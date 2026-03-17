/* Module: Administrative endpoint for clearing owner-scoped data sets. */
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { getCurrentUserId } from "@/lib/current-user"

export async function DELETE() {

  const ownerId = await getCurrentUserId()
  if (!ownerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  await prisma.$transaction([
    prisma.salesData.deleteMany({ where: { ownerId } }),
    prisma.region.deleteMany({ where: { ownerId } }),
    prisma.salesManager.deleteMany({ where: { ownerId } }),
    prisma.vendor.deleteMany({ where: { ownerId } }),
  ])

  return NextResponse.json({
    success: true
  })

}
