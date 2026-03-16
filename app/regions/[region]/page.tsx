import { AppShell } from "@/components/app-shell"
import Link from "next/link"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getCurrentUserId } from "@/lib/current-user"
import { redirect } from "next/navigation"

type RegionPageProps = {
    params: Promise<{ region: string }>
}

function currency(value: number | null): string {
    return `$${Number(value ?? 0).toLocaleString()}`
}

function percent(value: number | null): string {
    return `${Number(value ?? 0).toFixed(1)}%`
}

export default async function RegionDetailsPage({ params }: RegionPageProps) {
    const ownerId = await getCurrentUserId()

    if (!ownerId) {
        redirect("/login")
    }

    const { region } = await params
    const regionName = decodeURIComponent(region)

    const rows = await prisma.salesData.findMany({
        where: { ownerId, region: regionName },
        orderBy: [
            { salesManager: "asc" },
            { vendor: "asc" },
            { id: "asc" },
        ],
    })

    if (rows.length === 0) {
        notFound()
    }

    const totalTarget = rows.reduce((sum: number, row: (typeof rows)[number]) => sum + Number(row.quarterTarget ?? 0), 0)
    const totalAchieved = rows.reduce((sum: number, row: (typeof rows)[number]) => sum + Number(row.totalAchieved ?? 0), 0)
    const coverage = totalTarget > 0 ? (totalAchieved / totalTarget) * 100 : 0
    const month1Label = rows[0]?.month1Name ?? "MONTH 1"
    const month2Label = rows[0]?.month2Name ?? "MONTH 2"
    const month3Label = rows[0]?.month3Name ?? "MONTH 3"
    const commitLabel = rows[0]?.commitMonth ? `Commit - ${rows[0].commitMonth}` : "Commit"

    return (
        <AppShell
            activeItem="regions"
            eyebrow="Region View"
            title={regionName}
            description="Full imported records for this region, including manager, vendor, and monthly performance values."
        >
            <div className="flex justify-end">
                <Link
                    href="/dashboard"
                    className="inline-flex items-center justify-center rounded-2xl border border-[#d6c7ae] px-5 py-2.5 text-sm font-medium text-[#4f4333] transition hover:bg-[#f4ebdd] dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                    Back to dashboard
                </Link>
            </div>

            <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <article className="rounded-2xl border border-[#dfd4bf] bg-white/90 p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
                    <p className="text-sm uppercase tracking-wide text-[#8f7f65] dark:text-slate-400">Rows</p>
                    <p className="mt-2 text-2xl font-semibold text-[#2f261b] dark:text-slate-100">{rows.length}</p>
                </article>
                <article className="rounded-2xl border border-[#dfd4bf] bg-white/90 p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
                    <p className="text-sm uppercase tracking-wide text-[#8f7f65] dark:text-slate-400">Quarter Target</p>
                    <p className="mt-2 text-2xl font-semibold text-[#2f261b] dark:text-slate-100">{currency(totalTarget)}</p>
                </article>
                <article className="rounded-2xl border border-[#dfd4bf] bg-white/90 p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
                    <p className="text-sm uppercase tracking-wide text-[#8f7f65] dark:text-slate-400">Coverage</p>
                    <p className="mt-2 text-2xl font-semibold text-[#2f261b] dark:text-slate-100">{coverage.toFixed(1)}%</p>
                </article>
            </section>

            <section className="overflow-x-auto rounded-3xl border border-[#dfd4bf] bg-white/95 shadow-[0_8px_24px_rgba(28,22,14,0.08)] dark:border-slate-700 dark:bg-slate-900/85">
                <table className="min-w-full text-sm">
                    <thead className="bg-[#f4ebdd] text-left text-[#5f523f] dark:bg-slate-800 dark:text-slate-200">
                        <tr>
                            <th className="px-4 py-3">Sales Manager</th>
                            <th className="px-4 py-3">Vendor</th>
                            <th className="px-4 py-3">YR TGT</th>
                            <th className="px-4 py-3">QTR TGT</th>
                            <th className="px-4 py-3">MON TGT</th>
                            <th className="px-4 py-3">{month1Label}</th>
                            <th className="px-4 py-3">{month2Label}</th>
                            <th className="px-4 py-3">{month3Label}</th>
                            <th className="px-4 py-3">Total Achieved</th>
                            <th className="px-4 py-3">{commitLabel}</th>
                            <th className="px-4 py-3">%Achvd Q1</th>
                            <th className="px-4 py-3">Bal to Achv Q1</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row: (typeof rows)[number]) => (
                            <tr key={row.id} className="border-t border-[#efe5d6] text-[#342b20] dark:border-slate-700 dark:text-slate-100">
                                <td className="px-4 py-3">{row.salesManager}</td>
                                <td className="px-4 py-3">{row.vendor}</td>
                                <td className="px-4 py-3">{currency(row.yearTarget)}</td>
                                <td className="px-4 py-3">{currency(row.quarterTarget)}</td>
                                <td className="px-4 py-3">{currency(row.monthTarget)}</td>
                                <td className="px-4 py-3">{currency(row.jan)}</td>
                                <td className="px-4 py-3">{currency(row.feb)}</td>
                                <td className="px-4 py-3">{currency(row.mar)}</td>
                                <td className="px-4 py-3">{currency(row.totalAchieved)}</td>
                                <td className="px-4 py-3">{currency(row.commitMar)}</td>
                                <td className="px-4 py-3">{percent(row.percentQ1)}</td>
                                <td className="px-4 py-3">{currency(row.balanceQ1)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </section>
        </AppShell>
    )
}
