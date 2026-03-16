import { NextRequest, NextResponse } from "next/server"
import * as XLSX from "xlsx"
import { prisma } from "@/lib/prisma"
import { getCurrentUserId } from "@/lib/current-user"

export const runtime = "nodejs"

type JsonRow = Record<string, unknown>
type SalesRecordInput = {
    region: string
    salesManager: string
    vendor: string
    yearTarget: number
    quarterTarget: number
    monthTarget: number
    month1Name: string
    month2Name: string
    month3Name: string
    jan: number
    feb: number
    mar: number
    totalAchieved: number
    commitMonth: string
    commitMar: number
    percentQ1: number
    balanceQ1: number
}

function parseNumber(value: unknown): number {
    if (typeof value === "number") {
        return Number.isFinite(value) ? value : 0
    }

    if (typeof value !== "string") {
        return 0
    }

    const normalized = value.replace(/[$,%\s,]/g, "")
    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : 0
}

function parseText(value: unknown): string {
    if (value === null || value === undefined) {
        return ""
    }

    return String(value).trim()
}

function normalizeKey(value: string): string {
    return value.trim().toLowerCase().replace(/\s+/g, " ")
}

function getCellValue(row: JsonRow, aliases: string[]): unknown {
    const normalizedAliases = aliases.map(normalizeKey)

    for (const [key, value] of Object.entries(row)) {
        if (normalizedAliases.includes(normalizeKey(key))) {
            return value
        }
    }

    return null
}

function getCellKey(row: JsonRow, aliases: string[]): string | null {
    const normalizedAliases = aliases.map(normalizeKey)

    for (const key of Object.keys(row)) {
        if (normalizedAliases.includes(normalizeKey(key))) {
            return key
        }
    }

    return null
}

function findHeaderIndex(headers: string[], aliases: string[]): number {
    const normalizedAliases = aliases.map(normalizeKey)
    return headers.findIndex((header) => normalizedAliases.includes(normalizeKey(header)))
}

function detectMonthHeaders(row: JsonRow): [string, string, string] {
    const headers = Object.keys(row)
    const monthTargetIndex = findHeaderIndex(headers, ["MON TGT", "Month Target"])
    const totalAchievedIndex = findHeaderIndex(headers, ["Total Achieved", "TotalAchieved"])

    if (monthTargetIndex !== -1 && totalAchievedIndex > monthTargetIndex + 1) {
        const between = headers.slice(monthTargetIndex + 1, totalAchievedIndex).filter((value) => normalizeKey(value) !== "")
        if (between.length >= 3) {
            return [between[0], between[1], between[2]]
        }
    }

    return [
        getCellKey(row, ["JAN", "January"]) ?? "JAN",
        getCellKey(row, ["FEB", "February"]) ?? "FEB",
        getCellKey(row, ["MAR", "March"]) ?? "MAR",
    ]
}

function normalizeMonthLabel(value: string): string {
    return parseText(value).toUpperCase() || "MONTH"
}

function detectCommitMonth(row: JsonRow, fallback: string): string {
    const commitHeader = getCellKey(row, ["Commit - MAR", "Commit MAR", "Commit"])
    if (!commitHeader) {
        return fallback
    }

    const explicit = /commit\s*-\s*(.+)$/i.exec(commitHeader)
    if (explicit?.[1]) {
        return normalizeMonthLabel(explicit[1])
    }

    return fallback
}

function buildRecordKey(record: SalesRecordInput): string {
    return [
        normalizeKey(record.region),
        normalizeKey(record.salesManager),
        normalizeKey(record.vendor),
        record.yearTarget,
        record.quarterTarget,
        record.monthTarget,
        normalizeKey(record.month1Name),
        normalizeKey(record.month2Name),
        normalizeKey(record.month3Name),
        record.jan,
        record.feb,
        record.mar,
        record.totalAchieved,
        normalizeKey(record.commitMonth),
        record.commitMar,
        record.percentQ1,
        record.balanceQ1,
    ].join("|")
}

