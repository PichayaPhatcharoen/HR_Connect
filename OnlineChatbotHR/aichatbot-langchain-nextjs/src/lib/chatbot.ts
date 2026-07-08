import { NextRequest, NextResponse } from "next/server"
import { ChatGoogleGenerativeAI } from "@langchain/google-genai"
import { ChatPromptTemplate } from "@langchain/core/prompts"
import { toUIMessageStream } from "@ai-sdk/langchain"
import { createUIMessageStream, createUIMessageStreamResponse, UIMessage, convertToModelMessages } from "ai"
import { SYSTEM_PROMPT, LINE_SYSTEM_PROMPT, MAX_TOKENS, DEFAULT_TEMPERATURE } from "@/config/llm_config"
import { searchDocuments, buildContextBlocks } from "@/lib/searchcontext"
import { BaseCallbackHandler } from "@langchain/core/callbacks/base"
import { AIMessageChunk } from "@langchain/core/messages"
import { saveChatTurn } from "@/services/chatHistory"
import {
  classifyQuestionIntent,
  incrementFAQUsage,
  saveFAQCandidate,
  searchApprovedFAQs,
  getFAQConfidence,
} from "@/services/faqCandidate"
import { buildFAQGuidedPrompt, shouldEnrichFAQ } from "@/services/faqGuidedRag"
import { ConversationChannel } from "@prisma/client"

export const runtime = "nodejs"
export const maxDuration = 300

// กำหนด Similarity thresholds สำหรับ RAG
const MIN_RAG_SIMILARITY = 0.45            // ค่าความคล้ายต่ำสุดเพื่อให้ RAG ทำงาน
const CITATION_SIMILARITY_THRESHOLD = 0.55 // ค่าความคล้ายสำหรับแสดงเนื้อหาอ้างอิง (citations)

// สร้าง LLM instance (Google Generative AI)
function createLLM(isStream: boolean) {
  try {
    return new ChatGoogleGenerativeAI({
      apiKey: process.env.LLM_API_KEY,
      model: process.env.LLM_MODEL,
      streaming: isStream,
      temperature: DEFAULT_TEMPERATURE,
      maxOutputTokens: MAX_TOKENS,
    })
  } catch (err) {
    console.error("Failed to create LLM:", err)
    throw new Error("LLM initialization failed")
  }
}

// ดึง user message ล่าสุดจากประวัติการสนทนา (Web)
function getLatestUserText(messages: UIMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (m.role === "user") {
      const t = (m.parts ?? [])
        .filter((p: any) => p?.type === "text" && typeof p.text === "string")
        .map((p: any) => p.text)
        .join("\n")
        .trim()
      if (t) return t
    }
  }
  return ""
}

// รวม Chunks ของเอกสารมาทำเป็น Context สำหรับ LLM
// โดยเรียงตาม Doc Order และให้ความสำคัญกับ Top Source ก่อนเพื่อประหยัด Token budget
function buildChunkContext(
  chunks: Array<{ sourceId: number; chunkIndex: number; content: string; score?: number }>,
  docInfoMap: Map<number, { title: string; url: string; index: number }>,
  charBudget = 16000,
  topSourceId?: number
) {
  if (!chunks?.length) return "ไม่พบข้อความอ้างอิง";

  const sortedChunks = [...chunks].sort((a, b) => {
    if (topSourceId != null) {
      const aTop = a.sourceId === topSourceId ? 0 : 1
      const bTop = b.sourceId === topSourceId ? 0 : 1
      if (aTop !== bTop) return aTop - bTop
    }
    return a.sourceId - b.sourceId || a.chunkIndex - b.chunkIndex
  })

  let used = 0;
  const lines: string[] = [];
  const seen = new Set<string>();

  for (const c of sortedChunks) {
    const docInfo = docInfoMap.get(c.sourceId);
    if (!docInfo) continue;

    const text = c.content.replace(/\s+/g, " ").trim();
    if (text.length < 15) continue;

    const key = `${c.sourceId}:${c.chunkIndex}`;
    if (seen.has(key)) continue;
    seen.add(key);

    // ใช้เนื้อหาเต็ม (ไม่มีการตัดคำ เพื่อให้ Gemini ทำงานได้เต็มที่)
    const line = `• [อ้างอิง ${docInfo.index}] ${text}`;

    if (used + line.length > charBudget) break;
    lines.push(line);
    used += line.length;
  }

  if (lines.length === 0) return "ไม่พบข้อความอ้างอิง";

  return `Context snippets (ใช้เฉพาะข้อมูลเหล่านี้ในการตอบ):\n${lines.join("\n")}`;
}


export function escapeTemplateBraces(s: string): string {
  return s
    .replace(/\{/g, "{{").replace(/\}/g, "}}")
    .replace(/\[/g, "[[").replace(/\]/g, "]]")
}

function buildReferences(results: Array<{ id: number; title: string; url: string }>) {
  const refMap = new Map<number, { title: string; url: string; index: number }>();
  const lines: string[] = [];

  if (!results?.length) {
    return { refStr: "ไม่มีลิงก์อ้างอิง", refMap };
  }

  results.slice(0, 5).forEach((r, i) => {
    const index = i + 1;
    lines.push(`[${index}] ${r.title} — ${r.url}`);
    refMap.set(r.id, { title: r.title, url: r.url, index: index });
  });

  return { refStr: lines.join("\n"), refMap };
}


// Faculty Line is the only allowed contact when we suggest "contact HR" — not considered a full answer
const FACULTY_LINE_ID = "@143thesr"
const FACULTY_LINE_URL = "lin.ee/fLfASfSp"

