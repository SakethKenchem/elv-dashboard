import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@/app/generated/prisma/client"
import { isCatalogEntity } from "@/lib/catalog"
import { deleteCatalogItem, updateCatalogItem } from "@/lib/catalog-server"

type RouteContext = {
    params: Promise<{ entity: string; id: string }>
}

export async function PATCH(request: NextRequest, context: RouteContext) {
    const { entity, id } = await context.params

    if (!isCatalogEntity(entity)) {
        return NextResponse.json({ error: "Unknown catalog entity" }, { status: 404 })
    }

    const numericId = Number(id)
    if (!Number.isInteger(numericId)) {
        return NextResponse.json({ error: "Invalid item id" }, { status: 400 })
    }

    try {
        const body = await request.json()
        const item = await updateCatalogItem(entity, numericId, String(body.name ?? ""))
        return NextResponse.json({ item })
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            return NextResponse.json({ error: "An item with that name already exists" }, { status: 409 })
        }

        const message = error instanceof Error ? error.message : "Failed to update item"
        const status = message === "Item not found" ? 404 : 400
        return NextResponse.json({ error: message }, { status })
    }
}

export async function DELETE(_: NextRequest, context: RouteContext) {
    const { entity, id } = await context.params

    if (!isCatalogEntity(entity)) {
        return NextResponse.json({ error: "Unknown catalog entity" }, { status: 404 })
    }

    const numericId = Number(id)
    if (!Number.isInteger(numericId)) {
        return NextResponse.json({ error: "Invalid item id" }, { status: 400 })
    }

    try {
        const result = await deleteCatalogItem(entity, numericId)
        return NextResponse.json(result)
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to delete item"
        const status = message === "Item not found" ? 404 : 400
        return NextResponse.json({ error: message }, { status })
    }
}
