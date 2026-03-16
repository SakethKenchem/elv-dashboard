"use client"

import { useEffect, useState } from "react"

type ThemeMode = "light" | "dark"

function applyTheme(theme: ThemeMode) {
    const root = document.documentElement
    root.classList.toggle("dark", theme === "dark")
    localStorage.setItem("theme", theme)
}

export function ThemeSwitcher() {
    const [theme, setTheme] = useState<ThemeMode>(() => {
        const stored = typeof globalThis.localStorage !== "undefined" ? globalThis.localStorage.getItem("theme") : null
        const preferredDark = typeof globalThis.matchMedia === "function" ? globalThis.matchMedia("(prefers-color-scheme: dark)").matches : false
        return stored === "dark" || stored === "light" ? (stored as ThemeMode) : (preferredDark ? "dark" : "light")
    })

    useEffect(() => {
        applyTheme(theme)
    }, [theme])

    const toggle = () => {
        const next = theme === "dark" ? "light" : "dark"
        setTheme(next)
    }

    return (
        <button
            onClick={toggle}
            className="fixed left-4 top-4 z-50 rounded-xl border border-[#d6c7ae] bg-[#fffdf8]/95 px-3 py-2 text-xs font-semibold tracking-wide text-[#4f4333] shadow-sm backdrop-blur transition hover:bg-[#f4ebdd] dark:border-slate-600 dark:bg-slate-900/95 dark:text-slate-100 dark:hover:bg-slate-800"
            aria-label="Toggle color mode"
        >
            Toggle theme
        </button>
    )
}
