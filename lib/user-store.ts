/* Module: User persistence helpers used by auth and ownership logic. */
import { Pool } from "pg"

type UserRecord = {
    id: number
    email: string
    passwordHash: string
}

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
    throw new Error("Missing DATABASE_URL in environment variables")
}

const globalForPool = globalThis as unknown as { userStorePool?: Pool }

const pool =
    globalForPool.userStorePool ??
    new Pool({
        connectionString: databaseUrl,
    })

if (process.env.NODE_ENV !== "production") {
    globalForPool.userStorePool = pool
}

export async function countUsers(): Promise<number> {
    const result = await pool.query<{ count: string }>('SELECT COUNT(*)::text AS "count" FROM "User"')
    return Number(result.rows[0]?.count ?? 0)
}

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
    const result = await pool.query<UserRecord>(
        'SELECT "id", "email", "passwordHash" FROM "User" WHERE "email" = $1 LIMIT 1',
        [email]
    )

    return result.rows[0] ?? null
}

export async function createUser(email: string, passwordHash: string): Promise<UserRecord> {
    const result = await pool.query<UserRecord>(
        'INSERT INTO "User" ("email", "passwordHash", "createdAt", "updatedAt") VALUES ($1, $2, NOW(), NOW()) RETURNING "id", "email", "passwordHash"',
        [email, passwordHash]
    )

    return result.rows[0]
}

