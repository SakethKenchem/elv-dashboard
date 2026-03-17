/* Module: Root route that redirects users to auth or the main dashboard based on session state. */
import Link from "next/link"
export default function LandingPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f8f5ef] px-5 py-10 dark:bg-slate-950 md:px-10">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-[#d4f2df] blur-3xl dark:bg-emerald-900/20" />
        <div className="absolute right-0 top-1/3 h-96 w-96 rounded-full bg-[#ffe3c4] blur-3xl dark:bg-amber-900/10" />
      </div>

      <div className="relative mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-6xl flex-col justify-between rounded-4xl border border-[#e9ddc9] bg-[#fffdf8]/90 p-6 shadow-[0_24px_80px_rgba(58,48,36,0.10)] backdrop-blur dark:border-slate-800 dark:bg-slate-900/85 md:p-10">
        <header className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#8a7a62] dark:text-slate-400">
            Enterprise Lens
          </p>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-xl border border-[#d6c7ae] px-4 py-2 text-sm font-semibold text-[#4f4333] transition hover:bg-[#f4ebdd] dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Login
            </Link>
            <Link
              href="/signup"
              className="rounded-xl bg-[#2c7a58] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#235f45]"
            >
              Sign up
            </Link>
          </div>
        </header>

        <section className="grid gap-8 py-10 md:grid-cols-[1.1fr_0.9fr] md:items-end">
          <div>
            <p className="inline-flex rounded-full border border-[#d8cbb5] bg-[#f7efe2] px-3 py-1 text-xs font-semibold tracking-wide text-[#6f604b] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
              Sales intelligence, unified
            </p>
            <h1 className="mt-5 text-4xl font-semibold leading-tight text-[#2b2218] dark:text-slate-100 md:text-6xl">
              Make every regional number
              <span className="block text-[#2c7a58]">impossible to miss.</span>
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-[#6f604b] dark:text-slate-300 md:text-lg">
              ELV Dashboard gives you one place to import, monitor, and manage sales performance across regions, managers, and vendors.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/signup"
                className="rounded-2xl bg-[#2c7a58] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#235f45]"
              >
                Create account
              </Link>
              <Link
                href="/login"
                className="rounded-2xl border border-[#d6c7ae] px-6 py-3 text-sm font-semibold text-[#4f4333] transition hover:bg-[#f4ebdd] dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Already have an account
              </Link>
            </div>
          </div>

          <div className="rounded-3xl border border-[#e9ddc9] bg-[#fff8ed] p-6 dark:border-slate-700 dark:bg-slate-800/70">
            <h2 className="text-lg font-semibold text-[#2b2218] dark:text-slate-100">What you get</h2>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-[#5f523f] dark:text-slate-300">
              <li>Live dashboard with regional target vs achieved metrics</li>
              <li>One-click data import and deduplication workflows</li>
              <li>Catalog management for regions, vendors, and managers</li>
              <li>Protected access with secure authentication</li>
            </ul>
          </div>
        </section>

        <footer className="border-t border-[#ece1cf] pt-4 text-xs text-[#8a7a62] dark:border-slate-700 dark:text-slate-400">
          Sign in or sign up to continue to your dashboard.
        </footer>
      </div>
    </main>
  )
}
