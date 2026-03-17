/* Module: API handlers for paginated sales row listing, creation, and bulk deletion. */
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUserId } from "@/lib/current-user"
import {
    computeSalesManagerMetrics,
    type MonthMap,
    normalizeMonth,
    normalizeQuarter,
    quarterMonths,
    sanitizeNumber,
    sanitizeName,
    toMonthMap,
} from "@/lib/sales-manager-metrics"

type SalesPayload = {
    region: string
    salesManager: string
    vendor: string
    yearTarget: number
    quarterTarget: number
    monthTarget: number
    selectedQuarter: 1 | 2 | 3 | 4
    monthlyTargets: MonthMap
    monthlyAchieved: MonthMap
    commitMonth: string
    commitAmount: number
}

type SortField = "region" | "salesManager" | "vendor" | "quarterTarget" | "totalAchieved"
type SortDirection = "asc" | "desc"

function getSortField(value: string | null): SortField {
    const allowed: SortField[] = ["region", "salesManager", "vendor", "quarterTarget", "totalAchieved"]
    if (value && allowed.includes(value as SortField)) {
        return value as SortField
    }
    return "region"
}

function getSortDirection(value: string | null): SortDirection {
    return value === "desc" ? "desc" : "asc"
}

function parsePayload(input: unknown): SalesPayload {
    // Normalize incoming payload from UI/form into typed values used by DB logic.
    const body = (input ?? {}) as Record<string, unknown>
    const payload: SalesPayload = {
        region: sanitizeName(body.region),
        salesManager: sanitizeName(body.salesManager),
        vendor: sanitizeName(body.vendor),
        yearTarget: sanitizeNumber(body.yearTarget),
        quarterTarget: sanitizeNumber(body.quarterTarget),
        monthTarget: sanitizeNumber(body.monthTarget),
        selectedQuarter: normalizeQuarter(body.selectedQuarter),
        monthlyTargets: toMonthMap(body.monthlyTargets),
        monthlyAchieved: toMonthMap(body.monthlyAchieved),
        commitMonth: normalizeMonth(body.commitMonth),
        commitAmount: sanitizeNumber(body.commitAmount),
    }

    if (!payload.region || !payload.salesManager || !payload.vendor) {
        throw new Error("Region, sales manager, and vendor are required")
    }

    return payload
}

function buildPersistenceData(payload: SalesPayload) {
    // Keep both new JSON month maps and legacy flat month columns in sync.
    // This preserves compatibility with import/export sheets and older reads.
    const quarter = normalizeQuarter(payload.selectedQuarter)
    const quarterMonthNames = quarterMonths(quarter)
    const metrics = computeSalesManagerMetrics({
        selectedQuarter: quarter,
        quarterTarget: payload.quarterTarget,
        monthlyAchieved: payload.monthlyAchieved,
    })

    return {
        region: payload.region,
        salesManager: payload.salesManager,
        vendor: payload.vendor,
        yearTarget: payload.yearTarget,
        quarterTarget: payload.quarterTarget,
        monthTarget: payload.monthTarget,
        selectedQuarter: quarter,
        monthlyTargets: payload.monthlyTargets,
        monthlyAchieved: payload.monthlyAchieved,
        month1Name: quarterMonthNames[0],
        month2Name: quarterMonthNames[1],
        month3Name: quarterMonthNames[2],
        jan: payload.monthlyAchieved[quarterMonthNames[0]] ?? 0,
        feb: payload.monthlyAchieved[quarterMonthNames[1]] ?? 0,
        mar: payload.monthlyAchieved[quarterMonthNames[2]] ?? 0,
        totalAchieved: metrics.totalAchieved,
        commitMonth: payload.commitMonth,
        commitMar: payload.commitAmount,
        commitAmount: payload.commitAmount,
        percentQ1: metrics.percentageAchieved,
        balanceQ1: metrics.balanceToQuarterTarget,
    }
}

function buildMonthlyAchievedMap(row: {
    monthlyAchieved: unknown
    month1Name: string
    month2Name: string
    month3Name: string
    jan: number | null
    feb: number | null
    mar: number | null
}): MonthMap {
    // Prefer JSON month map; if absent, reconstruct from legacy month1/2/3 + jan/feb/mar fields.
    const monthlyAchieved = toMonthMap(row.monthlyAchieved)
    const fallbackValues = [
        { name: normalizeMonth(row.month1Name), value: Number(row.jan ?? 0) },
        { name: normalizeMonth(row.month2Name), value: Number(row.feb ?? 0) },
        { name: normalizeMonth(row.month3Name), value: Number(row.mar ?? 0) },
    ]

    const hasStoredValues = Object.values(monthlyAchieved).some((value) => Number(value ?? 0) !== 0)
    if (!hasStoredValues) {
        for (const item of fallbackValues) {
            monthlyAchieved[item.name] = item.value
        }
    }

    return monthlyAchieved
}

