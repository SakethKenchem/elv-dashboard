"use client"

import { ConfirmDialog } from "@/components/confirm-dialog"
import { ModalPanel } from "@/components/modal-panel"
import { useCallback, useEffect, useMemo, useState } from "react"

type SalesRow = {
    id: number
    region: string
    salesManager: string
    vendor: string
    yearTarget: number
    quarterTarget: number
    monthTarget: number
    month1Name: string
    month2Name: string
    month3Name: string
    jan: number | null
    feb: number | null
    mar: number | null
    totalAchieved: number | null
    commitMonth: string
    commitMar: number | null
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
    month1Name: string
    month2Name: string
    month3Name: string
    jan: string
    feb: string
    mar: string
    totalAchieved: string
    commitMonth: string
    commitMar: string
    percentQ1: string
    balanceQ1: string
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
    month1Name: "JAN",
    month2Name: "FEB",
    month3Name: "MAR",
    jan: "0",
    feb: "0",
    mar: "0",
    totalAchieved: "0",
    commitMonth: "MAR",
    commitMar: "0",
    percentQ1: "0",
    balanceQ1: "0",
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
}

function toFormState(row: SalesRow): FormState {
    return {
        region: row.region,
        salesManager: row.salesManager,
        vendor: row.vendor,
        yearTarget: String(row.yearTarget ?? 0),
        quarterTarget: String(row.quarterTarget ?? 0),
        monthTarget: String(row.monthTarget ?? 0),
        month1Name: row.month1Name ?? "JAN",
        month2Name: row.month2Name ?? "FEB",
        month3Name: row.month3Name ?? "MAR",
        jan: String(row.jan ?? 0),
        feb: String(row.feb ?? 0),
        mar: String(row.mar ?? 0),
        totalAchieved: String(row.totalAchieved ?? 0),
        commitMonth: row.commitMonth ?? "MAR",
        commitMar: String(row.commitMar ?? 0),
        percentQ1: String(row.percentQ1 ?? 0),
        balanceQ1: String(row.balanceQ1 ?? 0),
    }
}

function toPayload(form: FormState) {
    return {
        region: form.region,
        salesManager: form.salesManager,
        vendor: form.vendor,
        yearTarget: Number(form.yearTarget || 0),
        quarterTarget: Number(form.quarterTarget || 0),
        monthTarget: Number(form.monthTarget || 0),
        month1Name: form.month1Name.trim() || "JAN",
        month2Name: form.month2Name.trim() || "FEB",
        month3Name: form.month3Name.trim() || "MAR",
        jan: Number(form.jan || 0),
        feb: Number(form.feb || 0),
        mar: Number(form.mar || 0),
        totalAchieved: Number(form.totalAchieved || 0),
        commitMonth: form.commitMonth.trim() || "MAR",
        commitMar: Number(form.commitMar || 0),
        percentQ1: Number(form.percentQ1 || 0),
        balanceQ1: Number(form.balanceQ1 || 0),
    }
}

function currency(value: number | null): string {
    return `$${Number(value ?? 0).toLocaleString()}`
}

