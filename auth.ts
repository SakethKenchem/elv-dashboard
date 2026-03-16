import { compare, hash } from "bcryptjs"
import { resolveAuthSecret } from "@/lib/auth-secret"
import { countUsers, createUser, findUserByEmail } from "@/lib/user-store"
import type { NextAuthOptions } from "next-auth"
import Credentials from "next-auth/providers/credentials"

type AttemptState = {
    count: number
    blockedUntil: number
}

const attempts = new Map<string, AttemptState>()
const MAX_ATTEMPTS = 5
const BLOCK_WINDOW_MS = 10 * 60 * 1000
const AUTH_SECRET = resolveAuthSecret()

function normalizeEmail(value: string): string {
    return value.trim().toLowerCase()
}

function canAttempt(key: string): boolean {
    const now = Date.now()
    const state = attempts.get(key)

    if (!state) {
        return true
    }

    if (state.blockedUntil > now) {
        return false
    }

    if (state.blockedUntil !== 0) {
        attempts.delete(key)
    }

    return true
}

function registerFailure(key: string) {
    const now = Date.now()
    const current = attempts.get(key)

    if (!current) {
        attempts.set(key, { count: 1, blockedUntil: 0 })
        return
    }

    const nextCount = current.count + 1
    if (nextCount >= MAX_ATTEMPTS) {
        attempts.set(key, { count: nextCount, blockedUntil: now + BLOCK_WINDOW_MS })
        return
    }

    attempts.set(key, { count: nextCount, blockedUntil: 0 })
}

function clearFailures(key: string) {
    attempts.delete(key)
}

async function bootstrapAdminIfAllowed(email: string, password: string) {
    const hasUsers = await countUsers()
    if (hasUsers > 0) {
        return null
    }

    const adminEmail = normalizeEmail(process.env.ADMIN_EMAIL ?? "")
    const adminPassword = process.env.ADMIN_PASSWORD ?? ""

    if (!adminEmail || !adminPassword) {
        return null
    }

    if (email !== adminEmail || password !== adminPassword) {
        return null
    }

    const passwordHash = await hash(adminPassword, 12)

    return createUser(adminEmail, passwordHash)
}

export const authOptions: NextAuthOptions = {
    session: {
        strategy: "jwt",
        maxAge: 60 * 60 * 8,
    },
    callbacks: {
        async jwt({ token, user }) {
            if (user?.id) {
                token.userId = Number(user.id)
            }

            return token
        },
        async session({ session, token }) {
            if (session.user && typeof token.userId === "number") {
                session.user.id = String(token.userId)
            }

            return session
        },
    },
    secret: AUTH_SECRET,
    pages: {
        signIn: "/login",
    },
    providers: [
        Credentials({
            name: "Email and password",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
            },
            authorize: async (credentials) => {
                const email = normalizeEmail(String(credentials?.email ?? ""))
                const password = String(credentials?.password ?? "")

                if (!email || !password) {
                    return null
                }

                if (!canAttempt(email)) {
                    return null
                }

                let user = await findUserByEmail(email)

                if (!user) {
                    user = await bootstrapAdminIfAllowed(email, password)
                }

                if (!user) {
                    registerFailure(email)
                    return null
                }

                const validPassword = await compare(password, user.passwordHash)
                if (!validPassword) {
                    registerFailure(email)
                    return null
                }

                clearFailures(email)

                return {
                    id: String(user.id),
                    email: user.email,
                }
            },
        }),
    ],
}