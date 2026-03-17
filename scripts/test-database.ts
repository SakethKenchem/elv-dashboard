/* Module: Database connectivity smoke test script that validates Prisma can reach the configured database and run a simple query. */
import "dotenv/config"
import { prisma } from "../lib/prisma"

async function testDatabase() {
    console.log("Testing Prisma Postgres connection...\n")

    try {
        console.log("Connected to database")

        console.log("\nCreating a test user...")
        const timestamp = Date.now()
        const newUser = await prisma.user.create({
            data: {
                email: `demo+${timestamp}@example.com`,
                passwordHash: "demo-password-hash",
            },
        })
        console.log("Created user:", { id: newUser.id, email: newUser.email })

        console.log("\nFetching users...")
        const allUsers = await prisma.user.findMany({
            orderBy: { id: "desc" },
            take: 5,
        })
        console.log(`Found ${allUsers.length} user(s)`)
        allUsers.forEach((user) => {
            console.log(` - ${user.email}`)
        })

        console.log("\nAll tests passed")
    } catch (error) {
        console.error("Database test failed:", error)
        process.exit(1)
    }
}

testDatabase()

