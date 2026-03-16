"use client"

type ConfirmDialogProps = {
    open: boolean
    title: string
    description: string
    confirmLabel: string
    cancelLabel?: string
    tone?: "danger" | "neutral"
    busy?: boolean
    onConfirm: () => void
    onCancel: () => void
}

export function ConfirmDialog({
    open,
    title,
    description,
    confirmLabel,
    cancelLabel = "Cancel",
    tone = "danger",
    busy = false,
    onConfirm,
    onCancel,
}: ConfirmDialogProps) {
    if (!open) {
        return null
    }

    const confirmClassName =
        tone === "danger"
            ? "bg-[#b74424] hover:bg-[#99371b]"
            : "bg-[#2c7a58] hover:bg-[#235f45]"

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(38,31,24,0.32)] px-4 dark:bg-[rgba(2,6,23,0.65)]">
            <div className="w-full max-w-md rounded-3xl border border-[#e9ddc9] bg-[#fffdf8] p-6 shadow-[0_30px_80px_rgba(45,33,18,0.18)] dark:border-slate-700 dark:bg-slate-900 dark:shadow-[0_30px_80px_rgba(2,6,23,0.5)]">
                <p className="text-sm uppercase tracking-[0.2em] text-[#8a7a62] dark:text-slate-400">Please confirm</p>
                <h3 className="mt-2 text-2xl font-semibold text-[#2b2218] dark:text-slate-100">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-[#6f604b] dark:text-slate-300">{description}</p>

                <div className="mt-6 flex justify-end gap-3">
                    <button
                        onClick={onCancel}
                        disabled={busy}
                        className="rounded-xl border border-[#d6c7ae] px-4 py-2 text-sm font-semibold text-[#4f4333] transition hover:bg-[#f4ebdd] disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={busy}
                        className={`rounded-xl px-4 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${confirmClassName}`}
                    >
                        {busy ? "Working..." : confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    )
}
