import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
export async function GET() {
  try {
    const employees = await prisma.employees.findMany({
      include: {
        Position: {
          orderBy: { StartDate: "desc" },
          take: 1,
        },
      },
      orderBy: { StartDate: "desc" },
    });

    const mapped = employees.map((e) => {
      const latestPosition = e.Position?.[0] ?? null;
      return {
        id: e.EmployeeId,
        fullName: e.FullName,
        email: e.Email,
        phone: e.Phone ?? undefined,
        jobTitle: e.JobTitle ?? undefined,
        staffType: e.StaffType,
        degree: e.Degree ?? undefined,
        academicPosition: latestPosition?.AcademicPosition ?? undefined,
        supportAcademicPosition: latestPosition?.SupportPosition ?? undefined,
        status: e.Status,
        updatedAt:
          e.UpdatedAt?.toISOString?.() ??
          e.CreatedAt?.toISOString?.() ??
          (e.UpdatedAt as any),
      };
    });

    return NextResponse.json(mapped);
  } catch (error) {
    console.error("Failed to fetch employees:", error);
    return NextResponse.json(
      { error: "ไม่สามารถโหลดข้อมูลบุคลากรได้" },
      { status: 500 }
    );
  }
}

function yearsBetween(from: Date, to: Date) {
  const msPerYear = 1000 * 60 * 60 * 24 * 365.25;
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / msPerYear));
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const fullName = (body.fullName as string | undefined)?.trim();
    const gender = body.gender as "MALE" | "FEMALE" | undefined;
    const birthDateStr = body.birthDate as string | undefined;
    const startDateStr = body.startDate as string | undefined;
    const phone = (body.phone as string | undefined)?.trim();
    const email = (body.email as string | undefined)?.trim();
    const employeeTypeKey = body.employeeTypeKey as
      | "GOVERNMENT"
      | "BUDGET"
      | "INCOME"
      | "SPECIAL"
      | undefined;
    const contractType = body.contractType as "PROBATION" | "EMPLOYMENT" | undefined;
    const contractRoundParsed: number | null = (() => {
      const raw = body.contractRound;
      if (raw == null || raw === "") return null;
      const n = Number(raw);
      return Number.isFinite(n) ? n : null;
    })();
    const contractStartDateStr = body.contractStartDate as string | undefined;
    const contractEndDateStr = body.contractEndDate as string | undefined;
    const budgetAppointmentDate = body.budgetAppointmentDate as string | undefined;
    const incomeAppointmentDate = body.incomeAppointmentDate as string | undefined;
    const staffType = body.staffType as "ACADEMIC" | "SUPPORT" | undefined;
    const jobTitle = (body.jobTitle as string | undefined)?.trim();
    const PositionNumber = body.PositionNumber as string | number | undefined;
    const degree = body.degree as
      | "BACHELOR"
      | "MASTER"
      | "DOCTOR"
      | "OTHER"
      | undefined;
    const degreeDetail =
      degree === "OTHER"
        ? ((body.degreeDetail as string | undefined)?.trim() ?? "")
        : "";
    const academicPosition = body.academicPosition as
      | "LECTURER"
      | "ASSISTANT_PROFESSOR"
      | "ASSOCIATE_PROFESSOR"
      | "PROFESSOR"
      | undefined;
    const supportPosition = body.supportPosition as
      | "OPERATIONAL_LEVEL"
      | "SENIOR_PRACTITIONER"
      | "EXPERT"
      | "SENIOR_EXPERT"
      | "SUPPORTACADEMIC" 
      | undefined;

    const supportPositionForDb =
      supportPosition === "SUPPORTACADEMIC" ? "OPERATIONAL_LEVEL" : supportPosition;
    const positions = (body.positions ?? []) as Array<{
      academicPosition?: "LECTURER" | "ASSISTANT_PROFESSOR" | "ASSOCIATE_PROFESSOR" | "PROFESSOR";
      supportPosition?: "OPERATIONAL_LEVEL" | "SENIOR_PRACTITIONER" | "EXPERT" | "SENIOR_EXPERT";
      startDate?: string;
      endDate?: string;
    }>;
    const administrativePositions = (body.administrativePositions ?? []) as Array<{
      positionName?: string;
      startDate?: string;
      endDate?: string;
    }>;
    const hasIncompleteAdminPosition = administrativePositions.some(
      (a) => !a.positionName?.trim() || !a.startDate
    );

    if (
      !fullName ||
      !gender ||
      !birthDateStr ||
      !startDateStr ||
      !email ||
      !phone ||
      !employeeTypeKey ||
      !staffType ||
      !degree ||
      !["BACHELOR", "MASTER", "DOCTOR", "OTHER"].includes(degree)
    ) {
      return NextResponse.json(
        {
          error:
            "กรุณากรอกข้อมูลให้ครบถ้วน",
        },
        { status: 400 },
      );
    }
    const positionNumberParsed: number | null = (() => {
      if (PositionNumber == null) return null;
      const raw = typeof PositionNumber === "string" ? PositionNumber.trim() : String(PositionNumber);
      if (raw === "") return null;
      return Number(raw);
    })();
    if (positionNumberParsed != null && Number.isNaN(positionNumberParsed)) {
      return NextResponse.json(
        { error: "เลขที่อัตราจ้างไม่ถูกต้อง" },
        { status: 400 },
      );
    }
    if (degree === "OTHER" && !degreeDetail) {
      return NextResponse.json(
        { error: "กรุณาระบุวุฒิการศึกษา" },
        { status: 400 },
      );
    }
    if (hasIncompleteAdminPosition) {
      return NextResponse.json(
        { error: "ข้อมูลตำแหน่งบริหารไม่ครบถ้วน" },
        { status: 400 },
      );
    }

    const birthDate = new Date(birthDateStr);
    const startDate = new Date(startDateStr);
    if (Number.isNaN(birthDate.getTime()) || Number.isNaN(startDate.getTime())) {
      return NextResponse.json({ error: "รูปแบบวันที่ไม่ถูกต้อง" }, { status: 400 });
    }

    if (employeeTypeKey !== "GOVERNMENT") {
      if (!contractType || !contractStartDateStr || !contractEndDateStr) {
        return NextResponse.json(
          { error: "กรุณาระบุประเภทสัญญา และวันที่เริ่ม–สิ้นสุดสัญญา" },
          { status: 400 },
        );
      }
    }

    const contractStartDate = contractStartDateStr
      ? new Date(contractStartDateStr)
      : null;
    const contractEndDate = contractEndDateStr ? new Date(contractEndDateStr) : null;
    if (
      (contractStartDateStr && Number.isNaN(contractStartDate!.getTime())) ||
      (contractEndDateStr && Number.isNaN(contractEndDate!.getTime()))
    ) {
      return NextResponse.json({ error: "กรุณาตรวจสอบวันที่สัญญาให้ถูกต้อง" }, { status: 400 });
    }
    if (
      contractStartDate &&
      contractEndDate &&
      contractEndDate.getTime() < contractStartDate.getTime()
    ) {
      return NextResponse.json(
        { error: "กรุณาตรวจสอบวันที่สัญญาให้ถูกต้อง" },
        { status: 400 },
      );
    }

    const today = new Date();
    const age = yearsBetween(birthDate, today);
    const workDuration = yearsBetween(startDate, today);

    const employmentStart =
      employeeTypeKey === "INCOME" && incomeAppointmentDate
        ? new Date(incomeAppointmentDate)
        : employeeTypeKey === "BUDGET" && budgetAppointmentDate
          ? new Date(budgetAppointmentDate)
          : startDate;

    const adminToCreate = administrativePositions.map((a) => ({
        positionName: a.positionName!.trim(),
        startDate: new Date(a.startDate!),
        endDate: a.endDate ? new Date(a.endDate) : null,
      }));
    const positionsToCreate = positions
      .filter((p) => p.startDate && (p.academicPosition || p.supportPosition))
      .map((p) => ({
        AcademicPosition: staffType === "ACADEMIC" ? p.academicPosition ?? null : null,
        SupportPosition: staffType === "SUPPORT" ? p.supportPosition ?? null : null,
        StartDate: new Date(p.startDate!),
        EndDate: p.endDate ? new Date(p.endDate) : null,
      }));

    const employee = await prisma.$transaction(async (tx) => {
      const employeeCreateData = {
        FullName: fullName,
        Gender: gender,
        BirthDate: birthDate,
        Age: age,
        StartDate: startDate,
        WorkDuration: workDuration,
        StaffType: staffType,
        JobTitle: jobTitle || null,
        PositionNumber: positionNumberParsed,
        Degree: degree,
        DegreeDetail: degree === "OTHER" ? degreeDetail : "",
        Email: email,
        Phone: phone,
        Status: "ACTIVE" as const
      } as unknown as Prisma.EmployeesCreateInput;

      const emp = await tx.employees.create({
        data: employeeCreateData,
        select: { EmployeeId: true },
      });

      await tx.employments.create({
        data: {
          EmployeeId: emp.EmployeeId,
          EmploymentType: employeeTypeKey,
          StartDate: employmentStart,
        },
      });

      if (contractType && employeeTypeKey !== "GOVERNMENT") {
        await tx.employeeContracts.create({
          data: {
            EmployeeId: emp.EmployeeId,
            ContractType: contractType,
            ContractRound:
              contractType === "EMPLOYMENT" ? contractRoundParsed : 0,
            StartDate: contractStartDate ?? startDate,
            EndDate: contractEndDate ?? startDate,
            IsActive: true,
          },
        });
      }

      if (positionsToCreate.length > 0) {
        await tx.positions.createMany({
          data: positionsToCreate.map((p) => ({
            EmployeeId: emp.EmployeeId,
            ...p,
          })),
        });
      } else if (academicPosition || supportPositionForDb) {
        await tx.positions.create({
          data: {
            EmployeeId: emp.EmployeeId,
            AcademicPosition: academicPosition ?? null,
            SupportPosition: supportPositionForDb ?? null,
            StartDate: startDate,
            EndDate: null,
          },
        });
      }

      if (adminToCreate.length > 0) {
        await tx.employeeAdministrativePositions.createMany({
          data: adminToCreate.map((a) => ({
            EmployeeId: emp.EmployeeId,
            PositionName: a.positionName,
            StartDate: a.startDate,
            EndDate: a.endDate,
          })),
        });
      }

      return emp;
    });

    return NextResponse.json({ ok: true, id: employee.EmployeeId });
  } catch (error: any) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "อีเมลนี้ถูกใช้งานแล้ว" },
        { status: 409 },
      );
    }
    if (error instanceof Prisma.PrismaClientValidationError) {
      const msg = error.message;
      const needsRegenerate =
        msg.includes("OTHER") ||
        msg.includes("Invalid value for argument `Degree`");
      console.error("Failed to create employee (validation):", error);
      return NextResponse.json(
        {
          error: needsRegenerate
            ? "กรุณาตรวจสอบข้อมูลให้ถูกต้อง"
            : "กรุณาตรวจสอบข้อมูลให้ถูกต้อง",
          hint: needsRegenerate
            ? "ปิดเซิร์ฟเวอร์ dev (npm run dev) แล้วรัน npx prisma generate ในโฟลเดอร์โปรเจกต์ จากนั้นเปิด dev ใหม่ — ถ้ายัง error ให้รัน npx prisma migrate deploy หรือ db push ด้วย"
            : undefined,
          ...(process.env.NODE_ENV === "development" ? { detail: msg } : {}),
        },
        { status: 500 },
      );
    }
    console.error("Failed to create employee:", error);
    const message =
      error instanceof Prisma.PrismaClientKnownRequestError
        ? error.message
        : error instanceof Error
          ? error.message
          : String(error);
    return NextResponse.json(
      {
        error: "บันทึกข้อมูลไม่สำเร็จ",
        ...(process.env.NODE_ENV === "development" ? { detail: message } : {}),
      },
      { status: 500 },
    );
  }
}
