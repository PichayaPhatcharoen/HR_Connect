import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { ids } = (await req.json()) as { ids?: string[] };
  if (!ids?.length) {
    return NextResponse.json({ success: true });
  }

  await prisma.positions.updateMany({
    where: {
      PositionId: { in: ids },
    },
    data: {
      AcademicRetirementReadByHR: true,
    },
  });

  return NextResponse.json({ success: true });
}
