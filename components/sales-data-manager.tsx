/* Module: Sales data workspace UI for filtering and managing transaction-level rows with derived performance metrics. */
"use client"

import { ConfirmDialog } from "@/components/confirm-dialog"
import { ModalPanel } from "@/components/modal-panel"
import {
    MONTHS,
    computeSalesManagerMetrics,
    normalizeMonth,
    normalizeQuarter,
    toMonthMap,
    type MonthMap,
    type MonthName,
} from "@/lib/sales-manager-metrics"
import { useCallback, useEffect, useMemo, useState } from "react"

type SalesRow = {
    id: number
    region: string
    salesManager: string
    vendor: string
    yearTarget: number
    quarterTarget: number
    monthTarget: number
    selectedQuarter?: number
    monthlyTargets?: unknown
    monthlyAchieved?: unknown
    totalAchieved: number | null
    quarterAchieved?: number | null
    percentageAchieved?: number | null
    balanceToQuarterTarget?: number | null
    commitMonth: string
    commitAmount?: number | null
    percentQ1: number | null
    balanceQ1: number | null
}

type CatalogItem = {
    id: number
    name: string
}

type Filters = {
    region: string
    salesManager: string
    vendor: string
}

type FormState = {
    region: string
    salesManager: string
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

type Pagination = {
    page: number
    pageSize: number
    totalCount: number
    totalPages: number
}

type Summary = {
    totalTarget: number
    totalAchieved: number
    totalQuarterAchieved?: number
}

type ApiPayload = {
    error?: string
    rows?: SalesRow[]
    pagination?: Pagination
    summary?: Summary
    deleted?: number
}

type SortField = "region" | "salesManager" | "vendor" | "quarterTarget" | "totalAchieved"
type SortDirection = "asc" | "desc"

const emptyForm: FormState = {
    region: "",
    salesManager: "",
    vendor: "",
    yearTarget: "0",
    quarterTarget: "0",
    monthTarget: "0",
    selectedQuarter: 1,
    monthlyTargets: toMonthMap({}),
    monthlyAchieved: toMonthMap({}),
    commitMonth: "JANUARY",
    commitAmount: "0",
}

const emptyPagination: Pagination = {
    page: 1,
    pageSize: 12,
    totalCount: 0,
    totalPages: 1,
}

const emptySummary: Summary = {
    totalTarget: 0,
    totalAchieved: 0,
    totalQuarterAchieved: 0,
}

function parseNumber(value: string): number {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
}

function currency(value: unknown): string {
    const parsed = Number(value ?? 0)
    const safe = Number.isFinite(parsed) ? parsed : 0
    return `$${safe.toLocaleString()}`
}

function percent(value: number, total: number): string {
    if (total <= 0) {
        return "0.0%"
    }
    return `${((value / total) * 100).toFixed(1)}%`
}

function toFormState(row: SalesRow): FormState {
    return {
        region: row.region,
        salesManager: row.salesManager,
        vendor: row.vendor,
        yearTarget: String(row.yearTarget ?? 0),
        quarterTarget: String(row.quarterTarget ?? 0),
        monthTarget: String(row.monthTarget ?? 0),
        selectedQuarter: normalizeQuarter(row.selectedQuarter ?? 1),
        monthlyTargets: toMonthMap(row.monthlyTargets),
        monthlyAchieved: toMonthMap(row.monthlyAchieved),
        commitMonth: normalizeMonth(row.commitMonth ?? "JANUARY"),
        commitAmount: String(row.commitAmount ?? 0),
    }
}

function toPayload(form: FormState) {
    return {
        region: form.region,
        salesManager: form.salesManager,
        vendor: form.vendor,
        yearTarget: parseNumber(form.yearTarget),
        quarterTarget: parseNumber(form.quarterTarget),
        monthTarget: parseNumber(form.monthTarget),
        selectedQuarter: form.selectedQuarter,
        monthlyTargets: form.monthlyTargets,
        monthlyAchieved: form.monthlyAchieved,
        commitMonth: form.commitMonth,
        commitAmount: parseNumber(form.commitAmount),
    }
}

export function SalesDataManager({ initialFilters }: { initialFilters: Filters }) {
    const [rows, setRows] = useState<SalesRow[]>([])
    const [selectedIds, setSelectedIds] = useState<number[]>([])
    const [filters, setFilters] = useState<Filters>(initialFilters)
    const [draftFilters, setDraftFilters] = useState<Filters>(initialFilters)
    const [query, setQuery] = useState("")
    const [draftQuery, setDraftQuery] = useState("")
    const [sortBy, setSortBy] = useState<SortField>("region")
    const [sortDir, setSortDir] = useState<SortDirection>("asc")
    const [form, setForm] = useState<FormState>(emptyForm)
    const [editingId, setEditingId] = useState<number | null>(null)
    const [editorOpen, setEditorOpen] = useState(false)
    const [loading, setLoading] = useState(true)
    const [busy, setBusy] = useState<"create" | number | "bulk-delete" | null>(null)
    const [status, setStatus] = useState<Status>(null)
    const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
    const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)
    const [options, setOptions] = useState<{ regions: CatalogItem[]; salesManagers: CatalogItem[]; vendors: CatalogItem[] }>({
        regions: [],
        salesManagers: [],
        vendors: [],
    })
    const [pagination, setPagination] = useState<Pagination>(emptyPagination)
    const [summary, setSummary] = useState<Summary>(emptySummary)
    const [targetMonthDraft, setTargetMonthDraft] = useState<MonthName>("JANUARY")
    const [targetValueDraft, setTargetValueDraft] = useState("0")
    const [achievedMonthDraft, setAchievedMonthDraft] = useState<MonthName>("JANUARY")
    const [achievedValueDraft, setAchievedValueDraft] = useState("0")

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

    const loadRows = useCallback(async () => {
        try {
            setLoading(true)
            const params = new URLSearchParams()
            if (filters.region) params.set("region", filters.region)
            if (filters.salesManager) params.set("salesManager", filters.salesManager)
            if (filters.vendor) params.set("vendor", filters.vendor)
            if (query) params.set("q", query)
            params.set("sortBy", sortBy)
            params.set("sortDir", sortDir)
            params.set("page", String(pagination.page))
            params.set("pageSize", String(pagination.pageSize))

            const res = await fetch(`/api/sales-data?${params.toString()}`)
            const payload = await readApiPayload(res)

            if (!res.ok) {
                throw new Error(payloadError(payload, "Failed to load sales data"))
            }

            setRows(payload.rows ?? [])
            setPagination(payload.pagination ?? emptyPagination)
            setSummary(payload.summary ?? emptySummary)
            setSelectedIds([])
        } catch (error) {
            setStatus({ type: "error", message: error instanceof Error ? error.message : "Failed to load sales data" })
        } finally {
            setLoading(false)
        }
    }, [filters, pagination.page, pagination.pageSize, query, sortBy, sortDir])

    const loadOptions = useCallback(async () => {
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

        setOptions({
            regions: regionsPayload.items ?? [],
            salesManagers: managersPayload.items ?? [],
            vendors: vendorsPayload.items ?? [],
        })
    }, [])

    useEffect(() => {
        loadRows()
    }, [loadRows])

    useEffect(() => {
        loadOptions()
    }, [loadOptions])

    const coverage = useMemo(
        () => percent(Number(summary.totalQuarterAchieved ?? 0), summary.totalTarget),
        [summary.totalQuarterAchieved, summary.totalTarget]
    )

    const computed = useMemo(
        () =>
            computeSalesManagerMetrics({
                selectedQuarter: form.selectedQuarter,
                quarterTarget: parseNumber(form.quarterTarget),
                monthlyAchieved: form.monthlyAchieved,
            }),
        [form.monthlyAchieved, form.quarterTarget, form.selectedQuarter]
    )

    const applyFilters = () => {
        setFilters(draftFilters)
        setQuery(draftQuery.trim())
        setPagination((current) => ({ ...current, page: 1 }))
    }

    const clearFilters = () => {
        const cleared = { region: "", salesManager: "", vendor: "" }
        setDraftFilters(cleared)
        setFilters(cleared)
        setDraftQuery("")
        setQuery("")
        setPagination((current) => ({ ...current, page: 1 }))
    }

    const toggleSort = (field: SortField) => {
        if (sortBy === field) {
            setSortDir((current) => (current === "asc" ? "desc" : "asc"))
        } else {
            setSortBy(field)
            setSortDir("asc")
        }
        setPagination((current) => ({ ...current, page: 1 }))
    }

    const openCreate = () => {
        setEditingId(null)
        setForm(emptyForm)
        setTargetMonthDraft("JANUARY")
        setTargetValueDraft("0")
        setAchievedMonthDraft("JANUARY")
        setAchievedValueDraft("0")
        setEditorOpen(true)
    }

    const openEdit = (row: SalesRow) => {
        setEditingId(row.id)
        const nextForm = toFormState(row)
        setForm(nextForm)
        setTargetMonthDraft("JANUARY")
        setTargetValueDraft(String(nextForm.monthlyTargets.JANUARY ?? 0))
        setAchievedMonthDraft("JANUARY")
        setAchievedValueDraft(String(nextForm.monthlyAchieved.JANUARY ?? 0))
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

    const handleSubmit = async () => {
        try {
            setBusy(editingId ?? "create")
            setStatus(null)
            const endpoint = editingId === null ? "/api/sales-data" : `/api/sales-data/${editingId}`
            const method = editingId === null ? "POST" : "PATCH"
            const res = await fetch(endpoint, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(toPayload(form)),
            })
            const payload = await readApiPayload(res)

            if (!res.ok) {
                throw new Error(payloadError(payload, "Failed to save sales row"))
            }

            closeEditor()
            setStatus({ type: "success", message: editingId === null ? "Sales row created." : "Sales row updated." })
            await Promise.all([loadRows(), loadOptions()])
        } catch (error) {
            setStatus({ type: "error", message: error instanceof Error ? error.message : "Failed to save sales row" })
        } finally {
            setBusy(null)
        }
    }

    const handleDelete = async () => {
        if (confirmDeleteId === null) {
            return
        }

        try {
            setBusy(confirmDeleteId)
            setStatus(null)
            const res = await fetch(`/api/sales-data/${confirmDeleteId}`, { method: "DELETE" })
            const payload = await readApiPayload(res)

            if (!res.ok) {
                throw new Error(payloadError(payload, "Failed to delete sales row"))
            }

            setConfirmDeleteId(null)
            setStatus({ type: "success", message: "Sales row deleted." })
            await loadRows()
        } catch (error) {
            setStatus({ type: "error", message: error instanceof Error ? error.message : "Failed to delete sales row" })
        } finally {
            setBusy(null)
        }
    }

    const handleBulkDelete = async () => {
        if (selectedIds.length === 0) {
            return
        }

        try {
            setBusy("bulk-delete")
            setStatus(null)
            const res = await fetch("/api/sales-data", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: selectedIds }),
            })
            const payload = await readApiPayload(res)

            if (!res.ok) {
                throw new Error(payloadError(payload, "Failed to delete selected rows"))
            }

            setConfirmBulkDelete(false)
            setSelectedIds([])
            setStatus({ type: "success", message: `Deleted ${payload.deleted ?? 0} sales rows.` })
            await loadRows()
        } catch (error) {
            setStatus({ type: "error", message: error instanceof Error ? error.message : "Failed to delete selected rows" })
        } finally {
            setBusy(null)
        }
    }

    const toggleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedIds(rows.map((row) => row.id))
        } else {
            setSelectedIds([])
        }
    }

    const toggleSelectedId = (id: number, checked: boolean) => {
        setSelectedIds((current) => {
            if (checked) {
                return current.includes(id) ? current : [...current, id]
            }
            return current.filter((value) => value !== id)
        })
    }

    const inputClassName = "rounded-xl border border-[#d7c9b1] bg-white px-4 py-3 text-[#3a3024] outline-none transition focus:border-[#2c7a58] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
    const pageStart = pagination.totalCount === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1
    const pageEnd = Math.min(pagination.page * pagination.pageSize, pagination.totalCount)
    const allSelected = rows.length > 0 && selectedIds.length === rows.length

    return (
        <section className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <article className="rounded-2xl border border-[#dfd4bf] bg-white/90 p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
                    <p className="text-sm uppercase tracking-wide text-[#8f7f65] dark:text-slate-400">Filtered Rows</p>
                    <p className="mt-2 text-2xl font-semibold text-[#2f261b] dark:text-slate-100">{pagination.totalCount}</p>
                </article>
                <article className="rounded-2xl border border-[#dfd4bf] bg-white/90 p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
                    <p className="text-sm uppercase tracking-wide text-[#8f7f65] dark:text-slate-400">Quarter Target</p>
                    <p className="mt-2 text-2xl font-semibold text-[#2f261b] dark:text-slate-100">{currency(summary.totalTarget)}</p>
                </article>
                <article className="rounded-2xl border border-[#dfd4bf] bg-white/90 p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
                    <p className="text-sm uppercase tracking-wide text-[#8f7f65] dark:text-slate-400">Quarter Achieved</p>
                    <p className="mt-2 text-2xl font-semibold text-[#2f261b] dark:text-slate-100">{currency(summary.totalQuarterAchieved)}</p>
                </article>
                <article className="rounded-2xl border border-[#dfd4bf] bg-white/90 p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
                    <p className="text-sm uppercase tracking-wide text-[#8f7f65] dark:text-slate-400">Coverage</p>
                    <p className="mt-2 text-2xl font-semibold text-[#2f261b] dark:text-slate-100">{coverage}</p>
                </article>
            </div>

            <section className="rounded-3xl border border-[#e9ddc9] bg-[#fffdf8]/95 p-6 shadow-[0_20px_60px_rgba(58,48,36,0.08)] dark:border-slate-700 dark:bg-slate-900/85 md:p-8">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <input value={draftQuery} onChange={(event) => setDraftQuery(event.target.value)} placeholder="Search region, manager, vendor" className={inputClassName} />
                        <select value={draftFilters.region} onChange={(event) => setDraftFilters((current) => ({ ...current, region: event.target.value }))} className={inputClassName}>
                            <option value="">All regions</option>
                            {options.regions.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
                        </select>
                        <select value={draftFilters.salesManager} onChange={(event) => setDraftFilters((current) => ({ ...current, salesManager: event.target.value }))} className={inputClassName}>
                            <option value="">All sales managers</option>
                            {options.salesManagers.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
                        </select>
                        <select value={draftFilters.vendor} onChange={(event) => setDraftFilters((current) => ({ ...current, vendor: event.target.value }))} className={inputClassName}>
                            <option value="">All vendors</option>
                            {options.vendors.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
                        </select>
                    </div>

                    <div className="flex flex-wrap gap-3">
                        <button onClick={applyFilters} className="rounded-xl border border-[#d6c7ae] px-4 py-3 text-sm font-semibold text-[#4f4333] transition hover:bg-[#f4ebdd] dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">Apply filters</button>
                        <button onClick={clearFilters} className="rounded-xl border border-[#d6c7ae] px-4 py-3 text-sm font-semibold text-[#4f4333] transition hover:bg-[#f4ebdd] dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">Reset</button>
                        <button onClick={openCreate} className="rounded-xl bg-[#2c7a58] px-5 py-3 font-semibold text-white transition hover:bg-[#235f45]">New sales row</button>
                    </div>
                </div>

                {status ? (
                    <div className={`mt-5 rounded-xl border p-4 text-sm ${status.type === "success" ? "border-[#b6dfcc] bg-[#edf9f2] text-[#23513d]" : "border-[#f4bea7] bg-[#fff1eb] text-[#8a3c1f]"}`}>
                        {status.message}
                    </div>
                ) : null}
            </section>

            <section className="overflow-hidden rounded-3xl border border-[#dfd4bf] bg-white/95 shadow-[0_8px_24px_rgba(28,22,14,0.08)] dark:border-slate-700 dark:bg-slate-900/85">
                <div className="flex flex-col gap-3 border-b border-[#efe5d6] px-6 py-4 md:flex-row md:items-center md:justify-between dark:border-slate-700">
                    <div>
                        <h3 className="text-lg font-semibold text-[#30261a] dark:text-slate-100">Sales records</h3>
                        <p className="mt-1 text-sm text-[#6a5b47] dark:text-slate-300">Showing {pageStart} to {pageEnd} of {pagination.totalCount} rows.</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <button onClick={() => setConfirmBulkDelete(true)} disabled={selectedIds.length === 0 || loading} className="rounded-xl bg-[#b74424] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#99371b] disabled:cursor-not-allowed disabled:opacity-60">Delete selected ({selectedIds.length})</button>
                        <button onClick={() => setPagination((current) => ({ ...current, page: Math.max(current.page - 1, 1) }))} disabled={pagination.page <= 1 || loading} className="rounded-xl border border-[#d6c7ae] px-3 py-2 text-sm font-semibold text-[#4f4333] transition hover:bg-[#f4ebdd] disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">Previous</button>
                        <span className="px-2 text-sm text-[#6a5b47] dark:text-slate-300">Page {pagination.page} of {pagination.totalPages}</span>
                        <button onClick={() => setPagination((current) => ({ ...current, page: Math.min(current.page + 1, current.totalPages) }))} disabled={pagination.page >= pagination.totalPages || loading} className="rounded-xl border border-[#d6c7ae] px-3 py-2 text-sm font-semibold text-[#4f4333] transition hover:bg-[#f4ebdd] disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">Next</button>
                    </div>
                </div>

                {loading ? (
                    <div className="px-6 py-10 text-[#6a5b47] dark:text-slate-300">Loading sales rows...</div>
                ) : rows.length === 0 ? (
                    <div className="px-6 py-10 text-[#6a5b47] dark:text-slate-300">No sales rows match the current filters.</div>
                ) : (
                    <>
                        <div className="space-y-3 p-4 md:hidden">
                            {rows.map((row) => {
                                const rowTarget = Number(row.quarterTarget ?? 0)
                                const rowAchieved = Number(row.quarterAchieved ?? row.totalAchieved ?? 0)
                                const rowPercent = row.percentageAchieved !== undefined && row.percentageAchieved !== null
                                    ? `${Number(row.percentageAchieved).toFixed(1)}%`
                                    : percent(rowAchieved, rowTarget)
                                const rowBalance = row.balanceToQuarterTarget ?? row.balanceQ1 ?? Math.max(rowTarget - rowAchieved, 0)

                                return (
                                    <article key={`mobile-row-${row.id}`} className="rounded-2xl border border-[#efe5d6] bg-white px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="font-semibold text-[#342b20] dark:text-slate-100">{row.salesManager}</p>
                                                <p className="text-xs text-[#6a5b47] dark:text-slate-300">{row.region} | {row.vendor}</p>
                                            </div>
                                            <input type="checkbox" checked={selectedIds.includes(row.id)} onChange={(event) => toggleSelectedId(row.id, event.target.checked)} />
                                        </div>

                                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                                            <div className="rounded-lg border border-[#efe5d6] px-2 py-2 dark:border-slate-700">
                                                <p className="text-[#6a5b47] dark:text-slate-300">Quarter Target</p>
                                                <p className="font-semibold text-[#342b20] dark:text-slate-100">{currency(rowTarget)}</p>
                                            </div>
                                            <div className="rounded-lg border border-[#efe5d6] px-2 py-2 dark:border-slate-700">
                                                <p className="text-[#6a5b47] dark:text-slate-300">Achieved</p>
                                                <p className="font-semibold text-[#342b20] dark:text-slate-100">{currency(rowAchieved)}</p>
                                            </div>
                                            <div className="rounded-lg border border-[#efe5d6] px-2 py-2 dark:border-slate-700">
                                                <p className="text-[#6a5b47] dark:text-slate-300">% Achieved</p>
                                                <p className="font-semibold text-[#342b20] dark:text-slate-100">{rowPercent}</p>
                                            </div>
                                            <div className="rounded-lg border border-[#efe5d6] px-2 py-2 dark:border-slate-700">
                                                <p className="text-[#6a5b47] dark:text-slate-300">Balance</p>
                                                <p className="font-semibold text-[#342b20] dark:text-slate-100">{currency(rowBalance)}</p>
                                            </div>
                                        </div>

                                        <div className="mt-3 flex gap-2">
                                            <button onClick={() => openEdit(row)} className="flex-1 rounded-xl border border-[#d6c7ae] px-3 py-2 text-xs font-semibold text-[#4f4333] transition hover:bg-[#f4ebdd] dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">Edit</button>
                                            <button onClick={() => setConfirmDeleteId(row.id)} className="flex-1 rounded-xl bg-[#b74424] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#99371b]">Delete</button>
                                        </div>
                                    </article>
                                )
                            })}
                        </div>

                        <div className="hidden overflow-x-auto md:block">
                            <table className="min-w-full text-sm">
                                <thead className="bg-[#f4ebdd] text-left text-[#5f523f] dark:bg-slate-800 dark:text-slate-200">
                                    <tr>
                                        <th className="px-4 py-3"><input type="checkbox" checked={allSelected} onChange={(event) => toggleSelectAll(event.target.checked)} /></th>
                                        <th className="px-4 py-3"><button onClick={() => toggleSort("region")}>Region {sortBy === "region" ? (sortDir === "asc" ? "â†‘" : "â†“") : ""}</button></th>
                                        <th className="px-4 py-3"><button onClick={() => toggleSort("salesManager")}>Sales Manager {sortBy === "salesManager" ? (sortDir === "asc" ? "â†‘" : "â†“") : ""}</button></th>
                                        <th className="px-4 py-3"><button onClick={() => toggleSort("vendor")}>Vendor {sortBy === "vendor" ? (sortDir === "asc" ? "â†‘" : "â†“") : ""}</button></th>
                                        <th className="px-4 py-3"><button onClick={() => toggleSort("quarterTarget")}>Quarter Target {sortBy === "quarterTarget" ? (sortDir === "asc" ? "â†‘" : "â†“") : ""}</button></th>
                                        <th className="px-4 py-3"><button onClick={() => toggleSort("totalAchieved")}>Achieved {sortBy === "totalAchieved" ? (sortDir === "asc" ? "â†‘" : "â†“") : ""}</button></th>
                                        <th className="px-4 py-3">% Achieved</th>
                                        <th className="px-4 py-3">Balance</th>
                                        <th className="px-4 py-3">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((row) => {
                                        const rowTarget = Number(row.quarterTarget ?? 0)
                                        const rowAchieved = Number(row.quarterAchieved ?? row.totalAchieved ?? 0)
                                        return (
                                            <tr key={row.id} className="border-t border-[#efe5d6] text-[#342b20] dark:border-slate-700 dark:text-slate-100">
                                                <td className="px-4 py-3"><input type="checkbox" checked={selectedIds.includes(row.id)} onChange={(event) => toggleSelectedId(row.id, event.target.checked)} /></td>
                                                <td className="px-4 py-3 font-medium">{row.region}</td>
                                                <td className="px-4 py-3">{row.salesManager}</td>
                                                <td className="px-4 py-3">{row.vendor}</td>
                                                <td className="px-4 py-3">{currency(row.quarterTarget)}</td>
                                                <td className="px-4 py-3">{currency(rowAchieved)}</td>
                                                <td className="px-4 py-3">{row.percentageAchieved !== undefined && row.percentageAchieved !== null ? `${Number(row.percentageAchieved).toFixed(1)}%` : percent(rowAchieved, rowTarget)}</td>
                                                <td className="px-4 py-3">{currency(row.balanceToQuarterTarget ?? row.balanceQ1 ?? Math.max(rowTarget - rowAchieved, 0))}</td>
                                                <td className="px-4 py-3">
                                                    <div className="flex gap-2">
                                                        <button onClick={() => openEdit(row)} className="rounded-xl border border-[#d6c7ae] px-3 py-2 text-xs font-semibold text-[#4f4333] transition hover:bg-[#f4ebdd] dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">Edit</button>
                                                        <button onClick={() => setConfirmDeleteId(row.id)} className="rounded-xl bg-[#b74424] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#99371b]">Delete</button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </section>

            <ModalPanel
                open={editorOpen}
                onClose={closeEditor}
                title={editingId === null ? "Create sales row" : "Edit sales row"}
                description="Use the same planning workflow as Sales Manager Plans: quarter selection, month-wise targets, achieved values, commitment, and auto-calculated metrics."
            >
                <div className="space-y-6">
                    <div>
                        <h4 className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-[#8a7a62] dark:text-slate-400">Master identifiers</h4>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                            <input list="regions-list" className={inputClassName} placeholder="Region" value={form.region} onChange={(event) => setForm((current) => ({ ...current, region: event.target.value }))} />
                            <input list="sales-managers-list" className={inputClassName} placeholder="Sales Manager" value={form.salesManager} onChange={(event) => setForm((current) => ({ ...current, salesManager: event.target.value }))} />
                            <input list="vendors-list" className={inputClassName} placeholder="Vendor" value={form.vendor} onChange={(event) => setForm((current) => ({ ...current, vendor: event.target.value }))} />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="md:col-span-2">
                            <h4 className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-[#8a7a62] dark:text-slate-400">Targets</h4>
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
                        <div>
                            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-[#8a7a62] dark:text-slate-400">Quarter</label>
                            <select className={inputClassName} value={String(form.selectedQuarter)} onChange={(event) => setForm((current) => ({ ...current, selectedQuarter: normalizeQuarter(event.target.value) }))}>
                                <option value="1">Quarter 1</option>
                                <option value="2">Quarter 2</option>
                                <option value="3">Quarter 3</option>
                                <option value="4">Quarter 4</option>
                            </select>
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

                <datalist id="regions-list">{options.regions.map((item) => <option key={item.id} value={item.name} />)}</datalist>
                <datalist id="sales-managers-list">{options.salesManagers.map((item) => <option key={item.id} value={item.name} />)}</datalist>
                <datalist id="vendors-list">{options.vendors.map((item) => <option key={item.id} value={item.name} />)}</datalist>

                <div className="mt-6 flex flex-wrap justify-end gap-3">
                    <button onClick={closeEditor} className="rounded-xl border border-[#d6c7ae] px-4 py-3 text-sm font-semibold text-[#4f4333] transition hover:bg-[#f4ebdd] dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">Cancel</button>
                    <button onClick={handleSubmit} disabled={busy !== null} className="rounded-xl bg-[#2c7a58] px-5 py-3 font-semibold text-white transition hover:bg-[#235f45] disabled:cursor-not-allowed disabled:opacity-60">
                        {busy === "create" || typeof busy === "number" ? "Saving..." : editingId === null ? "Create row" : "Save changes"}
                    </button>
                </div>
            </ModalPanel>

            <ConfirmDialog
                open={confirmDeleteId !== null}
                title="Delete sales row?"
                description="This removes the selected sales record permanently. This action cannot be undone."
                confirmLabel="Delete row"
                busy={typeof busy === "number"}
                onCancel={() => setConfirmDeleteId(null)}
                onConfirm={handleDelete}
            />

            <ConfirmDialog
                open={confirmBulkDelete}
                title="Delete selected rows?"
                description={`This will remove ${selectedIds.length} selected rows permanently.`}
                confirmLabel="Delete selected"
                busy={busy === "bulk-delete"}
                onCancel={() => setConfirmBulkDelete(false)}
                onConfirm={handleBulkDelete}
            />
        </section >
    )
}

