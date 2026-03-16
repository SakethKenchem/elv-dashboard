"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

type SidebarItem = {
    id: number
    name: string
}

type SidebarState = {
    regions: SidebarItem[]
    salesManagers: SidebarItem[]
    vendors: SidebarItem[]
}

type JumpDimension = "region" | "salesManager" | "vendor"

export function SidebarFilters() {
    const [items, setItems] = useState<SidebarState>({
        regions: [],
        salesManagers: [],
        vendors: [],
    })
    const [dimension, setDimension] = useState<JumpDimension>("region")
    const [selectedValue, setSelectedValue] = useState("")
    const router = useRouter()

    useEffect(() => {
        const load = async () => {
            const [regionsRes, managersRes, vendorsRes] = await Promise.all([
                fetch("/api/catalog/regions"),
                fetch("/api/catalog/sales-managers"),
                fetch("/api/catalog/vendors"),
            ])

            const [regionsPayload, managersPayload, vendorsPayload] = await Promise.all([
                regionsRes.json(),
                managersRes.json(),
                vendorsRes.json(),
            ])

            setItems({
                regions: regionsPayload.items ?? [],
                salesManagers: managersPayload.items ?? [],
                vendors: vendorsPayload.items ?? [],
            })
        }

        load()
    }, [])

    const openSelection = () => {
        if (!selectedValue) {
            return
        }
        const params = new URLSearchParams()
        params.set(dimension, selectedValue)

        router.push(`/records${params.toString() ? `?${params.toString()}` : ""}`)
    }

    const currentOptions =
        dimension === "region"
            ? items.regions
            : dimension === "salesManager"
                ? items.salesManagers
                : items.vendors

    const dimensionLabel =
        dimension === "region"
            ? "region"
            : dimension === "salesManager"
                ? "sales manager"
                : "vendor"

    return (
        <div className="mt-6 space-y-5 border-t border-[#efe5d6] pt-5 dark:border-slate-700">
            <div>
                <p className="text-xs uppercase tracking-[0.18em] text-[#8a7a62] dark:text-slate-400">Quick Jump</p>
                <div className="mt-3 space-y-3 rounded-2xl bg-[#f8f1e6] p-3 dark:bg-slate-800/80">
                    <select
                        value={dimension}
                        onChange={(event) => {
                            setDimension(event.target.value as JumpDimension)
                            setSelectedValue("")
                        }}
                        className="w-full rounded-xl border border-[#d8c9b0] bg-white px-3 py-2 text-sm text-[#4f4333] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                    >
                        <option value="region">Region</option>
                        <option value="salesManager">Sales manager</option>
                        <option value="vendor">Vendor</option>
                    </select>

                    <select
                        value={selectedValue}
                        onChange={(event) => setSelectedValue(event.target.value)}
                        className="w-full rounded-xl border border-[#d8c9b0] bg-white px-3 py-2 text-sm text-[#4f4333] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                    >
                        <option value="">Choose a {dimensionLabel}</option>
                        {currentOptions.map((item) => (
                            <option key={item.id} value={item.name}>
                                {item.name}
                            </option>
                        ))}
                    </select>

                    <button
                        onClick={openSelection}
                        disabled={!selectedValue}
                        className="w-full rounded-xl bg-[#2c7a58] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#235f45]"
                    >
                        Open records
                    </button>
                </div>
            </div>

            <div>
                <p className="text-xs uppercase tracking-[0.18em] text-[#8a7a62] dark:text-slate-400">Manage</p>
                <div className="mt-3 space-y-2">
                    <Link href="/regions" className="block rounded-xl bg-[#f8f1e6] px-3 py-2 text-sm text-[#4f4333] transition hover:bg-[#efe4d1] dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
                        Region directory
                    </Link>
                    <Link href="/manage/regions" className="block rounded-xl bg-[#f8f1e6] px-3 py-2 text-sm text-[#4f4333] transition hover:bg-[#efe4d1] dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
                        Regions
                    </Link>
                    <Link href="/manage/sales-managers" className="block rounded-xl bg-[#f8f1e6] px-3 py-2 text-sm text-[#4f4333] transition hover:bg-[#efe4d1] dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
                        Sales Managers
                    </Link>
                    <Link href="/manage/vendors" className="block rounded-xl bg-[#f8f1e6] px-3 py-2 text-sm text-[#4f4333] transition hover:bg-[#efe4d1] dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
                        Vendors
                    </Link>
                    <Link href="/records" className="block rounded-xl bg-[#f8f1e6] px-3 py-2 text-sm text-[#4f4333] transition hover:bg-[#efe4d1] dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
                        Sales Data
                    </Link>
                </div>
            </div>
        </div>
    )
}
