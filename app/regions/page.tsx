/* Module: Regions summary page listing aggregated performance by region. */
import { AppShell } from "@/components/app-shell"
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { getCurrentUserId } from "@/lib/current-user"
import { redirect } from "next/navigation"

function currency(value: number): string {
    return `$${value.toLocaleString()}`
}

export default async function RegionsDirectoryPage() {
    const ownerId = await getCurrentUserId()

    if (!ownerId) {
        redirect("/login")
    }

    const rows = await prisma.salesData.groupBy({
        by: ["region"],
        where: { ownerId },
        _sum: {
            quarterTarget: true,
            totalAchieved: true,
        },
        _count: {
            _all: true,
        },
        orderBy: {
            region: "asc",
        },
    })

    return (
        <AppShell
            activeItem="regions"
            eyebrow="Region Directory"
            title="Regional drill-down"
            description="Browse all regions and jump into complete row-level details for each region."
        >
            <section className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                {rows.map((row: (typeof rows)[number]) => {
                    const target = Number(row._sum.quarterTarget ?? 0)
                    const achieved = Number(row._sum.totalAchieved ?? 0)
                    const progress = target > 0 ? ((achieved / target) * 100).toFixed(1) : "0.0"

                    return (
                        <Link
                            key={row.region}
                            href={`/records?region=${encodeURIComponent(row.region)}`}
                            className="rounded-2xl border border-[#dfd4bf] bg-white/95 p-6 shadow-[0_8px_24px_rgba(28,22,14,0.08)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(28,22,14,0.14)] dark:border-slate-700 dark:bg-slate-900/80"
                        >
                            <h3 className="text-xl font-semibold text-[#2f261b] dark:text-slate-100">{row.region}</h3>
                            <p className="mt-2 text-sm text-[#6a5b47] dark:text-slate-300">{row._count._all} rows</p>
                            <div className="mt-4 space-y-1 text-sm text-[#4f4333] dark:text-slate-200">
                                <p>Target: {currency(target)}</p>
                                <p>Achieved: {currency(achieved)}</p>
                                <p>Coverage: {progress}%</p>
                            </div>
                        </Link>
                    )
                })}
            </section>
        </AppShell>
    )
}

