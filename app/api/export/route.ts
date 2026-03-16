import { NextResponse } from "next/server"
import * as XLSX from "xlsx"
import { prisma } from "@/lib/prisma"
import { getCurrentUserId } from "@/lib/current-user"

export const runtime = "nodejs"

export async function GET() {
    try {
        const ownerId = await getCurrentUserId()
        if (!ownerId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const rows = await prisma.salesData.findMany({
            where: { ownerId },
            orderBy: { id: "asc" },
        })

        if (rows.length === 0) {
            return NextResponse.json({ error: "No data to export" }, { status: 404 })
        }

        const first = rows[0]
        const m1 = first.month1Name || "JAN"
        const m2 = first.month2Name || "FEB"
        const m3 = first.month3Name || "MAR"

        const data = rows.map((row) => ({
            Region: row.region,
            "Sales Manager": row.salesManager,
            Vendor: row.vendor,
            "YR TGT": Number(row.yearTarget),
            "QTR TGT": Number(row.quarterTarget),
            "MON TGT": Number(row.monthTarget),
            [m1]: Number(row.jan ?? 0),
            [m2]: Number(row.feb ?? 0),
            [m3]: Number(row.mar ?? 0),
            "Total Achieved": Number(row.totalAchieved ?? 0),
            "Commit Month": row.commitMonth,
            [`Commit - ${m3}`]: Number(row.commitMar ?? 0),
            "%Achvd Q1": Number(row.percentQ1 ?? 0),
            "Bal to Achv Q1": Number(row.balanceQ1 ?? 0),
        }))

        const wb = XLSX.utils.book_new()
        const ws = XLSX.utils.json_to_sheet(data)
        XLSX.utils.book_append_sheet(wb, ws, "Master")

        const raw = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as Uint8Array
        const buf = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength) as ArrayBuffer
        const blob = new Blob([buf], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        })
        const date = new Date().toISOString().slice(0, 10)

        return new NextResponse(blob, {
            status: 200,
            headers: {
                "Content-Type":
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Content-Disposition": `attachment; filename="elv-export-${date}.xlsx"`,
            },
        })
    } catch (error) {
        return NextResponse.json(
            {
                error: "Export failed",
                details: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
        )
    }
}
