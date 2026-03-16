import { prisma } from "../lib/prisma"

type CountRow = { count: number }

type RepairOptions = {
    assignUnownedToId: number | null
    assignUnownedToEmail: string | null
    syncCatalogs: boolean
    strict: boolean
}

type CatalogNameBuckets = {
    regions: Set<string>
    salesManagers: Set<string>
    vendors: Set<string>
}

function parseArgs(argv: string[]): RepairOptions {
    const getValue = (flag: string): string | null => {
        const index = argv.indexOf(flag)
        if (index === -1 || index === argv.length - 1) {
            return null
        }

        return argv[index + 1] ?? null
    }

    const assignUnownedToIdValue = getValue("--assign-unowned-to-id")
    const assignUnownedToEmail = getValue("--assign-unowned-to-email")?.trim().toLowerCase() ?? null
    const assignUnownedToId = assignUnownedToIdValue ? Number(assignUnownedToIdValue) : null

    if (assignUnownedToIdValue && !Number.isInteger(assignUnownedToId)) {
        throw new Error("--assign-unowned-to-id must be an integer")
    }

    if (assignUnownedToId !== null && assignUnownedToEmail) {
        throw new Error("Choose either --assign-unowned-to-id or --assign-unowned-to-email, not both")
    }

    return {
        assignUnownedToId,
        assignUnownedToEmail,
        syncCatalogs: argv.includes("--sync-catalogs"),
        strict: argv.includes("--strict"),
    }
}

async function resolveTargetUserId(options: RepairOptions): Promise<number | null> {
    if (options.assignUnownedToId !== null) {
        return options.assignUnownedToId
    }

    if (!options.assignUnownedToEmail) {
        return null
    }

    const user = await prisma.user.findUnique({
        where: { email: options.assignUnownedToEmail },
        select: { id: true },
    })

    if (!user) {
        throw new Error(`User not found for email ${options.assignUnownedToEmail}`)
    }

    return user.id
}

function addName(bucket: Set<string>, value: string) {
    const normalized = value.trim()
    if (normalized) {
        bucket.add(normalized)
    }
}

async function assignUnownedRecords(targetUserId: number) {
    const [salesData, regions, salesManagers, vendors] = await prisma.$transaction([
        prisma.$executeRaw`UPDATE "SalesData" SET "ownerId" = ${targetUserId} WHERE "ownerId" IS NULL`,
        prisma.$executeRaw`UPDATE "Region" SET "ownerId" = ${targetUserId} WHERE "ownerId" IS NULL`,
        prisma.$executeRaw`UPDATE "SalesManager" SET "ownerId" = ${targetUserId} WHERE "ownerId" IS NULL`,
        prisma.$executeRaw`UPDATE "Vendor" SET "ownerId" = ${targetUserId} WHERE "ownerId" IS NULL`,
    ])

    return {
        salesData: Number(salesData),
        regions: Number(regions),
        salesManagers: Number(salesManagers),
        vendors: Number(vendors),
    }
}

async function syncCatalogsFromOwnedSalesData() {
    const rows = await prisma.salesData.findMany({
        select: {
            ownerId: true,
            region: true,
            salesManager: true,
            vendor: true,
        },
        orderBy: [{ ownerId: "asc" }, { id: "asc" }],
    })

    const namesByOwner = new Map<number, CatalogNameBuckets>()

    for (const row of rows) {
        const buckets = namesByOwner.get(row.ownerId) ?? {
            regions: new Set<string>(),
            salesManagers: new Set<string>(),
            vendors: new Set<string>(),
        }

        addName(buckets.regions, row.region)
        addName(buckets.salesManagers, row.salesManager)
        addName(buckets.vendors, row.vendor)
        namesByOwner.set(row.ownerId, buckets)
    }

    const regionOps = []
    const salesManagerOps = []
    const vendorOps = []

    for (const [ownerId, buckets] of namesByOwner) {
        for (const name of buckets.regions) {
            regionOps.push(
                prisma.region.upsert({
                    where: { ownerId_name: { ownerId, name } },
                    update: {},
                    create: { ownerId, name },
                })
            )
        }

        for (const name of buckets.salesManagers) {
            salesManagerOps.push(
                prisma.salesManager.upsert({
                    where: { ownerId_name: { ownerId, name } },
                    update: {},
                    create: { ownerId, name },
                })
            )
        }

        for (const name of buckets.vendors) {
            vendorOps.push(
                prisma.vendor.upsert({
                    where: { ownerId_name: { ownerId, name } },
                    update: {},
                    create: { ownerId, name },
                })
            )
        }
    }

    await prisma.$transaction([...regionOps, ...salesManagerOps, ...vendorOps])

    return {
        regionUpserts: regionOps.length,
        salesManagerUpserts: salesManagerOps.length,
        vendorUpserts: vendorOps.length,
    }
}

async function getNullOwnerCounts() {
    const [salesDataRows, regionRows, salesManagerRows, vendorRows] = await Promise.all([
        prisma.$queryRaw<CountRow[]>`SELECT COUNT(*)::int AS count FROM "SalesData" WHERE "ownerId" IS NULL`,
        prisma.$queryRaw<CountRow[]>`SELECT COUNT(*)::int AS count FROM "Region" WHERE "ownerId" IS NULL`,
        prisma.$queryRaw<CountRow[]>`SELECT COUNT(*)::int AS count FROM "SalesManager" WHERE "ownerId" IS NULL`,
        prisma.$queryRaw<CountRow[]>`SELECT COUNT(*)::int AS count FROM "Vendor" WHERE "ownerId" IS NULL`,
    ])

    return {
        salesData: Number(salesDataRows[0]?.count ?? 0),
        regions: Number(regionRows[0]?.count ?? 0),
        salesManagers: Number(salesManagerRows[0]?.count ?? 0),
        vendors: Number(vendorRows[0]?.count ?? 0),
    }
}

async function main() {
    const options = parseArgs(process.argv.slice(2))
    const targetUserId = await resolveTargetUserId(options)
    const before = await getNullOwnerCounts()
    const hasUnownedRecords = Object.values(before).some((count) => count > 0)

    let assigned = { salesData: 0, regions: 0, salesManagers: 0, vendors: 0 }
    if (hasUnownedRecords && targetUserId !== null) {
        assigned = await assignUnownedRecords(targetUserId)
    }

    let catalogSync = { regionUpserts: 0, salesManagerUpserts: 0, vendorUpserts: 0 }
    if (options.syncCatalogs) {
        catalogSync = await syncCatalogsFromOwnedSalesData()
    }

    const after = await getNullOwnerCounts()
    const stillHasUnownedRecords = Object.values(after).some((count) => count > 0)

    if (options.strict && stillHasUnownedRecords) {
        throw new Error(
            "Unowned records still exist. Re-run with --assign-unowned-to-id <id> or --assign-unowned-to-email <email> before enforcing a required ownerId."
        )
    }

    console.log(
        JSON.stringify(
            {
                options,
                targetUserId,
                before,
                assigned,
                catalogSync,
                after,
            },
            null,
            2
        )
    )
}

main()
    .catch((error) => {
        console.error(error)
        process.exitCode = 1
    })
    .finally(async () => {
        await prisma.$disconnect()
    })