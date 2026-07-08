import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeAcademicRetirementDateIsoFromDb } from "@/lib/academicRetirement";

export async function GET() {
  const now = new Date();

  const twoMonthsLater = new Date();
  twoMonthsLater.setMonth(now.getMonth() + 2);

  const positionRows = await prisma.positions.findMany({
    where: {
      AcademicPosition: { not: null },
      EndDate: null,
      Employee: {
        StaffType: "ACADEMIC",
        Status: "ACTIVE",
      },
    },
    include: {
      Employee: {
        select: {
          EmployeeId: true,
          FullName: true,
          BirthDate: true,
        },
      },
    },
  });

  const data = positionRows
    .map((row) => {
      const e = row.Employee;
      const retirementIso = computeAcademicRetirementDateIsoFromDb(e.BirthDate);
      if (!retirementIso) return null;
      const retirementDate = new Date(retirementIso);
      if (
        retirementDate.getTime() < now.getTime() ||
        retirementDate.getTime() > twoMonthsLater.getTime()
      ) {
        return null;
      }
      return {
        PositionId: row.PositionId,
        EmployeeId: e.EmployeeId,
        FullName: e.FullName,
        RetirementDate: retirementIso,
        ReadByHR: row.AcademicRetirementReadByHR,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x != null);

  const count = data.filter((d) => !d.ReadByHR).length;

  return NextResponse.json({
    count,
    data,
  });
}
