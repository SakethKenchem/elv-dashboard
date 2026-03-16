import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { getCurrentUserId } from "@/lib/current-user"

type RegionAggregate = {
  yearlyTarget: number
  target: number
  achieved: number
}

export async function GET() {

  const ownerId = await getCurrentUserId()
  if (!ownerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const data = await prisma.salesData.findMany({
    where: { ownerId }
  })

  const regions: Record<string, RegionAggregate> = {}

  data.forEach((row: (typeof data)[number]) => {

    if (!regions[row.region]) {

      regions[row.region] = {
        yearlyTarget: 0,
        target: 0,
        achieved: 0
      }

    }

    regions[row.region].yearlyTarget += row.yearTarget || 0
    regions[row.region].target += row.quarterTarget || 0
    regions[row.region].achieved += row.totalAchieved || 0

  })

  return NextResponse.json(
    Object.entries(regions).map(([region, val]) => ({
      region,
      ...val
    }))
  )

}