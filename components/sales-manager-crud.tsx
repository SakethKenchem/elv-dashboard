"use client"

import { ConfirmDialog } from "@/components/confirm-dialog"
import { ModalPanel } from "@/components/modal-panel"
import {
    MONTHS,
    computeSalesManagerMetrics,
    normalizeMonth,
    normalizeQuarter,
    toMonthMap,
    type MonthName,
    type MonthMap,
} from "@/lib/sales-manager-metrics"
import { useCallback, useEffect, useMemo, useState } from "react"

type SalesManagerItem = {
    id: number
    name: string
    region: string | null
    vendor: string | null
    yearTarget: number
    quarterTarget: number
    monthTarget: number
    selectedQuarter: 1 | 2 | 3 | 4
    monthlyTargets: MonthMap
    monthlyAchieved: MonthMap
    commitMonth: string | null
    commitAmount: number
    usageCount: number
    quarterAchieved: number
    totalAchieved: number
    percentageAchieved: number
    balanceToQuarterTarget: number
}

type SalesManagerForm = {
    name: string
    region: string
    vendor: string
    yearTarget: string
    quarterTarget: string
    monthTarget: string
    selectedQuarter: 1 | 2 | 3 | 4
    monthlyTargets: MonthMap
    monthlyAchieved: MonthMap
    commitMonth: MonthName
    commitAmount: string
}

type Status = {
    type: "success" | "error"
    message: string
} | null

type ApiPayload = {
    error?: string
    items?: SalesManagerItem[]
    deletedSalesRows?: number
}

const emptyMonthMap = (): MonthMap => toMonthMap({})

const emptyForm: SalesManagerForm = {
    name: "",
    region: "",
    vendor: "",
    yearTarget: "0",
    quarterTarget: "0",
    monthTarget: "0",
    selectedQuarter: 1,
    monthlyTargets: emptyMonthMap(),
    monthlyAchieved: emptyMonthMap(),
    commitMonth: "JANUARY",
    commitAmount: "0",
}

function currency(value: unknown): string {
    const numeric = Number(value ?? 0)
    const safeValue = Number.isFinite(numeric) ? numeric : 0
    return `$${safeValue.toLocaleString()}`
}

function parseNumber(value: string): number {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
}

function toForm(item: SalesManagerItem): SalesManagerForm {
    return {
        name: item.name,
        region: item.region ?? "",
        vendor: item.vendor ?? "",
        yearTarget: String(item.yearTarget ?? 0),
        quarterTarget: String(item.quarterTarget ?? 0),
        monthTarget: String(item.monthTarget ?? 0),
        selectedQuarter: normalizeQuarter(item.selectedQuarter),
        monthlyTargets: toMonthMap(item.monthlyTargets),
        monthlyAchieved: toMonthMap(item.monthlyAchieved),
        commitMonth: normalizeMonth(item.commitMonth ?? "JANUARY"),
        commitAmount: String(item.commitAmount ?? 0),
    }
}

