"use client"

import { ConfirmDialog } from "@/components/confirm-dialog"
import { ModalPanel } from "@/components/modal-panel"
import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"

type CatalogItem = {
    id: number
    name: string
    usageCount: number
}

type CatalogManagerProps = {
    entity: string
    title: string
    singular: string
}

type Status = {
    type: "success" | "error"
    message: string
} | null

export function CatalogManager({ entity, title, singular }: CatalogManagerProps) {
    const [items, setItems] = useState<CatalogItem[]>([])
    const [draftName, setDraftName] = useState("")
    const [editingId, setEditingId] = useState<number | null>(null)
    const [loading, setLoading] = useState(true)
    const [busy, setBusy] = useState<number | "create" | null>(null)
    const [status, setStatus] = useState<Status>(null)
    const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
    const [editorOpen, setEditorOpen] = useState(false)
    const [search, setSearch] = useState("")
    const [currentPage, setCurrentPage] = useState(1)

    const isSalesManagersSection = entity === "sales-managers"
    const pageSize = 10

    const loadItems = useCallback(async () => {
        try {
            setLoading(true)
            const res = await fetch(`/api/catalog/${entity}`)
            const payload = await res.json()

            if (!res.ok) {
                throw new Error(payload.error ?? `Failed to load ${title.toLowerCase()}`)
            }

            setItems(payload.items ?? [])
        } catch (error) {
            setStatus({
                type: "error",
                message: error instanceof Error ? error.message : `Failed to load ${title.toLowerCase()}`,
            })
        } finally {
            setLoading(false)
        }
    }, [entity, title])

    useEffect(() => {
        loadItems()
    }, [loadItems])

    const filteredItems = useMemo(() => {
        const normalizedSearch = search.trim().toLowerCase()
        if (!normalizedSearch) {
            return items
        }

        return items.filter((item) => item.name.toLowerCase().includes(normalizedSearch))
    }, [items, search])

    const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize))

    const paginatedItems = useMemo(() => {
        if (!isSalesManagersSection) {
            return filteredItems
        }

        const start = (currentPage - 1) * pageSize
        return filteredItems.slice(start, start + pageSize)
    }, [currentPage, filteredItems, isSalesManagersSection])

    useEffect(() => {
        setCurrentPage(1)
    }, [search, entity])

    useEffect(() => {
        if (!isSalesManagersSection) {
            return
        }

        if (currentPage > totalPages) {
            setCurrentPage(totalPages)
        }
    }, [currentPage, isSalesManagersSection, totalPages])

    const openCreate = () => {
        setEditingId(null)
        setDraftName("")
        setEditorOpen(true)
    }

    const openEdit = (item: CatalogItem) => {
        setEditingId(item.id)
        setDraftName(item.name)
        setEditorOpen(true)
    }

    const closeEditor = () => {
        setEditorOpen(false)
        setEditingId(null)
        setDraftName("")
    }

    const saveItem = async () => {
        if (!draftName.trim()) {
            setStatus({ type: "error", message: `Enter a ${singular} name first.` })
            return
        }

        try {
            setBusy(editingId ?? "create")
            setStatus(null)
            const endpoint = editingId === null ? `/api/catalog/${entity}` : `/api/catalog/${entity}/${editingId}`
            const method = editingId === null ? "POST" : "PATCH"
            const res = await fetch(endpoint, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: draftName }),
            })
            const payload = await res.json()

            if (!res.ok) {
                throw new Error(payload.error ?? `Failed to save ${singular}`)
            }

            closeEditor()
            setStatus({ type: "success", message: editingId === null ? `${title.slice(0, -1)} created.` : `${title.slice(0, -1)} updated.` })
            await loadItems()
        } catch (error) {
            setStatus({
                type: "error",
                message: error instanceof Error ? error.message : `Failed to save ${singular}`,
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
            const res = await fetch(`/api/catalog/${entity}/${confirmDeleteId}`, {
                method: "DELETE",
            })
            const payload = await res.json()

            if (!res.ok) {
                throw new Error(payload.error ?? `Failed to delete ${singular}`)
            }

            setConfirmDeleteId(null)
            setStatus({
                type: "success",
                message: `${title.slice(0, -1)} deleted. Removed ${payload.deletedSalesRows ?? 0} linked sales rows.`,
            })
            await loadItems()
        } catch (error) {
            setStatus({
                type: "error",
                message: error instanceof Error ? error.message : `Failed to delete ${singular}`,
            })
        } finally {
            setBusy(null)
        }
    }

    const recordsHref = (name: string) => {
        const params = new URLSearchParams()
        if (entity === "regions") {
            params.set("region", name)
        } else if (entity === "sales-managers") {
            params.set("salesManager", name)
        } else {
            params.set("vendor", name)
        }
        return `/records?${params.toString()}`
    }

    return (
        <section className="space-y-6">
            <section className="rounded-3xl border border-[#e9ddc9] bg-[#fffdf8]/95 p-6 shadow-[0_20px_60px_rgba(58,48,36,0.08)] dark:border-slate-700 dark:bg-slate-900/85 md:p-8">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h3 className="text-lg font-semibold text-[#30261a] dark:text-slate-100">{title}</h3>
                        <p className="mt-1 text-sm text-[#6a5b47] dark:text-slate-300">
                            Search, create, rename, and remove {title.toLowerCase()} from one focused workspace.
                        </p>
                    </div>
                    <button
                        onClick={openCreate}
                        className="rounded-xl bg-[#2c7a58] px-5 py-3 font-semibold text-white transition hover:bg-[#235f45]"
                    >
                        New {singular}
                    </button>
                </div>

                <div className="mt-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder={`Search ${title.toLowerCase()}`}
                        className="w-full max-w-md rounded-xl border border-[#d7c9b1] bg-white px-4 py-3 text-[#3a3024] outline-none transition focus:border-[#2c7a58] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                    />
                    <span className="rounded-full bg-[#f4ebdd] px-3 py-1 text-sm text-[#6a5b47] dark:bg-slate-800 dark:text-slate-300">
                        {filteredItems.length} of {items.length}
                    </span>
                </div>

                {status ? (
                    <div className={`mt-5 rounded-xl border p-4 text-sm ${status.type === "success" ? "border-[#b6dfcc] bg-[#edf9f2] text-[#23513d]" : "border-[#f4bea7] bg-[#fff1eb] text-[#8a3c1f]"}`}>
                        {status.message}
                    </div>
                ) : null}
            </section>

            <section className="rounded-3xl border border-[#dfd4bf] bg-white/95 shadow-[0_8px_24px_rgba(28,22,14,0.08)] dark:border-slate-700 dark:bg-slate-900/85">
                {loading ? (
                    <div className="px-6 py-8 text-[#6a5b47] dark:text-slate-300">Loading {title.toLowerCase()}...</div>
                ) : filteredItems.length === 0 ? (
                    <div className="px-6 py-8 text-[#6a5b47] dark:text-slate-300">No {title.toLowerCase()} match the current search.</div>
                ) : (
                    <>
                        <div className="divide-y divide-[#efe5d6] dark:divide-slate-700">
                            {paginatedItems.map((item) => (
                                <div key={item.id} className="flex flex-col gap-4 px-6 py-4 md:flex-row md:items-center md:justify-between">
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-base font-semibold text-[#30261a] dark:text-slate-100">{item.name}</p>
                                        <p className="mt-1 text-sm text-[#6a5b47] dark:text-slate-300">Used in {item.usageCount} sales rows</p>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <Link
                                            href={recordsHref(item.name)}
                                            className="rounded-xl border border-[#c9d8d1] bg-[#eef7f2] px-4 py-2 text-sm font-semibold text-[#2c5e49] transition hover:bg-[#dff0e8] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                                        >
                                            View records
                                        </Link>
                                        <button
                                            onClick={() => openEdit(item)}
                                            disabled={busy !== null}
                                            className="rounded-xl border border-[#d6c7ae] px-4 py-2 text-sm font-semibold text-[#4f4333] transition hover:bg-[#f4ebdd] disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => setConfirmDeleteId(item.id)}
                                            disabled={busy !== null}
                                            className="rounded-xl bg-[#b74424] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#99371b] disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {isSalesManagersSection && filteredItems.length > pageSize ? (
                            <div className="flex flex-col gap-3 border-t border-[#efe5d6] px-6 py-4 dark:border-slate-700 md:flex-row md:items-center md:justify-between">
                                <p className="text-sm text-[#6a5b47] dark:text-slate-300">
                                    Showing {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, filteredItems.length)} of {filteredItems.length}
                                </p>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                                        disabled={currentPage === 1}
                                        className="rounded-lg border border-[#d6c7ae] px-3 py-1.5 text-sm font-semibold text-[#4f4333] transition hover:bg-[#f4ebdd] disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                                    >
                                        Previous
                                    </button>
                                    <span className="text-sm text-[#6a5b47] dark:text-slate-300">
                                        Page {currentPage} of {totalPages}
                                    </span>
                                    <button
                                        onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                                        disabled={currentPage === totalPages}
                                        className="rounded-lg border border-[#d6c7ae] px-3 py-1.5 text-sm font-semibold text-[#4f4333] transition hover:bg-[#f4ebdd] disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        ) : null}
                    </>
                )}
            </section>

            <ModalPanel
                open={editorOpen}
                onClose={closeEditor}
                title={editingId === null ? `Create ${singular}` : `Edit ${singular}`}
                description={`Changes here update the ${singular} catalog and keep linked sales rows aligned.`}
            >
                <div className="space-y-4">
                    <input
                        value={draftName}
                        onChange={(event) => setDraftName(event.target.value)}
                        className="w-full rounded-xl border border-[#d7c9b1] bg-white px-4 py-3 text-[#3a3024] outline-none transition focus:border-[#2c7a58] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                        placeholder={`Enter ${singular} name`}
                    />
                    <div className="flex justify-end gap-3">
                        <button
                            onClick={closeEditor}
                            className="rounded-xl border border-[#d6c7ae] px-4 py-3 text-sm font-semibold text-[#4f4333] transition hover:bg-[#f4ebdd] dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={saveItem}
                            disabled={busy !== null}
                            className="rounded-xl bg-[#2c7a58] px-5 py-3 font-semibold text-white transition hover:bg-[#235f45] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {busy === "create" || typeof busy === "number" ? "Saving..." : editingId === null ? `Create ${singular}` : "Save changes"}
                        </button>
                    </div>
                </div>
            </ModalPanel>

            <ConfirmDialog
                open={confirmDeleteId !== null}
                title={`Delete ${singular}?`}
                description={`This will remove the ${singular} and delete all linked sales rows. This action cannot be undone.`}
                confirmLabel={`Delete ${singular}`}
                busy={typeof busy === "number"}
                onCancel={() => setConfirmDeleteId(null)}
                onConfirm={deleteItem}
            />
        </section>
    )
}
