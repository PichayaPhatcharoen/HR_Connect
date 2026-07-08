import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { ingestSource } from "@/lib/ingest"
import { auth } from "@/lib/auth"
import fs from "fs/promises"
import path from "path"
import { generateSequentialUploadName } from "@/lib/sequentialUploadName"


// ฟังก์ชันช่วยในการดึงหรือสร้าง Category จากชื่อที่ระบุ
async function getOrCreateCategoryByName(customName: string | null, existingCategoryId: string | null, description: string | null = null): Promise<string | null> {
  if (!customName?.trim()) return existingCategoryId
  
  const normalizedName = customName.trim()
  
  // พยายามค้นหา Category ที่มีอยู่แล้วจากชื่อ (Case-insensitive)
  const existing = await prisma.documentCategory.findFirst({
    where: { Name: { equals: normalizedName, mode: 'insensitive' } },
    select: { CategoryId: true }
  })
  
  if (existing) {
    return existing.CategoryId
  }
  
  // สร้าง Category ใหม่หากไม่พบ
  const newCategory = await prisma.documentCategory.create({
    data: {
      Name: normalizedName,
      Description: description?.trim() || null,
    },
    select: { CategoryId: true }
  })
  
  return newCategory.CategoryId
}


// GET: ดึงรายการเอกสารทั้งหมด
export async function GET() {
  const docs = await prisma.sourceDocuments.findMany({
    orderBy: { UpdatedAt: "desc" },
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

  // ดึงข้อมูล Categories ทั้งหมดเพื่อแมปชื่อ
  const categories = await prisma.documentCategory.findMany({
    select: { CategoryId: true, Name: true }
  })
  const categoryMap = new Map(categories.map(c => [c.CategoryId, c.Name]))

  // กรองเอกสารที่ไม่ต้องการแสดงผล
  const filtered = docs.filter(d => {
    const storage = (d.StoragePath || "").toLowerCase()
    if (storage.startsWith("knowledge-curated/")) return false
    return true
  })

  // แมปข้อมูลให้อยู่ในรูปแบบที่ Frontend ต้องการ
  const mappedDocs = filtered.map(d => ({
    id: d.SourceDocumentId,
    fileName: d.FileName,
    storagePath: d.StoragePath,
    mimeType: d.MimeType,
    bytes: d.Bytes,
    categoryId: d.CategoryId,
    categoryName: d.CategoryId ? categoryMap.get(d.CategoryId) || null : null,
    userId: d.UserId,
    tags: d.Tags.map((t: any) => t.Tag),
    createdAt: d.CreatedAt,
    updatedAt: d.UpdatedAt,
    chunkCount: d._count?.Chunks ?? 0,
  }));
  return NextResponse.json(mappedDocs);
}

// POST: อัปโหลดไฟล์แบบ multipart/form-data
export async function POST(req: NextRequest) {
    const session = await auth()
    const userId = session?.user?.id
    //for debug
    // const headerDump: Record<string,string> = {};
    // req.headers.forEach((v, k) => headerDump[k] = v);
    
    // console.log("headers:", headerDump);
    // const ct = req.headers.get("content-type") || "";
    // console.log("content-type:", ct);

    try {
        const form = await req.formData()
        const file = form.get("file") as File | null
        if (!file) {
            return NextResponse.json({ error: "Error! you cannot submit without document" },{ status: 400 })
        }


        // ชื่อที่แสดงในระบบยังคงเป็นชื่อจากฟอร์ม/ไฟล์เดิม
        const displayFileName = (form.get("fileName") as string)?.trim() || file.name
        
        const categoryId = (form.get("categoryId") as string)?.trim() || null
        const customCategoryName = (form.get("customCategoryName") as string)?.trim() || null
        const customCategoryDesc = (form.get("customCategoryDesc") as string)?.trim() || null
        const tagIdsStr = (form.get("tagIds") as string)?.trim() || null
        const tagIds = tagIdsStr ? JSON.parse(tagIdsStr) : []

        // จัดการ Category: หากมีชื่อใหม่ให้สร้างใหม่ หรือใช้ Category เดิมที่ระบุมา
        const resolvedCategoryId = await getOrCreateCategoryByName(customCategoryName, categoryId, customCategoryDesc)

        // สร้างรายการในฐานข้อมูลเพื่อรับ ID มาใช้ตั้งชื่อ StoragePath
        const created = await prisma.sourceDocuments.create({
        data: {
            FileName: displayFileName,
            StoragePath: `waitingfor_id`,
            MimeType: file.type || null,
            Bytes: file.size || null,
            CategoryId: resolvedCategoryId,
            CustomCategoryName: null,
            UserId: userId || null,
        },
        select: {
            SourceDocumentId: true,
        },
        })
        
        
        const typecheck = (file.type).toLocaleLowerCase()
        let ext: string | null
        switch (typecheck) {
            case "image/png":
                ext = "png";
            break;
            case "image/jpeg":
                ext = "jpg";
                break;
            case "image/gif":
                ext = "gif";
                break;
            case "image/bmp":
                ext = "bmp";
                break;
            case "image/webp":
                ext = "webp";
                break;
            case "image/tiff":
                ext = "tiff";
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
            
            case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
                ext = "docx";
                break;
            
            case "application/msword":
                ext = "doc";
                break;
        default:
            return NextResponse.json(
            { error: `Unsupported file type: ${typecheck}` },
            { status: 400 }
            );
        }

        const docDir = path.join(process.cwd(), "public", "uploads", "Document")
        await fs.mkdir(docDir, { recursive: true })

        const sequentialFileName = await generateSequentialUploadName(
            docDir,
            "Document",
            ext
        )
        const storagePath = `uploads/Document/${sequentialFileName}`

        try {
            // บันทึกไฟล์ลงในระบบไฟล์ของเซิร์ฟเวอร์
            const buf = Buffer.from(await file.arrayBuffer())
            const fullPath = path.join(process.cwd(), "public", storagePath)
            await fs.writeFile(fullPath, buf)


            // อัปเดตฐานข้อมูลด้วย StoragePath จริง
            const updated = await prisma.sourceDocuments.update({
            where: { SourceDocumentId: created.SourceDocumentId },
            data: {
                StoragePath: storagePath,
                CategoryId: resolvedCategoryId,
                CustomCategoryName: null,
            },
            select: {
                SourceDocumentId: true,
                FileName: true,
                StoragePath: true,
                MimeType: true,
                Bytes: true,
                CategoryId: true,
                CreatedAt: true,
                UpdatedAt: true,
            },
            })

            // บันทึกการแมป Tags กับเอกสาร
            if (tagIds.length > 0) {
                await prisma.documentTagAssignment.createMany({
                    data: tagIds.map((tagId: string) => ({
                        DocumentId: created.SourceDocumentId,
                        TagId: tagId,
                    })),
                })
            }

            // ดึงข้อมูลที่อัปเดตแล้วพร้อม Tags
            const withTags = await prisma.sourceDocuments.findUnique({
                where: { SourceDocumentId: created.SourceDocumentId },
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
            
            // เรียกฟังก์ชัน Ingest เพื่อประมวลผลข้อมูลลง Vector Database แบบเบื้องหลัง
            ingestSource(updated.SourceDocumentId, true).catch(e => console.error("Background ingest failed:", e))
            
            return NextResponse.json({ ok: true, document: {
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
            }}, { status: 201 })


        }catch (fileError){
            // หากเกิดข้อผิดพลาดในการจัดการไฟล์ ให้ทำการลบข้อมูลที่เพิ่งเขียนลงฐานข้อมูลออก (Rollback)
            await prisma.sourceDocuments.delete({
                where: {SourceDocumentId: created.SourceDocumentId},
            })
            throw fileError
        }


    } catch (err: any) {
        console.error("ERROR AS JSON:", JSON.stringify(err, null, 2));
        return NextResponse.json({error: "Failed to upload document", details: err},{ status: 500 })
    }
}
