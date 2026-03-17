/* Module: Client login form handling credential submission and auth state feedback. */
"use client"

import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useState } from "react"

type LoginFormProps = {
    nextPath: string
}

export function LoginForm({ nextPath }: LoginFormProps) {
    const router = useRouter()
    const [errorMessage, setErrorMessage] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)

    async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setErrorMessage("")
        setIsSubmitting(true)

        const formData = new FormData(event.currentTarget)
        const email = String(formData.get("email") ?? "").trim().toLowerCase()
        const password = String(formData.get("password") ?? "")

        try {
            const result = await signIn("credentials", {
                email,
                password,
                redirect: false,
                callbackUrl: nextPath,
            })

            if (!result || result.error) {
                setErrorMessage("Invalid credentials or account locked temporarily.")
                return
            }

            const destination = result.url ?? nextPath
            router.push(destination)
            router.refresh()
            window.location.assign(destination)
        } catch {
            setErrorMessage("Unable to sign in right now. Please try again.")
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <input type="hidden" name="next" value={nextPath} />

            {errorMessage ? (
                <div className="rounded-xl border border-[#f4bea7] bg-[#fff1eb] p-3 text-sm text-[#8a3c1f] dark:border-rose-900/60 dark:bg-rose-950/20 dark:text-rose-200">
                    {errorMessage}
                </div>
            ) : null}

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
                    autoComplete="current-password"
                    required
                    minLength={10}
                    className="w-full rounded-xl border border-[#d7c9b1] bg-white px-4 py-3 text-[#3a3024] outline-none transition focus:border-[#2c7a58] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                    placeholder="Enter your password"
                />
            </div>

            <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-xl bg-[#2c7a58] px-4 py-3 font-semibold text-white transition hover:bg-[#235f45] disabled:cursor-not-allowed disabled:opacity-70"
            >
                {isSubmitting ? "Signing in..." : "Sign in securely"}
            </button>
        </form>
    )
}

