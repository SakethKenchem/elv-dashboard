import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function POST() {

  const data = await prisma.salesData.findMany({
    orderBy: { id: "asc" }
  })

  const seen = new Set()
  const duplicates:number[] = []

  for (const row of data) {

    const key =
      row.region +
      row.vendor +
      row.salesManager +
      row.quarterTarget

    if (seen.has(key)) {
      duplicates.push(row.id)
    } else {
      seen.add(key)
    }

  }

  if (duplicates.length > 0) {

    await prisma.salesData.deleteMany({
      where:{
        id:{ in:duplicates }
      }
    })

  }

  return NextResponse.json({
    removed: duplicates.length
  })

}