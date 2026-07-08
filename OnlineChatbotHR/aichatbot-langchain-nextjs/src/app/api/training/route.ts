import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";


const prisma = new PrismaClient();

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q") || "";
  const eventId = searchParams.get("id");

  try {
    if (eventId) {
      const trainingEvent = await prisma.trainingEvents.findUnique({
        where: { TrainingEventId: eventId },
        include: {
          Participants: {
            include: {
              Employee: {
                select: {
                  EmployeeId: true,
                  FullName: true,
                },
              },
            },
          },
        },
      });

      if (!trainingEvent) {
        return NextResponse.json(
          { error: "ไม่พบข้อมูลรายการนี้" },
          { status: 404 }
        );
      }

      return NextResponse.json({
        id: trainingEvent.TrainingEventId,
        title: trainingEvent.Title,
        category: trainingEvent.Category,
        categoryOther: trainingEvent.CategoryOther || "",
        domain: trainingEvent.Domain,
        domainOther: trainingEvent.DomainOther || "",
        format: trainingEvent.Format,
        startDate: trainingEvent.StartDate.toISOString().split("T")[0],
        endDate: trainingEvent.EndDate.toISOString().split("T")[0],
        updatedAt: trainingEvent.UpdatedAt.toISOString(),
        organizer: trainingEvent.Organizer || "",
        location: trainingEvent.LocationName || "",
        locationType: trainingEvent.LocationType,
        budget:
          trainingEvent.Budget !== null
            ? trainingEvent.Budget.toString()
            : "",
        yearBudget:
          trainingEvent.YearBudget !== null
            ? trainingEvent.YearBudget.toString()
            : "",
        description: trainingEvent.Description || "",
        participants: trainingEvent.Participants.map((p) => ({
          id: p.EmployeeId,
          name: p.Employee.FullName,
        })),
      });
    }

    if (query) {
      const employees = await prisma.employees.findMany({
        where: {
          FullName: {
            contains: query,
            mode: 'insensitive'
          },
          Status: 'ACTIVE'
        },
        select: {
          EmployeeId: true,
          FullName: true,
        },
        take: 10,
      });

      return NextResponse.json(employees);
    }

    const trainingEvents = await prisma.trainingEvents.findMany({
      include: {
        Participants: {
          include: {
            Employee: {
              select: {
                FullName: true,
              }
            }
          }
        }
      },
      orderBy: {
        StartDate: 'desc'
      }
    });

    const formattedData = trainingEvents.map(event => {
      const startDate = new Date(event.StartDate)
      const endDate = new Date(event.EndDate)
      
      return {
        id: event.TrainingEventId,
        title: event.Title,
        category: event.Category,
        categoryOther: event.CategoryOther,
        domain: event.Domain,
        domainOther: event.DomainOther,
        type: event.Format, 
        location: event.LocationName || event.LocationType,
        locationType: event.LocationType, 
        organizer: event.Organizer || "-",
        startDate: startDate.toLocaleDateString('th-TH', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        }),
        startDateRaw: startDate.toISOString().split('T')[0], 
        endDate: endDate.toLocaleDateString('th-TH', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        }),
        participants: event.Participants.map(p => p.Employee.FullName),
        budget: event.Budget,
        yearBudget: event.YearBudget,
        updatedAt: event.UpdatedAt.toISOString(),
      }
    });

    return NextResponse.json(formattedData);
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
  }
}