/** เอาไว้เช็ค unanwerable - จะ True ถ้า content มีการขอโทษ + แนะนำติดต่อ HR */
function isSuggestedContactOnly(content: string): boolean {
  // ขอโทษ
  const hasApology = /(ขออภัย|ขอโทษ|เสียใจ).{0,100}(ไม่พบ|ไม่มี|ไม่สามารถ)/i.test(content)
  if (!hasApology) return false

  // แนะนำติดต่อ HR - check หา LINE ID 
  const hasContactSuggest = /@143thesr|lin\.ee\/fLfASfSp/i.test(content)
  if (!hasContactSuggest) return false

  // หากคำตอบมีเนื้อหาสาระมากเกินกว่าแค่การแนะนำติดต่อไปยัง HR จะถือว่าไม่ใช่การตอบแบบ Handoff
  // กรองส่วนที่เกี่ยวข้องกับการติดต่อออกเพื่อวัดปริมาณเนื้อหาจริง
  const contactPatterns = [
    /ติดต่อ(เจ้าหน้าที่|ฝ่ายทรัพยากร|HR|บุคคล).*/i,
    /บัญชีไลน์.*:.*/i,
    /scan.*ผ่าน.*/i,
    /https?:\/\/lin\.ee\/.*/i,
    /[@＠]143thesr.*/i,
    /หาก(ท่าน|คุณ|ต้องการ|มีข้อสงสัย|สอบถาม).*(เพิ่มเติม|อื่น|อื่น ๆ).*/i,
    /สามารถ(สอบถาม|ติดต่อ).*(ดิฉัน|ฉัน|บอท|แชทบอท).*(เสมอ|ได้|ค่ะ|ครับ).*/i,
  ]

  const lines = content.split("\n")
  const nonContactLines = lines.filter(line => {
    return !contactPatterns.some(pattern => pattern.test(line))
  })

  const substantialContent = nonContactLines.join("\n").trim()

  // เพิ่มลิมิตจาก 250 เป็น 500: คำอธิบายที่ยาวกว่านั้นอาจยังเป็นเรื่อง Fallback ได้หากจบด้วยการให้ติดต่อ HR
  if (substantialContent.length > 500) return false

  // เช็คเพิ่มเติม: ถ้ามี Bullet points หรือโครงสร้างข้อมูล จะถือว่าเป็นคำตอบที่มีสาระ (ไม่ใช่แค่ทักทายทั่วไป)
  const hasStructuredContent = /[•\-\*]\s+\w/.test(substantialContent) || substantialContent.includes("F") && substantialContent.includes("I") && substantialContent.includes("G")
  if (hasStructuredContent && substantialContent.length > 200) return false

  const hasPhone = /\d{2,3}[-\s]?\d{3,4}([-\s]?(ต่อ|ext\.?)\s*\d+)?/.test(content) || /ต่อ\s*\d+/.test(content)
  const hasEmail = /@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(content) || /hr@kmitl/i.test(content)
  if (hasPhone || hasEmail) return false
  const hasOtherLine = /@[\w.-]+/.test(content) && !content.includes(FACULTY_LINE_ID)
  const hasOtherUrl = /https?:\/\//i.test(content) && !content.includes(FACULTY_LINE_URL)
  if (hasOtherLine || hasOtherUrl) return false

  return true
}

/** เช็คว่าเป็นการตอบข้อมูลการติดต่อ HR โดยตรงหรือไม่ (เช่น เมื่อถามว่า "ติดต่อ HR ได้ที่ไหน")
 * ใช้เพื่อซ่อน Reference ต่างๆ เพราะเป็นการตอบข้อมูลทั่วไป ไม่ใช่การดึงความรู้จากเอกสาร */
function isDirectContactResponse(content: string): boolean {
  // Must contain HR contact info
  const hasContactInfo = /@143thesr|lin\.ee\/fLfASfSp/i.test(content)
  if (!hasContactInfo) return false

  // Strip contact-related lines to see if there's substantial content
  const contactPatterns = [
    /ติดต่อ(เจ้าหน้าที่|ฝ่ายทรัพยากร|HR|บุคคล).*/i,
    /บัญชีไลน์.*:.*/i,
    /scan.*ผ่าน.*/i,
    /https?:\/\/lin\.ee\/.*/i,
    /[@＠]143thesr.*/i,
    /ท่าน.*สามารถ.*ติดต่อ.*/i,
    /เลือกตัวเลือกเมนู.*/i,
  ]

  const lines = content.split("\n")
  const nonContactLines = lines.filter(line => {
    return !contactPatterns.some(pattern => pattern.test(line))
  })

  const substantialContent = nonContactLines.join("\n").trim()

  // หากมีเนื้อหาสาระอื่นนอกเหนือข้อมูลติดต่อ จะไม่ถือว่าเป็น pure contact response
  if (substantialContent.length > 100) return false

  // Check if response has other contact methods (phone/email) - if so, it's a real answer
  const hasPhone = /\d{2,3}[-\s]?\d{3,4}([-\s]?(ต่อ|ext\.?)\s*\d+)?/.test(content) || /ต่อ\s*\d+/.test(content)
  const hasEmail = /@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(content) || /hr@kmitl/i.test(content)
  if (hasPhone || hasEmail) return false

  return true
}

/** Strip unwanted contact/follow-up lines that LLM incorrectly appends to complete answers */
function stripUnwantedContactLines(content: string): string {
  const lines = content.split("\n")
  const contactPatterns = [
    /หาก(ท่าน|คุณ|ต้องการ|มีข้อสงสัย|สอบถาม).*(เพิ่มเติม|อื่น|อื่น ๆ|รายละเอียด).*/i,
    /สามารถ(สอบถาม|ติดต่อ).*(ดิฉัน|ฉัน|บอท|แชทบอท).*(เสมอ|ได้|ค่ะ|ครับ|นะคะ).*/i,
    /ยินดี(ให้บริการ|ช่วยเหลือ|ตอบ).*(ค่ะ|ครับ).*/i,
    /ติดต่อ(เจ้าหน้าที่|ฝ่ายทรัพยากร|HR|บุคคล).*(โดยตรง|ได้|ทาง).*/i,
    /บัญชีไลน์.*:.*/i,
    /scan.*ผ่าน.*/i,
    /https?:\/\/lin\.ee\/.*/i,
    /[@＠]143thesr.*/i,
  ]

  const filtered = lines.filter(line => {
    return !contactPatterns.some(pattern => pattern.test(line))
  })

  return filtered.join("\n").trim()
}

/** Strip document-request preamble so semantic search targets the topic, not the request verb.
 *  e.g. "ขอเอกสารที่เกี่ยวกับการพ้นสภาพ" → "การพ้นสภาพ" */
function stripDocRequestPrefix(q: string): string {
  const cleaned = q
    .replace(/(ขอ|หา|ดาวน์โหลด|download)\s*(เอกสาร|ไฟล์|แบบฟอร์ม)?\s*(ที่|ซึ่ง)?\s*(เกี่ยวกับ|เกี่ยวข้องกับ|เกี่ยวข้อง)?/gi, "")
    .replace(/^(เอกสาร|ไฟล์|แบบฟอร์ม)\s*(ที่|ซึ่ง)?\s*(เกี่ยวกับ|เกี่ยวข้องกับ)?/gi, "")
    .replace(/(หน่อย|ครับ|ค่ะ|นะ|นะคะ|นะครับ)\s*$/gi, "")
    .trim()
  return cleaned.length >= 4 ? cleaned : q
}

