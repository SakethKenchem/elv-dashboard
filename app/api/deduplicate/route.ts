/* Module: API endpoint that removes duplicate sales rows while preserving canonical records. */
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { getCurrentUserId } from "@/lib/current-user"

export async function POST() {

  const ownerId = await getCurrentUserId()
  if (!ownerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const data = await prisma.salesData.findMany({
    where: { ownerId },
    orderBy: { id: "asc" }
  })

  const seen = new Set()
  const duplicates: number[] = []

  for (const row of data) {

    const key =
      row.region +
      row.vendor +
      row.salesManager +
      row.quarterTarget

    if (seen.has(key)) {
      duplicates.push(row.id)
    } else {
      seen.add(key)
    }

  }

  if (duplicates.length > 0) {

    await prisma.salesData.deleteMany({
      where: {
        ownerId,
        id: { in: duplicates }
      }
    })

  }

  return NextResponse.json({
    removed: duplicates.length
  })

}
