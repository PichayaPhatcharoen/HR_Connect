import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function POST(req: Request) {

  const { ids } = await req.json()

  await prisma.employeeContracts.updateMany({
    where: {
      ContractId: {
        in: ids
      }
    },
    data: {
      ReadByHR: true
    }
  })

  return NextResponse.json({ success: true })
}