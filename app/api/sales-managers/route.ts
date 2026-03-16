import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUserId } from "@/lib/current-user"
import {
    MONTHS,
    computeSalesManagerMetrics,
    normalizeMonth,
    normalizeQuarter,
    sanitizeName,
    sanitizeNumber,
    toMonthMap,
} from "@/lib/sales-manager-metrics"

type SalesManagerPayload = {
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

function parsePayload(input: unknown): SalesManagerPayload {
    const body = (input ?? {}) as Record<string, unknown>
    const name = sanitizeName(body.name)

    if (!name) {
        throw new Error("Sales manager name is required")
    }

    const selectedQuarter = normalizeQuarter(body.selectedQuarter)
    const monthlyTargets = toMonthMap(body.monthlyTargets)
    const monthlyAchieved = toMonthMap(body.monthlyAchieved)

    return {
        name,
        region: sanitizeName(body.region),
        vendor: sanitizeName(body.vendor),
        yearTarget: sanitizeNumber(body.yearTarget),
        quarterTarget: sanitizeNumber(body.quarterTarget),
        monthTarget: sanitizeNumber(body.monthTarget),
        selectedQuarter,
        monthlyTargets,
        monthlyAchieved,
        commitMonth: body.commitMonth ? normalizeMonth(body.commitMonth) : null,
        commitAmount: sanitizeNumber(body.commitAmount),
    }
}

async function syncManagersFromSalesData(ownerId: number) {
    const rows = await prisma.salesData.findMany({
        where: { ownerId },
        select: { salesManager: true, region: true, vendor: true },
        orderBy: { id: "asc" },
    })

    const firstSeen = new Map<string, { region: string; vendor: string }>()
    for (const row of rows) {
        const name = sanitizeName(row.salesManager)
        if (!name || firstSeen.has(name)) {
            continue
        }

        firstSeen.set(name, {
            region: sanitizeName(row.region),
            vendor: sanitizeName(row.vendor),
        })
    }

    await Promise.all(
        Array.from(firstSeen.entries()).map(([name, meta]) =>
            prisma.salesManager.upsert({
                where: { ownerId_name: { ownerId, name } },
                update: {
                    region: meta.region || undefined,
                    vendor: meta.vendor || undefined,
                },
                create: {
                    ownerId,
                    name,
                    region: meta.region || null,
                    vendor: meta.vendor || null,
                },
            })
        )
    )
}

export async function GET() {
    try {
        const ownerId = await getCurrentUserId()
        if (!ownerId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        try {
            await syncManagersFromSalesData(ownerId)
        } catch (syncError) {
            console.warn("sales-managers sync from sales-data failed; continuing with existing plan rows", syncError)
        }

        const [items, usageRows] = await Promise.all([
            prisma.salesManager.findMany({
                where: { ownerId },
                orderBy: { name: "asc" },
            }),
            prisma.salesData.groupBy({
                by: ["salesManager"],
                where: { ownerId },
                _count: { _all: true },
            }),
        ])

        const usageMap = new Map(usageRows.map((row) => [row.salesManager, row._count._all]))

        const hydrated = items.map((item) => {
            const monthlyTargets = toMonthMap(item.monthlyTargets)
            const monthlyAchieved = toMonthMap(item.monthlyAchieved)
            const metrics = computeSalesManagerMetrics({
                selectedQuarter: item.selectedQuarter,
                quarterTarget: item.quarterTarget,
                monthlyAchieved,
            })

            return {
                id: item.id,
                name: item.name,
                region: item.region,
                vendor: item.vendor,
                yearTarget: item.yearTarget,
                quarterTarget: item.quarterTarget,
                monthTarget: item.monthTarget,
                selectedQuarter: item.selectedQuarter,
                monthlyTargets,
                monthlyAchieved,
                commitMonth: item.commitMonth,
                commitAmount: item.commitAmount ?? 0,
                usageCount: usageMap.get(item.name) ?? 0,
                quarterAchieved: metrics.quarterAchieved,
                totalAchieved: metrics.totalAchieved,
                percentageAchieved: metrics.percentageAchieved,
                balanceToQuarterTarget: metrics.balanceToQuarterTarget,
                months: MONTHS,
            }
        })

        return NextResponse.json({ items: hydrated })
    } catch (error) {
        console.error("GET /api/sales-managers failed", error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to load sales managers" },
            { status: 500 }
        )
    }
}

export async function POST(request: NextRequest) {
    const ownerId = await getCurrentUserId()
    if (!ownerId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    try {
        const payload = parsePayload(await request.json())
        const row = await prisma.salesManager.create({
            data: {
                ownerId,
                name: payload.name,
                region: payload.region || null,
                vendor: payload.vendor || null,
                yearTarget: payload.yearTarget,
                quarterTarget: payload.quarterTarget,
                monthTarget: payload.monthTarget,
                selectedQuarter: payload.selectedQuarter,
                monthlyTargets: payload.monthlyTargets,
                monthlyAchieved: payload.monthlyAchieved,
                commitMonth: payload.commitMonth,
                commitAmount: payload.commitAmount,
            },
        })

        return NextResponse.json({ item: row }, { status: 201 })
    } catch (error) {
        const isUniqueViolation =
            typeof error === "object" &&
            error !== null &&
            "code" in error &&
            (error as { code?: string }).code === "P2002"

        if (isUniqueViolation) {
            return NextResponse.json({ error: "Sales manager already exists" }, { status: 409 })
        }

        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to create sales manager" },
            { status: 400 }
        )
    }
}
