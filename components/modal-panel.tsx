"use client"

import type { ReactNode } from "react"

type ModalPanelProps = {
    open: boolean
    title: string
    description?: string
    children: ReactNode
    onClose: () => void
}

export function ModalPanel({ open, title, description, children, onClose }: ModalPanelProps) {
    if (!open) {
        return null
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(38,31,24,0.32)] px-4 py-6 dark:bg-[rgba(2,6,23,0.65)]">
            <div className="w-full max-w-4xl rounded-3xl border border-[#e9ddc9] bg-[#fffdf8] shadow-[0_30px_80px_rgba(45,33,18,0.18)] dark:border-slate-700 dark:bg-slate-900 dark:shadow-[0_30px_80px_rgba(2,6,23,0.5)]">
                <div className="flex items-start justify-between gap-4 border-b border-[#efe5d6] px-6 py-5 dark:border-slate-700">
                    <div>
                        <p className="text-sm uppercase tracking-[0.2em] text-[#8a7a62] dark:text-slate-400">Editor</p>
                        <h3 className="mt-2 text-2xl font-semibold text-[#2b2218] dark:text-slate-100">{title}</h3>
                        {description ? <p className="mt-2 text-sm leading-6 text-[#6f604b] dark:text-slate-300">{description}</p> : null}
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded-xl border border-[#d6c7ae] px-3 py-2 text-sm font-semibold text-[#4f4333] transition hover:bg-[#f4ebdd] dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                        Close
                    </button>
                </div>
                <div className="max-h-[80vh] overflow-y-auto px-6 py-6">{children}</div>
            </div>
        </div>
    )
}