export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      title,
      category,
      categoryOther,
      domain,
      domainOther,
      format,
      startDate,
      endDate,
      selectedEmployees,
      organizer,
      location,
      locationType,
      budget,
      yearBudget,
      description,
    } = body;


    if (!title || !category || !domain || !format || !startDate || !endDate || !selectedEmployees || selectedEmployees.length === 0) {
      return NextResponse.json(
        { error: "กรุณาระบุข้อมูลที่จำเป็นให้ครบถ้วน" },
        { status: 400 }
      );
    }


    const newEvent = await prisma.trainingEvents.create({
      data: {
        Title: title.trim(),
        Category: category.toUpperCase(),
        CategoryOther:
          category?.toUpperCase?.() === "OTHER"
            ? (categoryOther?.toString?.().trim() || null)
            : null,
        Domain: domain.toUpperCase(),
        DomainOther:
          domain?.toUpperCase?.() === "OTHER"
            ? (domainOther?.toString?.().trim() || null)
            : null,
        Format: format.toUpperCase(),
        LocationType: locationType.toUpperCase(),
        StartDate: new Date(startDate),
        EndDate: new Date(endDate),
        LocationName: location?.trim() || null,
        Organizer: organizer?.trim() || null,
        Budget: budget ? parseFloat(budget.replace(/,/g, '')) : null,
        YearBudget: yearBudget ? yearBudget.toString().trim() : null,
        Description: description?.trim() || null,
        
   
        Participants: {
          create: selectedEmployees.map((emp: { id: string }) => ({
            EmployeeId: emp.id
          }))
        }
      },
      include: {
        Participants: true 
      }
    });

    return NextResponse.json(
      { message: "บันทึกข้อมูลสำเร็จ", data: newEvent },
      { status: 201 }
    );
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการบันทึกข้อมูล" },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();

    const {
      id,
      title,
      category,
      categoryOther,
      domain,
      domainOther,
      format,
      startDate,
      endDate,
      selectedEmployees,
      organizer,
      location,
      locationType,
      budget,
      yearBudget,
      description,
    } = body;

    if (!id) {
      return NextResponse.json(
        { error: "ไม่พบข้อมูลรายการนี้" },
        { status: 400 }
      );
    }

    if (!title || !category || !domain || !format || !startDate || !endDate || !selectedEmployees || selectedEmployees.length === 0) {
      return NextResponse.json(
        { error: "กรุณาระบุข้อมูลที่จำเป็นให้ครบถ้วน" },
        { status: 400 }
      );
    }

    const updatedEvent = await prisma.trainingEvents.update({
      where: { TrainingEventId: id },
      data: {
        Title: title.trim(),
        Category: category.toUpperCase(),
        CategoryOther:
          category?.toUpperCase?.() === "OTHER"
            ? (categoryOther?.toString?.().trim() || null)
            : null,
        Domain: domain.toUpperCase(),
        DomainOther:
          domain?.toUpperCase?.() === "OTHER"
            ? (domainOther?.toString?.().trim() || null)
            : null,
        Format: format.toUpperCase(),
        LocationType: locationType.toUpperCase(),
        StartDate: new Date(startDate),
        EndDate: new Date(endDate),
        LocationName: location?.trim() || null,
        Organizer: organizer?.trim() || null,
        Budget: budget ? parseFloat(budget.replace(/,/g, '')) : null,
        YearBudget: yearBudget ? yearBudget.toString().trim() : null,
        Description: description?.trim() || null,
        Participants: {
          deleteMany: {},
          create: selectedEmployees.map((emp: { id: string }) => ({
            EmployeeId: emp.id
          }))
        }
      },
      include: {
        Participants: {
          include: {
            Employee: {
              select: {
                FullName: true
              }
            }
          }
        }
      }
    });

    return NextResponse.json(
      { message: "อัปเดตข้อมูลสำเร็จ", data: updatedEvent },
      { status: 200 }
    );
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการอัปเดตข้อมูล" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "ไม่พบรายการที่ต้องการลบ" },
        { status: 400 }
      );
    }

    await prisma.trainingParticipants.deleteMany({
      where: { TrainingEventId: id }
    });

    await prisma.trainingEvents.delete({
      where: { TrainingEventId: id }
    });

    return NextResponse.json(
      { message: "ลบข้อมูลสำเร็จ" },
      { status: 200 }
    );
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการลบข้อมูล" },
      { status: 500 }
    );
  }
}