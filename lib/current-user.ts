import { authOptions } from "@/auth"
import { findUserByEmail } from "@/lib/user-store"
import { getServerSession } from "next-auth"

export async function getCurrentUserId(): Promise<number | null> {
    const session = await getServerSession(authOptions)

    const sessionUserId = Number(session?.user?.id)
    if (Number.isInteger(sessionUserId) && sessionUserId > 0) {
        return sessionUserId
    }

    const email = session?.user?.email?.trim().toLowerCase()

    if (!email) {
        return null
    }

    const user = await findUserByEmail(email)
    return user?.id ?? null
}
