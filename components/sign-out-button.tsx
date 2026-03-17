/* Module: Reusable sign-out action button tied to NextAuth logout flow. */
"use client"

import { signOut } from "next-auth/react"

export function SignOutButton() {
    return (
        <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="w-full rounded-xl border border-[#d6c7ae] px-4 py-2.5 text-sm font-semibold text-[#4f4333] transition hover:bg-[#f4ebdd] dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
        >
            Sign out
        </button>
    )
}

