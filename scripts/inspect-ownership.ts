/* Module: Diagnostic script that inspects ownership mappings to identify orphaned or incorrectly assigned records. */
import { prisma } from "../lib/prisma"

type CountRow = { count: number }

function createSalesDataSignature(row: {
    region: string
    salesManager: string
    vendor: string
    yearTarget: number
    quarterTarget: number
    monthTarget: number
    month1Name: string
    month2Name: string
    month3Name: string
    jan: number | null
    feb: number | null
    mar: number | null
    totalAchieved: number | null
    commitMonth: string
    commitMar: number | null
    percentQ1: number | null
    balanceQ1: number | null
}): string {
    return JSON.stringify([
        row.region,
        row.salesManager,
        row.vendor,
        row.yearTarget,
        row.quarterTarget,
        row.monthTarget,
        row.month1Name,
        row.month2Name,
        row.month3Name,
        Number(row.jan ?? 0),
        Number(row.feb ?? 0),
        Number(row.mar ?? 0),
        Number(row.totalAchieved ?? 0),
        row.commitMonth,
        Number(row.commitMar ?? 0),
        Number(row.percentQ1 ?? 0),
        Number(row.balanceQ1 ?? 0),
    ])
}

async function main() {
    const users = await prisma.user.findMany({
        select: { id: true, email: true },
        orderBy: { id: "asc" },
    })

    const userStats = await Promise.all(
        users.map(async (user) => ({
            id: user.id,
            email: user.email,
            salesData: await prisma.salesData.count({ where: { ownerId: user.id } }),
            regions: await prisma.region.count({ where: { ownerId: user.id } }),
            salesManagers: await prisma.salesManager.count({ where: { ownerId: user.id } }),
            vendors: await prisma.vendor.count({ where: { ownerId: user.id } }),
        }))
    )

    const [nullSalesDataRows, nullRegionRows, nullSalesManagerRows, nullVendorRows, salesRows] = await Promise.all([
        prisma.$queryRaw<CountRow[]>`SELECT COUNT(*)::int AS count FROM "SalesData" WHERE "ownerId" IS NULL`,
        prisma.$queryRaw<CountRow[]>`SELECT COUNT(*)::int AS count FROM "Region" WHERE "ownerId" IS NULL`,
        prisma.$queryRaw<CountRow[]>`SELECT COUNT(*)::int AS count FROM "SalesManager" WHERE "ownerId" IS NULL`,
        prisma.$queryRaw<CountRow[]>`SELECT COUNT(*)::int AS count FROM "Vendor" WHERE "ownerId" IS NULL`,
        prisma.salesData.findMany({
            select: {
                ownerId: true,
                region: true,
                salesManager: true,
                vendor: true,
                yearTarget: true,
                quarterTarget: true,
                monthTarget: true,
                month1Name: true,
                month2Name: true,
                month3Name: true,
                jan: true,
                feb: true,
                mar: true,
                totalAchieved: true,
                commitMonth: true,
                commitMar: true,
                percentQ1: true,
                balanceQ1: true,
            },
            orderBy: [{ ownerId: "asc" }, { id: "asc" }],
        }),
    ])

    const nullOwner = {
        salesData: Number(nullSalesDataRows[0]?.count ?? 0),
        regions: Number(nullRegionRows[0]?.count ?? 0),
        salesManagers: Number(nullSalesManagerRows[0]?.count ?? 0),
        vendors: Number(nullVendorRows[0]?.count ?? 0),
    }

    const signaturesByOwner = new Map<number, Set<string>>()
    for (const row of salesRows) {
        const current = signaturesByOwner.get(row.ownerId) ?? new Set<string>()
        current.add(createSalesDataSignature(row))
        signaturesByOwner.set(row.ownerId, current)
    }

    const ownerIds = [...signaturesByOwner.keys()].sort((left, right) => left - right)
    const overlaps: Array<{ owners: [number, number]; overlappingRows: number }> = []

    for (let i = 0; i < ownerIds.length; i += 1) {
        for (let j = i + 1; j < ownerIds.length; j += 1) {
            const leftOwnerId = ownerIds[i]
            const rightOwnerId = ownerIds[j]
            const leftRows = signaturesByOwner.get(leftOwnerId) ?? new Set<string>()
            const rightRows = signaturesByOwner.get(rightOwnerId) ?? new Set<string>()

            let overlappingRows = 0
            for (const signature of leftRows) {
                if (rightRows.has(signature)) {
                    overlappingRows += 1
                }
            }

            overlaps.push({ owners: [leftOwnerId, rightOwnerId], overlappingRows })
        }
    }

    console.log(JSON.stringify({ users: userStats, nullOwner, overlaps }, null, 2))
}

main()
    .catch((error) => {
        console.error(error)
        process.exitCode = 1
    })
    .finally(async () => {
        await prisma.$disconnect()
    })