export async function POST(req: NextRequest) {

    try {
        const ownerId = await getCurrentUserId()
        if (!ownerId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const data = await req.formData()
        const file = data.get("file")

        if (!(file instanceof File)) {
            return NextResponse.json({ error: "No file uploaded" }, { status: 400 })
        }

        const bytes = await file.arrayBuffer()
        const workbook = XLSX.read(bytes, { type: "array" })
        const masterSheetName = workbook.SheetNames.find(
            (name) => normalizeKey(name) === "master"
        )

        const selectedSheetName = masterSheetName ?? workbook.SheetNames[0]

        if (!selectedSheetName) {
            return NextResponse.json(
                { error: "The workbook has no sheets" },
                { status: 400 }
            )
        }

        const sheet = workbook.Sheets[selectedSheetName]
        const rows = XLSX.utils.sheet_to_json<JsonRow>(sheet, {
            defval: null,
            raw: true,
        })

        if (rows.length === 0) {
            return NextResponse.json(
                { error: "The selected sheet is empty" },
                { status: 400 }
            )
        }

        const [month1Header, month2Header, month3Header] = detectMonthHeaders(rows[0])
        const month1Name = normalizeMonthLabel(month1Header)
        const month2Name = normalizeMonthLabel(month2Header)
        const month3Name = normalizeMonthLabel(month3Header)

        const mappedRecords = rows
            .map((row): SalesRecordInput | null => {
                const region = parseText(getCellValue(row, ["Region"]))
                const salesManager = parseText(getCellValue(row, ["Sales Manager", "SalesManager"]))
                const vendor = parseText(getCellValue(row, ["Vendor"]))
                const commitHeaderKey =
                    getCellKey(row, ["Commit - MAR", "Commit MAR", "Commit"]) ??
                    Object.keys(row).find((key) => normalizeKey(key).startsWith("commit -")) ??
                    null

                if (!region || !salesManager || !vendor) {
                    return null
                }

                return {
                    region,
                    salesManager,
                    vendor,
                    yearTarget: parseNumber(getCellValue(row, ["YR TGT", "Year Target"])),
                    quarterTarget: parseNumber(getCellValue(row, ["QTR TGT", "Quarter Target"])),
                    monthTarget: parseNumber(getCellValue(row, ["MON TGT", "Month Target"])),
                    month1Name,
                    month2Name,
                    month3Name,
                    jan: parseNumber(row[month1Header]),
                    feb: parseNumber(row[month2Header]),
                    mar: parseNumber(row[month3Header]),
                    totalAchieved: parseNumber(getCellValue(row, ["Total Achieved", "TotalAchieved"])),
                    commitMonth: detectCommitMonth(row, month3Name),
                    commitMar: parseNumber(commitHeaderKey ? row[commitHeaderKey] : null),
                    percentQ1: parseNumber(getCellValue(row, ["%Achvd Q1", "% Achvd Q1", "Percent Q1"])),
                    balanceQ1: parseNumber(getCellValue(row, ["Bal to Achv Q1", "Balance Q1"])),
                }
            })
            .filter((record): record is SalesRecordInput => record !== null)

        const uploadUniqueMap = new Map<string, SalesRecordInput>()
        for (const record of mappedRecords) {
            const key = buildRecordKey(record)
            if (!uploadUniqueMap.has(key)) {
                uploadUniqueMap.set(key, record)
            }
        }

        const uploadUniqueRecords = Array.from(uploadUniqueMap.values())

        const existing = await prisma.salesData.findMany({
            where: { ownerId },
            select: {
                region: true,
                salesManager: true,
                vendor: true,
                yearTarget: true,
                quarterTarget: true,
                monthTarget: true,
                month1Name: true,
                month2Name: true,
                month3Name: true,
                jan: true,
                feb: true,
                mar: true,
                totalAchieved: true,
                commitMonth: true,
                commitMar: true,
                percentQ1: true,
                balanceQ1: true,
            },
        })

        const existingKeys = new Set(
            existing.map((row: (typeof existing)[number]) =>
                buildRecordKey({
                    region: row.region,
                    salesManager: row.salesManager,
                    vendor: row.vendor,
                    yearTarget: row.yearTarget,
                    quarterTarget: row.quarterTarget,
                    monthTarget: row.monthTarget,
                    month1Name: row.month1Name,
                    month2Name: row.month2Name,
                    month3Name: row.month3Name,
                    jan: Number(row.jan ?? 0),
                    feb: Number(row.feb ?? 0),
                    mar: Number(row.mar ?? 0),
                    totalAchieved: Number(row.totalAchieved ?? 0),
                    commitMonth: row.commitMonth,
                    commitMar: Number(row.commitMar ?? 0),
                    percentQ1: Number(row.percentQ1 ?? 0),
                    balanceQ1: Number(row.balanceQ1 ?? 0),
                })
            )
        )

        const records = uploadUniqueRecords.filter(
            (record) => !existingKeys.has(buildRecordKey(record))
        )

        const uniqueRegions = [...new Set(mappedRecords.map((record) => record.region))]
        const uniqueSalesManagers = [...new Set(mappedRecords.map((record) => record.salesManager))]
        const uniqueVendors = [...new Set(mappedRecords.map((record) => record.vendor))]

        const chunkSize = 500

        for (let i = 0; i < records.length; i += chunkSize) {
            const chunk = records.slice(i, i + chunkSize).map((record) => ({ ...record, ownerId }))
            await prisma.salesData.createMany({ data: chunk })
        }

        await Promise.all([
            ...uniqueRegions.map((name) =>
                prisma.region.upsert({
                    where: { ownerId_name: { ownerId, name } },
                    update: {},
                    create: { ownerId, name },
                })
            ),
            ...uniqueSalesManagers.map((name) =>
                prisma.salesManager.upsert({
                    where: { ownerId_name: { ownerId, name } },
                    update: {},
                    create: { ownerId, name },
                })
            ),
            ...uniqueVendors.map((name) =>
                prisma.vendor.upsert({
                    where: { ownerId_name: { ownerId, name } },
                    update: {},
                    create: { ownerId, name },
                })
            ),
        ])

        const skippedInvalid = rows.length - mappedRecords.length
        const skippedWithinUpload = mappedRecords.length - uploadUniqueRecords.length
        const skippedExisting = uploadUniqueRecords.length - records.length

        return NextResponse.json({
            success: true,
            imported: records.length,
            sheet: selectedSheetName,
            skippedInvalid,
            skippedWithinUpload,
            skippedExisting,
        })
    } catch (error) {
        console.error("/api/import failed", error)
        return NextResponse.json(
            {
                error: "Failed to import workbook",
                details: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
        )
    }
}
