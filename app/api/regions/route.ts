/* Module: API endpoint providing region-level aggregated KPI data for dashboard views. */
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { getCurrentUserId } from "@/lib/current-user"
import { computeSalesManagerMetrics, normalizeMonth, normalizeQuarter, toMonthMap } from "@/lib/sales-manager-metrics"

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

    const monthlyAchieved = toMonthMap(row.monthlyAchieved)
    const hasStoredValues = Object.values(monthlyAchieved).some((value) => Number(value ?? 0) !== 0)

    if (!hasStoredValues) {
      monthlyAchieved[normalizeMonth(row.month1Name)] = Number(row.jan ?? 0)
      monthlyAchieved[normalizeMonth(row.month2Name)] = Number(row.feb ?? 0)
      monthlyAchieved[normalizeMonth(row.month3Name)] = Number(row.mar ?? 0)
    }

    const metrics = computeSalesManagerMetrics({
      selectedQuarter: normalizeQuarter(row.selectedQuarter),
      quarterTarget: Number(row.quarterTarget ?? 0),
      monthlyAchieved,
    })

    const achievedForDashboard =
      row.totalAchieved === null || row.totalAchieved === undefined
        ? Number(metrics.quarterAchieved ?? 0)
        : Number(row.totalAchieved)

    regions[row.region].yearlyTarget += row.yearTarget || 0
    regions[row.region].target += row.quarterTarget || 0
    regions[row.region].achieved += achievedForDashboard

  })

  return NextResponse.json(
    Object.entries(regions).map(([region, val]) => ({
      region,
      ...val
    }))
  )

}
