import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { embedFAQQuestion } from "@/services/faqEmbedding";

export async function GET(request: NextRequest) {
  try {
    const status = request.nextUrl.searchParams.get("status") ?? "active";

    const where =
      status === "inactive"
        ? { IsActive: false }
        : status === "all"
          ? {}
          : { IsActive: true };

    const faqs = await prisma.fAQs.findMany({
      where,
      include: {
        Category: true,
      },
      orderBy: { UsageCount: "desc" },
    });
    return NextResponse.json(faqs);
  } catch (error: any) {
    console.error("Failed to fetch FAQs:", error);
    return NextResponse.json(
      { error: "Failed to fetch FAQs" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { question, answer, category } = await request.json();

    if (!question?.trim() || !answer?.trim()) {
      return NextResponse.json(
        { error: "Question and answer are required" },
        { status: 400 }
      );
    }

    // จัดการการค้นหาหรือสร้างหมวดหมู่ (Category)
    let categoryId: string | null = null;
    const categoryName = category?.trim();
    
    if (categoryName && categoryName !== 'ทั้งหมด') {
      // ค้นหาหมวดหมู่ที่มีอยู่แล้วตามชื่อ
      let existingCategory = await prisma.fAQCategories.findFirst({
        where: { Name: categoryName },
      });
      
      if (!existingCategory) {
        // หากไม่พบ ให้สร้างหมวดหมู่ใหม่
        existingCategory = await prisma.fAQCategories.create({
          data: { Name: categoryName },
        });
      }
      
      categoryId = existingCategory.FAQCategoryId;
    }

    const created = await prisma.fAQs.create({
      data: {
        Question: question.trim(),
        Answer: answer.trim(),
        CategoryId: categoryId,
        UsageCount: 0,
      },
    });

    // ทำการสร้าง Embedding ให้กับคำถาม (ทำงานแบบ Background เพื่อไม่ให้บล็อก User)
    embedFAQQuestion(created.FAQId, created.Question).catch(err => 
      console.error("[FAQ] Background embedding failed:", err)
    );

    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    console.error("Failed to create FAQ:", error);
    return NextResponse.json(
      { error: "Failed to create FAQ" },
      { status: 500 }
    );
  }
}

