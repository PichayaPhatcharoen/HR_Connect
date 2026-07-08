import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"


export const runtime = "nodejs"

// Configure API route for larger files
export const config = {
  api: {
    bodyParser: false, // Disable default body parser
    responseLimit: false,
  },
}

// GET document
export async function GET() {
  const docs = await prisma.sourceDocuments.findMany({
    orderBy: { CreatedAt: "desc" },
    select: {
      SourceDocumentId: true,
      FileName: true,
      StoragePath: true,
      MimeType: true,
      Bytes: true,
      CategoryId: true,
      CustomCategoryName: true,
      CreatedAt: true,
      UpdatedAt: true,
    },
  })
  const mappedDocs = docs.map(d => ({
    id: d.SourceDocumentId,
    fileName: d.FileName,
    storagePath: d.StoragePath,
    mimeType: d.MimeType,
    bytes: d.Bytes,
    categoryId: d.CategoryId,
    customCategoryName: d.CustomCategoryName,
    createdAt: d.CreatedAt,
    updatedAt: d.UpdatedAt,
  }));
  return NextResponse.json(mappedDocs);
}


export async function POST(req: NextRequest) {
    const headerDump: Record<string,string> = {};
    req.headers.forEach((v, k) => headerDump[k] = v);
    console.log("UPLOAD headers:", headerDump);

    
    const ct = req.headers.get("content-type") || "";
    console.log("UPLOAD content-type:", ct);


    const form = await req.formData()
    const file = form.get("file") as File | null
    if (!file) {
        return NextResponse.json({ error: "Error! you cannot submit without document" },{ status: 400 })
    }
    return NextResponse.json({error: "Failed to upload document"},{ status: 200 })
}