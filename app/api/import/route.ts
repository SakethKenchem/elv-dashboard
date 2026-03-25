/* Module: Workbook import API that parses sheets, deduplicates rows, and upserts sales + manager plan data. */
import { NextRequest, NextResponse } from "next/server"
import * as XLSX from "xlsx"
import { prisma } from "@/lib/prisma"
import { getCurrentUserId } from "@/lib/current-user"
import {
    MONTHS,
    normalizeMonth,
    normalizeQuarter,
    quarterMonths,
    sanitizeName,
    toMonthMap,
} from "@/lib/sales-manager-metrics"

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

type SalesManagerPlanInput = {
    name: string
    region: string
    vendor: string
    yearTarget: number
    quarterTarget: number
    monthTarget: number
    selectedQuarter: 1 | 2 | 3 | 4
    monthlyTargets: Record<string, number>
    monthlyAchieved: Record<string, number>
    commitMonth: string | null
    commitAmount: number
}

function quarterFromMonth(month: string): 1 | 2 | 3 | 4 {
    // Infer quarter from the first month label found in the imported sheet.
    const normalized = normalizeMonth(month)
    const index = MONTHS.indexOf(normalized)
    if (index < 3) return 1
    if (index < 6) return 2
    if (index < 9) return 3
    return 4
}

function mergePlan(base: SalesManagerPlanInput, override: SalesManagerPlanInput): SalesManagerPlanInput {
    // Uploaded explicit plan data should override derived plan fields when present,
    // while still preserving non-zero month values already accumulated.
    const mergedTargets = toMonthMap(base.monthlyTargets)
    const mergedAchieved = toMonthMap(base.monthlyAchieved)
    const overrideTargets = toMonthMap(override.monthlyTargets)
    const overrideAchieved = toMonthMap(override.monthlyAchieved)

    for (const month of MONTHS) {
        if (Number(overrideTargets[month] ?? 0) !== 0) {
            mergedTargets[month] = Number(overrideTargets[month] ?? 0)
        }
        if (Number(overrideAchieved[month] ?? 0) !== 0) {
            mergedAchieved[month] = Number(overrideAchieved[month] ?? 0)
        }
    }

    return {
        ...base,
        ...override,
        region: override.region || base.region,
        vendor: override.vendor || base.vendor,
        yearTarget: Number(override.yearTarget || base.yearTarget),
        quarterTarget: Number(override.quarterTarget || base.quarterTarget),
        monthTarget: Number(override.monthTarget || base.monthTarget),
        selectedQuarter: normalizeQuarter(override.selectedQuarter || base.selectedQuarter),
        commitMonth: override.commitMonth || base.commitMonth,
        commitAmount: Number(override.commitAmount || base.commitAmount),
        monthlyTargets: mergedTargets,
        monthlyAchieved: mergedAchieved,
    }
}

function deriveSalesManagerPlans(records: SalesRecordInput[]): SalesManagerPlanInput[] {
    // Build manager-level plans from transaction rows so manager hub is populated
    // even when workbook has only a Master sheet.
    const plans = new Map<string, SalesManagerPlanInput>()

    for (const record of records) {
        const name = sanitizeName(record.salesManager)
        if (!name) {
            continue
        }

        const existing = plans.get(name)
        const selectedQuarter = quarterFromMonth(record.month1Name)
        const monthsInQuarter = quarterMonths(selectedQuarter)
        const month1 = normalizeMonth(record.month1Name)
        const month2 = normalizeMonth(record.month2Name)
        const month3 = normalizeMonth(record.month3Name)

        const monthlyTargets = existing ? toMonthMap(existing.monthlyTargets) : toMonthMap({})
        const monthlyAchieved = existing ? toMonthMap(existing.monthlyAchieved) : toMonthMap({})

        const perMonthTarget = Number(record.monthTarget ?? 0)
        monthlyTargets[month1] += perMonthTarget
        monthlyTargets[month2] += perMonthTarget
        monthlyTargets[month3] += perMonthTarget

        monthlyAchieved[month1] += Number(record.jan ?? 0)
        monthlyAchieved[month2] += Number(record.feb ?? 0)
        monthlyAchieved[month3] += Number(record.mar ?? 0)

        plans.set(name, {
            name,
            region: sanitizeName(record.region) || existing?.region || "",
            vendor: sanitizeName(record.vendor) || existing?.vendor || "",
            yearTarget: Number(existing?.yearTarget ?? 0) + Number(record.yearTarget ?? 0),
            quarterTarget: Number(existing?.quarterTarget ?? 0) + Number(record.quarterTarget ?? 0),
            monthTarget: Number(existing?.monthTarget ?? 0) + Number(record.monthTarget ?? 0),
            selectedQuarter,
            monthlyTargets,
            monthlyAchieved,
            commitMonth: normalizeMonth(record.commitMonth),
            commitAmount: Number(existing?.commitAmount ?? 0) + Number(record.commitMar ?? 0),
        })

        // Keep selected quarter aligned with row data whenever possible.
        if (plans.get(name)) {
            plans.get(name)!.selectedQuarter = normalizeQuarter(selectedQuarter)
            // Keep quarter-target month keys hydrated in case month headers are abbreviated.
            for (const month of monthsInQuarter) {
                plans.get(name)!.monthlyTargets[month] += 0
                plans.get(name)!.monthlyAchieved[month] += 0
            }
        }
    }

    return Array.from(plans.values())
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
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .replace(/\s+/g, " ")
}

