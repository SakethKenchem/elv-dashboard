import { prisma } from "@/lib/prisma"
import { catalogConfig, type CatalogEntity } from "@/lib/catalog"

type CatalogItem = {
    id: number
    name: string
    usageCount: number
}

function sanitizeName(name: string): string {
    return name.trim()
}

function ensureName(name: string): string {
    const sanitized = sanitizeName(name)
    if (!sanitized) {
        throw new Error("Name is required")
    }
    return sanitized
}

async function getUsageMap(entity: CatalogEntity): Promise<Map<string, number>> {
    switch (entity) {
        case "regions": {
            const rows = await prisma.salesData.groupBy({
                by: ["region"],
                _count: { _all: true },
            })
            return new Map(rows.map((row: (typeof rows)[number]) => [row.region, row._count._all]))
        }
        case "sales-managers": {
            const rows = await prisma.salesData.groupBy({
                by: ["salesManager"],
                _count: { _all: true },
            })
            return new Map(rows.map((row: (typeof rows)[number]) => [row.salesManager, row._count._all]))
        }
        case "vendors": {
            const rows = await prisma.salesData.groupBy({
                by: ["vendor"],
                _count: { _all: true },
            })
            return new Map(rows.map((row: (typeof rows)[number]) => [row.vendor, row._count._all]))
        }
    }
}

async function syncCatalogFromSalesData(entity: CatalogEntity) {
    switch (entity) {
        case "regions": {
            const rows = await prisma.salesData.findMany({
                distinct: ["region"],
                select: { region: true },
            })
            await Promise.all(
                rows
                    .map((row: (typeof rows)[number]) => row.region.trim())
                    .filter(Boolean)
                    .map((name: string) =>
                        prisma.region.upsert({
                            where: { name },
                            update: {},
                            create: { name },
                        })
                    )
            )
            return
        }
        case "sales-managers": {
            const rows = await prisma.salesData.findMany({
                distinct: ["salesManager"],
                select: { salesManager: true },
            })
            await Promise.all(
                rows
                    .map((row: (typeof rows)[number]) => row.salesManager.trim())
                    .filter(Boolean)
                    .map((name: string) =>
                        prisma.salesManager.upsert({
                            where: { name },
                            update: {},
                            create: { name },
                        })
                    )
            )
            return
        }
        case "vendors": {
            const rows = await prisma.salesData.findMany({
                distinct: ["vendor"],
                select: { vendor: true },
            })
            await Promise.all(
                rows
                    .map((row: (typeof rows)[number]) => row.vendor.trim())
                    .filter(Boolean)
                    .map((name: string) =>
                        prisma.vendor.upsert({
                            where: { name },
                            update: {},
                            create: { name },
                        })
                    )
            )
            return
        }
    }
}

export async function listCatalogItems(entity: CatalogEntity): Promise<CatalogItem[]> {
    await syncCatalogFromSalesData(entity)
    const usageMap = await getUsageMap(entity)

    switch (entity) {
        case "regions": {
            const items = await prisma.region.findMany({ orderBy: { name: "asc" } })
            return items.map((item: (typeof items)[number]) => ({
                id: item.id,
                name: item.name,
                usageCount: usageMap.get(item.name) ?? 0,
            }))
        }
        case "sales-managers": {
            const items = await prisma.salesManager.findMany({ orderBy: { name: "asc" } })
            return items.map((item: (typeof items)[number]) => ({
                id: item.id,
                name: item.name,
                usageCount: usageMap.get(item.name) ?? 0,
            }))
        }
        case "vendors": {
            const items = await prisma.vendor.findMany({ orderBy: { name: "asc" } })
            return items.map((item: (typeof items)[number]) => ({
                id: item.id,
                name: item.name,
                usageCount: usageMap.get(item.name) ?? 0,
            }))
        }
    }
}

export async function createCatalogItem(entity: CatalogEntity, name: string) {
    const sanitized = ensureName(name)

    switch (entity) {
        case "regions":
            return prisma.region.create({ data: { name: sanitized } })
        case "sales-managers":
            return prisma.salesManager.create({ data: { name: sanitized } })
        case "vendors":
            return prisma.vendor.create({ data: { name: sanitized } })
    }
}

export async function updateCatalogItem(entity: CatalogEntity, id: number, name: string) {
    const sanitized = ensureName(name)

    switch (entity) {
        case "regions": {
            const existing = await prisma.region.findUnique({ where: { id } })
            if (!existing) {
                throw new Error("Item not found")
            }
            const updated = await prisma.region.update({ where: { id }, data: { name: sanitized } })
            if (existing.name !== sanitized) {
                await prisma.salesData.updateMany({
                    where: { region: existing.name },
                    data: { region: sanitized },
                })
            }
            return updated
        }
        case "sales-managers": {
            const existing = await prisma.salesManager.findUnique({ where: { id } })
            if (!existing) {
                throw new Error("Item not found")
            }
            const updated = await prisma.salesManager.update({ where: { id }, data: { name: sanitized } })
            if (existing.name !== sanitized) {
                await prisma.salesData.updateMany({
                    where: { salesManager: existing.name },
                    data: { salesManager: sanitized },
                })
            }
            return updated
        }
        case "vendors": {
            const existing = await prisma.vendor.findUnique({ where: { id } })
            if (!existing) {
                throw new Error("Item not found")
            }
            const updated = await prisma.vendor.update({ where: { id }, data: { name: sanitized } })
            if (existing.name !== sanitized) {
                await prisma.salesData.updateMany({
                    where: { vendor: existing.name },
                    data: { vendor: sanitized },
                })
            }
            return updated
        }
    }
}

export async function deleteCatalogItem(entity: CatalogEntity, id: number) {
    switch (entity) {
        case "regions": {
            const existing = await prisma.region.findUnique({ where: { id } })
            if (!existing) {
                throw new Error("Item not found")
            }
            const deletedSalesRows = await prisma.salesData.deleteMany({ where: { region: existing.name } })
            await prisma.region.delete({ where: { id } })
            return { deletedSalesRows: deletedSalesRows.count }
        }
        case "sales-managers": {
            const existing = await prisma.salesManager.findUnique({ where: { id } })
            if (!existing) {
                throw new Error("Item not found")
            }
            const deletedSalesRows = await prisma.salesData.deleteMany({ where: { salesManager: existing.name } })
            await prisma.salesManager.delete({ where: { id } })
            return { deletedSalesRows: deletedSalesRows.count }
        }
        case "vendors": {
            const existing = await prisma.vendor.findUnique({ where: { id } })
            if (!existing) {
                throw new Error("Item not found")
            }
            const deletedSalesRows = await prisma.salesData.deleteMany({ where: { vendor: existing.name } })
            await prisma.vendor.delete({ where: { id } })
            return { deletedSalesRows: deletedSalesRows.count }
        }
    }
}

export function getCatalogPageMeta(entity: CatalogEntity) {
    return catalogConfig[entity]
}
