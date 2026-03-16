import { SidebarFilters } from "./sidebar-filters"
import { SignOutButton } from "./sign-out-button"
import Link from "next/link"
import type { ReactNode } from "react"

type AppShellProps = {
    activeItem: "dashboard" | "import" | "records" | "regions" | "sales-managers" | "vendors"
    eyebrow: string
    title: ReactNode
    description: string
    children: ReactNode
}

const navItems = [
    { key: "dashboard", label: "Dashboard", href: "/dashboard" },
    { key: "import", label: "Import Studio", href: "/import" },
    { key: "records", label: "Sales Managers", href: "/records" },
    { key: "regions", label: "Regions", href: "/manage/regions" },
    { key: "vendors", label: "Vendors", href: "/manage/vendors" },
] as const

export function AppShell({
    activeItem,
    eyebrow,
    title,
    description,
    children,
}: AppShellProps) {
    return (
        <main className="relative min-h-screen overflow-hidden bg-[#f8f5ef] px-4 py-6 dark:bg-slate-950 md:px-8 md:py-8">
            <div className="pointer-events-none absolute inset-0">
                <div className="absolute -top-16 -left-16 h-72 w-72 rounded-full bg-[#d4f2df] blur-3xl dark:bg-emerald-900/20" />
                <div className="absolute right-0 top-1/4 h-80 w-80 rounded-full bg-[#ffe3c4] blur-3xl dark:bg-amber-900/10" />
            </div>

            <div className="relative mx-auto flex max-w-7xl flex-col gap-6 lg:flex-row">
                <aside className="w-full rounded-3xl border border-[#e9ddc9] bg-[#fffdf8]/95 p-5 shadow-[0_20px_60px_rgba(58,48,36,0.08)] backdrop-blur dark:border-slate-800 dark:bg-slate-900/90 dark:shadow-[0_20px_60px_rgba(2,6,23,0.45)] lg:sticky lg:top-8 lg:w-72 lg:self-start">
                    <p className="text-sm uppercase tracking-[0.25em] text-[#8a7a62] dark:text-slate-400">
                        Enterprise Lens
                    </p>
                    <h1 className="mt-3 text-2xl font-semibold text-[#2b2218] dark:text-slate-100">
                        ELV Control Center
                    </h1>
                    <p className="mt-2 text-sm leading-6 text-[#6f604b] dark:text-slate-300">
                        Sales visibility, data imports, and master-data management in one place.
                    </p>

                    <div className="mt-4">
                        <SignOutButton />
                    </div>

                    <nav className="mt-6 space-y-2">
                        {navItems.map((item) => {
                            const isActive = item.key === activeItem
                            return (
                                <Link
                                    key={item.key}
                                    href={item.href}
                                    className={`flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-medium transition ${isActive
                                        ? "bg-[#2c7a58] text-white shadow-[0_10px_24px_rgba(44,122,88,0.25)]"
                                        : "bg-[#f8f1e6] text-[#4f4333] hover:bg-[#efe4d1] dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                                        }`}
                                >
                                    <span>{item.label}</span>
                                    <span className={isActive ? "text-white/75" : "text-[#9d8a72] dark:text-slate-400"}>›</span>
                                </Link>
                            )
                        })}
                    </nav>

                    <SidebarFilters />
                </aside>

                <section className="min-w-0 flex-1 space-y-6">
                    <header className="rounded-3xl border border-[#e9ddc9] bg-[#fffdf8]/90 p-6 shadow-[0_20px_60px_rgba(58,48,36,0.08)] backdrop-blur dark:border-slate-800 dark:bg-slate-900/85 dark:shadow-[0_20px_60px_rgba(2,6,23,0.45)] md:p-8">
                        <p className="text-sm uppercase tracking-[0.2em] text-[#8a7a62] dark:text-slate-400">
                            {eyebrow}
                        </p>
                        <h2 className="mt-2 text-3xl font-semibold text-[#2b2218] dark:text-slate-100 md:text-5xl">
                            {title}
                        </h2>
                        <p className="mt-2 max-w-3xl text-[#6f604b] dark:text-slate-300">
                            {description}
                        </p>
                    </header>

                    {children}
                </section>
            </div>
        </main>
    )
}
