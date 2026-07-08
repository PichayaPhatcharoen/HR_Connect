import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import path from "path"
import fs from "fs/promises"
import { ingestSource } from "@/lib/ingest"
import { generateSequentialUploadName } from "@/lib/sequentialUploadName"

// Helper to get or create category from custom name
async function getOrCreateCategoryByName(customName: string | null, existingCategoryId: string | null, description: string | null = null): Promise<string | null> {
  if (!customName?.trim()) return existingCategoryId
  
  const normalizedName = customName.trim()
  
  // Try to find existing category with this name
  const existing = await prisma.documentCategory.findFirst({
    where: { Name: { equals: normalizedName, mode: 'insensitive' } },
    select: { CategoryId: true }
  })
  
  if (existing) {
    return existing.CategoryId
  }
  
  // Create new category with optional description
  const newCategory = await prisma.documentCategory.create({
    data: {
      Name: normalizedName,
      Description: description?.trim() || null,
    },
    select: { CategoryId: true }
  })
  
  return newCategory.CategoryId
}


export const runtime = "nodejs"

async function deleteIfExists(fullPath: string) {
  try {
    await fs.unlink(fullPath)
  } catch { }
}

// GET a document
export async function GET(_req: NextRequest, { params }: { params: Promise<{ docId: string }> }) {
  const { docId } = await params
  const id = Number(docId)
  const doc = await prisma.sourceDocuments.findUnique({
    where: { SourceDocumentId: id },
    select: {
      SourceDocumentId: true,
      FileName: true,
      StoragePath: true,
      MimeType: true,
      Bytes: true,
      CategoryId: true,
      UserId: true,
      Tags: {
        select: {
          Tag: {
            select: {
              TagId: true,
              Name: true,
              Category: {
                select: {
                  CategoryId: true,
                  Name: true,
                },
              },
            },
          },
        },
      },
      CreatedAt: true,
      UpdatedAt: true,
      _count: {
        select: { Chunks: true }
      }
    },
  })
  if (!doc) return NextResponse.json({ error: "not found" }, { status: 404 })

  // Fetch category name if exists
  let categoryName = null
  if (doc.CategoryId) {
    const category = await prisma.documentCategory.findUnique({
      where: { CategoryId: doc.CategoryId },
      select: { Name: true }
    })
    categoryName = category?.Name || null
  }

  return NextResponse.json({
    id: doc.SourceDocumentId,
    fileName: doc.FileName,
    storagePath: doc.StoragePath,
    mimeType: doc.MimeType,
    bytes: doc.Bytes,
    categoryId: doc.CategoryId,
    categoryName: categoryName,
    userId: doc.UserId,
    tags: doc.Tags.map((t: any) => t.Tag),
    createdAt: doc.CreatedAt,
    updatedAt: doc.UpdatedAt,
    chunkCount: doc._count?.Chunks ?? 0,
  })
}

