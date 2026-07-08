import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import path from "node:path"
import fs from "node:fs/promises"
import crypto from "node:crypto"
import { extractText } from "@/lib/extractText"

const OPENAI_BASE = process.env.LLM_BASE_OPENAI_URL!
const EMBED_MODEL = process.env.EMBEDDING_MODEL!
const AUTH = `Bearer ${process.env.LLM_API_KEY || "none"}`

const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex")


// ฟังก์ชันสำหรับทำความสะอาดข้อความภาษาไทย (ลบช่องว่างส่วนเกินและจัดการอักขระพิเศษ)
function cleanThaiGappedText(s: string) {
  if (!s) return s
  let t = s.replace(/\u0000/g, "").replace(/[\u0001-\u001F]/g, "")
  t = t.replace(/([ก-๙])\s+([ก-๙])/g, "$1$2")
    .replace(/(\d)\s+(\d)/g, "$1$2")
    .replace(/([A-Za-z])\s+([A-Za-z])/g, "$1$2")
  for (let i = 0; i < 2; i++) {
    t = t.replace(/([ก-๙])\s+([ก-๙])/g, "$1$2")
      .replace(/(\d)\s+(\d)/g, "$1$2")
      .replace(/([A-Za-z])\s+([A-Za-z])/g, "$1$2")
  }
  t = t.replace(/(\d)([A-Za-zก-๙])/g, "$1 $2")
    .replace(/([A-Za-zก-๙])(\d)/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
  return t
}

import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters"

//chunking func
async function splitText(raw: string, chunkSize = 500, overlap = 100) {
  const text = String(raw ?? "")
  const out: Array<{ chunk: string; index: number }> = []

  // ใช้ RecursiveCharacterTextSplitter จาก LangChain เพื่อแบ่งข้อความ
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: chunkSize,
    chunkOverlap: overlap,
    // ลำดับการแบ่ง: ย่อหน้า -> บรรทัด -> ช่องว่าง -> ตัวอักษร
    separators: ["\n\n", "\n", " ", ""]
  });

  try {
    const chunks = await splitter.createDocuments([text]);

    // === Heading Injection ===
    const isHeading = (line: string) => {
      const t = line.trim()
      if (!t || t.length > 80) return false
      if (/^([\(（]?\d+[\)）]|[กขคงจ]\.|หมวด|ส่วนที่|ข้อ\s*\d|มาตรา\s*\d)/.test(t)) return false // ข้าม
      if (/\.{4,}|—{3,}/.test(t)) return false
      return t.length <= 60 && !/[,;]$/.test(t)
    }

    let lastHeading = ""
    for (let i = 0; i < chunks.length; i++) {
      const raw = chunks[i].pageContent
      const trimmed = raw.trim()
      if (!trimmed) continue

      // Check heading
      const firstLine = trimmed.split("\n")[0]?.trim() ?? ""
      if (isHeading(firstLine) && firstLine.length > 5) {
        lastHeading = firstLine
      }

      // Inject heading
      let finalChunk = trimmed
      if (lastHeading && !trimmed.startsWith(lastHeading)) {
        finalChunk = `${lastHeading}\n${trimmed}`
      }

      out.push({ chunk: finalChunk, index: i })
    }
  } catch (e) {
    console.error("splitText error with RecursiveCharacterTextSplitter:", e);
    // Fallback
    const size = Math.max(1, Math.floor(chunkSize))
    const ov = Math.min(Math.max(0, Math.floor(overlap)), size - 1)
    let i = 0, safety = 0
    while (i < text.length) {
      const end = Math.min(i + size, text.length)
      const trimmed = text.slice(i, end).trim()
      if (trimmed) out.push({ chunk: trimmed, index: out.length })
      if (end >= text.length) break
      const next = end - ov
      i = next <= i ? end : next
      if (++safety > 200_000) throw new Error("splitText safety limit exceeded")
    }
  }

  return out
}


function vecLit(v: number[]) {
  return `[${v.map(x => (Number.isFinite(x) ? +x : 0)).join(",")}]`
}