/** Intent detection to separate document requests from QA requests. */
function detectIntent(q: string): "document" | "qa" {
  // Only trigger document mode if user is PURELY asking for documents, not asking how-to questions
  const pureDocKeywords = [
    "ขอเอกสาร",
    "มีเอกสาร",
    "เอกสารเกี่ยวกับ",
    "download",
    "ดาวน์โหลด",
  ]

  // If query asks "how to" or "what are the steps/rules/criteria", it's QA even if it mentions documents
  const qaIndicators = [
    "ทำอย่างไร",
    "อย่างไร",
    "ต้องทำ",
    "มีหลักเกณฑ์",
    "ระเบียบ",
    "ขั้นตอน",
    "วิธี",
    "คืออะไร",
    "อธิบาย",
  ]

  const hasQAIntent = qaIndicators.some(k => q.includes(k))
  if (hasQAIntent) return "qa"

  if (pureDocKeywords.some(k => q.includes(k))) {
    return "document"
  }
  return "qa"
}

// Callback handler to save chat history (fire-and-forget)
class DBSaverCallback extends BaseCallbackHandler {
  name = "DBSaverCallback"
  private responseText = ""
  private isStreaming = false
  private hideCitations = false

  constructor(
    private userText: string,
    private sources: any[],
    private meta: { sessionId?: string; lineUserId?: string },
    private ragUsed: boolean,
    private topScore: number | null,
    private startedAt: number = performance.now(),
    private citationsShown: boolean = false
  ) {
    super()
  }

  get collectedText() { return this.responseText }
  get shouldHideCitations() { return this.hideCitations }

  markCitationsShown() {
    this.citationsShown = true
  }

  async handleLLMNewToken(token: string) {
    this.isStreaming = true
    this.responseText += token
  }

  async handleLLMEnd(output: any) {
    try {
      if (!this.isStreaming && output?.output) {
        this.responseText = String(output.output || "")
      }
      if (!this.responseText.trim()) return

      // กรองประโยคแนะนำการติดต่ออกเพื่อใช้เช็ค Fallback ที่แม่นยำขึ้น
      const cleanedResponse = stripUnwantedContactLines(this.responseText)
      // ตรวจสอบกับข้อความ Original (ก่อนกรอง) เพื่อป้องกันการตรวจจับพลาด
      const suggestedContactOnly = isSuggestedContactOnly(this.responseText)
      const directContactResponse = isDirectContactResponse(this.responseText)
      this.hideCitations = suggestedContactOnly ||
        directContactResponse ||
        /ขออภัย.{0,60}ไม่พบข้อมูล/i.test(cleanedResponse) ||
        /ไม่สามารถ(ให้ข้อมูล|ตอบ|ช่วยเหลือ)/i.test(cleanedResponse) ||
        /(ให้ข้อมูลได้เฉพาะเรื่อง|ไม่สามารถตอบคำถามนี้)/i.test(cleanedResponse)
      const responseTimeSeconds = (performance.now() - this.startedAt) / 1000

      // กำหนดประเภทคำตอบ (answerType) และสาเหตุ (fallbackReason) จากเนื้อหาและ RAG metadata
      let answerType: "answered" | "partial" | "fallback" = "answered"
      let fallbackReason: "no_docs" | "low_conf" | "policy_restricted" | "handoff" | "unknown" | undefined

      if (suggestedContactOnly) {
        answerType = "fallback"
        fallbackReason = "handoff"
      } else if (!this.ragUsed || (this.topScore !== null && this.topScore < MIN_RAG_SIMILARITY)) {
        answerType = "partial"
        fallbackReason = "no_docs"
      } else if (this.topScore !== null && this.topScore < 0.5) {
        answerType = "partial"
        fallbackReason = "low_conf"
      }

      const retrievalSnapshot = this.sources
        .slice(0, 5)
        .map((d: any) => ({ id: d.id, title: d.title || d.fileName || "", score: d.score ?? 0 }))

      // Fire-and-forget with timeout
      Promise.race([
        saveChatTurn({
          sessionId: this.meta.sessionId,
          lineUserId: this.meta.lineUserId,
          userMessage: this.userText,
          botMessage: this.responseText,
          sources: this.sources,
          metadata: {
            ragUsed: this.ragUsed,
            topScore: this.topScore,
            suggestedContactOnly,
            answerType,
            fallbackReason,
            retrievalSnapshot,
            citationsShown: this.citationsShown,
          },
          responseTimeSeconds,
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error("DB save timeout")), 10000))
      ]).catch(err => {
        // Chat save is not critical for user experience, just log and continue
        console.warn("Chat turn save failed (non-critical):", err.message)
      })

      // บันทึก FAQ candidate (แบบ fire-and-forget พร้อม timeout)
      const channel = this.meta.lineUserId ? ConversationChannel.LINE : ConversationChannel.WEB
      Promise.race([
        saveFAQCandidate({
          question: this.userText,
          answer: this.responseText,
          channel,
          metadata: {
            topScore: this.topScore,
            answerType,
          },
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error("FAQ save timeout")), 10000))
      ]).catch(err => {
        // การบันทึก FAQ ไม่ใช่ส่วนวิกฤต ให้ Log ไว้แล้วทำงานต่อ
        console.warn("FAQ candidate save failed (non-critical):", err.message)
      })
    } catch (err) {
      console.error("DBSaverCallback.handleLLMEnd error:", err)
    }
  }
}

// แยกประเภท Chat สำหรับ Web และ LINE
type ChatOption = { userText: string; stream: boolean } | { messages: UIMessage[]; stream: boolean }

type ReferenceCandidate = {
  id?: number
  title?: string | null
  url?: string | null
  score?: number | null
}

function selectReferenceDocs(docs: ReferenceCandidate[]) {
  const sorted = [...docs].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
  const eligible = sorted.filter(d => (d.score ?? 0) >= CITATION_SIMILARITY_THRESHOLD)
  const citationPool = eligible.length > 0 ? eligible : sorted
  return {
    mostRelevant: citationPool.slice(0, 1),
    maybeRelevant: citationPool.slice(1, 4),
  }
}