// PUT file update --> เรียกทำ reingest ไฟล์ใหม่
export async function PUT(req: NextRequest, { params }: { params: Promise<{ docId: string }> }) {
  const { docId } = await params
  const id = Number(docId);
  const existing = await prisma.sourceDocuments.findUnique({ where: { SourceDocumentId: id } });
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

  try {
    const form = await req.formData()
    const maybeFile = form.get("file") as File | null

    const nextFileNameInput =
      (form.get("fileName") as string)?.trim() || existing.FileName;

    // Keep original for display name (FileName column allows /, spaces, etc.)
    const displayFileName = nextFileNameInput;

    const nextCategoryId = (form.get("categoryId") as string)?.trim() || existing.CategoryId || null;
    const customCategoryName = (form.get("customCategoryName") as string)?.trim() || null;
    const customCategoryDesc = (form.get("customCategoryDesc") as string)?.trim() || null;
    const tagIdsStr = (form.get("tagIds") as string)?.trim() || null;
    const tagIds = tagIdsStr ? JSON.parse(tagIdsStr) : [];

    // Resolve category: if custom name provided, get or create the category
    const resolvedCategoryId = await getOrCreateCategoryByName(customCategoryName, nextCategoryId, customCategoryDesc)

    if (!maybeFile) {
      // Update document metadata only
      await prisma.sourceDocuments.update({
        where: { SourceDocumentId: id },
        data: {
          FileName: displayFileName,
          CategoryId: resolvedCategoryId,
          CustomCategoryName: null, // No longer used - we create real categories now
        },
      })

      // Update tag assignments
      await prisma.documentTagAssignment.deleteMany({
        where: { DocumentId: id },
      })

      if (tagIds.length > 0) {
        await prisma.documentTagAssignment.createMany({
          data: tagIds.map((tagId: string) => ({
            DocumentId: id,
            TagId: tagId,
          })),
        })
      }

      // Fetch updated document with tags
      const withTags = await prisma.sourceDocuments.findUnique({
        where: { SourceDocumentId: id },
        select: {
          SourceDocumentId: true,
          FileName: true,
          StoragePath: true,
          MimeType: true,
          Bytes: true,
          CategoryId: true,
          Tags: {
            select: {
              Tag: {
                select: {
                  TagId: true,
                  Name: true,
                  Category: {
                    select: {
                      CategoryId: true,
                      Name: true,
                    },
                  },
                },
              },
            },
          },
          CreatedAt: true,
          UpdatedAt: true,
        },
      })

      return NextResponse.json({
        id: withTags!.SourceDocumentId,
        fileName: withTags!.FileName,
        storagePath: withTags!.StoragePath,
        mimeType: withTags!.MimeType,
        bytes: withTags!.Bytes,
        categoryId: withTags!.CategoryId,
        tags: withTags!.Tags.map((t: any) => t.Tag),
        createdAt: withTags!.CreatedAt,
        updatedAt: withTags!.UpdatedAt,
      });
    }


    const typecheck = (maybeFile.type).toLocaleLowerCase();
    let ext: string;
    switch (typecheck) {
      case "image/png":
        ext = "png";
        break;
      case "image/jpeg":
        ext = "jpg";
        break;
      case "application/pdf":
        ext = "pdf";
        break;

      case "text/plain":
        ext = "txt";
        break;

      case "text/csv":
        ext = "csv";
        break;

      case "application/csv":
        ext = "csv";
        break;

      case "application/vnd.ms-excel":
        ext = "csv";
        break;
      default:
        return NextResponse.json(
          { error: `Unsupported file type: ${typecheck}` },
          { status: 400 }
        );
    }

    const docDir = path.join(process.cwd(), "public", "uploads", "Document");
    await fs.mkdir(docDir, { recursive: true });
    
    const sequentialFileName = await generateSequentialUploadName(
      docDir,
      "Document",
      ext
    );
    const storagePath = `uploads/Document/${sequentialFileName}`;
    const fullPath = path.join(process.cwd(), "public", storagePath);
    const oldFullPath = path.join(process.cwd(), "public", existing.StoragePath);



    // update files
    const buf = Buffer.from(await maybeFile.arrayBuffer());

    if (existing.StoragePath && existing.StoragePath !== storagePath) {
      await deleteIfExists(oldFullPath);
    }
    await fs.mkdir(docDir, { recursive: true });
    await fs.writeFile(fullPath, buf);

    await prisma.sourceDocuments.update({
      where: { SourceDocumentId: id },
      data: {
        FileName: displayFileName,
        StoragePath: storagePath,
        MimeType: maybeFile.type || null,
        Bytes: maybeFile.size || null,
        CategoryId: resolvedCategoryId,
        CustomCategoryName: null, // Clear custom name since we resolved to real category
      },
    })

    // Update tag assignments
    await prisma.documentTagAssignment.deleteMany({
      where: { DocumentId: id },
    })

    if (tagIds.length > 0) {
      await prisma.documentTagAssignment.createMany({
        data: tagIds.map((tagId: string) => ({
          DocumentId: id,
          TagId: tagId,
        })),
      })
    }

    // Fetch updated document with tags
    const withTags = await prisma.sourceDocuments.findUnique({
      where: { SourceDocumentId: id },
      select: {
        SourceDocumentId: true,
        FileName: true,
        StoragePath: true,
        MimeType: true,
        Bytes: true,
        CategoryId: true,
        Tags: {
          select: {
            Tag: {
              select: {
                TagId: true,
                Name: true,
                Category: {
                  select: {
                    CategoryId: true,
                    Name: true,
                  },
                },
              },
            },
          },
        },
        CreatedAt: true,
        UpdatedAt: true,
      },
    })

    //ยังไม่ implement ocr --> image = update  เฉยๆ
    if (maybeFile.type.startsWith("image/")) {
      console.warn(`[UPDATE-DOC] skip ingest: image file (${maybeFile.type}) -> ${maybeFile.name}`)
      return NextResponse.json({ ok: false, warning: "ไฟล์รูปภาพยังไม่รองรับ ingestion รอ implement OCR ในอนาคต", document: withTags, }, { status: 202 })
    }

    // re-ingest in background = del + call ingest func
    prisma.documentChunks.deleteMany({ where: { SourceDocumentId: id } })
      .then(() => ingestSource(id, true))
      .then(result => console.log("re-ingested :", result.stats))
      .catch(e => console.error("Background re-ingest failed:", e))

    return NextResponse.json({
      ok: true, document: {
        id: withTags!.SourceDocumentId,
        fileName: withTags!.FileName,
        storagePath: withTags!.StoragePath,
        mimeType: withTags!.MimeType,
        bytes: withTags!.Bytes,
        categoryId: withTags!.CategoryId,
        tags: withTags!.Tags.map((t: any) => t.Tag),
        createdAt: withTags!.CreatedAt,
        updatedAt: withTags!.UpdatedAt,
        chunkCount: 0,
      }
    }, { status: 200 })

  } catch (e: any) {
    console.error("UPDATE ERROR:", e)
    return NextResponse.json(
      { error: "อัปเดตไม่สำเร็จ", details: String(e?.message || e) },
      { status: 500 }
    )
  }
}

// DELETE — ลบDoc + ลบ chunk
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ docId: string }> }
) {
  const { docId } = await params
  const id = Number(docId)
  const existing = await prisma.sourceDocuments.findUnique({ where: { SourceDocumentId: id } })
  if (!existing) return new NextResponse(null, { status: 204 })

  try {
    //ลบ file
    if (existing.StoragePath) {
      const fullPath = path.join(process.cwd(), "public", existing.StoragePath!);
      await deleteIfExists(fullPath)
    }
    //ลบ chunk
    await prisma.documentChunks.deleteMany({ where: { SourceDocumentId: id } })
    await prisma.sourceDocuments.delete({ where: { SourceDocumentId: id } })
    return new NextResponse(null, { status: 204 })
  } catch (e: any) {
    console.error("DELETE ERROR:", e)
    return NextResponse.json(
      { error: "ลบไม่สำเร็จ", details: String(e?.message || e) },
      { status: 500 }
    )
  }
}