import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const list = await prisma.employeeDecorations.findMany({
      include: {
        Employee: { select: { EmployeeId: true, FullName: true } },
        Decoration: { select: { DecorationId: true, Name: true, Abbreviation: true } },
      },
      orderBy: { CreatedAt: "desc" },
    });
    const mapped = list.map((d) => ({
      id: d.EmployeeDecorationId,
      employeeId: d.EmployeeId,
      employeeName: d.Employee.FullName,
      decorationId: d.DecorationId,
      decorationName: d.Decoration.Name,
      decorationCode: d.Decoration.Abbreviation,
      receivedDate: d.ReceivedDate ? d.ReceivedDate.toISOString().slice(0, 10) : null,
      gazetteDate: d.GazetteDate ? d.GazetteDate.toISOString().slice(0, 10) : null,
    }));
    return NextResponse.json(mapped);
  } catch (error) {
    console.error("Failed to fetch employee decorations:", error);
    return NextResponse.json(
      { error: "ไม่สามารถโหลดข้อมูลได้" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { employeeId, decorationCode, receivedDate, gazetteDate } = body as {
      employeeId?: string;
      decorationCode?: string;
      receivedDate?: string;
      gazetteDate?: string;
    };
    if (!employeeId || !decorationCode) {
      return NextResponse.json(
        { error: "กรุณาเลือกบุคลากรและชื่อเครื่องราช" },
        { status: 400 }
      );
    }
    const decoration = await prisma.royalDecorations.findFirst({
      where: { Abbreviation: decorationCode.trim() },
    });
    if (!decoration) {
      return NextResponse.json(
        { error: "ไม่พบเครื่องราชที่เลือก" },
        { status: 400 }
      );
    }
    await prisma.employeeDecorations.create({
      data: {
        EmployeeId: employeeId,
        DecorationId: decoration.DecorationId,
        ReceivedDate: receivedDate ? new Date(receivedDate) : null,
        GazetteDate: gazetteDate ? new Date(gazetteDate) : null,
      },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to create employee decoration:", error);
    return NextResponse.json(
      { error: "บันทึกข้อมูลไม่สำเร็จ" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, employeeId, decorationCode, receivedDate, gazetteDate } = body as {
      id?: string;
      employeeId?: string;
      decorationCode?: string;
      receivedDate?: string;
      gazetteDate?: string;
    };

    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }
    if (!employeeId || !decorationCode) {
      return NextResponse.json(
        { error: "กรุณาเลือกบุคลากรและชื่อเครื่องราช" },
        { status: 400 }
      );
    }

    const decoration = await prisma.royalDecorations.findFirst({
      where: { Abbreviation: decorationCode.trim() },
    });
    if (!decoration) {
      return NextResponse.json(
        { error: "ไม่พบเครื่องราชที่เลือก" },
        { status: 400 }
      );
    }

    await prisma.employeeDecorations.update({
      where: { EmployeeDecorationId: id },
      data: {
        EmployeeId: employeeId,
        DecorationId: decoration.DecorationId,
        ReceivedDate: receivedDate ? new Date(receivedDate) : null,
        GazetteDate: gazetteDate ? new Date(gazetteDate) : null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to update employee decoration:", error);
    return NextResponse.json(
      { error: "บันทึกข้อมูลไม่สำเร็จ" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { id } = body as { id?: string };

    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    await prisma.employeeDecorations.delete({
      where: { EmployeeDecorationId: id },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to delete employee decoration:", error);
    return NextResponse.json(
      { error: "ลบข้อมูลไม่สำเร็จ" },
      { status: 500 }
    );
  }
}