function getCellValue(row: JsonRow, aliases: string[]): unknown {
    // Header matching is alias-based to tolerate user-edited workbook labels.
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
    // Prefer headers positioned between MON TGT and Total Achieved;
    // fallback to JAN/FEB/MAR aliases if order cannot be detected.
    const headers = Object.keys(row)
    const monthTargetIndex = findHeaderIndex(headers, ["MON TGT", "Month Target", "Monthly Target"])
    const totalAchievedIndex = findHeaderIndex(headers, ["Total Achieved", "TotalAchieved", "Total Achvd"])

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
    const commitHeader = getCellKey(row, ["Commit - MAR", "Commit MAR", "Commit", "Commitment"])
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
    // Stable key used for both within-upload and against-DB deduplication.
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

function detectSalesManagerPlanSheet(workbook: XLSX.WorkBook): string | null {
    const exact = workbook.SheetNames.find((name) => normalizeKey(name) === "sales manager plans")
    if (exact) {
        return exact
    }

    const fallback = workbook.SheetNames.find((name) => normalizeKey(name).includes("sales manager"))
    return fallback ?? null
}

function parseSalesManagerPlans(rows: JsonRow[]): SalesManagerPlanInput[] {
    const parsed: SalesManagerPlanInput[] = []

    for (const row of rows) {
        const name = sanitizeName(
            getCellValue(row, [
                "Name",
                "Sales Manager",
                "SalesManager",
                "Sales Manager Name",
                "Manager",
                "CAM",
                "C A M",
                "Account Manager",
            ])
        )
        if (!name) {
            continue
        }

        const monthlyTargets = toMonthMap({})
        const monthlyAchieved = toMonthMap({})

        for (const month of MONTHS) {
            monthlyTargets[month] = parseNumber(getCellValue(row, [`Target ${month}`, `${month} Target`]))
            monthlyAchieved[month] = parseNumber(getCellValue(row, [`Achieved ${month}`, `${month} Achieved`]))
        }

        parsed.push({
            name,
            region: sanitizeName(getCellValue(row, ["Region"])),
            vendor: sanitizeName(getCellValue(row, ["Vendor"])),
            yearTarget: parseNumber(getCellValue(row, ["Yearly Target", "YR TGT"])),
            quarterTarget: parseNumber(getCellValue(row, ["Quarterly Target", "QTR TGT"])),
            monthTarget: parseNumber(getCellValue(row, ["Monthly Target", "MON TGT"])),
            selectedQuarter: normalizeQuarter(getCellValue(row, ["Quarter", "Selected Quarter"])),
            monthlyTargets,
            monthlyAchieved,
            commitMonth: sanitizeName(getCellValue(row, ["Commit Month", "Commit"]))
                ? normalizeMonth(getCellValue(row, ["Commit Month", "Commit"]))
                : null,
            commitAmount: parseNumber(getCellValue(row, ["Commit Amount", "Commitment Amount"])),
        })
    }

    return parsed
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

        const salesManagerPlanSheetName = detectSalesManagerPlanSheet(workbook)
        const salesManagerPlanRows = salesManagerPlanSheetName
            ? XLSX.utils.sheet_to_json<JsonRow>(workbook.Sheets[salesManagerPlanSheetName], {
                defval: null,
                raw: true,
            })
            : []

        const salesManagerPlans = parseSalesManagerPlans(salesManagerPlanRows)

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

        // Convert loose sheet rows into normalized records and drop invalid rows.
        const mappedRecords = rows
            .map((row): SalesRecordInput | null => {
                const region = parseText(getCellValue(row, ["Region"]))
                const salesManager = parseText(
                    getCellValue(row, [
                        "Sales Manager",
                        "SalesManager",
                        "Sales Managers",
                        "Manager",
                        "CAM",
                        "C A M",
                        "Account Manager",
                        "Customer Account Manager",
                    ])
                )
                const vendor = parseText(getCellValue(row, ["Vendor", "Vendors", "Supplier"]))
                const commitHeaderKey =
                    getCellKey(row, ["Commit - MAR", "Commit MAR", "Commit", "Commitment"]) ??
                    Object.keys(row).find((key) => normalizeKey(key).startsWith("commit")) ??
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
                    totalAchieved: parseNumber(getCellValue(row, ["Total Achieved", "TotalAchieved", "Total Achvd"])),
                    commitMonth: detectCommitMonth(row, month3Name),
                    commitMar: parseNumber(commitHeaderKey ? row[commitHeaderKey] : null),
                    percentQ1: parseNumber(getCellValue(row, ["%Achvd Q1", "% Achvd Q1", "Percent Q1"])),
                    balanceQ1: parseNumber(getCellValue(row, ["Bal to Achv Q1", "Balance Q1"])),
                }
            })
            .filter((record): record is SalesRecordInput => record !== null)

        if (mappedRecords.length === 0) {
            return NextResponse.json(
                {
                    error: "No valid rows found in uploaded sheet",
                    details:
                        "Required columns include Region, CAM or Sales Manager, Vendor, YR TGT, QTR TGT, MON TGT, month achieved columns, and commit/coverage columns.",
                },
                { status: 400 }
            )
        }

        // First dedupe pass: remove duplicates inside the same uploaded file.
        const uploadUniqueMap = new Map<string, SalesRecordInput>()
        for (const record of mappedRecords) {
            const key = buildRecordKey(record)
            if (!uploadUniqueMap.has(key)) {
                uploadUniqueMap.set(key, record)
            }
        }

        const uploadUniqueRecords = Array.from(uploadUniqueMap.values())

        // Second dedupe pass: avoid inserting rows that already exist for this owner.
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

        const uniqueRegions = [...new Set(mappedRecords.map((record) => sanitizeName(record.region)).filter(Boolean))]
        const uniqueVendors = [...new Set(mappedRecords.map((record) => sanitizeName(record.vendor)).filter(Boolean))]
        const derivedSalesManagerPlans = deriveSalesManagerPlans(uploadUniqueRecords)

        // Merge derived plans with explicit Sales Manager Plan sheet rows.
        // Explicit sheet data has precedence for overlapping manager entries.
        const mergedPlansMap = new Map<string, SalesManagerPlanInput>()
        for (const derived of derivedSalesManagerPlans) {
            mergedPlansMap.set(derived.name, derived)
        }
        for (const uploadedPlan of salesManagerPlans) {
            const current = mergedPlansMap.get(uploadedPlan.name)
            mergedPlansMap.set(
                uploadedPlan.name,
                current ? mergePlan(current, uploadedPlan) : uploadedPlan
            )
        }
        const plansToUpsert = Array.from(mergedPlansMap.values())

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
            ...uniqueVendors.map((name) =>
                prisma.vendor.upsert({
                    where: { ownerId_name: { ownerId, name } },
                    update: {},
                    create: { ownerId, name },
                })
            ),
            ...plansToUpsert.map((plan) =>
                prisma.salesManager.upsert({
                    where: { ownerId_name: { ownerId, name: plan.name } },
                    update: {
                        region: plan.region || null,
                        vendor: plan.vendor || null,
                        yearTarget: plan.yearTarget,
                        quarterTarget: plan.quarterTarget,
                        monthTarget: plan.monthTarget,
                        selectedQuarter: plan.selectedQuarter,
                        monthlyTargets: plan.monthlyTargets,
                        monthlyAchieved: plan.monthlyAchieved,
                        commitMonth: plan.commitMonth,
                        commitAmount: plan.commitAmount,
                    },
                    create: {
                        ownerId,
                        name: plan.name,
                        region: plan.region || null,
                        vendor: plan.vendor || null,
                        yearTarget: plan.yearTarget,
                        quarterTarget: plan.quarterTarget,
                        monthTarget: plan.monthTarget,
                        selectedQuarter: plan.selectedQuarter,
                        monthlyTargets: plan.monthlyTargets,
                        monthlyAchieved: plan.monthlyAchieved,
                        commitMonth: plan.commitMonth,
                        commitAmount: plan.commitAmount,
                    },
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
            importedSalesManagerPlans: plansToUpsert.length,
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

