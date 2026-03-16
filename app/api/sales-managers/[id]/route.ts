import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUserId } from "@/lib/current-user"
import { normalizeMonth, normalizeQuarter, sanitizeName, sanitizeNumber, toMonthMap } from "@/lib/sales-manager-metrics"

type RouteContext = {
    params: Promise<{ id: string }>
}

function parsePayload(input: unknown) {
    const body = (input ?? {}) as Record<string, unknown>
    const name = sanitizeName(body.name)

    if (!name) {
        throw new Error("Sales manager name is required")
    }

    return {
        name,
        region: sanitizeName(body.region),
        vendor: sanitizeName(body.vendor),
        yearTarget: sanitizeNumber(body.yearTarget),
        quarterTarget: sanitizeNumber(body.quarterTarget),
        monthTarget: sanitizeNumber(body.monthTarget),
        selectedQuarter: normalizeQuarter(body.selectedQuarter),
        monthlyTargets: toMonthMap(body.monthlyTargets),
        monthlyAchieved: toMonthMap(body.monthlyAchieved),
        commitMonth: body.commitMonth ? normalizeMonth(body.commitMonth) : null,
        commitAmount: sanitizeNumber(body.commitAmount),
    }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
    const ownerId = await getCurrentUserId()
    if (!ownerId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await context.params
    const numericId = Number(id)

    if (!Number.isInteger(numericId)) {
        return NextResponse.json({ error: "Invalid sales manager id" }, { status: 400 })
    }

    try {
        const payload = parsePayload(await request.json())
        const existing = await prisma.salesManager.findFirst({ where: { id: numericId, ownerId } })

        if (!existing) {
            return NextResponse.json({ error: "Sales manager not found" }, { status: 404 })
        }

        const row = await prisma.salesManager.update({
            where: { id: numericId },
            data: {
                ...payload,
                region: payload.region || null,
                vendor: payload.vendor || null,
            },
        })

        if (existing.name !== payload.name) {
            await prisma.salesData.updateMany({
                where: { ownerId, salesManager: existing.name },
                data: { salesManager: payload.name },
            })
        }

        return NextResponse.json({ item: row })
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
            { error: error instanceof Error ? error.message : "Failed to update sales manager" },
            { status: 400 }
        )
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
        return NextResponse.json({ error: "Invalid sales manager id" }, { status: 400 })
    }

    const existing = await prisma.salesManager.findFirst({ where: { id: numericId, ownerId } })
    if (!existing) {
        return NextResponse.json({ error: "Sales manager not found" }, { status: 404 })
    }

    const deletedSalesRows = await prisma.salesData.deleteMany({
        where: { ownerId, salesManager: existing.name },
    })

    await prisma.salesManager.delete({ where: { id: numericId } })

    return NextResponse.json({ deletedSalesRows: deletedSalesRows.count })
}
