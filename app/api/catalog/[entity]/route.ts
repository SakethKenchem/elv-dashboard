import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@/app/generated/prisma/client"
import { isCatalogEntity } from "@/lib/catalog"
import { createCatalogItem, listCatalogItems } from "@/lib/catalog-server"

type RouteContext = {
    params: Promise<{ entity: string }>
}

export async function GET(_: NextRequest, context: RouteContext) {
    const { entity } = await context.params

    if (!isCatalogEntity(entity)) {
        return NextResponse.json({ error: "Unknown catalog entity" }, { status: 404 })
    }

    const items = await listCatalogItems(entity)
    return NextResponse.json({ items })
}

export async function POST(request: NextRequest, context: RouteContext) {
    const { entity } = await context.params

    if (!isCatalogEntity(entity)) {
        return NextResponse.json({ error: "Unknown catalog entity" }, { status: 404 })
    }

    try {
        const body = await request.json()
        const item = await createCatalogItem(entity, String(body.name ?? ""))
        return NextResponse.json({ item }, { status: 201 })
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            return NextResponse.json({ error: "An item with that name already exists" }, { status: 409 })
        }

        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to create item" },
            { status: 400 }
        )
    }
}
