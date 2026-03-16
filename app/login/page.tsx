import { LoginForm } from "@/components/login-form"
import Link from "next/link"

type LoginPageProps = {
    searchParams: Promise<{
        error?: string
        message?: string
        next?: string
    }>
}

function safeNextPath(nextPath: string | undefined): string {
    if (!nextPath) {
        return "/dashboard"
    }

    if (!nextPath.startsWith("/")) {
        return "/"
    }

    if (nextPath.startsWith("//")) {
        return "/"
    }

    return nextPath
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
    const params = await searchParams
    const nextPath = safeNextPath(params.next)
    const errorMessage = params.error ? decodeURIComponent(params.error) : ""
    const infoMessage = params.message ? decodeURIComponent(params.message) : ""

    return (
        <main className="min-h-screen bg-[#f8f5ef] px-4 py-10 dark:bg-slate-950">
            <div className="mx-auto w-full max-w-md rounded-3xl border border-[#e9ddc9] bg-[#fffdf8]/95 p-8 shadow-[0_20px_60px_rgba(58,48,36,0.10)] dark:border-slate-700 dark:bg-slate-900/90">
                <p className="text-xs uppercase tracking-[0.2em] text-[#8a7a62] dark:text-slate-400">Secure access</p>
                <h1 className="mt-2 text-3xl font-semibold text-[#2b2218] dark:text-slate-100">Sign in</h1>
                <p className="mt-2 text-sm text-[#6f604b] dark:text-slate-300">Use your authorized account to access ELV dashboard data.</p>

                {errorMessage ? (
                    <div className="mt-5 rounded-xl border border-[#f4bea7] bg-[#fff1eb] p-3 text-sm text-[#8a3c1f] dark:border-rose-900/60 dark:bg-rose-950/20 dark:text-rose-200">
                        {errorMessage}
                    </div>
                ) : null}

                {infoMessage ? (
                    <div className="mt-5 rounded-xl border border-[#b6dfcc] bg-[#edf9f2] p-3 text-sm text-[#23513d] dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-200">
                        {infoMessage}
                    </div>
                ) : null}

                <LoginForm nextPath={nextPath} />

                <p className="mt-5 text-xs leading-5 text-[#8a7a62] dark:text-slate-400">
                    New here?{" "}
                    <Link href="/signup" className="font-semibold text-[#2c7a58] dark:text-emerald-300">
                        Create an account
                    </Link>
                </p>

                <p className="mt-5 text-xs leading-5 text-[#8a7a62] dark:text-slate-400">
                    Just want to explore?{" "}
                    <Link href="/" className="font-semibold text-[#2c7a58] dark:text-emerald-300">
                        Go to landing page
                    </Link>
                </p>

                <p className="mt-5 text-xs leading-5 text-[#8a7a62] dark:text-slate-400">
                    Security controls: password hashing, HTTP-only sessions, route protection, and failed-attempt throttling.
                </p>
            </div>
        </main>
    )
}
