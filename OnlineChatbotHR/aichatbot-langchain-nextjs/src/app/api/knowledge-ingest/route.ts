import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import crypto from "node:crypto"

export const runtime = "nodejs"
export const maxDuration = 120

const OPENAI_BASE = process.env.LLM_BASE_OPENAI_URL!
const EMBED_MODEL = process.env.EMBEDDING_MODEL!
const AUTH = `Bearer ${process.env.LLM_API_KEY || "none"}`
const BASE_URL = (process.env.NEXT_PUBLIC_BASE_URL ?? "").replace(/\/+$/, "")

const db = prisma as any
const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex")

function vecLit(v: number[]) {
  return `[${v.map(x => (Number.isFinite(x) ? +x : 0)).join(",")}]`
}

/**
 * เรียกใช้งาน API เพื่อแปลงข้อความเป็น Vector (Embedding) แบบกลุ่ม
 */
async function embedBatch(texts: string[]): Promise<number[][]> {
  const res = await fetch(`${OPENAI_BASE}/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: AUTH },
    body: JSON.stringify({ model: EMBED_MODEL, input: texts }),
  })
  if (!res.ok) throw new Error(`embedding failed: ${res.status} ${await res.text().catch(() => "")}`)
  const json = await res.json() as any
  const arr: any[] = json?.data ?? []
  if (arr.length !== texts.length) throw new Error(`embedding count mismatch (${arr.length} vs ${texts.length})`)
  return arr.map((d: any) => d.embedding || [])
}

/**
 * แบ่งเนื้อหา Knowledge เป็นส่วนย่อยๆ (Chunks) ตามบรรทัดว่าง
 * เป้าหมายคือ 300-900 ตัวอักษรต่อ Chunk เพื่อให้ Embedding มีคุณภาพดีที่สุด
 */
function splitKnowledgeBody(body: string, maxChunk = 900): Array<{ chunk: string; index: number }> {
  const sections = body.split(/\n{2,}/).map(s => s.trim()).filter(Boolean)
  const out: Array<{ chunk: string; index: number }> = []
  let current = ""
  let idx = 0

  for (const section of sections) {
    if ((current + "\n\n" + section).length > maxChunk && current.length > 0) {
      out.push({ chunk: current.trim(), index: idx++ })
      current = section
    } else {
      current = current ? current + "\n\n" + section : section
    }
  }
  if (current.trim()) out.push({ chunk: current.trim(), index: idx })

  return out.length ? out : [{ chunk: body.trim(), index: 0 }]
}

/**
 * POST /api/knowledge-ingest
 * ขั้นตอนหลัก:
 * 1. โหลดข้อมูล KnowledgeDraft จากฐานข้อมูล
 * 2. ปรับแต่งเนื้อหา (Title + Metadata + Keywords) เพื่อรวมเป็น Full text
 * 3. ตรวจสอบหรือสร้าง SourceDocuments ในหมวด "human-curated"
 * 4. แบ่งเนื้อหา (Split) -> แปลงเป็นเวกเตอร์ (Embed) -> บันทึกลงตาราง document_chunks
 * 5. อัปเดตสถานะ Draft เป็น PUBLISHED และเชื่อมโยง SourceDocumentId
 */
export async function POST(req: NextRequest) {
  try {
    const { draftId } = await req.json()
    if (!draftId) return NextResponse.json({ ok: false, error: "draftId required" }, { status: 400 })

    // 1. โหลดข้อมูล Draft
    const draft = await db.knowledgeDraft.findUnique({ where: { KnowledgeDraftId: draftId } })
    if (!draft) return NextResponse.json({ ok: false, error: "draft not found" }, { status: 404 })

    // 2. ปรับแต่งเนื้อหาเพื่อทำ Embedding (ใส่ Metadata นำหน้าเพื่อให้บอตเข้าใจบริบท)
    const keywordsLine = draft.Keywords?.length ? `คำสำคัญ: ${draft.Keywords.join(", ")}` : ""
    const metaHeader = [
      `[หมวด: ${draft.Domain}] [ประเภท: ${draft.Intent}]`,
      draft.SourceRef ? `อ้างอิง: ${draft.SourceRef}` : "",
      keywordsLine,
    ].filter(Boolean).join("\n")

    const fullText = `${draft.Title}\n${metaHeader}\n\n${draft.Body}`

    // 3. จัดการข้อมูลในตาราง SourceDocuments
    const storagePath = `knowledge-curated/${draftId}.txt`
    let sourceDoc = await prisma.sourceDocuments.findUnique({ where: { StoragePath: storagePath } })
    if (!sourceDoc) {
      sourceDoc = await prisma.sourceDocuments.create({
        data: {
          FileName: draft.Title,
          StoragePath: storagePath,
          MimeType: "text/plain",
          Bytes: Buffer.byteLength(fullText, "utf8"),
        },
      })
    } else {
      // อัปเดตชื่อไฟล์และขนาดหากมีการเปลี่ยนแปลง
      sourceDoc = await prisma.sourceDocuments.update({
        where: { StoragePath: storagePath },
        data: { FileName: draft.Title, Bytes: Buffer.byteLength(fullText, "utf8") },
      })
    }

    const sourceId = sourceDoc.SourceDocumentId

    // 4. แบ่งเนื้อหาเป็น Chunks ย่อย
    const chunks = splitKnowledgeBody(fullText)
    if (!chunks.length) return NextResponse.json({ ok: false, error: "empty content" }, { status: 422 })

    // ตรวจสอบความซ้ำซ้อนด้วย Hash เพื่อไม่ให้บันทึกข้อมูลเดิมซ้ำ
    const hashes = chunks.map(c => sha256(c.chunk))
    const existing = await prisma.documentChunks.findMany({
      where: { SourceDocumentId: sourceId, Hash: { in: hashes } },
      select: { Hash: true },
    })
    const existingSet = new Set(existing.map(e => e.Hash))
    const toInsert = chunks.map(c => ({ ...c, hash: sha256(c.chunk) })).filter(c => !existingSet.has(c.hash))

    let inserted = 0
    let dims = 0

    if (toInsert.length > 0) {
      const BATCH = 32
      for (let i = 0; i < toInsert.length; i += BATCH) {
        const batch = toInsert.slice(i, i + BATCH)
        const vectors = await embedBatch(batch.map(b => b.chunk))
        dims = vectors[0]?.length || 0

        const rows = batch.map((b, j) => {
          const lit = vecLit(vectors[j])
          return Prisma.sql`(${sourceId}, ${b.chunk}, ${null}, ${b.index}, ${b.hash}, ${Prisma.sql`${lit}::vector(1024)`})`
        })

        // บันทึกลงตาราง document_chunks (PGVector)
        await prisma.$executeRaw(Prisma.sql`
          INSERT INTO "document_chunks" ("SourceDocumentId","Content","ChunkIndex","Hash","Embedding")
          VALUES ${Prisma.join(rows)}
          ON CONFLICT ("SourceDocumentId","ChunkIndex") DO UPDATE
            SET "Content" = EXCLUDED."Content",
                "Hash"    = EXCLUDED."Hash",
                "Embedding" = EXCLUDED."Embedding"
        `)

        inserted += batch.length
      }
    }

    const total = await prisma.documentChunks.count({ where: { SourceDocumentId: sourceId } })

    // 5. เปลี่ยนสถานะ Draft เป็น PUBLISHED
    await db.knowledgeDraft.update({
      where: { KnowledgeDraftId: draftId },
      data: {
        Status: "PUBLISHED",
        PublishedAt: new Date(),
        SourceDocumentId: sourceId,
      },
    })

    return NextResponse.json({
      ok: true,
      draftId,
      sourceDocumentId: sourceId,
      sourceUrl: `${BASE_URL}/${storagePath}`,
      stats: { chunksTotal: chunks.length, dedupSkipped: chunks.length - toInsert.length, insertedNow: inserted, totalChunks: total, dims },
    }, { status: 201 })

  } catch (error: any) {
    console.error("[knowledge-ingest POST]", error)
    return NextResponse.json({ ok: false, error: error?.message || String(error) }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, info: "Internal Endpoint: ใช้สำหรับประมวลผล Knowledge draft ลงสู่ Vector database" })
}
