import { resolveAuthSecret } from "@/lib/auth-secret"
import { getToken } from "next-auth/jwt"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

const AUTH_SECRET = resolveAuthSecret()

export default async function middleware(req: NextRequest) {
    const token = await getToken({ req, secret: AUTH_SECRET })
    const isAuthenticated = Boolean(token)
    const pathname = req.nextUrl.pathname
    const isPublicPage = pathname === "/" || pathname === "/login" || pathname === "/signup"

    if (pathname.startsWith("/api/auth")) {
        return NextResponse.next()
    }

    if (pathname === "/login" || pathname === "/signup") {
        if (isAuthenticated) {
            return NextResponse.redirect(new URL("/dashboard", req.url))
        }
        return NextResponse.next()
    }

    if (isPublicPage) {
        return NextResponse.next()
    }

    if (!isAuthenticated) {
        if (pathname.startsWith("/api/")) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const loginUrl = new URL("/login", req.url)
        loginUrl.searchParams.set("next", `${pathname}${req.nextUrl.search}`)
        return NextResponse.redirect(loginUrl)
    }

    return NextResponse.next()
}

export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map)$).*)"],
}