export function SalesManagerCrud() {
    const [items, setItems] = useState<SalesManagerItem[]>([])
    const [page, setPage] = useState(1)
    const [loading, setLoading] = useState(true)
    const [status, setStatus] = useState<Status>(null)
    const [busy, setBusy] = useState<number | "create" | null>(null)
    const [editorOpen, setEditorOpen] = useState(false)
    const [editingId, setEditingId] = useState<number | null>(null)
    const [form, setForm] = useState<SalesManagerForm>(emptyForm)
    const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
    const [targetMonthDraft, setTargetMonthDraft] = useState<MonthName>("JANUARY")
    const [targetValueDraft, setTargetValueDraft] = useState("0")
    const [achievedMonthDraft, setAchievedMonthDraft] = useState<MonthName>("JANUARY")
    const [achievedValueDraft, setAchievedValueDraft] = useState("0")
    const pageSize = 8

    const readApiPayload = async (res: Response): Promise<ApiPayload> => {
        const contentType = res.headers.get("content-type") ?? ""
        if (contentType.toLowerCase().includes("application/json")) {
            try {
                return (await res.json()) as ApiPayload
            } catch {
                return {}
            }
        }

        const text = await res.text()
        return text ? { error: text } : {}
    }

    const payloadError = (payload: ApiPayload, fallback: string): string => {
        const message = payload.error
        return typeof message === "string" && message.trim() ? message : fallback
    }

    const payloadItems = (payload: ApiPayload): SalesManagerItem[] => {
        return Array.isArray(payload.items) ? payload.items : []
    }

    const loadItems = useCallback(async () => {
        try {
            setLoading(true)
            const res = await fetch("/api/sales-managers")
            const payload = await readApiPayload(res)

            if (!res.ok) {
                throw new Error(payloadError(payload, "Failed to load sales managers"))
            }

            setItems(payloadItems(payload))
            setPage(1)
        } catch (error) {
            setStatus({
                type: "error",
                message: error instanceof Error ? error.message : "Failed to load sales managers",
            })
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        loadItems()
    }, [loadItems])

    useEffect(() => {
        const maxPage = Math.max(Math.ceil(items.length / pageSize), 1)
        setPage((current) => Math.min(current, maxPage))
    }, [items.length, pageSize])

    const computed = useMemo(
        () =>
            computeSalesManagerMetrics({
                selectedQuarter: form.selectedQuarter,
                quarterTarget: parseNumber(form.quarterTarget),
                monthlyAchieved: form.monthlyAchieved,
            }),
        [form.monthlyAchieved, form.quarterTarget, form.selectedQuarter]
    )

    const openCreate = () => {
        setEditingId(null)
        setForm(emptyForm)
        setTargetMonthDraft("JANUARY")
        setTargetValueDraft("0")
        setAchievedMonthDraft("JANUARY")
        setAchievedValueDraft("0")
        setEditorOpen(true)
    }

    const openEdit = (item: SalesManagerItem) => {
        setEditingId(item.id)
        setForm(toForm(item))
        setTargetMonthDraft("JANUARY")
        setTargetValueDraft(String(item.monthlyTargets.JANUARY ?? 0))
        setAchievedMonthDraft("JANUARY")
        setAchievedValueDraft(String(item.monthlyAchieved.JANUARY ?? 0))
        setEditorOpen(true)
    }

    const closeEditor = () => {
        setEditorOpen(false)
        setEditingId(null)
        setForm(emptyForm)
    }

    const setMonthlyTarget = () => {
        const month = normalizeMonth(targetMonthDraft)
        const value = parseNumber(targetValueDraft)
        setForm((current) => ({
            ...current,
            monthlyTargets: {
                ...current.monthlyTargets,
                [month]: value,
            },
        }))
    }

    const setMonthlyAchieved = () => {
        const month = normalizeMonth(achievedMonthDraft)
        const value = parseNumber(achievedValueDraft)
        setForm((current) => ({
            ...current,
            monthlyAchieved: {
                ...current.monthlyAchieved,
                [month]: value,
            },
        }))
    }

    const saveItem = async () => {
        if (!form.name.trim()) {
            setStatus({ type: "error", message: "Sales manager name is required." })
            return
        }

        try {
            setBusy(editingId ?? "create")
            setStatus(null)

            const endpoint = editingId === null ? "/api/sales-managers" : `/api/sales-managers/${editingId}`
            const method = editingId === null ? "POST" : "PATCH"
            const res = await fetch(endpoint, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: form.name,
                    region: form.region,
                    vendor: form.vendor,
                    yearTarget: parseNumber(form.yearTarget),
                    quarterTarget: parseNumber(form.quarterTarget),
                    monthTarget: parseNumber(form.monthTarget),
                    selectedQuarter: form.selectedQuarter,
                    monthlyTargets: form.monthlyTargets,
                    monthlyAchieved: form.monthlyAchieved,
                    commitMonth: form.commitMonth,
                    commitAmount: parseNumber(form.commitAmount),
                }),
            })
            const payload = await readApiPayload(res)

            if (!res.ok) {
                throw new Error(payloadError(payload, "Failed to save sales manager"))
            }

            closeEditor()
            setStatus({
                type: "success",
                message: editingId === null ? "Sales manager created." : "Sales manager updated.",
            })
            await loadItems()
        } catch (error) {
            setStatus({
                type: "error",
                message: error instanceof Error ? error.message : "Failed to save sales manager",
            })
        } finally {
            setBusy(null)
        }
    }

    const deleteItem = async () => {
        if (confirmDeleteId === null) {
            return
        }

        try {
            setBusy(confirmDeleteId)
            setStatus(null)
            const res = await fetch(`/api/sales-managers/${confirmDeleteId}`, {
                method: "DELETE",
            })
            const payload = await readApiPayload(res)

            if (!res.ok) {
                throw new Error(payloadError(payload, "Failed to delete sales manager"))
            }

            setConfirmDeleteId(null)
            setStatus({
                type: "success",
                message: `Sales manager deleted. Removed ${payload.deletedSalesRows ?? 0} linked sales rows.`,
            })
            await loadItems()
        } catch (error) {
            setStatus({
                type: "error",
                message: error instanceof Error ? error.message : "Failed to delete sales manager",
            })
        } finally {
            setBusy(null)
        }
    }

    const inputClassName =
        "rounded-xl border border-[#d7c9b1] bg-white px-4 py-3 text-[#3a3024] outline-none transition focus:border-[#2c7a58] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
    const totalPages = Math.max(Math.ceil(items.length / pageSize), 1)
    const pageStart = items.length === 0 ? 0 : (page - 1) * pageSize + 1
    const pageEnd = Math.min(page * pageSize, items.length)
    const pagedItems = useMemo(() => {
        const start = (page - 1) * pageSize
        return items.slice(start, start + pageSize)
    }, [items, page, pageSize])

    return (
        <section className="space-y-6">
            <section className="rounded-3xl border border-[#e9ddc9] bg-[#fffdf8]/95 p-6 shadow-[0_20px_60px_rgba(58,48,36,0.08)] dark:border-slate-700 dark:bg-slate-900/85 md:p-8">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h3 className="text-lg font-semibold text-[#30261a] dark:text-slate-100">Sales Managers</h3>
                        <p className="mt-1 text-sm text-[#6a5b47] dark:text-slate-300">
                            Manage yearly, quarterly, monthly, month-wise targets, commitments, and quarter balance in one place.
                        </p>
                    </div>
                    <button onClick={openCreate} className="rounded-xl bg-[#2c7a58] px-5 py-3 font-semibold text-white transition hover:bg-[#235f45]">
                        New Sales Manager Plan
                    </button>
                </div>

                {status ? (
                    <div className={`mt-5 rounded-xl border p-4 text-sm ${status.type === "success" ? "border-[#b6dfcc] bg-[#edf9f2] text-[#23513d]" : "border-[#f4bea7] bg-[#fff1eb] text-[#8a3c1f]"}`}>
                        {status.message}
                    </div>
                ) : null}
            </section>

            <section className="overflow-hidden rounded-3xl border border-[#dfd4bf] bg-white/95 shadow-[0_8px_24px_rgba(28,22,14,0.08)] dark:border-slate-700 dark:bg-slate-900/85">
                {loading ? (
                    <div className="px-6 py-8 text-[#6a5b47] dark:text-slate-300">Loading sales manager plans...</div>
                ) : items.length === 0 ? (
                    <div className="px-6 py-8 text-[#6a5b47] dark:text-slate-300">No sales manager plans yet.</div>
                ) : (
                    <>
                        <div className="flex flex-col gap-3 border-b border-[#efe5d6] px-6 py-4 md:flex-row md:items-center md:justify-between dark:border-slate-700">
                            <p className="text-sm text-[#6a5b47] dark:text-slate-300">Showing {pageStart} to {pageEnd} of {items.length} plans.</p>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setPage((current) => Math.max(current - 1, 1))}
                                    disabled={page <= 1}
                                    className="rounded-xl border border-[#d6c7ae] px-3 py-2 text-sm font-semibold text-[#4f4333] transition hover:bg-[#f4ebdd] disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                                >
                                    Previous
                                </button>
                                <span className="px-2 text-sm text-[#6a5b47] dark:text-slate-300">Page {page} of {totalPages}</span>
                                <button
                                    onClick={() => setPage((current) => Math.min(current + 1, totalPages))}
                                    disabled={page >= totalPages}
                                    className="rounded-xl border border-[#d6c7ae] px-3 py-2 text-sm font-semibold text-[#4f4333] transition hover:bg-[#f4ebdd] disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                                >
                                    Next
                                </button>
                            </div>
                        </div>

                        <div className="space-y-3 p-4 md:hidden">
                            {pagedItems.map((item) => (
                                <article key={`mobile-${item.id}`} className="rounded-2xl border border-[#efe5d6] bg-white px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="font-semibold text-[#342b20] dark:text-slate-100">{item.name}</p>
                                            <p className="text-xs text-[#6a5b47] dark:text-slate-300">{item.region ?? "-"} | {item.vendor ?? "-"}</p>
                                        </div>
                                        <span className="rounded-full bg-[#f4ebdd] px-2 py-1 text-xs font-semibold text-[#5f523f] dark:bg-slate-800 dark:text-slate-200">Q{item.selectedQuarter}</span>
                                    </div>
                                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                                        <div className="rounded-lg border border-[#efe5d6] px-2 py-2 dark:border-slate-700">
                                            <p className="text-[#6a5b47] dark:text-slate-300">Quarter Target</p>
                                            <p className="font-semibold text-[#342b20] dark:text-slate-100">{currency(item.quarterTarget)}</p>
                                        </div>
                                        <div className="rounded-lg border border-[#efe5d6] px-2 py-2 dark:border-slate-700">
                                            <p className="text-[#6a5b47] dark:text-slate-300">Total Achieved</p>
                                            <p className="font-semibold text-[#342b20] dark:text-slate-100">{currency(item.totalAchieved)}</p>
                                        </div>
                                        <div className="rounded-lg border border-[#efe5d6] px-2 py-2 dark:border-slate-700">
                                            <p className="text-[#6a5b47] dark:text-slate-300">% Achieved</p>
                                            <p className="font-semibold text-[#342b20] dark:text-slate-100">{item.percentageAchieved.toFixed(1)}%</p>
                                        </div>
                                        <div className="rounded-lg border border-[#efe5d6] px-2 py-2 dark:border-slate-700">
                                            <p className="text-[#6a5b47] dark:text-slate-300">Quarter Balance</p>
                                            <p className="font-semibold text-[#342b20] dark:text-slate-100">{currency(item.balanceToQuarterTarget)}</p>
                                        </div>
                                    </div>
                                    <div className="mt-3 flex gap-2">
                                        <button onClick={() => openEdit(item)} className="flex-1 rounded-xl border border-[#d6c7ae] px-3 py-2 text-xs font-semibold text-[#4f4333] transition hover:bg-[#f4ebdd] dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">
                                            Edit
                                        </button>
                                        <button onClick={() => setConfirmDeleteId(item.id)} className="flex-1 rounded-xl bg-[#b74424] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#99371b]">
                                            Delete
                                        </button>
                                    </div>
                                </article>
                            ))}
                        </div>

                        <div className="hidden overflow-x-auto md:block">
                            <table className="w-full min-w-330 text-sm">
                                <thead className="bg-[#f4ebdd] text-left text-[#5f523f] dark:bg-slate-800 dark:text-slate-200">
                                    <tr>
                                        <th className="px-4 py-3">Name</th>
                                        <th className="px-4 py-3">Region</th>
                                        <th className="px-4 py-3">Vendor</th>
                                        <th className="px-4 py-3">Year Target</th>
                                        <th className="px-4 py-3">Quarter Target</th>
                                        <th className="px-4 py-3">Quarter</th>
                                        <th className="px-4 py-3">Total Achieved</th>
                                        <th className="px-4 py-3">% Achieved</th>
                                        <th className="px-4 py-3">Quarter Balance</th>
                                        <th className="px-4 py-3">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pagedItems.map((item) => (
                                        <tr key={item.id} className="border-t border-[#efe5d6] text-[#342b20] dark:border-slate-700 dark:text-slate-100">
                                            <td className="px-4 py-3 font-medium">
                                                <p>{item.name}</p>
                                                <p className="text-xs text-[#6a5b47] dark:text-slate-300">Used in {item.usageCount} sales rows</p>
                                            </td>
                                            <td className="px-4 py-3">{item.region ?? "-"}</td>
                                            <td className="px-4 py-3">{item.vendor ?? "-"}</td>
                                            <td className="px-4 py-3">{currency(item.yearTarget)}</td>
                                            <td className="px-4 py-3">{currency(item.quarterTarget)}</td>
                                            <td className="px-4 py-3">Q{item.selectedQuarter}</td>
                                            <td className="px-4 py-3">{currency(item.totalAchieved)}</td>
                                            <td className="px-4 py-3">{item.percentageAchieved.toFixed(1)}%</td>
                                            <td className="px-4 py-3">{currency(item.balanceToQuarterTarget)}</td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <div className="flex gap-2">
                                                    <button onClick={() => openEdit(item)} className="rounded-xl border border-[#d6c7ae] px-3 py-2 text-xs font-semibold text-[#4f4333] transition hover:bg-[#f4ebdd] dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">
                                                        Edit
                                                    </button>
                                                    <button onClick={() => setConfirmDeleteId(item.id)} className="rounded-xl bg-[#b74424] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#99371b]">
                                                        Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </section>

            <ModalPanel
                open={editorOpen}
                onClose={closeEditor}
                title={editingId === null ? "Create sales manager plan" : "Edit sales manager plan"}
                description="Capture yearly, quarterly, monthly and month-wise targets, commitment month, and achieved values."
            >
                <div className="space-y-6">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="md:col-span-2">
                            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-[#8a7a62] dark:text-slate-400">Plan setup</p>
                        </div>
                        <div>
                            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-[#8a7a62] dark:text-slate-400">Sales Manager Name</label>
                            <input className={inputClassName} placeholder="Sales Manager Name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
                        </div>
                        <div>
                            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-[#8a7a62] dark:text-slate-400">Region</label>
                            <input className={inputClassName} placeholder="Attach Region" value={form.region} onChange={(event) => setForm((current) => ({ ...current, region: event.target.value }))} />
                        </div>
                        <div>
                            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-[#8a7a62] dark:text-slate-400">Vendor</label>
                            <input className={inputClassName} placeholder="Attach Vendor" value={form.vendor} onChange={(event) => setForm((current) => ({ ...current, vendor: event.target.value }))} />
                        </div>
                        <div>
                            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-[#8a7a62] dark:text-slate-400">Quarter</label>
                            <select className={inputClassName} value={String(form.selectedQuarter)} onChange={(event) => setForm((current) => ({ ...current, selectedQuarter: normalizeQuarter(event.target.value) }))}>
                                <option value="1">Quarter 1</option>
                                <option value="2">Quarter 2</option>
                                <option value="3">Quarter 3</option>
                                <option value="4">Quarter 4</option>
                            </select>
                        </div>
                        <div>
                            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-[#8a7a62] dark:text-slate-400">Yearly Target</label>
                            <input className={inputClassName} placeholder="Yearly Target" value={form.yearTarget} onChange={(event) => setForm((current) => ({ ...current, yearTarget: event.target.value }))} />
                        </div>
                        <div>
                            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-[#8a7a62] dark:text-slate-400">Quarterly Target</label>
                            <input className={inputClassName} placeholder="Quarterly Target" value={form.quarterTarget} onChange={(event) => setForm((current) => ({ ...current, quarterTarget: event.target.value }))} />
                        </div>
                        <div>
                            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-[#8a7a62] dark:text-slate-400">Monthly Target</label>
                            <input className={inputClassName} placeholder="Monthly Target" value={form.monthTarget} onChange={(event) => setForm((current) => ({ ...current, monthTarget: event.target.value }))} />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                        <section className="rounded-2xl border border-[#e9ddc9] bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                            <h4 className="text-sm font-semibold text-[#30261a] dark:text-slate-100">Set monthly targets</h4>
                            <div className="mt-3 flex flex-wrap gap-3">
                                <select className={inputClassName} value={targetMonthDraft} onChange={(event) => setTargetMonthDraft(normalizeMonth(event.target.value))}>
                                    {MONTHS.map((month) => <option key={month} value={month}>{month}</option>)}
                                </select>
                                <input className={inputClassName} placeholder="Target value" value={targetValueDraft} onChange={(event) => setTargetValueDraft(event.target.value)} />
                                <button onClick={setMonthlyTarget} className="rounded-xl bg-[#2c7a58] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#235f45]">Set target</button>
                            </div>
                            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                                {MONTHS.map((month) => (
                                    <div key={`target-${month}`} className="flex items-center justify-between rounded-lg border border-[#efe5d6] px-3 py-2 text-xs dark:border-slate-700">
                                        <span>{month}</span>
                                        <span className="font-semibold">{currency(form.monthlyTargets[month])}</span>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <section className="rounded-2xl border border-[#e9ddc9] bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                            <h4 className="text-sm font-semibold text-[#30261a] dark:text-slate-100">Set monthly achieved</h4>
                            <div className="mt-3 flex flex-wrap gap-3">
                                <select className={inputClassName} value={achievedMonthDraft} onChange={(event) => setAchievedMonthDraft(normalizeMonth(event.target.value))}>
                                    {MONTHS.map((month) => <option key={month} value={month}>{month}</option>)}
                                </select>
                                <input className={inputClassName} placeholder="Achieved value" value={achievedValueDraft} onChange={(event) => setAchievedValueDraft(event.target.value)} />
                                <button onClick={setMonthlyAchieved} className="rounded-xl bg-[#2c7a58] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#235f45]">Set achieved</button>
                            </div>
                            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                                {MONTHS.map((month) => (
                                    <div key={`achieved-${month}`} className="flex items-center justify-between rounded-lg border border-[#efe5d6] px-3 py-2 text-xs dark:border-slate-700">
                                        <span>{month}</span>
                                        <span className="font-semibold">{currency(form.monthlyAchieved[month])}</span>
                                    </div>
                                ))}
                            </div>
                        </section>
                    </div>

                    <section className="rounded-2xl border border-[#e9ddc9] bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                        <h4 className="text-sm font-semibold text-[#30261a] dark:text-slate-100">Commitment and auto-calculated performance</h4>
                        <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
                            <select className={inputClassName} value={form.commitMonth} onChange={(event) => setForm((current) => ({ ...current, commitMonth: normalizeMonth(event.target.value) }))}>
                                {MONTHS.map((month) => <option key={`commit-${month}`} value={month}>{month}</option>)}
                            </select>
                            <input className={inputClassName} placeholder="Commitment amount" value={form.commitAmount} onChange={(event) => setForm((current) => ({ ...current, commitAmount: event.target.value }))} />
                        </div>

                        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
                            <div className="rounded-xl border border-[#efe5d6] px-4 py-3 dark:border-slate-700">
                                <p className="text-xs text-[#6a5b47] dark:text-slate-300">Total Achieved</p>
                                <p className="text-base font-semibold text-[#30261a] dark:text-slate-100">{currency(computed.totalAchieved)}</p>
                            </div>
                            <div className="rounded-xl border border-[#efe5d6] px-4 py-3 dark:border-slate-700">
                                <p className="text-xs text-[#6a5b47] dark:text-slate-300">Quarter Achieved</p>
                                <p className="text-base font-semibold text-[#30261a] dark:text-slate-100">{currency(computed.quarterAchieved)}</p>
                            </div>
                            <div className="rounded-xl border border-[#efe5d6] px-4 py-3 dark:border-slate-700">
                                <p className="text-xs text-[#6a5b47] dark:text-slate-300">Percentage Achieved</p>
                                <p className="text-base font-semibold text-[#30261a] dark:text-slate-100">{computed.percentageAchieved.toFixed(1)}%</p>
                            </div>
                            <div className="rounded-xl border border-[#efe5d6] px-4 py-3 dark:border-slate-700">
                                <p className="text-xs text-[#6a5b47] dark:text-slate-300">Balance to Quarter Target</p>
                                <p className="text-base font-semibold text-[#30261a] dark:text-slate-100">{currency(computed.balanceToQuarterTarget)}</p>
                            </div>
                        </div>
                    </section>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                    <button onClick={closeEditor} className="rounded-xl border border-[#d6c7ae] px-4 py-3 text-sm font-semibold text-[#4f4333] transition hover:bg-[#f4ebdd] dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">
                        Cancel
                    </button>
                    <button onClick={saveItem} disabled={busy !== null} className="rounded-xl bg-[#2c7a58] px-5 py-3 font-semibold text-white transition hover:bg-[#235f45] disabled:cursor-not-allowed disabled:opacity-60">
                        {busy === "create" || typeof busy === "number" ? "Saving..." : editingId === null ? "Create plan" : "Save changes"}
                    </button>
                </div>
            </ModalPanel>

            <ConfirmDialog
                open={confirmDeleteId !== null}
                title="Delete sales manager plan?"
                description="This will remove the sales manager plan and all linked sales rows for this manager."
                confirmLabel="Delete plan"
                busy={typeof busy === "number"}
                onCancel={() => setConfirmDeleteId(null)}
                onConfirm={deleteItem}
            />
        </section>
    )
}
