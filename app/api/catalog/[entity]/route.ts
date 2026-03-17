/* Module: Generic catalog collection API for listing and creating entity records (regions, vendors, sales managers). */
import { NextRequest, NextResponse } from "next/server"
import { isCatalogEntity } from "@/lib/catalog"
import { createCatalogItem, listCatalogItems } from "@/lib/catalog-server"
import { getCurrentUserId } from "@/lib/current-user"

type RouteContext = {
    params: Promise<{ entity: string }>
}

function isUniqueConstraintError(error: unknown): boolean {
    return (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: string }).code === "P2002"
    )
}

export async function GET(_: NextRequest, context: RouteContext) {
    const { entity } = await context.params
    const userId = await getCurrentUserId()

    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!isCatalogEntity(entity)) {
        return NextResponse.json({ error: "Unknown catalog entity" }, { status: 404 })
    }

    try {
        const items = await listCatalogItems(entity, userId)
        return NextResponse.json({ items })
    } catch (error) {
        console.error(`/api/catalog/${entity} failed`, error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to load catalog" },
            { status: 500 }
        )
    }
}

export async function POST(request: NextRequest, context: RouteContext) {
    const { entity } = await context.params
    const userId = await getCurrentUserId()

    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!isCatalogEntity(entity)) {
        return NextResponse.json({ error: "Unknown catalog entity" }, { status: 404 })
    }

    try {
        const body = await request.json()
        const item = await createCatalogItem(entity, userId, String(body.name ?? ""))
        return NextResponse.json({ item }, { status: 201 })
    } catch (error) {
        if (isUniqueConstraintError(error)) {
            return NextResponse.json({ error: "An item with that name already exists" }, { status: 409 })
        }

        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to create item" },
            { status: 400 }
        )
    }
}
