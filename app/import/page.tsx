"use client"

import { AppShell } from "@/components/app-shell"
import Link from "next/link"
import { useState } from "react"

type ActionState = {
  type: "success" | "error"
  message: string
} | null

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState<"upload" | "delete" | "dedupe" | "export" | null>(null)
  const [status, setStatus] = useState<ActionState>(null)

  const readApiPayload = async (res: Response): Promise<Record<string, unknown>> => {
    const contentType = res.headers.get("content-type") ?? ""

    if (contentType.toLowerCase().includes("application/json")) {
      try {
        const payload = (await res.json()) as Record<string, unknown>
        return payload
      } catch {
        return {}
      }
    }

    const text = await res.text()
    return text ? { error: text } : {}
  }

  const upload = async () => {
    if (!file) {
      setStatus({ type: "error", message: "Please choose an Excel file first." })
      return
    }

    const form = new FormData()
    form.append("file", file)

    try {
      setBusy("upload")
      setStatus(null)
      const res = await fetch("/api/import", {
        method: "POST",
        body: form,
      })
      const payload = await readApiPayload(res)

      if (!res.ok) {
        throw new Error(String(payload.error ?? "Upload failed"))
      }

      setStatus({
        type: "success",
        message:
          `Imported ${payload.imported ?? 0} rows from ${payload.sheet ?? "sheet"}. ` +
          `Skipped invalid: ${payload.skippedInvalid ?? 0}, ` +
          `duplicates in upload: ${payload.skippedWithinUpload ?? 0}, ` +
          `already existing: ${payload.skippedExisting ?? 0}.`,
      })
    } catch (error) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Upload failed",
      })
    } finally {
      setBusy(null)
    }
  }

  const deleteAll = async () => {
    try {
      setBusy("delete")
      setStatus(null)
      const res = await fetch("/api/delete-all", {
        method: "DELETE",
      })
      const payload = await readApiPayload(res)

      if (!res.ok) {
        throw new Error(String(payload.error ?? "Failed to delete data"))
      }

      setStatus({ type: "success", message: "All records deleted." })
    } catch (error) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Delete action failed",
      })
    } finally {
      setBusy(null)
    }
  }

  const exportData = async () => {
    try {
      setBusy("export")
      setStatus(null)
      const res = await fetch("/api/export")
      if (!res.ok) {
        const payload = await readApiPayload(res)
        throw new Error(String(payload.error ?? "Export failed"))
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `elv-export-${new Date().toISOString().slice(0, 10)}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
      setStatus({ type: "success", message: "Export downloaded successfully." })
    } catch (error) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Export failed",
      })
    } finally {
      setBusy(null)
    }
  }

  const dedupe = async () => {
    try {
      setBusy("dedupe")
      setStatus(null)
      const res = await fetch("/api/deduplicate", {
        method: "POST",
      })
      const data = await readApiPayload(res)

      if (!res.ok) {
        throw new Error(String(data.error ?? "Failed to deduplicate records"))
      }

      setStatus({
        type: "success",
        message: `Removed ${Number(data.removed ?? 0)} duplicate rows.`,
      })
    } catch (error) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Deduplicate action failed",
      })
    } finally {
      setBusy(null)
    }
  }

  return (
    <AppShell
      activeItem="import"
      eyebrow="Data Studio"
      title="Import and manage ELV data"
      description="Upload your workbook, clear stale records, and remove duplicates without leaving the control center."
    >
      <section className="rounded-3xl border border-[#e9ddc9] bg-[#fffdf8]/95 p-6 shadow-[0_30px_80px_rgba(45,33,18,0.12)] dark:border-slate-700 dark:bg-slate-900/85 md:p-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div />

          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-2xl border border-[#d6c7ae] px-5 py-2.5 text-sm font-medium text-[#4f4333] transition hover:bg-[#f4ebdd] dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Back to dashboard
          </Link>
        </div>

        <div className="mt-8 rounded-2xl border-2 border-dashed border-[#d6c7ae] bg-[#fff8ed] p-5 dark:border-slate-600 dark:bg-slate-800/70 md:p-6">
          <label className="block text-sm font-medium text-[#594b38] dark:text-slate-300" htmlFor="workbook">
            Excel Workbook
          </label>
          <input
            id="workbook"
            type="file"
            accept=".xlsx,.xls"
            className="mt-3 block w-full rounded-xl border border-[#d7c9b1] bg-white px-3 py-2 text-[#3a3024] file:mr-4 file:rounded-lg file:border-0 file:bg-[#2c7a58] file:px-4 file:py-2 file:text-white dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />

          <button
            onClick={upload}
            disabled={busy !== null}
            className="mt-4 inline-flex items-center justify-center rounded-xl bg-[#2c7a58] px-5 py-2.5 font-semibold text-white transition hover:bg-[#235f45] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy === "upload" ? "Uploading..." : "Upload workbook"}
          </button>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
          <button
            onClick={exportData}
            disabled={busy !== null}
            className="rounded-xl bg-[#1e5fa8] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#174d8a] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy === "export" ? "Exporting..." : "Download as Excel"}
          </button>

          <button
            onClick={deleteAll}
            disabled={busy !== null}
            className="rounded-xl bg-[#b74424] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#99371b] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy === "delete" ? "Deleting..." : "Delete all data"}
          </button>

          <button
            onClick={dedupe}
            disabled={busy !== null}
            className="rounded-xl bg-[#ce8f2f] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#ad7622] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy === "dedupe" ? "Deduplicating..." : "Deduplicate records"}
          </button>
        </div>

        {status ? (
          <div
            className={`mt-6 rounded-xl border p-4 text-sm ${status.type === "success"
              ? "border-[#b6dfcc] bg-[#edf9f2] text-[#23513d]"
              : "border-[#f4bea7] bg-[#fff1eb] text-[#8a3c1f]"
              }`}
          >
            {status.message}
          </div>
        ) : null}
      </section>
    </AppShell>
  )
}