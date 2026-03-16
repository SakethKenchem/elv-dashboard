import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

type RegionAggregate = {
  yearlyTarget: number
  target: number
  achieved: number
}

export async function GET() {

  const data = await prisma.salesData.findMany()

  const regions: Record<string, RegionAggregate> = {}

  data.forEach((row) => {

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