//embbed func
async function embedBatchOpenAI(texts: string[]): Promise<number[][]> {
  try {
    const res = await fetch(`${OPENAI_BASE}/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: AUTH },
      body: JSON.stringify({ model: EMBED_MODEL, input: texts }),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => "")
      throw new Error(`embeddings failed: ${res.status} ${res.statusText} ${errText}`)
    }

    const json = await res.json() as any
    const arr = json?.data ?? []

    if (!Array.isArray(arr) || arr.length !== texts.length) {
      throw new Error(`embedding count mismatch (${arr.length} vs ${texts.length})`)
    }

    return arr.map((d: any) => d.embedding || [])

  } catch (err: any) {
    console.error("[EMBED][error]", err)
    return []
  }
}

//ingest function
export async function ingestSource(sourceId: number, debug = false) {
  const stepLog: any[] = []
  const log = (step: string, info: any) => { stepLog.push({ step, ...info }); if (debug) console.log(`[INGEST][${step}]`, info) }

  // 1. โหลดข้อมูลเอกสารจากฐานข้อมูล
  const doc = await prisma.sourceDocuments.findUnique({
    where: { SourceDocumentId: Number(sourceId) },
    select: { SourceDocumentId: true, StoragePath: true, FileName: true, MimeType: true, CategoryId: true, CustomCategoryName: true }
  })
  if (!doc) throw new Error("source not found")
  log("load-db", { id: doc.SourceDocumentId, storagePath: doc.StoragePath, mimeType: doc.MimeType })

  // 2. ตรวจสอบที่อยู่ไฟล์
  const absPath = path.join(process.cwd(), "public", doc.StoragePath)

  // 3. ดึงข้อความออกจากไฟล์ (Extract Text)
  const result = await extractText(absPath, doc.MimeType || undefined)
  const text = cleanThaiGappedText(result.text)
  const pages = result.pages
  
  log("extract", { 
    method: result.method, 
    pages, 
    rawLen: result.text.length, 
    cleanedLen: text.length,
    warning: result.warning 
  })
  
  //เช็คความยาว
  if (!text || text.trim().length < 30) {
    const msg = result.method === "unknown" 
      ? `ไม่รองรับไฟล์ประเภทนี้: ${result.warning || "unknown type"}`
      : `ดึงข้อความได้น้อยเกินไป (${text?.length || 0} chars)${result.warning ? ` [${result.warning}]` : ''}`
    
    console.warn(`[INGEST][skip] ${doc.FileName} — ${msg}`)
    return {
      ok: false,
      sourceId: doc.SourceDocumentId,
      reason: "no_text_content",
      message: msg,
      debug: stepLog,
    }
  }


  // 4. แบ่งข้อความเป็นส่วนย่อย (Chunking)
  const chunks = await splitText(text, 800, 200)
  if (!chunks.length) {
    log("skip-no-chunks", { note: "split produced 0 chunks" })
    return {
      ok: false,
      sourceId: doc.SourceDocumentId,
      reason: "no_chunks",
      message: "ไม่สามารถแบ่งข้อความเป็นชิ้นได้",
      debug: stepLog,
    }
  }
  log("split", { chunksTotal: chunks.length })

  // 5. ตรวจสอบความซ้ำซ้อนด้วย Hash
  const hashes = chunks.map(c => sha256(c.chunk))

  const existing = await prisma.documentChunks.findMany({
    where: { SourceDocumentId: doc.SourceDocumentId, Hash: { in: hashes } }, select: { Hash: true }
  })
  const existed = new Set(existing.map(e => e.Hash))
  const toInsert = chunks.map(c => ({ ...c, hash: sha256(c.chunk) })).filter(c => !existed.has(c.hash))

  // 6. แปลงเป็นเวกเตอร์ (Embed) และบันทึกลงฐานข้อมูล (Insert)
  let inserted = 0, dims = 0
  if (toInsert.length > 0) {
    const BATCH = 32
    for (let i = 0; i < toInsert.length; i += BATCH) {
      const batch = toInsert.slice(i, i + BATCH)
      const vectors = await embedBatchOpenAI(batch.map(b => b.chunk))
      dims = vectors[0]?.length || 0

      const rows = batch.map((b, j) => {
        const lit = vecLit(vectors[j])
        // ("SourceId","Content","ChunkIndex","Hash","Embedding")
        return Prisma.sql`(${doc.SourceDocumentId}, ${b.chunk}, ${b.index}, ${b.hash}, ${Prisma.sql`${lit}::vector(1024)`})`
      })

      await prisma.$executeRaw(Prisma.sql`
            INSERT INTO "document_chunks"
            ("SourceDocumentId","Content","ChunkIndex","Hash","Embedding")
            VALUES
            ${Prisma.join(rows)}
            ON CONFLICT ("SourceDocumentId","ChunkIndex") DO NOTHING
        `)

      inserted += batch.length
      log("embed-insert-batch", { batchSize: batch.length, dims })
    }
  }

  const total = await prisma.documentChunks.count({ where: { SourceDocumentId: doc.SourceDocumentId } })
  log("total", { insertedNow: inserted, totalVectors: total })

  return {
    ok: total > 0,
    sourceId: doc.SourceDocumentId,
    pages: pages ?? null,
    stats: {
      textLength: text.length,
      chunksTotal: chunks.length,
      dedupSkipped: chunks.length - toInsert.length,
      insertedNow: inserted,
      totalVectors: total,
      dims: dims || undefined,
    },
    debug: stepLog,
  }
}
