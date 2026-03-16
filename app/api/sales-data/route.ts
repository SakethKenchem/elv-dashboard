import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUserId } from "@/lib/current-user"

type SalesPayload = {
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

function parseText(value: unknown): string {
    return String(value ?? "").trim()
}

function parseNumber(value: unknown): number {
    const parsed = Number(value ?? 0)
    return Number.isFinite(parsed) ? parsed : 0
}

function parsePayload(input: unknown): SalesPayload {
    const body = (input ?? {}) as Record<string, unknown>
    const payload: SalesPayload = {
        region: parseText(body.region),
        salesManager: parseText(body.salesManager),
        vendor: parseText(body.vendor),
        yearTarget: parseNumber(body.yearTarget),
        quarterTarget: parseNumber(body.quarterTarget),
        monthTarget: parseNumber(body.monthTarget),
        month1Name: parseText(body.month1Name) || "JAN",
        month2Name: parseText(body.month2Name) || "FEB",
        month3Name: parseText(body.month3Name) || "MAR",
        jan: parseNumber(body.jan),
        feb: parseNumber(body.feb),
        mar: parseNumber(body.mar),
        totalAchieved: parseNumber(body.totalAchieved),
        commitMonth: parseText(body.commitMonth) || "MAR",
        commitMar: parseNumber(body.commitMar),
        percentQ1: parseNumber(body.percentQ1),
        balanceQ1: parseNumber(body.balanceQ1),
    }

    if (!payload.region || !payload.salesManager || !payload.vendor) {
        throw new Error("Region, sales manager, and vendor are required")
    }

    return payload
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

    const [rows, totalCount, summary] = await Promise.all([
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

    return NextResponse.json({
        rows,
        pagination: {
            page,
            pageSize,
            totalCount,
            totalPages: Math.max(Math.ceil(totalCount / pageSize), 1),
        },
        summary: {
            totalTarget: Number(summary._sum.quarterTarget ?? 0),
            totalAchieved: Number(summary._sum.totalAchieved ?? 0),
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
        const row = await prisma.salesData.create({ data: { ...payload, ownerId } })
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