async function syncCatalogs(ownerId: number, payload: SalesPayload) {
    await Promise.all([
        prisma.region.upsert({
            where: { ownerId_name: { ownerId, name: payload.region } },
            update: {},
            create: { ownerId, name: payload.region },
        }),
        prisma.salesManager.upsert({
            where: { ownerId_name: { ownerId, name: payload.salesManager } },
            update: {},
            create: { ownerId, name: payload.salesManager },
        }),
        prisma.vendor.upsert({
            where: { ownerId_name: { ownerId, name: payload.vendor } },
            update: {},
            create: { ownerId, name: payload.vendor },
        }),
    ])
}

export async function GET(request: NextRequest) {
    const ownerId = await getCurrentUserId()
    if (!ownerId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const region = searchParams.get("region")?.trim()
    const salesManager = searchParams.get("salesManager")?.trim()
    const vendor = searchParams.get("vendor")?.trim()
    const query = searchParams.get("q")?.trim()
    const page = Math.max(Number(searchParams.get("page") ?? "1") || 1, 1)
    const pageSize = Math.min(Math.max(Number(searchParams.get("pageSize") ?? "12") || 12, 1), 100)
    const sortBy = getSortField(searchParams.get("sortBy"))
    const sortDir = getSortDirection(searchParams.get("sortDir"))

    const where = {
        ownerId,
        ...(region ? { region } : {}),
        ...(salesManager ? { salesManager } : {}),
        ...(vendor ? { vendor } : {}),
        ...(query ? {
            OR: [
                { region: { contains: query, mode: "insensitive" as const } },
                { salesManager: { contains: query, mode: "insensitive" as const } },
                { vendor: { contains: query, mode: "insensitive" as const } },
            ],
        } : {}),
    }

    // Query page rows + totals in parallel for responsive table rendering.
    const [rows, totalCount, aggregate] = await Promise.all([
        prisma.salesData.findMany({
            where,
            orderBy: [
                { [sortBy]: sortDir },
                { id: "asc" },
            ],
            skip: (page - 1) * pageSize,
            take: pageSize,
        }),
        prisma.salesData.count({ where }),
        prisma.salesData.aggregate({
            where,
            _sum: {
                quarterTarget: true,
                totalAchieved: true,
            },
        }),
    ])

    // Attach derived row KPIs used by cards/tables without re-computing on the client.
    const rowsWithMetrics = rows.map((row) => {
        const monthlyAchieved = buildMonthlyAchievedMap(row)
        const metrics = computeSalesManagerMetrics({
            selectedQuarter: normalizeQuarter(row.selectedQuarter),
            quarterTarget: Number(row.quarterTarget ?? 0),
            monthlyAchieved,
        })

        return {
            ...row,
            monthlyAchieved,
            quarterAchieved: metrics.quarterAchieved,
            percentageAchieved: metrics.percentageAchieved,
            balanceToQuarterTarget: metrics.balanceToQuarterTarget,
        }
    })

    const totalQuarterAchieved = rowsWithMetrics.reduce(
        (sum, row) => sum + Number(row.quarterAchieved ?? 0),
        0
    )

    return NextResponse.json({
        rows: rowsWithMetrics,
        pagination: {
            page,
            pageSize,
            totalCount,
            totalPages: Math.max(Math.ceil(totalCount / pageSize), 1),
        },
        summary: {
            totalTarget: Number(aggregate._sum.quarterTarget ?? 0),
            totalAchieved: Number(aggregate._sum.totalAchieved ?? 0),
            totalQuarterAchieved,
        },
        sorting: {
            sortBy,
            sortDir,
        },
    })
}

export async function POST(request: NextRequest) {
    try {
        const ownerId = await getCurrentUserId()
        if (!ownerId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const payload = parsePayload(await request.json())
        await syncCatalogs(ownerId, payload)
        const row = await prisma.salesData.create({ data: { ...buildPersistenceData(payload), ownerId } })
        return NextResponse.json({ row }, { status: 201 })
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to create row" },
            { status: 400 }
        )
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const ownerId = await getCurrentUserId()
        if (!ownerId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const body = (await request.json()) as { ids?: number[] }
        const ids = Array.isArray(body.ids) ? body.ids.filter((id) => Number.isInteger(id)) : []

        if (ids.length === 0) {
            return NextResponse.json({ error: "No row ids provided" }, { status: 400 })
        }

        const result = await prisma.salesData.deleteMany({
            where: { ownerId, id: { in: ids } },
        })

        return NextResponse.json({ deleted: result.count })
    } catch {
        return NextResponse.json({ error: "Failed to delete selected rows" }, { status: 400 })
    }
}

