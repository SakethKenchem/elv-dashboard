/* Module: Runtime helper for loading and validating authentication secret configuration. */
const FALLBACK_DEV_SECRET = "dev-insecure-auth-secret-change-me"

export function resolveAuthSecret(): string {
    const configuredSecret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET

    if (configuredSecret) {
        return configuredSecret
    }

    if (process.env.NODE_ENV === "production") {
        throw new Error("Missing AUTH_SECRET (or NEXTAUTH_SECRET) in production")
    }

    return FALLBACK_DEV_SECRET
}

