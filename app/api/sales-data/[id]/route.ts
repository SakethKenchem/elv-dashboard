/* Module: Sales row item API for patching/deleting a specific record while preserving catalog consistency. */
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUserId } from "@/lib/current-user"
import {
    computeSalesManagerMetrics,
    type MonthMap,
    normalizeMonth,
    normalizeQuarter,
    quarterMonths,
    sanitizeName,
    sanitizeNumber,
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

function parsePayload(input: unknown): SalesPayload {
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

type RouteContext = {
    params: Promise<{ id: string }>
}

export async function PATCH(request: NextRequest, context: RouteContext) {
    const ownerId = await getCurrentUserId()
    if (!ownerId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await context.params
    const numericId = Number(id)

    if (!Number.isInteger(numericId)) {
        return NextResponse.json({ error: "Invalid row id" }, { status: 400 })
    }

    try {
        const payload = parsePayload(await request.json())
        await syncCatalogs(ownerId, payload)
        const row = await prisma.salesData.update({
            where: { id: numericId, ownerId },
            data: buildPersistenceData(payload),
        })
        return NextResponse.json({ row })
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to update row"
        return NextResponse.json({ error: message }, { status: 400 })
    }
}

export async function DELETE(_: NextRequest, context: RouteContext) {
    const ownerId = await getCurrentUserId()
    if (!ownerId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await context.params
    const numericId = Number(id)

    if (!Number.isInteger(numericId)) {
        return NextResponse.json({ error: "Invalid row id" }, { status: 400 })
    }

    try {
        const result = await prisma.salesData.deleteMany({ where: { id: numericId, ownerId } })
        if (result.count === 0) {
            return NextResponse.json({ error: "Row not found" }, { status: 404 })
        }
        return NextResponse.json({ success: true })
    } catch {
        return NextResponse.json({ error: "Failed to delete row" }, { status: 400 })
    }
}
