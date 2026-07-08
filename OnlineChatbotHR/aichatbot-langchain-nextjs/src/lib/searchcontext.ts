import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"

const OPENAI_BASE = process.env.LLM_BASE_OPENAI_URL!
const EMBED_MODEL = process.env.EMBEDDING_MODEL!
const AUTH = `Bearer ${process.env.LLM_API_KEY || "none"}`
const BASE_URL = (process.env.NEXT_PUBLIC_BASE_URL ?? "").replace(/\/+$/, "")


// แปลง qry -> vector
export async function embedQuery(text: string): Promise<number[]> {
  const res = await fetch(`${OPENAI_BASE}/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: AUTH },
    body: JSON.stringify({ model: EMBED_MODEL, input: text }),
  })
  if (!res.ok) throw new Error(`embedding failed: ${res.status} ${await res.text().catch(() => "")}`)
  const json = await res.json() as any
  const arr = json?.data ?? []
  // จัดการผลลัพธ์ที่ได้จาก API
  const vector: number[] = arr[0].embedding || []

  // console.log("--- EMBEDDED QUERY VECTOR ---")
  // console.log("text", text)
  // console.log(vector)


  return vector
}


// แปลง format เวกเตอร์เป็น literal ของ pgvector
function vecLit(v: number[]) {
  return `[${v.map(x => (Number.isFinite(x) ? +x : 0)).join(",")}]`
}

// ประเภทข้อมูลสำหรับผลลัพธ์การค้นหาที่ Chatbot ใช้งาน
export type SearchResult = {
  id: number
  title: string
  category: string
  url: string
  score: number | null
}

function parseSourceRef(s: string | null | undefined): { url: string | null; description: string | null } {
  const v = (s ?? "").trim()
  if (!v) return { url: null, description: null }
  
  // extract URL จาก text ที่ผสมกัน ( "ตัวอย่าง https://example.com" หรือ "ตัวอย่าง www.example.com" )
  const httpsMatch = v.match(/(https?:\/\/[^\s]+)/i)
  //https: & www.
  if (httpsMatch) {
    const url = httpsMatch[1]
    const description = v.replace(httpsMatch[0], "").trim()
    return { url, description: description || null }
  }
  const wwwMatch = v.match(/(www\.[^\s]+)/i)
  if (wwwMatch) {
    const url = `https://${wwwMatch[1]}`
    const description = v.replace(wwwMatch[0], "").trim()
    return { url, description: description || null }
  }
  
  // เช็คถ้าเป็น URL เต็ม
  if (/^https?:\/\//i.test(v)) return { url: v, description: null }
  if (/^www\./i.test(v)) return { url: `https://${v}`, description: null }
  
  // เช็คถ้าเป็น text ธรรมดา
  return { url: null, description: v }
}

// function Hybrid search ค้นหาเอกสารจาก vector database เลือกมา k รายการ Default = 5 
export async function searchDocuments(query: string, k = 5): Promise<{ query: string; results: SearchResult[] }> {
  const q = (query || "").trim()
  if (!q) return { query: q, results: [] }

  // keyword search (หาไฟล์จากชื่อไฟล์/หมวดหมู่) - fallback ถ้า semantic ไม่เจอ
  const kw = await prisma.sourceDocuments.findMany({
    where: {
      OR: [
        { FileName: { contains: q, mode: "insensitive" } }, //ชื่อมี keyword
        { CategoryId: { not: null } }, // เอาเอกสารที่มี category (เอาไป match ทีหลัง)
      ],
    },
    //กำหนด field
    select: { 
      SourceDocumentId: true, 
      FileName: true, 
      StoragePath: true,
      CategoryId: true,
    },
    take: k * 2, //เอามา 2k รายการไปคัดต่อ
    orderBy: { CreatedAt: "desc" },
  })

  // Fetch categories เพื่อ filter keyword matches
  const categoryIds = [...new Set(kw.map(d => d.CategoryId).filter(Boolean))]
  const categories = categoryIds.length > 0 
    ? await prisma.documentCategory.findMany({
        where: { CategoryId: { in: categoryIds as string[] } },
        select: { CategoryId: true, Name: true }
      })
    : []
  const categoryMap = new Map(categories.map(c => [c.CategoryId, c.Name]))
  
  // Filter ผลลัพธ์ keyword ตาม category name หรือ filename match
  const filteredKw = kw.filter(d => {
    const fileMatch = d.FileName.toLowerCase().includes(q.toLowerCase())
    const categoryName = d.CategoryId ? categoryMap.get(d.CategoryId) : null
    const categoryMatch = categoryName ? categoryName.toLowerCase().includes(q.toLowerCase()) : false
    return fileMatch || categoryMatch
  }).slice(0, k)

  // 2. Semantic Search: ค้นหาด้วยความหมายโดยเลือก Chunk ที่ใกล้เคียงที่สุด
  // ทำการ Group by เอกสารเพื่อให้เหลือเพียง Chunk ที่คะแนนดีที่สุดของแต่ละไฟล์
  let semDocs: Array<{ id: number; fileName: string; storagePath: string; category: string | null; score: number }> = []
  try {
    const qVec = await embedQuery(q)
    const vec = vecLit(qVec)

    // ใช้ cosine distance: "<=>" ยิ่งน้อยยิ่งใกล้สิ่งที่อยากได้
    // เลือก top chunk ที่ดีที่สุดของเอกสารนั้น
    const rows = await prisma.$queryRaw<Array<{ sourceId: number; best: number }>>(Prisma.sql`
      WITH best AS (
        SELECT "SourceDocumentId", MIN("Embedding" <=> ${Prisma.sql`${vec}::vector`}) AS dist
        FROM "document_chunks"
        GROUP BY "SourceDocumentId"
      )
      SELECT "SourceDocumentId" AS "sourceId", dist AS best
      FROM best
      ORDER BY best ASC
      LIMIT ${Prisma.raw(String(k))}
    `)
    
    // คืนค่ารายการเอกสารพร้อมคะแนน Cosine similarity
    if (rows.length) {
      const ids = rows.map(r => r.sourceId)
      const docs = await prisma.sourceDocuments.findMany({
        where: { SourceDocumentId: { in: ids } },
        select: { 
          SourceDocumentId: true, 
          FileName: true, 
          StoragePath: true, 
          CategoryId: true,
        },
      })
      
      // ดึงข้อมูลชื่อหมวดหมู่ (Category names)
      const docCategoryIds = [...new Set(docs.map(d => d.CategoryId).filter(Boolean))]
      const docCategories = docCategoryIds.length > 0
        ? await prisma.documentCategory.findMany({
            where: { CategoryId: { in: docCategoryIds as string[] } },
            select: { CategoryId: true, Name: true }
          })
        : []
      const docCategoryMap = new Map(docCategories.map(c => [c.CategoryId, c.Name]))
      
      const map = new Map(docs.map(d => [d.SourceDocumentId, d]))
      semDocs = rows.map(r => {
        const d = map.get(r.sourceId)
        if (!d) return null
        const score = 1 - Number(r.best)
        const categoryName = d.CategoryId ? docCategoryMap.get(d.CategoryId) : null
        return { 
          id: d.SourceDocumentId, 
          fileName: d.FileName, 
          storagePath: d.StoragePath, 
          category: categoryName || null, 
          score 
        }
      }).filter(Boolean) as any
    }
  } catch (e) {
    console.warn("[SEARCH] semantic skipped:", e)
  }

  // รวมผลลัพธ์และคำนวณคะแนนใหม่ (Ranking)
  const merged = new Map<number, SearchResult>()
  const storagePathById = new Map<number, string>()
  const categoryIdById = new Map<number, string | null>()
  
  for (const s of semDocs) {
    storagePathById.set(s.id, s.storagePath)
    categoryIdById.set(s.id, s.category)
    merged.set(s.id, {
      id: s.id,
      title: s.fileName,
      category: s.category || "ไม่ระบุ",
      url: `${BASE_URL}/${s.storagePath}`,
      score: s.score,
    })
  }
  for (const d of filteredKw) {
    if (!merged.has(d.SourceDocumentId)) {
      storagePathById.set(d.SourceDocumentId, d.StoragePath)
      const categoryName = d.CategoryId ? categoryMap.get(d.CategoryId) : null
      merged.set(d.SourceDocumentId, {
        id: d.SourceDocumentId,
        title: d.FileName,
        category: categoryName || "ไม่ระบุ",
        url: `${BASE_URL}/${d.StoragePath}`,
        score: 0.35,
      })
    }
  }

  // จัดอันดับ (semantic ก่อน) แล้วตัด k
  let allResults = Array.from(merged.values())

  allResults = allResults
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
    .slice(0, k)

  // กรองผลลัพธ์เฉพาะที่มีคะแนนความคล้ายสูง (Similarity > 0.1) เพื่อป้องกันการตอบนอกเรื่อง
  let relevantResults = allResults.filter(r => {
    const score = r.score ?? 0
    return score > 0.1
  })

  // หากเอกสารมาจาก Knowledge curated ให้ดึง SourceRef (ลิงก์ต้นทาง) มาใช้แทน StoragePath
  const curatedIds = relevantResults
    .map(r => ({ id: r.id, sp: storagePathById.get(r.id) }))
    .filter(x => typeof x.sp === "string" && x.sp.startsWith("knowledge-curated/"))
    .map(x => x.id)

  if (curatedIds.length > 0) {
    const drafts = await (prisma as any).knowledgeDraft.findMany({
      where: { SourceDocumentId: { in: curatedIds } },
      select: { SourceDocumentId: true, KnowledgeDraftId: true, SourceRef: true, Title: true },
    })
    console.log("[searchDocuments] Static QA drafts found:", drafts)
    const draftBySourceId = new Map<number, { draftId: string; sourceRef: string | null }>(
      (drafts || []).map((d: any) => [
        Number(d.SourceDocumentId),
        { draftId: String(d.KnowledgeDraftId), sourceRef: d.SourceRef ?? null },
      ])
    )

    relevantResults = relevantResults.map(r => {
      const sp = storagePathById.get(r.id) || ""
      if (!sp.startsWith("knowledge-curated/")) return r
      const draft = draftBySourceId.get(r.id)
      console.log(`[searchDocuments] Processing curated doc ${r.id}: draft=`, draft)
      
      const parsed = parseSourceRef(draft?.sourceRef)
      console.log(`[searchDocuments] SourceRef="${draft?.sourceRef}" parsed to:`, parsed)
      
      if (parsed.url) {
        // SourceRef contains a URL (either pure URL or mixed with description)
        try {
          const urlObj = new URL(parsed.url)
          // Use description if present, otherwise use domain
          const displayTitle = parsed.description || urlObj.hostname
          // Use just the displayTitle from SourceRef, not combined with knowledge title
          const result = { ...r, url: parsed.url, title: displayTitle }
          console.log(`[searchDocuments] Using URL with description:`, result)
          return result
        } catch {
          return { ...r, url: parsed.url, title: parsed.description || parsed.url }
        }
      }
      
      // SourceRef is plain text only (no URL) - show as text without link
      if (parsed.description) {
        console.log(`[searchDocuments] SourceRef is plain text only:`, parsed.description)
        // Use just the description from SourceRef, not combined with knowledge title
        return { ...r, url: "", title: parsed.description }
      }
      
      // กรณีไม่มีข้อมูลอ้างอิงเลย ให้แสดงชื่อรายการโดยไม่มีลิงก์
      return { ...r, url: "", title: r.title }
    })
  }

  return { query: q, results: relevantResults }
}

export type RetrievedChunk = {
  sourceId: number
  chunkIndex: number
  content: string
  distance: number
  score: number
}

export async function getTopChunks(query: string, k = 8, filter?: { sourceIds?: number[] }) {
  //เรียก function embed แปลง query 
  const qVec = await embedQuery(query)
  const vec = vecLit(qVec)
  //ต้องใช้ sql เต็มเรียก pgvector operator `<=>` เปรียบเทียบ cosine similarity
  const rows = await prisma.$queryRaw<Array<{ sourceId: number; chunkIndex: number; content: string; dist: number }>>(Prisma.sql`
    SELECT "SourceDocumentId" AS "sourceId", "ChunkIndex" AS "chunkIndex", "Content" AS "content", ("Embedding" <=> ${Prisma.sql`${vec}::vector`}) AS dist
    FROM "document_chunks"
    ${filter?.sourceIds?.length ? Prisma.sql`WHERE "SourceDocumentId" IN (${Prisma.join(filter.sourceIds)})` : Prisma.empty}
    ORDER BY dist ASC
    LIMIT ${Prisma.raw(String(k * 2))}
  `)
  //เก็บข้อมูล chunks eg distance และ score
  const chunks = rows.map(r => ({
    sourceId: r.sourceId,
    chunkIndex: r.chunkIndex,
    content: r.content,
    distance: Number(r.dist),
    score: 1 - Number(r.dist),
  })) as RetrievedChunk[]
  
  // การ filter เอกสารที่มี score < 0.2
  const relevantChunks = chunks.filter(chunk => chunk.score > 0.20)
  return relevantChunks.slice(0, k)
}

// Fetch chunks ตาม document และ index range (รวมบริบทรอบข้างด้วย)
export async function getChunkRange(
  sourceId: number,
  minIndex: number,
  maxIndex: number
): Promise<Array<{ sourceId: number; chunkIndex: number; content: string }>> {
  const rows = await prisma.documentChunks.findMany({
    where: {
      SourceDocumentId: sourceId,
      ChunkIndex: { gte: Math.max(0, minIndex), lte: maxIndex },
    },
    select: { SourceDocumentId: true, ChunkIndex: true, Content: true },
    orderBy: { ChunkIndex: "asc" },
  })
  return rows.map((r) => ({
    sourceId: r.SourceDocumentId,
    chunkIndex: r.ChunkIndex,
    content: r.Content ?? "",
  }))
}

/**
 * Neighbor-safe block-based context builder:
 * - ดึง Top anchor chunks ตามความคล้ายของ Vector
 * - ขยายขอบเขตแต่ละ Anchor ให้เป็น Block (ดึงบริบทรอบข้าง +/- neighborWindow)
 * - จำกัดจำนวนด้วย Max blocks เพื่อให้ข้อมูลเป็นชุดที่สมบูรณ์ ไม่ถูกตัดแบ่งตอนกลาง
 */
export async function buildContextBlocks(
  query: string,
  options: {
    retrieve?: number
    neighborWindow?: number
    maxBlocks?: number
    minAnchorScore?: number
    sourceIds?: number[]
  } = {}
): Promise<Array<{ sourceId: number; chunkIndex: number; content: string; score: number }>> {
  const {
    retrieve = 40,
    neighborWindow = 2,
    maxBlocks = 4,
    minAnchorScore = 0.35,
    sourceIds,
  } = options

  // 1. ดึง Anchor chunks เริ่มต้นตามคะแนนความคล้าย
  const anchors = await getTopChunks(query, retrieve, { sourceIds })
  anchors.sort((a, b) => b.score - a.score)

  const used = new Set<string>()
  const blocks: Array<Array<{ sourceId: number; chunkIndex: number; content: string; score: number }>> = []

  for (const anchor of anchors) {
    if (anchor.score < minAnchorScore) continue  // ข้าม Chunk ที่คะแนนต่ำเกินไป

    const anchorKey = `${anchor.sourceId}-${anchor.chunkIndex}`
    if (used.has(anchorKey)) continue  // ถ้า Chunk นี้ถูกรวมอยู่ใน Block อื่นแล้วให้ข้ามไป

    // 2. ขยายขอบเขต: ดึง Chunks รอบข้าง Anchor
    const neighbors = await getChunkRange(
      anchor.sourceId,
      anchor.chunkIndex - neighborWindow,
      anchor.chunkIndex + neighborWindow
    )

    const block = neighbors.map(n => ({
      sourceId: n.sourceId,
      chunkIndex: n.chunkIndex,
      content: n.content,
      score: anchor.score,  // ทุก Chunk ใน Block จะใช้คะแนนเดียวกับ Chunk หลัก
    }))

    // ทำเครื่องหมายทุก Chunk ใน Block นี้ว่าถูกใช้งานแล้ว เพื่อป้องกันการขยายซ้ำ
    for (const c of block) {
      used.add(`${c.sourceId}-${c.chunkIndex}`)
    }

    blocks.push(block)
    if (blocks.length >= maxBlocks) break
  }

  // 3. รวม Blocks เข้าด้วยกันและเรียงตามลำดับเอกสาร (Document order)
  const finalChunks = blocks.flatMap(block =>
    block.slice().sort((a, b) =>
      a.sourceId - b.sourceId || a.chunkIndex - b.chunkIndex
    )
  )

  return finalChunks
}