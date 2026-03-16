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

function uniqueNormalizedNames(values: string[]): string[] {
    const seen = new Set<string>()
    const result: string[] = []

    for (const value of values) {
        const name = sanitizeName(value)
        if (!name || seen.has(name)) {
            continue
        }
        seen.add(name)
        result.push(name)
    }

    return result
}

async function getUsageMap(entity: CatalogEntity, ownerId: number): Promise<Map<string, number>> {
    switch (entity) {
        case "regions": {
            const rows = await prisma.salesData.groupBy({
                by: ["region"],
                where: { ownerId },
                _count: { _all: true },
            })
            return new Map(rows.map((row: (typeof rows)[number]) => [row.region, row._count._all]))
        }
        case "sales-managers": {
            const rows = await prisma.salesData.groupBy({
                by: ["salesManager"],
                where: { ownerId },
                _count: { _all: true },
            })
            return new Map(rows.map((row: (typeof rows)[number]) => [row.salesManager, row._count._all]))
        }
        case "vendors": {
            const rows = await prisma.salesData.groupBy({
                by: ["vendor"],
                where: { ownerId },
                _count: { _all: true },
            })
            return new Map(rows.map((row: (typeof rows)[number]) => [row.vendor, row._count._all]))
        }
    }
}

async function syncCatalogFromSalesData(entity: CatalogEntity, ownerId: number) {
    switch (entity) {
        case "regions": {
            const rows = await prisma.salesData.findMany({
                where: { ownerId },
                distinct: ["region"],
                select: { region: true },
            })
            const names = uniqueNormalizedNames(rows.map((row: (typeof rows)[number]) => row.region))
            await Promise.all(
                names.map((name: string) =>
                    prisma.region.upsert({
                        where: { ownerId_name: { ownerId, name } },
                        update: {},
                        create: { ownerId, name },
                    })
                )
            )
            return
        }
        case "sales-managers": {
            const rows = await prisma.salesData.findMany({
                where: { ownerId },
                distinct: ["salesManager"],
                select: { salesManager: true },
            })
            const names = uniqueNormalizedNames(rows.map((row: (typeof rows)[number]) => row.salesManager))
            await Promise.all(
                names.map((name: string) =>
                    prisma.salesManager.upsert({
                        where: { ownerId_name: { ownerId, name } },
                        update: {},
                        create: { ownerId, name },
                    })
                )
            )
            return
        }
        case "vendors": {
            const rows = await prisma.salesData.findMany({
                where: { ownerId },
                distinct: ["vendor"],
                select: { vendor: true },
            })
            const names = uniqueNormalizedNames(rows.map((row: (typeof rows)[number]) => row.vendor))
            await Promise.all(
                names.map((name: string) =>
                    prisma.vendor.upsert({
                        where: { ownerId_name: { ownerId, name } },
                        update: {},
                        create: { ownerId, name },
                    })
                )
            )
            return
        }
    }
}

export async function listCatalogItems(entity: CatalogEntity, ownerId: number): Promise<CatalogItem[]> {
    await syncCatalogFromSalesData(entity, ownerId)
    const usageMap = await getUsageMap(entity, ownerId)

    switch (entity) {
        case "regions": {
            const items = await prisma.region.findMany({ where: { ownerId }, orderBy: { name: "asc" } })
            return items.map((item: (typeof items)[number]) => ({
                id: item.id,
                name: item.name,
                usageCount: usageMap.get(item.name) ?? 0,
            }))
        }
        case "sales-managers": {
            const items = await prisma.salesManager.findMany({ where: { ownerId }, orderBy: { name: "asc" } })
            return items.map((item: (typeof items)[number]) => ({
                id: item.id,
                name: item.name,
                usageCount: usageMap.get(item.name) ?? 0,
            }))
        }
        case "vendors": {
            const items = await prisma.vendor.findMany({ where: { ownerId }, orderBy: { name: "asc" } })
            return items.map((item: (typeof items)[number]) => ({
                id: item.id,
                name: item.name,
                usageCount: usageMap.get(item.name) ?? 0,
            }))
        }
    }
}

export async function createCatalogItem(entity: CatalogEntity, ownerId: number, name: string) {
    const sanitized = ensureName(name)

    switch (entity) {
        case "regions":
            return prisma.region.create({ data: { ownerId, name: sanitized } })
        case "sales-managers":
            return prisma.salesManager.create({ data: { ownerId, name: sanitized } })
        case "vendors":
            return prisma.vendor.create({ data: { ownerId, name: sanitized } })
    }
}

export async function updateCatalogItem(entity: CatalogEntity, ownerId: number, id: number, name: string) {
    const sanitized = ensureName(name)

    switch (entity) {
        case "regions": {
            const existing = await prisma.region.findFirst({ where: { id, ownerId } })
            if (!existing) {
                throw new Error("Item not found")
            }
            const updated = await prisma.region.update({ where: { id }, data: { name: sanitized } })
            if (existing.name !== sanitized) {
                await prisma.salesData.updateMany({
                    where: { ownerId, region: existing.name },
                    data: { region: sanitized },
                })
            }
            return updated
        }
        case "sales-managers": {
            const existing = await prisma.salesManager.findFirst({ where: { id, ownerId } })
            if (!existing) {
                throw new Error("Item not found")
            }
            const updated = await prisma.salesManager.update({ where: { id }, data: { name: sanitized } })
            if (existing.name !== sanitized) {
                await prisma.salesData.updateMany({
                    where: { ownerId, salesManager: existing.name },
                    data: { salesManager: sanitized },
                })
            }
            return updated
        }
        case "vendors": {
            const existing = await prisma.vendor.findFirst({ where: { id, ownerId } })
            if (!existing) {
                throw new Error("Item not found")
            }
            const updated = await prisma.vendor.update({ where: { id }, data: { name: sanitized } })
            if (existing.name !== sanitized) {
                await prisma.salesData.updateMany({
                    where: { ownerId, vendor: existing.name },
                    data: { vendor: sanitized },
                })
            }
            return updated
        }
    }
}

export async function deleteCatalogItem(entity: CatalogEntity, ownerId: number, id: number) {
    switch (entity) {
        case "regions": {
            const existing = await prisma.region.findFirst({ where: { id, ownerId } })
            if (!existing) {
                throw new Error("Item not found")
            }
            const deletedSalesRows = await prisma.salesData.deleteMany({ where: { ownerId, region: existing.name } })
            await prisma.region.delete({ where: { id } })
            return { deletedSalesRows: deletedSalesRows.count }
        }
        case "sales-managers": {
            const existing = await prisma.salesManager.findFirst({ where: { id, ownerId } })
            if (!existing) {
                throw new Error("Item not found")
            }
            const deletedSalesRows = await prisma.salesData.deleteMany({ where: { ownerId, salesManager: existing.name } })
            await prisma.salesManager.delete({ where: { id } })
            return { deletedSalesRows: deletedSalesRows.count }
        }
        case "vendors": {
            const existing = await prisma.vendor.findFirst({ where: { id, ownerId } })
            if (!existing) {
                throw new Error("Item not found")
            }
            const deletedSalesRows = await prisma.salesData.deleteMany({ where: { ownerId, vendor: existing.name } })
            await prisma.vendor.delete({ where: { id } })
            return { deletedSalesRows: deletedSalesRows.count }
        }
    }
}

export function getCatalogPageMeta(entity: CatalogEntity) {
    return catalogConfig[entity]
}
