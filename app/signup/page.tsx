/* Module: Signup screen for creating new user accounts. */
import { hash } from "bcryptjs"
import { createUser, findUserByEmail } from "@/lib/user-store"
import { headers } from "next/headers"
import Link from "next/link"
import { redirect } from "next/navigation"

type SignupAttemptState = {
    count: number
    blockedUntil: number
}

const signupAttempts = new Map<string, SignupAttemptState>()
const SIGNUP_MAX_ATTEMPTS = 8
const SIGNUP_BLOCK_WINDOW_MS = 10 * 60 * 1000

type SignupPageProps = {
    searchParams: Promise<{
        error?: string
    }>
}

function safeEmail(value: string): string {
    return value.trim().toLowerCase()
}

function canAttemptSignup(key: string): boolean {
    const now = Date.now()
    const state = signupAttempts.get(key)

    if (!state) {
        return true
    }

    if (state.blockedUntil > now) {
        return false
    }

    if (state.blockedUntil !== 0) {
        signupAttempts.delete(key)
    }

    return true
}

function registerSignupFailure(key: string) {
    const now = Date.now()
    const state = signupAttempts.get(key)

    if (!state) {
        signupAttempts.set(key, { count: 1, blockedUntil: 0 })
        return
    }

    const nextCount = state.count + 1
    if (nextCount >= SIGNUP_MAX_ATTEMPTS) {
        signupAttempts.set(key, { count: nextCount, blockedUntil: now + SIGNUP_BLOCK_WINDOW_MS })
        return
    }

    signupAttempts.set(key, { count: nextCount, blockedUntil: 0 })
}

function clearSignupFailures(key: string) {
    signupAttempts.delete(key)
}

function validatePassword(password: string): string | null {
    if (password.length < 10) {
        return "Password must be at least 10 characters."
    }

    const hasLetter = /[a-zA-Z]/.test(password)
    const hasNumber = /\d/.test(password)

    if (!hasLetter || !hasNumber) {
        return "Password must include at least one letter and one number."
    }

    return null
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
    const params = await searchParams
    const errorMessage = params.error ? decodeURIComponent(params.error) : ""

    async function signupAction(formData: FormData) {
        "use server"

        const email = safeEmail(String(formData.get("email") ?? ""))
        const password = String(formData.get("password") ?? "")
        const confirmPassword = String(formData.get("confirmPassword") ?? "")
        const requestHeaders = await headers()
        const clientIp = (requestHeaders.get("x-forwarded-for") ?? "unknown").split(",")[0].trim()
        const signupKey = `${email}|${clientIp}`

        if (!canAttemptSignup(signupKey)) {
            redirect("/signup?error=Too%20many%20signup%20attempts.%20Please%20try%20again%20later")
        }

        if (!email || !password || !confirmPassword) {
            registerSignupFailure(signupKey)
            redirect("/signup?error=Please%20fill%20all%20fields")
        }

        if (!/^\S+@\S+\.\S+$/.test(email)) {
            registerSignupFailure(signupKey)
            redirect("/signup?error=Please%20enter%20a%20valid%20email")
        }

        if (email.length > 254) {
            registerSignupFailure(signupKey)
            redirect("/signup?error=Please%20enter%20a%20valid%20email")
        }

        const passwordError = validatePassword(password)
        if (passwordError) {
            registerSignupFailure(signupKey)
            redirect(`/signup?error=${encodeURIComponent(passwordError)}`)
        }

        if (password.length > 128) {
            registerSignupFailure(signupKey)
            redirect("/signup?error=Password%20is%20too%20long")
        }

        if (password !== confirmPassword) {
            registerSignupFailure(signupKey)
            redirect("/signup?error=Passwords%20do%20not%20match")
        }

        const existingUser = await findUserByEmail(email)
        if (existingUser) {
            registerSignupFailure(signupKey)
            redirect("/signup?error=Unable%20to%20create%20account%20with%20provided%20credentials")
        }

        const passwordHash = await hash(password, 12)
        try {
            await createUser(email, passwordHash)
        } catch {
            registerSignupFailure(signupKey)
            redirect("/signup?error=Unable%20to%20create%20account%20with%20provided%20credentials")
        }

        clearSignupFailures(signupKey)

        redirect("/login?message=Account%20created%20successfully&next=%2Fdashboard")
    }

    return (
        <main className="min-h-screen bg-[#f8f5ef] px-4 py-10 dark:bg-slate-950">
            <div className="mx-auto w-full max-w-md rounded-3xl border border-[#e9ddc9] bg-[#fffdf8]/95 p-8 shadow-[0_20px_60px_rgba(58,48,36,0.10)] dark:border-slate-700 dark:bg-slate-900/90">
                <p className="text-xs uppercase tracking-[0.2em] text-[#8a7a62] dark:text-slate-400">Secure onboarding</p>
                <h1 className="mt-2 text-3xl font-semibold text-[#2b2218] dark:text-slate-100">Create account</h1>
                <p className="mt-2 text-sm text-[#6f604b] dark:text-slate-300">Sign up to access the ELV dashboard and data management tools.</p>

                {errorMessage ? (
                    <div className="mt-5 rounded-xl border border-[#f4bea7] bg-[#fff1eb] p-3 text-sm text-[#8a3c1f] dark:border-rose-900/60 dark:bg-rose-950/20 dark:text-rose-200">
                        {errorMessage}
                    </div>
                ) : null}

                <form action={signupAction} className="mt-6 space-y-4">
                    <div>
                        <label htmlFor="email" className="mb-1 block text-sm font-medium text-[#4f4333] dark:text-slate-200">Email</label>
                        <input
                            id="email"
                            name="email"
                            type="email"
                            autoComplete="email"
                            required
                            className="w-full rounded-xl border border-[#d7c9b1] bg-white px-4 py-3 text-[#3a3024] outline-none transition focus:border-[#2c7a58] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                            placeholder="you@company.com"
                        />
                    </div>

                    <div>
                        <label htmlFor="password" className="mb-1 block text-sm font-medium text-[#4f4333] dark:text-slate-200">Password</label>
                        <input
                            id="password"
                            name="password"
                            type="password"
                            autoComplete="new-password"
                            required
                            minLength={10}
                            className="w-full rounded-xl border border-[#d7c9b1] bg-white px-4 py-3 text-[#3a3024] outline-none transition focus:border-[#2c7a58] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                            placeholder="Minimum 10 characters"
                        />
                    </div>

                    <div>
                        <label htmlFor="confirmPassword" className="mb-1 block text-sm font-medium text-[#4f4333] dark:text-slate-200">Confirm password</label>
                        <input
                            id="confirmPassword"
                            name="confirmPassword"
                            type="password"
                            autoComplete="new-password"
                            required
                            minLength={10}
                            className="w-full rounded-xl border border-[#d7c9b1] bg-white px-4 py-3 text-[#3a3024] outline-none transition focus:border-[#2c7a58] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                            placeholder="Repeat your password"
                        />
                    </div>

                    <button
                        type="submit"
                        className="w-full rounded-xl bg-[#2c7a58] px-4 py-3 font-semibold text-white transition hover:bg-[#235f45]"
                    >
                        Create account
                    </button>
                </form>

                <p className="mt-5 text-xs leading-5 text-[#8a7a62] dark:text-slate-400">
                    Already registered?{" "}
                    <Link href="/login" className="font-semibold text-[#2c7a58] dark:text-emerald-300">
                        Sign in
                    </Link>
                </p>
            </div>
        </main>
    )
}

