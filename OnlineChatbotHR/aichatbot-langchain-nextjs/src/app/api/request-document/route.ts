import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * 🔹 API: /api/request-document
 * Method: GET
 * ใช้สำหรับดึงรายการเอกสารตาม category (slug)
 * เช่น /api/request-document?category=leave-form
 */
export async function GET(req: Request) {
  try {
    // ✅ ดึงค่า query parameter จาก URL
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");

    // ✅ ถ้าไม่มี category → แสดงเอกสารทั้งหมด
    if (!category) {
      const allDocuments = await prisma.sourceDocuments.findMany({
        orderBy: { CreatedAt: "desc" },
        select: {
          SourceDocumentId: true,
          FileName: true,
          StoragePath: true,
          CategoryId: true,
          CreatedAt: true,
          UpdatedAt: true,
        },
      });

      const mappedDocs = allDocuments.map(d => ({
        id: d.SourceDocumentId,
        fileName: d.FileName,
        storagePath: d.StoragePath,
        category: d.CategoryId,
        createdAt: d.CreatedAt,
        updatedAt: d.UpdatedAt,
      }));

      return NextResponse.json(mappedDocs, { status: 200 });
    }

    // ✅ ถ้ามี category → ค้นหาเอกสารเฉพาะหมวดหมู่
    const documents = await prisma.sourceDocuments.findMany({
      where: {
        CategoryId: {
          equals: category,
          mode: "insensitive", // ไม่สนตัวพิมพ์เล็ก/ใหญ่
        },
      },
      orderBy: { CreatedAt: "desc" },
      select: {
        SourceDocumentId: true,
        FileName: true,
        StoragePath: true,
        CategoryId: true,
        CreatedAt: true,
        UpdatedAt: true,
      },
    });

    const mappedDocs = documents.map(d => ({
      id: d.SourceDocumentId,
      fileName: d.FileName,
      storagePath: d.StoragePath,
      category: d.CategoryId,
      createdAt: d.CreatedAt,
      updatedAt: d.UpdatedAt,
    }));

    // ✅ ถ้าไม่พบข้อมูล
    if (mappedDocs.length === 0) {
      return NextResponse.json(
        { message: `ไม่พบเอกสารในหมวดหมู่ ${category}` },
        { status: 404 }
      );
    }

    // ✅ ส่งผลลัพธ์กลับไปให้ฝั่ง Client
    return NextResponse.json(mappedDocs, { status: 200 });
  } catch (error) {
    console.error("❌ Error fetching documents:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการดึงข้อมูลเอกสาร" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
