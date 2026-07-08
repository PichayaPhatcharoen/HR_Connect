import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const list = await prisma.studentInfo.findMany({
      orderBy: { Year: "desc" },
    });
    const mapped = list.map((s) => ({
      id: s.StudentInfoId,
      year: s.Year,
      totalStudent: s.TotalStudent,
      yearType: s.YearType,
    }));
    return NextResponse.json(mapped);
  } catch (error) {
    console.error("Failed to fetch student info:", error);
    return NextResponse.json(
      { error: "ไม่สามารถโหลดข้อมูลได้" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { year, totalStudent, yearType } = body as {
      year?: number;
      totalStudent?: number;
      yearType?: "ACADEMIC" | "BUDGET";
    };
    if (year == null || totalStudent == null) {
      return NextResponse.json(
        { error: "กรุณากรอกปีการศึกษาและจำนวนนักศึกษา" },
        { status: 400 }
      );
    }
    const y = Number(year);
    const t = Number(totalStudent);
    if (Number.isNaN(y) || Number.isNaN(t) || t < 0) {
      return NextResponse.json(
        { error: "ปีการศึกษาและจำนวนนักศึกษาไม่ถูกต้อง" },
        { status: 400 }
      );
    }

    const normalizedYearType =
      yearType === "BUDGET" || yearType === "ACADEMIC" ? yearType : "ACADEMIC";
    await prisma.studentInfo.create({
      data: { Year: String(y), TotalStudent: t, YearType: normalizedYearType },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to create student info:", error);
    return NextResponse.json(
      { error: "บันทึกข้อมูลไม่สำเร็จ" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, year, totalStudent, yearType } = body as {
      id?: string;
      year?: number;
      totalStudent?: number;
      yearType?: "ACADEMIC" | "BUDGET";
    };

    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }
    if (year == null || totalStudent == null) {
      return NextResponse.json(
        { error: "กรุณากรอกปีการศึกษาและจำนวนนักศึกษา" },
        { status: 400 }
      );
    }

    const y = Number(year);
    const t = Number(totalStudent);
    if (Number.isNaN(y) || Number.isNaN(t) || t < 0) {
      return NextResponse.json(
        { error: "ปีการศึกษาและจำนวนนักศึกษาไม่ถูกต้อง" },
        { status: 400 }
      );
    }

    const normalizedYearType =
      yearType === "BUDGET" || yearType === "ACADEMIC" ? yearType : "ACADEMIC";
    await prisma.studentInfo.update({
      where: { StudentInfoId: id },
      data: { Year: String(y), TotalStudent: t, YearType: normalizedYearType },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to update student info:", error);
    return NextResponse.json(
      { error: "บันทึกข้อมูลไม่สำเร็จ" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const idFromQuery = url.searchParams.get("id") ?? undefined;

    const body = await request.json().catch(() => ({}));
    const id = (body?.id as string | undefined) ?? idFromQuery;

    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    await prisma.studentInfo.delete({
      where: { StudentInfoId: id },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to delete student info:", error);
    return NextResponse.json(
      { error: "ลบข้อมูลไม่สำเร็จ" },
      { status: 500 }
    );
  }
}