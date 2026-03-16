import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

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

async function syncCatalogs(payload: SalesPayload) {
    await Promise.all([
        prisma.region.upsert({ where: { name: payload.region }, update: {}, create: { name: payload.region } }),
        prisma.salesManager.upsert({ where: { name: payload.salesManager }, update: {}, create: { name: payload.salesManager } }),
        prisma.vendor.upsert({ where: { name: payload.vendor }, update: {}, create: { name: payload.vendor } }),
    ])
}

type RouteContext = {
    params: Promise<{ id: string }>
}

export async function PATCH(request: NextRequest, context: RouteContext) {
    const { id } = await context.params
    const numericId = Number(id)

    if (!Number.isInteger(numericId)) {
        return NextResponse.json({ error: "Invalid row id" }, { status: 400 })
    }

    try {
        const payload = parsePayload(await request.json())
        await syncCatalogs(payload)
        const row = await prisma.salesData.update({
            where: { id: numericId },
            data: payload,
        })
        return NextResponse.json({ row })
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to update row"
        return NextResponse.json({ error: message }, { status: 400 })
    }
}

export async function DELETE(_: NextRequest, context: RouteContext) {
    const { id } = await context.params
    const numericId = Number(id)

    if (!Number.isInteger(numericId)) {
        return NextResponse.json({ error: "Invalid row id" }, { status: 400 })
    }

    try {
        await prisma.salesData.delete({ where: { id: numericId } })
        return NextResponse.json({ success: true })
    } catch {
        return NextResponse.json({ error: "Failed to delete row" }, { status: 400 })
    }
}
