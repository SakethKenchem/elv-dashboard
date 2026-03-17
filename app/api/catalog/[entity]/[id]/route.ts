/* Module: Generic catalog item API for updating and deleting a specific entity record by id. */
import { NextRequest, NextResponse } from "next/server"
import { isCatalogEntity } from "@/lib/catalog"
import { deleteCatalogItem, updateCatalogItem } from "@/lib/catalog-server"
import { getCurrentUserId } from "@/lib/current-user"

type RouteContext = {
    params: Promise<{ entity: string; id: string }>
}

function isUniqueConstraintError(error: unknown): boolean {
    return (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: string }).code === "P2002"
    )
}

export async function PATCH(request: NextRequest, context: RouteContext) {
    const { entity, id } = await context.params
    const userId = await getCurrentUserId()

    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!isCatalogEntity(entity)) {
        return NextResponse.json({ error: "Unknown catalog entity" }, { status: 404 })
    }

    const numericId = Number(id)
    if (!Number.isInteger(numericId)) {
        return NextResponse.json({ error: "Invalid item id" }, { status: 400 })
    }

    try {
        const body = await request.json()
        const item = await updateCatalogItem(entity, userId, numericId, String(body.name ?? ""))
        return NextResponse.json({ item })
    } catch (error) {
        if (isUniqueConstraintError(error)) {
            return NextResponse.json({ error: "An item with that name already exists" }, { status: 409 })
        }

        const message = error instanceof Error ? error.message : "Failed to update item"
        const status = message === "Item not found" ? 404 : 400
        return NextResponse.json({ error: message }, { status })
    }
}

export async function DELETE(_: NextRequest, context: RouteContext) {
    const { entity, id } = await context.params
    const userId = await getCurrentUserId()

    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!isCatalogEntity(entity)) {
        return NextResponse.json({ error: "Unknown catalog entity" }, { status: 404 })
    }

    const numericId = Number(id)
    if (!Number.isInteger(numericId)) {
        return NextResponse.json({ error: "Invalid item id" }, { status: 400 })
    }

    try {
        const result = await deleteCatalogItem(entity, userId, numericId)
        return NextResponse.json(result)
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to delete item"
        const status = message === "Item not found" ? 404 : 400
        return NextResponse.json({ error: message }, { status })
    }
}