function formatLineReferenceBlock(mostRelevant: ReferenceCandidate[], maybeRelevant: ReferenceCandidate[]) {
  if (mostRelevant.length === 0 && maybeRelevant.length === 0) return ""

  const formatDocLine = (doc: ReferenceCandidate, icon: string) => {
    const title = doc.title?.trim() || doc.url || "เอกสาร"
    if (doc.url) return `${icon} ${title}\n${doc.url}`
    return `${icon} ${title}`
  }

  const lines: string[] = []
  const divider = "===================="
  lines.push(divider)

  if (mostRelevant.length > 0) {
    lines.push("เอกสารอ้างอิงที่เกี่ยวข้องที่สุด:")
    lines.push(...mostRelevant.map(doc => formatDocLine(doc, "-")))
  }
  if (maybeRelevant.length > 0) {
    if (lines.length > 0) lines.push("")
    lines.push(divider)
    lines.push("เอกสารที่อาจเกี่ยวข้อง:")
    lines.push(...maybeRelevant.map(doc => formatDocLine(doc, "-")))
  }

  return lines.join("\n").trim()
}

export async function answerWithSearch(
  sourceChat: ChatOption,
  meta: { sessionId?: string; lineUserId?: string } = {}
) {
  const startedAt = performance.now()
  const model = createLLM(sourceChat.stream)
  const query = "userText" in sourceChat ? sourceChat.userText.trim() : getLatestUserText(sourceChat.messages)
  const sharedIntent = await classifyQuestionIntent(query)

  const [faqResults, { results: docResults = [] }] = await Promise.all([
    searchApprovedFAQs(query, 3),
    searchDocuments(query, 5)
  ])
  const topFAQ = faqResults[0]

  // FAQ-BOOSTED RETRIEVAL: ถ้าเจอ FAQ ที่ตรงกัน จะใช้คำถามใน FAQ มาช่วยเสริมการค้นหา Document (RAG) ให้แม่นยำขึ้น
  let enhancedDocResults = docResults
  if (topFAQ && topFAQ.score >= 0.7) {
    const enhancedQuery = `${query} ${topFAQ.Question}`
    console.log("[FAQ-BOOST] Enhanced query:", enhancedQuery.slice(0, 100))

    try {
      const boostedSearch = await searchDocuments(enhancedQuery, 5)
      enhancedDocResults = boostedSearch.results || []
      console.log("[FAQ-BOOST] พบ", enhancedDocResults.length, "boosted docs")
    } catch (err) {
      console.error("[FAQ-BOOST] Enhanced search failed, using original:", err)
      enhancedDocResults = docResults
    }
  }

  const topScore = enhancedDocResults[0]?.score ?? 0
  const topFAQScore = topFAQ?.score ?? 0
  const isShort = query.trim().length < 10
  const shouldSkipKnowledgeRetrieval = sharedIntent.shouldSkipKnowledgeRetrieval

  // ตัดสินใจว่าจะใช้ RAG หรือไม่
  const faqConfidence = getFAQConfidence(faqResults, query)
  const useFaqGuidedRag = faqConfidence >= 0.65 && !shouldSkipKnowledgeRetrieval
  const useRag =
    (useFaqGuidedRag || !useFaqGuidedRag) &&
    !isShort &&
    !shouldSkipKnowledgeRetrieval &&
    enhancedDocResults.length > 0 &&
    topScore >= MIN_RAG_SIMILARITY

  // กรณีใช้ FAQ-guided RAG: ใช้ FAQ เป็นฐานข้อมูลหลัก และเสริมด้วย RAG content
  if (useFaqGuidedRag && topFAQ) {
    incrementFAQUsage(topFAQ.FAQId).catch(() => { })

    // ดึง Context จาก Document (RAG) มาเสริมคำตอบจาก FAQ
    const topSourceIds = enhancedDocResults.map(r => r.id)
    const topDocId = enhancedDocResults[0]?.id
    let limitedChunks: Array<{ sourceId: number; chunkIndex: number; content: string; score?: number }> = []

    try {
      const blocks = await buildContextBlocks(query, {
        retrieve: 20, // ดึงปริมาณน้อยลงสำหรับการเสริมข้อมูล FAQ
        neighborWindow: 1,
        maxBlocks: 2,
        minAnchorScore: 0.3,
        sourceIds: topSourceIds,
      })
      limitedChunks = blocks
    } catch (e) {
      console.error("[FAQ-GUIDED] Context block error:", e)
    }

    const docInfoMap = new Map()
    enhancedDocResults.forEach((doc: any, idx: number) => {
      docInfoMap.set(doc.id, { title: doc.title || doc.fileName || "", url: doc.url || "", index: idx + 1 })
    })

    const ctx = buildChunkContext(limitedChunks, docInfoMap, 8000, topDocId)
    const { refStr: references } = buildReferences(enhancedDocResults)

    // ตรวจสอบว่าควรเสริมข้อมูล (enrich) ให้กับ FAQ นี้หรือไม่
    const shouldEnrich = shouldEnrichFAQ(topFAQ, query, ctx)

    // ให้ LLM เป็นคนเรียบเรียงคำตอบเสมอ (ไม่ส่ง FAQ static กลับไปตรงๆ)
    const faqGuidedPrompt = buildFAQGuidedPrompt(topFAQ, shouldEnrich && ctx ? ctx : "", references, query)
    const model = createLLM(sourceChat.stream)
    const dbCallback = new DBSaverCallback(query, enhancedDocResults, meta, true, topFAQScore, startedAt)

    console.log("[FAQ-GUIDED] ใช้ FAQ เป็นฐาน, การเสริมข้อมูล RAG:", shouldEnrich)

    if ("messages" in sourceChat) {
      const prompt = ChatPromptTemplate.fromMessages([
        ["system", SYSTEM_PROMPT + faqGuidedPrompt],
        ...convertToModelMessages(sourceChat.messages),
      ])
      const chain = prompt.pipe(model)

      try {
        const stream = await chain.stream({}, { callbacks: [dbCallback] })
        return createUIMessageStreamResponse({ stream: toUIMessageStream(stream) })
      } catch (err) {
        console.error("[FAQ-GUIDED] Stream error, กำลังสลับไปใช้ FAQ-only LLM:", err)
        // กรณีดึงข้อมูลเสริมไม่ได้ ให้ใช้เฉพาะข้อมูลจาก FAQ (แต่ยังผ่าน LLM เพื่อความสมูท)
        const faqOnlyPrompt = buildFAQGuidedPrompt(topFAQ, "", "", query)
        const faqOnlyPromptTemplate = ChatPromptTemplate.fromMessages([
          ["system", SYSTEM_PROMPT + faqOnlyPrompt],
          ...convertToModelMessages(sourceChat.messages),
        ])
        const faqOnlyChain = faqOnlyPromptTemplate.pipe(model)
        const stream = await faqOnlyChain.stream({}, { callbacks: [dbCallback] })
        return createUIMessageStreamResponse({ stream: toUIMessageStream(stream) })
      }
    } else {
      // LINE: invoke
      const prompt = ChatPromptTemplate.fromMessages([
        ["system", LINE_SYSTEM_PROMPT + faqGuidedPrompt],
        ["human", "{messageinput}"],
      ])
      const chain = prompt.pipe(model)
      const resp = await chain.invoke({ messageinput: query }, { callbacks: [dbCallback] })
      const content = String(resp.content ?? "")
        ; (dbCallback as any).responseText = content
      dbCallback.handleLLMEnd({ output: content })
      return content
    }
  }

  if (!useRag) {
    // กรณีมี FAQ แต่ไม่มี Document ที่เกี่ยวข้อง
    if (topFAQ && topFAQ.score >= 0.75) {
      console.log("[FAQ-ONLY] ใช้ FAQ โดยไม่มี RAG enrichment:", topFAQ.Question)
      incrementFAQUsage(topFAQ.FAQId).catch(() => { })
      
      const faqOnlyPrompt = buildFAQGuidedPrompt(topFAQ, "", "", query)
      const model = createLLM(sourceChat.stream)
      const dbCallback = new DBSaverCallback(query, [], meta, false, topFAQ.score, startedAt)
      
      if ("messages" in sourceChat) {
        const prompt = ChatPromptTemplate.fromMessages([
          ["system", SYSTEM_PROMPT + faqOnlyPrompt],
          ...convertToModelMessages(sourceChat.messages),
        ])
        const chain = prompt.pipe(model)
        try {
          const stream = await chain.stream({}, { callbacks: [dbCallback] })
          return createUIMessageStreamResponse({ stream: toUIMessageStream(stream) })
        } catch (err) {
          console.error("[FAQ-ONLY] Stream error:", err)
          const resp = await chain.invoke({}, { callbacks: [dbCallback] })
          const content = String(resp?.content ?? "")
          ; (dbCallback as any).responseText = content
          dbCallback.handleLLMEnd({ output: content })
          return new Response(
            JSON.stringify({ id: "faq-only-response", role: "assistant", content }),
            { headers: { "Content-Type": "application/json" } }
          )
        }
      } else {
        const prompt = ChatPromptTemplate.fromMessages([
          ["system", LINE_SYSTEM_PROMPT + faqOnlyPrompt],
          ["human", "{messageinput}"],
        ])
        const chain = prompt.pipe(model)
        const resp = await chain.invoke({ messageinput: query }, { callbacks: [dbCallback] })
        const content = String(resp.content ?? "")
        ; (dbCallback as any).responseText = content
        dbCallback.handleLLMEnd({ output: content })
        return content
      }
    }

    console.log("[ANSWERCTX] RAG skipped", {
      query: query.slice(0, 50),
      isShort,
      intentLabel: sharedIntent.label,
      shouldSkipKnowledgeRetrieval,
      topScore,
      topFAQScore,
      docCount: docResults.length,
      faqCount: faqResults.length,
    })
  }

  const dbCallback = new DBSaverCallback(query, docResults, meta, useRag, topScore, startedAt)

  if (!useRag) {
    if ("messages" in sourceChat) {
      const prompt = ChatPromptTemplate.fromMessages([
        ["system", SYSTEM_PROMPT],
        ...convertToModelMessages(sourceChat.messages),
      ])
      const chain = prompt.pipe(model)
      console.time("model.stream")
      try {
        const stream = await chain.stream({}, { callbacks: [dbCallback] })
        console.timeEnd("model.stream")
        return createUIMessageStreamResponse({ stream: toUIMessageStream(stream) })
      } catch (err) {
        console.timeEnd("model.stream")
        console.error("[ANSWERCTX] stream(noRAG) error, falling back to invoke:", err)
        const resp = await chain.invoke({}, { callbacks: [dbCallback] })
        const content = String(resp?.content ?? "")
          //set response text & trigger save สำหรับ invoke fallback
          ; (dbCallback as any).responseText = content
        dbCallback.handleLLMEnd({ output: content })
        return new Response(
          JSON.stringify({ id: "noRAG-response", role: "assistant", content }),
          { headers: { "Content-Type": "application/json" } }
        )
      }
    } else {
      const prompt = ChatPromptTemplate.fromMessages([
        ["system", LINE_SYSTEM_PROMPT],
        ["human", "{messageinput}"],
      ])
      const chain = prompt.pipe(model)
      const resp = await chain.invoke({ messageinput: query }, { callbacks: [dbCallback] })
      const content = String(resp.content ?? "")
        // set response text สำหรับ non-streaming callback
        ; (dbCallback as any).responseText = content
      dbCallback.handleLLMEnd({ output: content })
      return content
    }
  }

  const intent = detectIntent(query)

  // === Intent Routing: Document requests ===
  // user ขอเอกสาร/แบบฟอร์ม
  if (intent === "document" && docResults.length > 0) {
    console.log("[ANSWERCTX] Intent = document. Returning raw document links.")
    // Re-search with topic-only query to avoid 'ขอเอกสาร' biasing the embedding
    const topicQuery = stripDocRequestPrefix(query)
    const docSearchResults = topicQuery !== query
      ? (await searchDocuments(topicQuery, 5)).results ?? []
      : docResults
    const topDocs = docSearchResults.filter(d => (d.score ?? 0) > 0.35).sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    console.log("[ANSWERCTX] doc-intent topicQuery:", topicQuery, "topDocs:", topDocs.map(d => ({ title: d.title, score: d.score })))
    let docContent = ""
    if (topDocs.length > 0) {
      docContent = `พบเอกสารที่เกี่ยวข้อง ${topDocs.length} รายการ`
    } else {
      docContent = "ขออภัย ไม่พบเอกสารที่ตรงกับคำค้นหาของคุณค่ะ"
    }

    if ("messages" in sourceChat) {
      dbCallback.handleLLMEnd({ output: docContent })
      const stream = createUIMessageStream({
        execute: async ({ writer }) => {
          // Use a synthetic LangChain stream so toUIMessageStream emits proper
          // start/text/finish parts — without these, useChat never transitions to 'ready'
          const syntheticReadable = new ReadableStream<AIMessageChunk>({
            start(controller) {
              controller.enqueue(new AIMessageChunk({ content: docContent }))
              controller.close()
            },
          })
          await writer.merge(toUIMessageStream(syntheticReadable as any))
          writer.write({
            type: "data-rag-refs",
            data: {
              mostRelevant: topDocs.slice(0, 1).map((d) => ({ id: d.id, url: d.url, title: d.title })),
              maybeRelevant: topDocs.slice(1).map((d) => ({ id: d.id, url: d.url, title: d.title })),
            },
          })
        },
      })
      return createUIMessageStreamResponse({ stream })
    } else {
      dbCallback.handleLLMEnd({ output: docContent })
      return docContent
    }
  }

  const stopWords = ["อธิบาย", "เอกสาร", "แบบฟอร์ม", "ขอ", "ที่", "เกี่ยวข้อง", "เกี่ยวกับ", "หน่อย", "ครับ", "ค่ะ", "มีอะไรบ้าง", "คืออะไร", "การ", "ช่วย", "บอก", "เรื่อง", "อย่างไร", "ไหน"]
  let qClean = query
  stopWords.forEach(sw => { qClean = qClean.replace(new RegExp(sw, 'g'), ' ') })
  const keywords = qClean.split(/\s+/).filter(w => w.length >= 3)

  // Apply lexical boost to docResults based on title & category
  const boostedDocResults = docResults.map(d => {
    let scoreBoost = 0
    for (const kw of keywords) {
      if (d.title.includes(kw) || (d.category && d.category.includes(kw))) scoreBoost += 0.15
    }
    return { ...d, score: (d.score ?? 0) + scoreBoost }
  }).sort((a, b) => (b.score ?? 0) - (a.score ?? 0))

  // จัดการเอกสารอ้างอิง (Cite เฉพาะเอกสารที่มีความคล้ายสูงพอ)
  const strongDocs = boostedDocResults.filter(d => (d.score ?? 0) >= CITATION_SIMILARITY_THRESHOLD)
  const docsForRefs = strongDocs.length > 0 ? strongDocs : boostedDocResults
  const { refStr: references, refMap } = buildReferences(docsForRefs);

  // ===== Block-based Neighbor-safe Retrieval =====
  // จัดกลุ่ม Chunks ของเอกสารให้เป็น Block เพื่อให้ข้อมูลที่เป็นลำดับ (เช่น หัวข้อและรายการ) ไม่หลุดจากกัน
  const topSourceIds = boostedDocResults.map(r => r.id)
  const topDocId = docResults[0]?.id
  let limitedChunks: Array<{ sourceId: number; chunkIndex: number; content: string; score?: number }> = []
  try {
    console.time("buildContextBlocks")
    const blocks = await buildContextBlocks(query, {
      retrieve: 40,
      neighborWindow: 2,
      maxBlocks: 4,
      minAnchorScore: 0.35,
      sourceIds: topSourceIds,
    })
    console.timeEnd("buildContextBlocks")
    limitedChunks = blocks
  } catch (e) {
    console.error("[ANSWERCTX] buildContextBlocks error:", e)
    limitedChunks = []
  }

  // // Debug: ดู chunk ที่ส่งให้ LLM
  // console.log("[ans-data] limitedChunks preview:",
  //   limitedChunks.map(c => ({ doc: c.sourceId, idx: c.chunkIndex, preview: c.content.slice(0, 60) }))
  // )

  const chunksWithNeighbors = limitedChunks  // alias for existing fallback check below


  if (chunksWithNeighbors.length === 0) {
    //ไม่พบข้อมูลที่เกี่ยวข้องใน Context แต่มีเอกสารที่อาจเกี่ยวข้อง
    const mostRelevantDoc = docResults[0]
    if (mostRelevantDoc) {
      const responseWithDoc = `ขออภัย ไม่พบข้อมูลที่เกี่ยวข้องกับคำถามนี้ในเอกสารที่มีอยู่\n\nแต่มีเอกสารที่อาจเกี่ยวข้อง: ${mostRelevantDoc.title}\n\nสามารถดาวน์โหลดได้ที่: ${mostRelevantDoc.url}\n\nหากต้องการความช่วยเหลือเพิ่มเติม กรุณาติดต่อฝ่ายทรัพยากรบุคคลโดยตรงค่ะ`

      if (!("messages" in sourceChat)) {
        return responseWithDoc
      }
    } else {
      //ไม่พบเอกสารที่เกี่ยวข้อง
      const noRelevantResponse = `ขออภัย ไม่พบเอกสารที่เกี่ยวข้องกับคำถามนี้ค่ะ\n\nหากต้องการความช่วยเหลือเพิ่มเติม กรุณาติดต่อฝ่ายทรัพยากรบุคคลโดยตรง หรือลองใช้คำค้นหาที่เฉพาะเจาะจงมากขึ้นค่ะ`

      if (!("messages" in sourceChat)) {
        return noRelevantResponse
      }
    }
  }

  // สร้าง Context: ให้ความสำคัญกับเอกสารที่เป็น Top Doc ก่อนเสมอ
  const ctx = buildChunkContext(limitedChunks, refMap, 16000, topDocId)


  console.log("[ans-data] query:", query)
  console.log("[ans-data] docRefs:", docResults.length, "chunks used:", limitedChunks.length)
  console.log("[ans-data] ctx.length:", ctx.length)
  console.log("[ans-data] docScores:", docResults.map(d => ({ title: d.title, score: d.score })))

  // Debug: log what context we're feeding the LLM
  console.log("[ans-data] CTX SAMPLE (first 800 chars):", ctx.slice(0, 800))

  // สร้าง prompt
  const systemPromptSearched = [
    "คุณคือ HR Chatbot ผู้เชี่ยวชาญด้านทรัพยากรบุคคล จากคณะเทคโนโลยีสารสนเทศ มหาวิทยาลัยเทคโนโลยีพระจอมเกล้าเจ้าคุณทหารลาดกระบัง คุณให้ข้อมูลที่ถูกต้องและเป็นประโยชน์แก่เจ้าหน้าที่และบุคลากร",
    "**กฎสำคัญที่สุด**: คุณห้ามใช้ความรู้ทั่วไปหรือข้อมูลจากภายนอกที่ไม่ได้อยู่ใน CONTEXT ที่ให้มา คุณต้องตอบจากข้อมูลใน CONTEXT เท่านั้น หาก CONTEXT ไม่มีข้อมูลที่เกี่ยวข้อง ให้ตอบว่าไม่พบข้อมูลทันที",
    "ใช้ข้อมูลใน CONTEXT เป็นหลักในการตอบคำถามเท่านั้น ห้ามเพิ่มเติมข้อมูลจากความรู้ทั่วไปหรือการคาดเดา",
    "**กฎสำคัญ**: หากคำถามต้องการ 'อธิบาย', 'คืออะไร', หรือขอรายละเอียด ให้อธิบายเนื้อหาออกมาตรงๆ เลย ห้ามพูดว่า 'มีระบุในเอกสาร' หรือ 'ดูรายละเอียดในเอกสาร' โดยไม่ยอมอธิบายเนื้อหาจริงๆ",
    "หากเนื้อหายาว ให้สรุปเป็น Bullet Points",
    "**กฎสำคัญเรื่องลิงก์**: หาก CONTEXT มี URL ที่เป็นเว็บไซต์ทางการ/หน้าระบบ/แบบฟอร์ม ให้คง URL ที่สำคัญไว้ในคำตอบด้วย (เขียนเป็นลิงก์เต็มที่คลิกได้) **สำคัญมาก: เมื่อเขียน URL ห้ามใส่วงเล็บปิด ) หลัง URL โดยเด็ดขาด แม้ว่าจะอยู่ในประโยคที่มีวงเล็บก็ตาม ให้เว้นวรรคก่อนวงเล็บเปิดปิด**",
    "**กฎสำคัญที่สุดเรื่อง URL**: หากต้องการแทรก URL ลิงก์ในคำตอบ ให้ใช้ URL จาก REFERENCES ที่ให้มาอย่างเคร่งครัด ห้ามดัดแปลง แก้ไข หรือพิมพ์ชื่อไฟล์ใหม่เองโดยเด็ดขาด ต้องใช้ URL ตามที่ปรากฏใน REFERENCES เท่านั้น",
    "ตอบ 'ขออภัย ไม่พบข้อมูลค่ะ' **ต้องใช้คำนี้ในการขอโทษ** โดยตอบเฉพาะเมื่อ CONTEXT ว่างเปล่าและไม่มีความรู้เรื่องนั้นจริงๆ",
    "**กฎสำคัญเรื่องการติดต่อ HR**: เมื่อคุณตอบคำถามได้อย่างครบถ้วนแล้ว ให้หยุดตอบทันที ห้ามเพิ่มประโยคแนะนำให้ติดต่อเจ้าหน้าที่ HR หรือลิงก์ LINE ต่อท้ายเด็ดขาด",
    "แนะนำติดต่อ HR เฉพาะเมื่อ CONTEXT ว่างเปล่าหรือไม่มีข้อมูลเพียงพอจริงๆ และตอบคำถามไม่ได้เลยเท่านั้น หรือเมื่อผู้ใช้ถามเรื่องช่องทางการติดต่อโดยตรง",
    "****เฉพาะเมื่อจำเป็นต้องแนะนำให้ติดต่อ HR เท่านั้น**** ให้พูดว่า: ท่านสามารถติดต่อเจ้าหน้าที่ HR ได้ทางบัญชีไลน์ id: @143thesr หรือ scan ผ่าน https://lin.ee/fLfASfSp และเลือกตัวเลือกเมนูติดต่อเจ้าหน้าที่โดยตรง",
    "หากเป็นคำทักทายหรือคำถามทั่วไปที่ไม่ใช่งานฝ่าย HR ให้ตอบสั้นๆ และห้ามใส่ลิงก์",
    "ห้ามพิมพ์ชื่อเต็มของเอกสารในคำตอบ เพราะระบบแสดงรายการเอกสารให้ผู้ใช้เห็นแยกต่างหากแล้ว",
    "ใช้ Markdown ได้เพื่อความสวยงาม สำหรับ bullet ให้ใช้ - แทน",
    "",
    "REFERENCES:",
    escapeTemplateBraces(references),
    "",
    "CONTEXT:",
    escapeTemplateBraces(ctx),
    "",
    "หลังจากให้คำตอบแล้ว ห้ามพูดว่า 'หากต้องการสอบถามเพิ่มเติมสามารถติดต่อ...' หรือ 'หากมีข้อสงสัยเพิ่มเติม...' หรือ 'ท่านสามารถติดต่อเจ้าหน้าที่ HR...' ",
    "คำตอบ: (อธิบายเนื้อหาออกมาเลยโดยตรง ไม่ต้องบอกให้ผู้ใช้ไปอ่านลิงก์เอง ไม่ใส่ชื่อเอกสาร ไม่ใส่ [อ้างอิง N])"
  ].join("\n")
  console.log("references", references)

  //==========================================================
  //web --> Stream
  if ("messages" in sourceChat) {
    const prompt = ChatPromptTemplate.fromMessages([
      ["system", SYSTEM_PROMPT + systemPromptSearched],
      ...convertToModelMessages(sourceChat.messages),
    ])
    const chain = prompt.pipe(model)
    console.time("model.stream")
    try {
      const shouldShowRefs = true
      const { mostRelevant, maybeRelevant } = selectReferenceDocs(boostedDocResults)
      const streamWithSources = createUIMessageStream({
        execute: async ({ writer }) => {
          try {
            console.log("[ANSWERCTX] Starting LLM stream...")
            const stream = await chain.stream({}, { callbacks: [dbCallback] })
            console.timeEnd("model.stream")
            console.log("[ANSWERCTX] Stream created, merging...")
            const uiStream = toUIMessageStream(stream)
            const reader = (uiStream as ReadableStream<any>).getReader()
            let capturedText = ""

            // ตั้งเวลา Timeout ป้องกันการค้างของ Stream
            let timeoutId: NodeJS.Timeout | undefined
            const timeoutPromise = new Promise<void>((_, reject) => {
              timeoutId = setTimeout(() => {
                reject(new Error("Stream timeout after 60 seconds"))
              }, 60000)
            })
            
            const streamPromise = (async () => {
              while (true) {
                const { done, value } = await reader.read()
                if (done) break
                const textDelta = (value as any)?.textDelta ?? (value as any)?.delta
                if (typeof textDelta === "string") capturedText += textDelta
                writer.write(value)
              }
            })()
            
            // Race between stream completion and timeout
            await Promise.race([streamPromise, timeoutPromise])
            // Clear timeout if it exists
            if (timeoutId) {
              clearTimeout(timeoutId)
            }

            const cleanedText = stripUnwantedContactLines(capturedText)
            // Check fallback on ORIGINAL text (before stripping), otherwise contact detection fails
            const isFallback = isSuggestedContactOnly(capturedText) ||
              isDirectContactResponse(capturedText) ||
              /ขออภัย.{0,60}ไม่พบข้อมูล/i.test(cleanedText) ||
              /ไม่สามารถ(ให้ข้อมูล|ตอบ|ช่วยเหลือ)/i.test(cleanedText) ||
              /(ให้ข้อมูลได้เฉพาะเรื่อง|ไม่สามารถตอบคำถามนี้)/i.test(cleanedText)
            if (shouldShowRefs && !isFallback) {
              dbCallback.markCitationsShown()
              writer.write({
                type: "data-rag-refs",
                data: {
                  mostRelevant: mostRelevant.map((d) => ({ id: d.id, url: d.url, title: d.title })),
                  maybeRelevant: maybeRelevant.slice(0, 3).map((d) => ({ id: d.id, url: d.url, title: d.title })),
                },
              })
            }
          } catch (err) {
            console.error("[ANSWERCTX] Error in execute callback:", err)
            writer.write({ type: "text-delta", delta: "ขออภัย เกิดข้อผิดพลาดในการประมวลผล กรุณาลองใหม่อีกครั้งค่ะ", id: "error-msg" })
          }
        },
      })
      return createUIMessageStreamResponse({ stream: streamWithSources })
    } catch (err) {
      console.timeEnd("model.stream")
      console.error("[ANSWERCTX] stream error, falling back to invoke:", err)
      
      // Check if it's a Google API service unavailable error
      const isGoogleAPIError = (err as any)?.message?.includes('503 Service Unavailable') || 
                              (err as any)?.message?.includes('generativelanguage.googleapis.com')
      
      if (isGoogleAPIError) {
        console.log("[ANSWERCTX] Google API unavailable, returning fallback response")
        const fallbackResponse = "ขออภัย ระบบประมวลผลข้อมูลชั่วคราวไม่พร้อมใช้งานในขณะนี้ กรุณาลองใหม่อีกครั้งในภายหลังค่ะ"
        dbCallback.handleLLMEnd({ output: fallbackResponse })
        return new Response(
          JSON.stringify({ id: "api-error-response", role: "assistant", content: fallbackResponse }),
          { headers: { "Content-Type": "application/json" } }
        )
      }
      
      // Regular error handling
      try {
        const resp = await chain.invoke({}, { callbacks: [dbCallback] })
        const content = String(resp?.content ?? "")
          // Manually set response text and trigger save for invoke fallback
          ; (dbCallback as any).responseText = content
        dbCallback.handleLLMEnd({ output: content })
        return new Response(
          JSON.stringify({ id: "fallback-response", role: "assistant", content }),
          { headers: { "Content-Type": "application/json" } }
        )
      } catch (invokeErr) {
        console.error("[ANSWERCTX] invoke also failed:", invokeErr)
        const errorResponse = "ขออภัย เกิดข้อผิดพลาดในการประมวลผล กรุณาลองใหม่อีกครั้งค่ะ"
        dbCallback.handleLLMEnd({ output: errorResponse })
        return new Response(
          JSON.stringify({ id: "error-response", role: "assistant", content: errorResponse }),
          { headers: { "Content-Type": "application/json" } }
        )
      }
    }
    //line --> invoke
  } else {
    try {
      const prompt = ChatPromptTemplate.fromMessages([
        ["system", LINE_SYSTEM_PROMPT + systemPromptSearched],
        ["human", "{messageinput}"],
      ])
      const chain = prompt.pipe(model)
      const resp = await chain.invoke({ messageinput: query }, { callbacks: [dbCallback] })
      const content = String(resp.content ?? "")
        // Manually set response text for non-streaming callback
        ; (dbCallback as any).responseText = content
      dbCallback.handleLLMEnd({ output: content })

      const shouldAppendRefs = useRag && !dbCallback.shouldHideCitations && boostedDocResults.length > 0
      if (!shouldAppendRefs) return content

      const { mostRelevant, maybeRelevant } = selectReferenceDocs(boostedDocResults)
      const referenceBlock = formatLineReferenceBlock(mostRelevant, maybeRelevant)
      if (!referenceBlock) return content

      const cleanedContent = content.trimEnd()
      return `${cleanedContent}\n\n${referenceBlock}`
    } catch (err) {
      console.error("[ANSWERCTX] LINE invoke error:", err)
      
      // Check if it's a Google API service unavailable error
      const isGoogleAPIError = (err as any)?.message?.includes('503 Service Unavailable') || 
                              (err as any)?.message?.includes('generativelanguage.googleapis.com')
      
      if (isGoogleAPIError) {
        console.log("[ANSWERCTX] Google API unavailable for LINE, returning fallback")
        return "ขออภัย ระบบประมวลผลข้อมูลชั่วคราวไม่พร้อมใช้งานในขณะนี้ กรุณาลองใหม่อีกครั้งในภายหลังค่ะ"
      }
      
      return "ขออภัย เกิดข้อผิดพลาดในการประมวลผล กรุณาลองใหม่อีกครั้งค่ะ"
    }
  }
}

// Export เป็น function สำหรับ LINE
export async function lineBotAnswer(userMessage: string, lineUserId: string) {
  return (await answerWithSearch(
    { userText: userMessage, stream: false },
    { lineUserId }
  )) as string
}

//answer ตอบกลับ POST web 
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const messages: UIMessage[] = body.messages

    // Get session ID from header or generate anonymous one
    const sessionId = req.headers.get("x-session-id") || `anonymous-${Date.now()}`

    return (await answerWithSearch(
      { messages, stream: true },
      { sessionId }
    )) as Response
  } catch (error) {
    console.error("chat error:", error)
    return NextResponse.json({ error: "Sorry, there's an error occurred!" }, { status: 500 })
  }
}
