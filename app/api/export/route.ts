import { NextResponse } from "next/server"
import * as XLSX from "xlsx"
import { prisma } from "@/lib/prisma"
import { getCurrentUserId } from "@/lib/current-user"
import { MONTHS, computeSalesManagerMetrics, normalizeMonth, toMonthMap } from "@/lib/sales-manager-metrics"

type SalesManagerPlanExportRow = {
    name: string
    region: string
    vendor: string
    yearTarget: number
    quarterTarget: number
    monthTarget: number
    selectedQuarter: number
    monthlyTargets: ReturnType<typeof toMonthMap>
    monthlyAchieved: ReturnType<typeof toMonthMap>
    commitMonth: string
    commitAmount: number
}

export const runtime = "nodejs"

export async function GET() {
    try {
        const ownerId = await getCurrentUserId()
        if (!ownerId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const [rows, salesManagerPlans] = await Promise.all([
            prisma.salesData.findMany({
                where: { ownerId },
                orderBy: { id: "asc" },
            }),
            prisma.salesManager.findMany({
                where: { ownerId },
                orderBy: { name: "asc" },
            }),
        ])

        if (rows.length === 0 && salesManagerPlans.length === 0) {
            return NextResponse.json({ error: "No data to export" }, { status: 404 })
        }

        const wb = XLSX.utils.book_new()
        if (rows.length > 0) {
            const first = rows[0]
            const m1 = first.month1Name || "JAN"
            const m2 = first.month2Name || "FEB"
            const m3 = first.month3Name || "MAR"

            const data = rows.map((row) => ({
                Region: row.region,
                "Sales Manager": row.salesManager,
                Vendor: row.vendor,
                "YR TGT": Number(row.yearTarget),
                "QTR TGT": Number(row.quarterTarget),
                "MON TGT": Number(row.monthTarget),
                [m1]: Number(row.jan ?? 0),
                [m2]: Number(row.feb ?? 0),
                [m3]: Number(row.mar ?? 0),
                "Total Achieved": Number(row.totalAchieved ?? 0),
                "Commit Month": row.commitMonth,
                [`Commit - ${m3}`]: Number(row.commitMar ?? 0),
                "%Achvd Q1": Number(row.percentQ1 ?? 0),
                "Bal to Achv Q1": Number(row.balanceQ1 ?? 0),
            }))

            const ws = XLSX.utils.json_to_sheet(data)
            XLSX.utils.book_append_sheet(wb, ws, "Master")
        }

        const plansSource: SalesManagerPlanExportRow[] = salesManagerPlans.length > 0
            ? salesManagerPlans.map((plan) => ({
                name: plan.name,
                region: String(plan.region ?? ""),
                vendor: String(plan.vendor ?? ""),
                yearTarget: Number(plan.yearTarget ?? 0),
                quarterTarget: Number(plan.quarterTarget ?? 0),
                monthTarget: Number(plan.monthTarget ?? 0),
                selectedQuarter: Number(plan.selectedQuarter ?? 1),
                monthlyTargets: toMonthMap(plan.monthlyTargets),
                monthlyAchieved: toMonthMap(plan.monthlyAchieved),
                commitMonth: String(plan.commitMonth ?? ""),
                commitAmount: Number(plan.commitAmount ?? 0),
            }))
            : (() => {
                const grouped = new Map<string, SalesManagerPlanExportRow>()

                for (const row of rows) {
                    const key = row.salesManager
                    const current = grouped.get(key) ?? {
                        name: row.salesManager,
                        region: String(row.region ?? ""),
                        vendor: String(row.vendor ?? ""),
                        yearTarget: 0,
                        quarterTarget: 0,
                        monthTarget: 0,
                        selectedQuarter: Number(row.selectedQuarter ?? 1),
                        monthlyTargets: toMonthMap({}),
                        monthlyAchieved: toMonthMap({}),
                        commitMonth: String(row.commitMonth ?? ""),
                        commitAmount: 0,
                    }

                    current.yearTarget += Number(row.yearTarget ?? 0)
                    current.quarterTarget += Number(row.quarterTarget ?? 0)
                    current.monthTarget += Number(row.monthTarget ?? 0)
                    current.commitAmount += Number(row.commitAmount ?? row.commitMar ?? 0)

                    const rowTargets = toMonthMap(row.monthlyTargets)
                    const rowAchieved = toMonthMap(row.monthlyAchieved)

                    const hasTargetMap = Object.values(rowTargets).some((value) => Number(value ?? 0) !== 0)
                    const hasAchievedMap = Object.values(rowAchieved).some((value) => Number(value ?? 0) !== 0)

                    if (!hasAchievedMap) {
                        rowAchieved[normalizeMonth(row.month1Name)] += Number(row.jan ?? 0)
                        rowAchieved[normalizeMonth(row.month2Name)] += Number(row.feb ?? 0)
                        rowAchieved[normalizeMonth(row.month3Name)] += Number(row.mar ?? 0)
                    }

                    if (!hasTargetMap && Number(row.monthTarget ?? 0) > 0) {
                        rowTargets[normalizeMonth(row.month1Name)] += Number(row.monthTarget ?? 0)
                        rowTargets[normalizeMonth(row.month2Name)] += Number(row.monthTarget ?? 0)
                        rowTargets[normalizeMonth(row.month3Name)] += Number(row.monthTarget ?? 0)
                    }

                    for (const month of MONTHS) {
                        current.monthlyTargets[month] += Number(rowTargets[month] ?? 0)
                        current.monthlyAchieved[month] += Number(rowAchieved[month] ?? 0)
                    }

                    grouped.set(key, current)
                }

                return Array.from(grouped.values())
            })()

        if (plansSource.length > 0) {
            const plans = plansSource.map((plan) => {
                const monthlyTargets = toMonthMap(plan.monthlyTargets)
                const monthlyAchieved = toMonthMap(plan.monthlyAchieved)
                const metrics = computeSalesManagerMetrics({
                    selectedQuarter: plan.selectedQuarter,
                    quarterTarget: plan.quarterTarget,
                    monthlyAchieved,
                })

                const monthColumns: Record<string, number> = {}
                for (const month of MONTHS) {
                    monthColumns[`Target ${month}`] = Number(monthlyTargets[month] ?? 0)
                    monthColumns[`Achieved ${month}`] = Number(monthlyAchieved[month] ?? 0)
                }

                return {
                    Name: plan.name,
                    Region: String(plan.region ?? ""),
                    Vendor: String(plan.vendor ?? ""),
                    "Yearly Target": Number(plan.yearTarget ?? 0),
                    "Quarterly Target": Number(plan.quarterTarget ?? 0),
                    "Monthly Target": Number(plan.monthTarget ?? 0),
                    Quarter: Number(plan.selectedQuarter ?? 1),
                    "Commit Month": String(plan.commitMonth ?? ""),
                    "Commit Amount": Number(plan.commitAmount ?? 0),
                    "Quarter Achieved": Number(metrics.quarterAchieved),
                    "Total Achieved": Number(metrics.totalAchieved),
                    "% Achieved": Number(metrics.percentageAchieved),
                    "Balance to Quarter": Number(metrics.balanceToQuarterTarget),
                    ...monthColumns,
                }
            })

            const plansSheet = XLSX.utils.json_to_sheet(plans)
            XLSX.utils.book_append_sheet(wb, plansSheet, "Sales Manager Plans")
        }

        const raw = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer | Uint8Array
        const bytes = raw instanceof Uint8Array ? raw : new Uint8Array(raw)
        const buffer = Buffer.from(bytes)
        const date = new Date().toISOString().slice(0, 10)

        return new NextResponse(buffer, {
            status: 200,
            headers: {
                "Content-Type":
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Content-Disposition": `attachment; filename="elv-export-${date}.xlsx"`,
                "Content-Length": String(buffer.length),
                "Cache-Control": "no-store",
            },
        })
    } catch (error) {
        return NextResponse.json(
            {
                error: "Export failed",
                details: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
        )
    }
}
