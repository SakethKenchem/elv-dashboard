import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function DELETE() {

  await prisma.salesData.deleteMany()

  return NextResponse.json({
    success: true
  })

}