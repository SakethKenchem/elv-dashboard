/* Module: NextAuth handler bridge exposing GET/POST auth endpoints for sign-in and session flows. */
import { authOptions } from "@/auth"
import NextAuth from "next-auth"

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