function percent(value: number, total: number): string {
    if (total <= 0) {
        return "0.0%"
    }
    return `${((value / total) * 100).toFixed(1)}%`
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
            const payload = await res.json()

            if (!res.ok) {
                throw new Error(payload.error ?? "Failed to load sales data")
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
        () => percent(summary.totalAchieved, summary.totalTarget),
        [summary.totalAchieved, summary.totalTarget]
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
        setEditorOpen(true)
    }

    const openEdit = (row: SalesRow) => {
        setEditingId(row.id)
        setForm(toFormState(row))
        setEditorOpen(true)
    }

    const closeEditor = () => {
        setEditorOpen(false)
        setEditingId(null)
        setForm(emptyForm)
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
            const payload = await res.json()

            if (!res.ok) {
                throw new Error(payload.error ?? "Failed to save sales row")
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
            const payload = await res.json()

            if (!res.ok) {
                throw new Error(payload.error ?? "Failed to delete sales row")
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
            const payload = await res.json()

            if (!res.ok) {
                throw new Error(payload.error ?? "Failed to delete selected rows")
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
                    <p className="text-sm uppercase tracking-wide text-[#8f7f65] dark:text-slate-400">Total Achieved</p>
                    <p className="mt-2 text-2xl font-semibold text-[#2f261b] dark:text-slate-100">{currency(summary.totalAchieved)}</p>
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
                        <button onClick={applyFilters} className="rounded-xl border border-[#d6c7ae] px-4 py-3 text-sm font-semibold text-[#4f4333] transition hover:bg-[#f4ebdd] dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">
                            Apply filters
                        </button>
                        <button onClick={clearFilters} className="rounded-xl border border-[#d6c7ae] px-4 py-3 text-sm font-semibold text-[#4f4333] transition hover:bg-[#f4ebdd] dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">
                            Reset
                        </button>
                        <button onClick={openCreate} className="rounded-xl bg-[#2c7a58] px-5 py-3 font-semibold text-white transition hover:bg-[#235f45]">
                            New sales row
                        </button>
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
                        <button
                            onClick={() => setConfirmBulkDelete(true)}
                            disabled={selectedIds.length === 0 || loading}
                            className="rounded-xl bg-[#b74424] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#99371b] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            Delete selected ({selectedIds.length})
                        </button>
                        <button
                            onClick={() => setPagination((current) => ({ ...current, page: Math.max(current.page - 1, 1) }))}
                            disabled={pagination.page <= 1 || loading}
                            className="rounded-xl border border-[#d6c7ae] px-3 py-2 text-sm font-semibold text-[#4f4333] transition hover:bg-[#f4ebdd] disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                            Previous
                        </button>
                        <span className="px-2 text-sm text-[#6a5b47] dark:text-slate-300">Page {pagination.page} of {pagination.totalPages}</span>
                        <button
                            onClick={() => setPagination((current) => ({ ...current, page: Math.min(current.page + 1, current.totalPages) }))}
                            disabled={pagination.page >= pagination.totalPages || loading}
                            className="rounded-xl border border-[#d6c7ae] px-3 py-2 text-sm font-semibold text-[#4f4333] transition hover:bg-[#f4ebdd] disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                            Next
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="px-6 py-10 text-[#6a5b47] dark:text-slate-300">Loading sales rows...</div>
                ) : rows.length === 0 ? (
                    <div className="px-6 py-10 text-[#6a5b47] dark:text-slate-300">No sales rows match the current filters.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead className="bg-[#f4ebdd] text-left text-[#5f523f] dark:bg-slate-800 dark:text-slate-200">
                                <tr>
                                    <th className="px-4 py-3"><input type="checkbox" checked={allSelected} onChange={(event) => toggleSelectAll(event.target.checked)} /></th>
                                    <th className="px-4 py-3"><button onClick={() => toggleSort("region")}>Region {sortBy === "region" ? (sortDir === "asc" ? "↑" : "↓") : ""}</button></th>
                                    <th className="px-4 py-3"><button onClick={() => toggleSort("salesManager")}>Sales Manager {sortBy === "salesManager" ? (sortDir === "asc" ? "↑" : "↓") : ""}</button></th>
                                    <th className="px-4 py-3"><button onClick={() => toggleSort("vendor")}>Vendor {sortBy === "vendor" ? (sortDir === "asc" ? "↑" : "↓") : ""}</button></th>
                                    <th className="px-4 py-3"><button onClick={() => toggleSort("quarterTarget")}>Quarter Target {sortBy === "quarterTarget" ? (sortDir === "asc" ? "↑" : "↓") : ""}</button></th>
                                    <th className="px-4 py-3"><button onClick={() => toggleSort("totalAchieved")}>Achieved {sortBy === "totalAchieved" ? (sortDir === "asc" ? "↑" : "↓") : ""}</button></th>
                                    <th className="px-4 py-3">Progress</th>
                                    <th className="px-4 py-3">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row) => {
                                    const rowTarget = Number(row.quarterTarget ?? 0)
                                    const rowAchieved = Number(row.totalAchieved ?? 0)
                                    return (
                                        <tr key={row.id} className="border-t border-[#efe5d6] text-[#342b20] dark:border-slate-700 dark:text-slate-100">
                                            <td className="px-4 py-3">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedIds.includes(row.id)}
                                                    onChange={(event) => toggleSelectedId(row.id, event.target.checked)}
                                                />
                                            </td>
                                            <td className="px-4 py-3 font-medium">{row.region}</td>
                                            <td className="px-4 py-3">{row.salesManager}</td>
                                            <td className="px-4 py-3">{row.vendor}</td>
                                            <td className="px-4 py-3">{currency(row.quarterTarget)}</td>
                                            <td className="px-4 py-3">{currency(row.totalAchieved)}</td>
                                            <td className="px-4 py-3">{percent(rowAchieved, rowTarget)}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex gap-2">
                                                    <button onClick={() => openEdit(row)} className="rounded-xl border border-[#d6c7ae] px-3 py-2 text-xs font-semibold text-[#4f4333] transition hover:bg-[#f4ebdd] dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">
                                                        Edit
                                                    </button>
                                                    <button onClick={() => setConfirmDeleteId(row.id)} className="rounded-xl bg-[#b74424] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#99371b]">
                                                        Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            <ModalPanel
                open={editorOpen}
                onClose={closeEditor}
                title={editingId === null ? "Create sales row" : "Edit sales row"}
                description="Use the same business headings as the Master sheet and set month labels for the active cycle (for example APR, MAY, JUN)."
            >
                <div className="space-y-5">
                    <div>
                        <h4 className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-[#8a7a62] dark:text-slate-400">Master identifiers</h4>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                            <input list="regions-list" className={inputClassName} placeholder="Region" value={form.region} onChange={(event) => setForm((current) => ({ ...current, region: event.target.value }))} />
                            <input list="sales-managers-list" className={inputClassName} placeholder="Sales Manager" value={form.salesManager} onChange={(event) => setForm((current) => ({ ...current, salesManager: event.target.value }))} />
                            <input list="vendors-list" className={inputClassName} placeholder="Vendor" value={form.vendor} onChange={(event) => setForm((current) => ({ ...current, vendor: event.target.value }))} />
                        </div>
                    </div>

                    <div>
                        <h4 className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-[#8a7a62] dark:text-slate-400">Targets</h4>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                            <input className={inputClassName} placeholder="YR TGT" value={form.yearTarget} onChange={(event) => setForm((current) => ({ ...current, yearTarget: event.target.value }))} />
                            <input className={inputClassName} placeholder="QTR TGT" value={form.quarterTarget} onChange={(event) => setForm((current) => ({ ...current, quarterTarget: event.target.value }))} />
                            <input className={inputClassName} placeholder="MON TGT" value={form.monthTarget} onChange={(event) => setForm((current) => ({ ...current, monthTarget: event.target.value }))} />
                        </div>
                    </div>

                    <div>
                        <h4 className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-[#8a7a62] dark:text-slate-400">Monthly values</h4>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                            <input className={inputClassName} placeholder="Month 1 Name (JAN / APR)" value={form.month1Name} onChange={(event) => setForm((current) => ({ ...current, month1Name: event.target.value.toUpperCase() }))} />
                            <input className={inputClassName} placeholder="Month 2 Name (FEB / MAY)" value={form.month2Name} onChange={(event) => setForm((current) => ({ ...current, month2Name: event.target.value.toUpperCase() }))} />
                            <input className={inputClassName} placeholder="Month 3 Name (MAR / JUN)" value={form.month3Name} onChange={(event) => setForm((current) => ({ ...current, month3Name: event.target.value.toUpperCase() }))} />
                            <input className={inputClassName} placeholder="Month 1 Amount" value={form.jan} onChange={(event) => setForm((current) => ({ ...current, jan: event.target.value }))} />
                            <input className={inputClassName} placeholder="Month 2 Amount" value={form.feb} onChange={(event) => setForm((current) => ({ ...current, feb: event.target.value }))} />
                            <input className={inputClassName} placeholder="Month 3 Amount" value={form.mar} onChange={(event) => setForm((current) => ({ ...current, mar: event.target.value }))} />
                        </div>
                    </div>

                    <div>
                        <h4 className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-[#8a7a62] dark:text-slate-400">Performance</h4>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                            <input className={inputClassName} placeholder="Total Achieved" value={form.totalAchieved} onChange={(event) => setForm((current) => ({ ...current, totalAchieved: event.target.value }))} />
                            <input className={inputClassName} placeholder="Commit Month" value={form.commitMonth} onChange={(event) => setForm((current) => ({ ...current, commitMonth: event.target.value.toUpperCase() }))} />
                            <input className={inputClassName} placeholder="Commit Amount" value={form.commitMar} onChange={(event) => setForm((current) => ({ ...current, commitMar: event.target.value }))} />
                            <input className={inputClassName} placeholder="%Achvd Q1" value={form.percentQ1} onChange={(event) => setForm((current) => ({ ...current, percentQ1: event.target.value }))} />
                            <input className={inputClassName} placeholder="Bal to Achv Q1" value={form.balanceQ1} onChange={(event) => setForm((current) => ({ ...current, balanceQ1: event.target.value }))} />
                        </div>
                    </div>
                </div>

                <datalist id="regions-list">{options.regions.map((item) => <option key={item.id} value={item.name} />)}</datalist>
                <datalist id="sales-managers-list">{options.salesManagers.map((item) => <option key={item.id} value={item.name} />)}</datalist>
                <datalist id="vendors-list">{options.vendors.map((item) => <option key={item.id} value={item.name} />)}</datalist>

                <div className="mt-6 flex flex-wrap justify-end gap-3">
                    <button onClick={closeEditor} className="rounded-xl border border-[#d6c7ae] px-4 py-3 text-sm font-semibold text-[#4f4333] transition hover:bg-[#f4ebdd] dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">
                        Cancel
                    </button>
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
        </section>
    )
}
