import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { embedFAQQuestion } from "@/services/faqEmbedding";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ faqId: string }> }
) {
  const { faqId: id } = await params;

  try {
    const faq = await prisma.fAQs.findUnique({
      where: { FAQId: id },
      include: {
        Category: true,
      },
    });

    if (!faq) {
      return NextResponse.json({ error: "FAQ not found" }, { status: 404 });
    }

    // ปรับรูปแบบข้อมูลให้ตรงตามความต้องการของ Frontend
    return NextResponse.json({
      id: faq.FAQId,
      question: faq.Question,
      answer: faq.Answer,
      category: faq.Category?.Name || "ทั้งหมด",
      usageCount: faq.UsageCount,
    });
  } catch (error: any) {
    console.error("Failed to fetch FAQ:", error);
    return NextResponse.json(
      { error: "Failed to fetch FAQ" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ faqId: string }> }
) {
  const { faqId: id } = await params;

  try {
    const { question, answer, category } = await request.json();

    if (!question?.trim() || !answer?.trim()) {
      return NextResponse.json(
        { error: "Question and answer are required" },
        { status: 400 }
      );
    }

    // จัดการการตรวจสอบและสร้าง Category หากมีการระบุมาใหม่
    let validCategoryId: string | null = null;
    if (category && category !== "ทั้งหมด") {
      let categoryExists = await prisma.fAQCategories.findFirst({
        where: { Name: category },
      });
      
      // หากไม่พบหมวดหมู่ ให้ทำการสร้างใหม่
      if (!categoryExists) {
        categoryExists = await prisma.fAQCategories.create({
          data: { Name: category },
        });
      }
      
      validCategoryId = categoryExists.FAQCategoryId;
    }

    const updated = await prisma.fAQs.update({
      where: { FAQId: id },
      data: {
        Question: question.trim(),
        Answer: answer.trim(),
        CategoryId: validCategoryId,
      },
    });

    // อัปเดต Embedding ถ้าคำถามเปลี่ยน (background, non-blocking)
    embedFAQQuestion(updated.FAQId, updated.Question).catch(err =>
      console.error("[FAQ] Background embedding failed on update:", err)
    );

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("Failed to update FAQ:", error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return NextResponse.json({ error: "FAQ not found" }, { status: 404 });
      }
    }

    return NextResponse.json(
      { error: "Failed to update FAQ" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ faqId: string }> }
) {
  const { faqId: id } = await params;

  try {
    // เปลี่ยนสถานะของ FAQ candidate ที่เกี่ยวข้องกลับเป็น PENDING เพื่อให้ปรากฏในหน้าอนุมัติอีกครั้ง
    await prisma.fAQCandidates.updateMany({
      where: { ApprovedFAQId: id },
      data: {
        Status: "PENDING",
        ReviewedBy: null,
        ReviewedAt: null
      }
    });

    await prisma.fAQs.delete({
      where: { FAQId: id },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error: any) {
    console.error("Failed to delete FAQ:", error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return NextResponse.json({ error: "FAQ not found" }, { status: 404 });
      }
    }

    return NextResponse.json(
      { error: "Failed to delete FAQ" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ faqId: string }> }
) {
  const { faqId: id } = await params;

  try {
    const { isActive } = await request.json();

    if (typeof isActive !== "boolean") {
      return NextResponse.json(
        { error: "isActive must be a boolean" },
        { status: 400 }
      );
    }

    const updated = await prisma.fAQs.update({
      where: { FAQId: id },
      data: { IsActive: isActive },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("Failed to archive FAQ:", error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return NextResponse.json({ error: "FAQ not found" }, { status: 404 });
      }
    }

    return NextResponse.json(
      { error: "Failed to archive FAQ" },
      { status: 500 }
    );
  }
}
