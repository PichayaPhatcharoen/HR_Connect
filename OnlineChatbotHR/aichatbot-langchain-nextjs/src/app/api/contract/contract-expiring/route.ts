import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const now = new Date();

  const twoMonthsLater = new Date();
  twoMonthsLater.setMonth(now.getMonth() + 2);

  const contracts = await prisma.employeeContracts.findMany({
    where: {
      EndDate: {
        gte: now,
        lte: twoMonthsLater,
      },
    },
    include: {
      Employee: {
        select: {
          FullName: true,
        },
      },
    },
  });

  const unreadCount = contracts.filter(c => !c.ReadByHR).length;

  return NextResponse.json({
    count: unreadCount,
    data: contracts,
  });
}