/* Module: Dashboard landing page that summarizes ELV sales performance and regional rollups. */
"use client"

import { AppShell } from "@/components/app-shell"
import { useEffect, useMemo, useState } from "react"
import Link from "next/link"

type RegionSummary = {
    region: string
    yearlyTarget: number | null
    target: number | null
    achieved: number | null
}

type MeResponse = {
    name?: string
}

export default function DashboardPage() {
    const [regions, setRegions] = useState<RegionSummary[]>([])
    const [userName, setUserName] = useState("User")
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const load = async () => {
            try {
                setLoading(true)
                const res = await fetch("/api/regions")
                const payload = await res.json()

                if (!res.ok) {
                    throw new Error(payload.error ?? "Failed to load regional data")
                }

                setRegions(Array.isArray(payload) ? payload : [])

                const meRes = await fetch("/api/me", { cache: "no-store" })
                if (meRes.ok) {
                    const mePayload = (await meRes.json()) as MeResponse
                    if (typeof mePayload.name === "string" && mePayload.name.trim()) {
                        setUserName(mePayload.name)
                    }
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to load data")
            } finally {
                setLoading(false)
            }
        }

        load()
    }, [])

    const totalYearlyTarget = useMemo(
        () => regions.reduce((sum, r) => sum + Number(r.yearlyTarget ?? 0), 0),
        [regions]
    )

    const totalTarget = useMemo(
        () => regions.reduce((sum, r) => sum + Number(r.target ?? 0), 0),
        [regions]
    )

    const totalAchieved = useMemo(
        () => regions.reduce((sum, r) => sum + Number(r.achieved ?? 0), 0),
        [regions]
    )

    const totalPercent =
        totalTarget > 0 ? (totalAchieved / totalTarget) * 100 : 0

    return (
        <AppShell
            activeItem="dashboard"
            eyebrow="Enterprise Lens"
            title="ELV Sales Dashboard"
            description="Beautifully tracked regional performance with live imports and master-data controls."
        >
            <section className="rounded-2xl border border-[#dfd4bf] bg-white/90 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
                <p className="text-sm text-[#6a5b47] dark:text-slate-300">Hello, <span className="font-semibold text-[#2f271d] dark:text-slate-100">{userName}</span>. Welcome back.</p>
            </section>

            <div className="flex justify-end">
                <Link
                    href="/import"
                    className="inline-flex items-center justify-center rounded-2xl bg-[#2c7a58] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#225e44]"
                >
                    Open Data Studio
                </Link>
            </div>

            <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <article className="rounded-2xl border border-[#dfd4bf] bg-white/90 p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
                    <p className="text-sm uppercase tracking-wide text-[#8f7f65] dark:text-slate-400">
                        Yearly Target
                    </p>
                    <p className="mt-2 text-3xl font-semibold text-[#2f261b] dark:text-slate-100">
                        ${totalYearlyTarget.toLocaleString()}
                    </p>
                </article>
                <article className="rounded-2xl border border-[#dfd4bf] bg-white/90 p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
                    <p className="text-sm uppercase tracking-wide text-[#8f7f65] dark:text-slate-400">
                        Quarter Target
                    </p>
                    <p className="mt-2 text-3xl font-semibold text-[#2f261b] dark:text-slate-100">
                        ${totalTarget.toLocaleString()}
                    </p>
                </article>

                <article className="rounded-2xl border border-[#dfd4bf] bg-white/90 p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
                    <p className="text-sm uppercase tracking-wide text-[#8f7f65] dark:text-slate-400">
                        Total Achieved
                    </p>
                    <p className="mt-2 text-3xl font-semibold text-[#2f261b] dark:text-slate-100">
                        ${totalAchieved.toLocaleString()}
                    </p>
                </article>

                <article className="rounded-2xl border border-[#dfd4bf] bg-white/90 p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
                    <p className="text-sm uppercase tracking-wide text-[#8f7f65] dark:text-slate-400">
                        Coverage
                    </p>
                    <p className="mt-2 text-3xl font-semibold text-[#2f261b] dark:text-slate-100">
                        {totalPercent.toFixed(1)}%
                    </p>
                </article>
            </section>

            {loading ? (
                <div className="rounded-2xl border border-[#e3d8c7] bg-white/80 p-8 text-[#6f604b] dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-300">
                    Loading regional metrics...
                </div>
            ) : null}

            {error ? (
                <div className="rounded-2xl border border-[#f2b8a2] bg-[#fff2eb] p-8 text-[#8a3c1f]">
                    {error}
                </div>
            ) : null}

            {!loading && !error ? (
                <section className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
                    {regions.map((region) => {
                        const target = Number(region.target ?? 0)
                        const achieved = Number(region.achieved ?? 0)
                        const percent = target > 0 ? (achieved / target) * 100 : 0
                        const progress = Math.min(percent, 100)
                        const regionPath = `/records?region=${encodeURIComponent(region.region)}`

                        return (
                            <Link
                                key={region.region}
                                href={regionPath}
                                className="block rounded-2xl border border-[#dfd4bf] bg-white/95 p-6 shadow-[0_8px_24px_rgba(28,22,14,0.08)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(28,22,14,0.14)] dark:border-slate-700 dark:bg-slate-900/80 dark:shadow-[0_8px_24px_rgba(2,6,23,0.35)]"
                            >
                                <h2 className="text-lg font-semibold text-[#30261a] dark:text-slate-100">
                                    {region.region}
                                </h2>

                                <dl className="mt-4 space-y-2 text-sm text-[#5f523f] dark:text-slate-300">
                                    <div className="flex items-center justify-between">
                                        <dt>Target</dt>
                                        <dd className="font-semibold text-[#2f271d] dark:text-slate-100">
                                            ${target.toLocaleString()}
                                        </dd>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <dt>Achieved</dt>
                                        <dd className="font-semibold text-[#2f271d] dark:text-slate-100">
                                            ${achieved.toLocaleString()}
                                        </dd>
                                    </div>
                                </dl>

                                <div className="mt-4 h-3 w-full rounded-full bg-[#f0e6d6] dark:bg-slate-800">
                                    <div
                                        className="h-3 rounded-full bg-linear-to-r from-[#d98e40] to-[#2c7a58] transition-all duration-500"
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>

                                <p className="mt-2 text-sm font-medium text-[#6a5b47] dark:text-slate-300">
                                    {percent.toFixed(1)}% achieved
                                </p>
                            </Link>
                        )
                    })}
                </section>
            ) : null}
        </AppShell>
    )
}

