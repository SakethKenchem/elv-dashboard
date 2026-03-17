/* Module: API endpoint returning current authenticated user profile/session payload. */
import { authOptions } from "@/auth"
import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"

function formatNameFromEmail(email: string): string {
    const local = email.split("@")[0] ?? ""
    if (!local) {
        return "User"
    }

    return local
        .split(/[._-]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(" ")
}

export async function GET() {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const fallbackName = session.user.email ? formatNameFromEmail(session.user.email) : "User"
    const name = session.user.name?.trim() || fallbackName

    return NextResponse.json({ name })
}
