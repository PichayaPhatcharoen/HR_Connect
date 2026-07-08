import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ employeeId: string }> }
) {
  const id = (await params).employeeId;
  try {
    const e = await prisma.employees.findUnique({
      where: { EmployeeId: id },
      include: {
        Employment: {
          orderBy: { StartDate: "desc" },
          take: 1,
        },
        Position: {
          orderBy: { StartDate: "desc" },
        },
        AdministrativePositions: {
          orderBy: { StartDate: "desc" },
        },
        EmployeeContracts: {
          where: { IsActive: true },
          orderBy: { StartDate: "desc" },
          take: 1,
        },
      },
    });

    if (!e) {
      return NextResponse.json(
        { error: "ไม่พบข้อมูลบุคลากร" },
        { status: 404 }
      );
    }

    const latestEmployment = e.Employment?.[0] ?? null;
    const employmentType = latestEmployment?.EmploymentType ?? "GOVERNMENT";
    const employeeCategory =
      employmentType === "GOVERNMENT" ? null : employmentType;

    const latestPosition = e.Position?.[0] ?? null;

    const latestContract = e.EmployeeContracts?.[0] ?? null;
    const contractTypeForClient =
      latestContract?.ContractType === "EMPLOYMENT"
        ? "CONTRACT"
        : latestContract?.ContractType ?? undefined;
    const contractNumberForClient =
      latestContract?.ContractType === "EMPLOYMENT"
        ? latestContract.ContractRound ?? undefined
        : undefined;

    return NextResponse.json({
      id: e.EmployeeId,
      fullName: e.FullName,
      gender: e.Gender ?? undefined,
      birthDate: e.BirthDate.toISOString().slice(0, 10),
      startDate: e.StartDate.toISOString().slice(0, 10),
      phone: e.Phone ?? "",
      email: e.Email,
      educationLevel: e.Degree ?? undefined,
      educationLevelDetail: e.DegreeDetail ?? undefined,
      employmentType,
      employeeCategory: employeeCategory ?? undefined,
      contractType: contractTypeForClient,
      contractNumber: contractNumberForClient,
      contractStartDate: latestContract
        ? latestContract.StartDate.toISOString().slice(0, 10)
        : "",
      contractEndDate: latestContract
        ? latestContract.EndDate.toISOString().slice(0, 10)
        : "",
      budgetAppointmentDate: undefined,
      incomeAppointmentDate: undefined,
      staffType: e.StaffType,
      jobTitle: e.JobTitle ?? "",
      PositionNumber: e.PositionNumber ?? undefined,
      academicPosition: latestPosition?.AcademicPosition ?? undefined,
      supportAcademicPosition: latestPosition?.SupportPosition ?? undefined,
      positions: e.Position.map((p) => ({
        id: p.PositionId,
        academicPosition: p.AcademicPosition ?? undefined,
        supportPosition: p.SupportPosition ?? undefined,
        startDate: p.StartDate ? p.StartDate.toISOString().slice(0, 10) : "",
        endDate: p.EndDate ? p.EndDate.toISOString().slice(0, 10) : "",
      })),
      status: e.Status,
      administrativePositions: e.AdministrativePositions.map((a) => ({
        id: a.EmployeeAdministrativePositionId,
        positionName: a.PositionName,
        startDate: a.StartDate.toISOString().slice(0, 10),
        endDate: a.EndDate ? a.EndDate.toISOString().slice(0, 10) : undefined,
      })),
    });
  } catch (error) {
    console.error("Failed to fetch employee:", error);
    return NextResponse.json(
      { error: "ไม่สามารถโหลดข้อมูลบุคลากรได้" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ employeeId: string }> }
) {
  const id = (await params).employeeId;
  try {
    const body = await request.json();

    const fullName = body.fullName?.trim();
    const email = body.email?.trim();
    const startDate = body.startDate as string | undefined;
    const birthDate = body.birthDate as string | undefined;
    if (!fullName || !email || !startDate || !birthDate) {
      return NextResponse.json(
        { error: "กรุณากรอกข้อมูลให้ครบถ้วน" },
        { status: 400 }
      );
    }

    const administrativePositions = (body.administrativePositions ?? []) as Array<{
      positionName?: string;
      startDate?: string;
      endDate?: string;
    }>;
    const hasIncompleteAdminPosition = administrativePositions.some(
      (a) => !a.positionName?.trim() || !a.startDate
    );
    if (hasIncompleteAdminPosition) {
      return NextResponse.json(
        { error: "ข้อมูลตำแหน่งบริหารไม่ครบถ้วน" },
        { status: 400 }
      );
    }

    const PositionNumberRaw = body.PositionNumber as string | undefined;
    const PositionNumber =
      PositionNumberRaw != null &&
      PositionNumberRaw !== "" &&
      !Number.isNaN(Number(PositionNumberRaw))
        ? Number(PositionNumberRaw)
        : null;

    const educationLevelRaw = body.educationLevel as string | undefined;
    const degreeToSave =
      educationLevelRaw &&
      ["BACHELOR", "MASTER", "DOCTOR", "OTHER"].includes(educationLevelRaw)
        ? (educationLevelRaw as "BACHELOR" | "MASTER" | "DOCTOR" | "OTHER")
        : undefined;
    const educationLevelDetail =
      degreeToSave === "OTHER"
        ? ((body.educationLevelDetail as string | undefined)?.trim() ?? "")
        : "";

    if (degreeToSave === "OTHER" && !educationLevelDetail) {
      return NextResponse.json(
        { error: "กรุณาระบุวุฒิการศึกษา" },
        { status: 400 }
      );
    }

    const employmentTypeBody = body.employmentType as
      | "GOVERNMENT"
      | "INSTITUTE_EMPLOYEE"
      | undefined;
    const employeeCategory = body.employeeCategory as
      | "BUDGET"
      | "INCOME"
      | "SPECIAL"
      | null
      | undefined;

    let employmentTypeForDb: "GOVERNMENT" | "BUDGET" | "INCOME" | "SPECIAL" =
      "GOVERNMENT";
    if (employmentTypeBody === "GOVERNMENT") {
      employmentTypeForDb = "GOVERNMENT";
    } else if (employeeCategory) {
      employmentTypeForDb = employeeCategory;
    }

    const budgetAppointmentDate = body.budgetAppointmentDate as
      | string
      | undefined;
    const incomeAppointmentDate = body.incomeAppointmentDate as
      | string
      | undefined;

    const startDateObj = new Date(startDate);
    let employmentStart = startDateObj;
    if (
      employmentTypeForDb === "INCOME" &&
      incomeAppointmentDate &&
      !Number.isNaN(new Date(incomeAppointmentDate).getTime())
    ) {
      employmentStart = new Date(incomeAppointmentDate);
    } else if (
      employmentTypeForDb === "BUDGET" &&
      budgetAppointmentDate &&
      !Number.isNaN(new Date(budgetAppointmentDate).getTime())
    ) {
      employmentStart = new Date(budgetAppointmentDate);
    }

    const contractTypeBody = body.contractType as
      | "PROBATION"
      | "CONTRACT"
      | undefined;
    let contractTypeForDb: "PROBATION" | "EMPLOYMENT" | null = null;
    if (contractTypeBody === "PROBATION") {
      contractTypeForDb = "PROBATION";
    } else if (contractTypeBody === "CONTRACT") {
      contractTypeForDb = "EMPLOYMENT";
    }

    const contractRoundParsed: number | null = (() => {
      const raw = body.contractNumber;
      if (raw == null || raw === "") return null;
      const n = Number(raw);
      return Number.isFinite(n) ? n : null;
    })();

    const contractStartDateStr = body.contractStartDate as string | undefined;
    const contractEndDateStr = body.contractEndDate as string | undefined;

    let contractStartForDb = employmentStart;
    let contractEndForDb = employmentStart;
    if (employmentTypeForDb !== "GOVERNMENT") {
      if (!contractTypeForDb || !contractStartDateStr || !contractEndDateStr) {
        return NextResponse.json(
          {
            error:
              "กรุณาตรวจสอบสัญญาจ้าง",
          },
          { status: 400 }
        );
      }
      const cs = new Date(contractStartDateStr);
      const ce = new Date(contractEndDateStr);
      if (Number.isNaN(cs.getTime()) || Number.isNaN(ce.getTime())) {
        return NextResponse.json(
          { error: "กรุณาตรวจสอบวันที่สัญญาให้ถูกต้อง" },
          { status: 400 }
        );
      }
      if (ce.getTime() < cs.getTime()) {
        return NextResponse.json(
          {
            error: "กรุณาตรวจสอบวันที่สัญญาให้ถูกต้อง",
          },
          { status: 400 }
        );
      }
      contractStartForDb = cs;
      contractEndForDb = ce;
    }

    const staffType = (body.staffType as "ACADEMIC" | "SUPPORT" | undefined) ?? "ACADEMIC";

    const existingEmployee = await prisma.employees.findUnique({
      where: { EmployeeId: id },
      select: { BirthDate: true, StaffType: true },
    });
    const priorBirthIso = existingEmployee?.BirthDate.toISOString().slice(0, 10);
    const resetRetirementNotificationFlags =
      !existingEmployee ||
      priorBirthIso !== birthDate ||
      existingEmployee.StaffType !== staffType;

    const prevAcademicRetirementFlags = (await prisma.positions.findFirst({
      where: {
        EmployeeId: id,
        AcademicPosition: { not: null },
        EndDate: null,
      },
      orderBy: { StartDate: "desc" },
      select: {
        AcademicRetirementNotifiedHR: true,
        AcademicRetirementReadByHR: true,
      } as unknown as Prisma.PositionsSelect,
    })) as {
      AcademicRetirementNotifiedHR: boolean;
      AcademicRetirementReadByHR: boolean;
    } | null;

    const academicPosition = (body.academicPosition as
      | "LECTURER"
      | "ASSISTANT_PROFESSOR"
      | "ASSOCIATE_PROFESSOR"
      | "PROFESSOR"
      | undefined) ?? null;
    const supportAcademicPosition = (body.supportAcademicPosition as
      | "OPERATIONAL_LEVEL"
      | "SENIOR_PRACTITIONER"
      | "EXPERT"
      | "SENIOR_EXPERT"
      | undefined) ?? null;
    const positionHistory = (body.positions ?? []) as Array<{
      academicPosition?: "LECTURER" | "ASSISTANT_PROFESSOR" | "ASSOCIATE_PROFESSOR" | "PROFESSOR";
      supportPosition?: "OPERATIONAL_LEVEL" | "SENIOR_PRACTITIONER" | "EXPERT" | "SENIOR_EXPERT";
      startDate?: string;
      endDate?: string;
    }>;
    const normalizedPositions = positionHistory
      .filter((p) => p.startDate && (p.academicPosition || p.supportPosition))
      .map((p) => ({
        AcademicPosition: staffType === "ACADEMIC" ? p.academicPosition ?? null : null,
        SupportPosition: staffType === "SUPPORT" ? p.supportPosition ?? null : null,
        StartDate: new Date(p.startDate!),
        EndDate: p.endDate ? new Date(p.endDate) : null,
      }));

    await prisma.$transaction(async (tx) => {
      await tx.employeeAdministrativePositions.deleteMany({
        where: { EmployeeId: id },
      });

      await tx.employees.update({
        where: { EmployeeId: id },
        data: {
          FullName: fullName,
          Gender: body.gender || null,
          BirthDate: new Date(birthDate),
          Email: email,
          Phone: body.phone?.trim() || null,
          JobTitle: body.jobTitle?.trim() || null,
          Degree: degreeToSave,
          DegreeDetail: degreeToSave === "OTHER" ? educationLevelDetail : "",
          StaffType: staffType,
          StartDate: new Date(startDate),
          PositionNumber: PositionNumber,
        } as unknown as Prisma.EmployeesUpdateInput,
      });

      await tx.positions.deleteMany({ where: { EmployeeId: id } });
      if (normalizedPositions.length > 0) {
        await tx.positions.createMany({
          data: normalizedPositions.map((p) => ({
            EmployeeId: id,
            ...p,
          })),
        });
      } else if (academicPosition || supportAcademicPosition) {
        await tx.positions.create({
          data: {
            EmployeeId: id,
            AcademicPosition: staffType === "ACADEMIC" ? academicPosition : null,
            SupportPosition: staffType === "SUPPORT" ? supportAcademicPosition : null,
            StartDate: new Date(startDate),
            EndDate: null,
          },
        });
      }

      if (
        staffType === "ACADEMIC" &&
        !resetRetirementNotificationFlags &&
        prevAcademicRetirementFlags
      ) {
        const newAcademic = await tx.positions.findFirst({
          where: {
            EmployeeId: id,
            AcademicPosition: { not: null },
            EndDate: null,
          },
          orderBy: { StartDate: "desc" },
        });
        if (newAcademic) {
          await tx.positions.update({
            where: { PositionId: newAcademic.PositionId },
            data: {
              AcademicRetirementNotifiedHR:
                prevAcademicRetirementFlags.AcademicRetirementNotifiedHR,
              AcademicRetirementReadByHR:
                prevAcademicRetirementFlags.AcademicRetirementReadByHR,
            } as unknown as Prisma.PositionsUpdateInput,
          });
        }
      }

      const latestEmployment = await tx.employments.findFirst({
        where: { EmployeeId: id },
        orderBy: { StartDate: "desc" },
      });

      if (latestEmployment) {
        await tx.employments.update({
          where: { EmploymentId: latestEmployment.EmploymentId },
          data: {
            EmploymentType: employmentTypeForDb,
            StartDate: employmentStart,
          },
        });
      } else {
        await tx.employments.create({
          data: {
            EmployeeId: id,
            EmploymentType: employmentTypeForDb,
            StartDate: employmentStart,
          },
        });
      }
      const latestContract = await tx.employeeContracts.findFirst({
        where: { EmployeeId: id },
        orderBy: { StartDate: "desc" },
      });

      if (latestContract) {
        if (contractTypeForDb) {
          await tx.employeeContracts.update({
            where: { ContractId: latestContract.ContractId },
            data: {
              ContractType: contractTypeForDb,
              ContractRound:
                contractTypeForDb === "EMPLOYMENT"
                  ? contractRoundParsed != null
                    ? contractRoundParsed
                    : latestContract.ContractRound
                  : 0,
              StartDate: contractStartForDb,
              EndDate: contractEndForDb,
            },
          });
        } else {
          await tx.employeeContracts.update({
            where: { ContractId: latestContract.ContractId },
            data: { IsActive: false },
          });
        }
      } else if (contractTypeForDb) {
        await tx.employeeContracts.create({
          data: {
            EmployeeId: id,
            ContractType: contractTypeForDb,
            ContractRound:
              contractTypeForDb === "EMPLOYMENT" ? contractRoundParsed : 0,
            StartDate: contractStartForDb,
            EndDate: contractEndForDb,
            IsActive: true,
          },
        });
      }

      if (administrativePositions.length > 0) {
        await tx.employeeAdministrativePositions.createMany({
          data: administrativePositions.map((a) => ({
            EmployeeId: id,
            PositionName: a.positionName!.trim(),
            StartDate: new Date(a.startDate!),
            EndDate: a.endDate ? new Date(a.endDate) : null,
          })),
        });
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to update employee:", error);
    return NextResponse.json(
      { error: "บันทึกข้อมูลไม่สำเร็จ" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ employeeId: string }> }
) {
  const id = (await params).employeeId;
  try {
    await prisma.$transaction(async (tx) => {
      await tx.trainingParticipants.deleteMany({ where: { EmployeeId: id } });
      await tx.employeeDecorations.deleteMany({ where: { EmployeeId: id } });
      await tx.resignations.deleteMany({ where: { EmployeeId: id } });
      await tx.positions.deleteMany({ where: { EmployeeId: id } });
      await tx.employments.deleteMany({ where: { EmployeeId: id } });
      await tx.employeeContracts.deleteMany({ where: { EmployeeId: id } });
      await tx.employeeAdministrativePositions.deleteMany({
        where: { EmployeeId: id },
      });

      await tx.employees.delete({ where: { EmployeeId: id } });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to delete employee:", error);
    return NextResponse.json(
      { error: "ลบข้อมูลไม่สำเร็จ" },
      { status: 500 }
    );
  }
}
