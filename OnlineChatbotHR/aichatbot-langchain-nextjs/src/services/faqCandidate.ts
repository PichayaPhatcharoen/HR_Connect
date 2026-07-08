import { prisma } from "@/lib/prisma"
import { ChatGoogleGenerativeAI } from "@langchain/google-genai"
import { ConversationChannel, Prisma } from "@prisma/client"
import crypto from "crypto"
import { embedQuery } from "@/lib/searchcontext"

/**
 * บริการกรองและรวบรวม FAQ Candidate
 * ทำหน้าที่คัดเลือกคำถามที่มีคุณภาพจากบทสนทนาเพื่อนำมาทำเป็น FAQ
 */

type FAQCandidateLabel = "faq" | "greeting" | "meta" | "irrelevant" | "unclear"

type FAQCandidateMetadata = {
  topScore?: number | null
  answerType?: "answered" | "partial" | "fallback"
}

type FAQCandidateAssessment = {
  shouldCollect: boolean
  label: FAQCandidateLabel
  normalizedQuestion?: string
}

type SharedQuestionIntent = {
  label: FAQCandidateLabel
  shouldSkipKnowledgeRetrieval: boolean
}

function createClassifierLLM() {
  return new ChatGoogleGenerativeAI({
    apiKey: process.env.LLM_API_KEY,
    model: process.env.LLM_MODEL,
    temperature: 0,
  })
}

async function classifyQuestionWithLLM(
  question: string,
  metadata?: FAQCandidateMetadata
): Promise<FAQCandidateLabel> {
  const model = createClassifierLLM()
  const prompt = [
    "จัดประเภทข้อความผู้ใช้เพื่อใช้ในระบบคัดเลือก FAQ candidate",
    "ตอบกลับเป็น JSON เท่านั้น เช่น {\"label\":\"faq\"}",
    "label ที่อนุญาตมี: faq, greeting, meta, irrelevant, unclear",
    "faq = คำถามที่เกี่ยวกับขอบเขตงานและนำไปใช้ซ้ำเป็น FAQ ได้",
    "greeting = คำทักทาย/ขอบคุณ/small talk ที่ไม่มีความต้องการข้อมูลเชิงสาระ",
    "meta = คำถามเกี่ยวกับตัวบอต ความสามารถ ข้อจำกัด หรือวิธีใช้บอต",
    "irrelevant = ไม่เกี่ยวกับโดเมนความรู้เป้าหมายหรือไม่เหมาะเป็น FAQ",
    "unclear = กำกวมเกินไป พึ่งบริบทมากเกินไป หรือยังไม่พร้อมเป็น FAQ",
    "ให้ตัดสินจากความหมาย ไม่ใช่แค่ regex หรือ keyword match",
    "พิจารณาร่วมกับ RAG score (topScore) และ answerType ที่ส่งมา",
    `คำถาม: ${JSON.stringify(question)}`,
    `RAG topScore: ${metadata?.topScore ?? "null"}`,
    `ประเภทคำตอบ (answerType): ${metadata?.answerType ?? "null"}`,
  ].join("\n")

  try {
    const resp = await model.invoke(prompt)
    const content = String(resp.content ?? "").trim()
    const match = content.match(/\{[\s\S]*\}/)
    if (!match) return "unclear"
    const parsed = JSON.parse(match[0]) as { label?: string }
    if (
      parsed.label === "faq" ||
      parsed.label === "greeting" ||
      parsed.label === "meta" ||
      parsed.label === "irrelevant" ||
      parsed.label === "unclear"
    ) {
      return parsed.label
    }
    return "unclear"
  } catch (err) {
    console.error("[FAQ] LLM classify failed:", err)
    return "unclear"
  }
}

async function canonicalizeFAQQuestion(
  question: string,
  metadata?: FAQCandidateMetadata
): Promise<string> {
  const model = createClassifierLLM()
  const prompt = [
    "เขียนคำถามผู้ใช้ใหม่ให้เป็นคำถาม FAQ กลาง (canonical question) เพียง 1 ข้อ",
    "ตอบกลับเป็น JSON เท่านั้น เช่น {\"canonicalQuestion\":\"...\"}",
    "ต้องคงเจตนาและความหมายเดิมของคำถาม",
    "รวมความต่างด้านถ้อยคำที่ผิวเผินให้เป็นคำถามเดียวที่ใช้ซ้ำได้",
    "ให้เป็นประโยคสั้น กระชับ อ่านแล้วใช้เป็นชื่อหัวข้อ FAQ ได้",
    "ตัดคำสุภาพและรูปประโยคเชิงขอร้องออก แต่คงความต้องการข้อมูลเดิม",
    "ห้ามตอบคำถาม",
    "ใช้ภาษาเดียวกับคำถามต้นฉบับ",
    `คำถาม: ${JSON.stringify(question)}`,
    `RAG topScore: ${metadata?.topScore ?? "null"}`,
    `ประเภทคำตอบ (answerType): ${metadata?.answerType ?? "null"}`,
  ].join("\n")

  try {
    const resp = await model.invoke(prompt)
    const content = String(resp.content ?? "").trim()
    const match = content.match(/\{[\s\S]*\}/)
    if (!match) return question.trim()
    const parsed = JSON.parse(match[0]) as { canonicalQuestion?: string }
    return parsed.canonicalQuestion?.trim() || question.trim()
  } catch (err) {
    console.error("[FAQ] Canonicalize failed:", err)
    return question.trim()
  }
}

/**
 * ตรวจสอบว่าเป็น FAQ Candidate ที่มีคุณภาพหรือไม่
 */
export async function assessFAQCandidate(
  question: string,
  metadata?: FAQCandidateMetadata
): Promise<FAQCandidateAssessment> {
  const q = question.trim()

  if (q.length < 5) return { shouldCollect: false, label: "unclear" }
  if (
    metadata?.answerType !== "fallback" &&
    metadata?.topScore !== undefined &&
    metadata.topScore !== null &&
    metadata.topScore < 0.15
  ) {
    return { shouldCollect: false, label: "irrelevant" }
  }

  let label: FAQCandidateLabel
  if (metadata?.answerType === "answered" && (metadata?.topScore ?? 0) >= 0.55) {
    label = "faq"
    // เก็บคำถามที่บอตหาคำตอบไม่ได้ (fallback) เพื่อให้ staff ตรวจสอบ
    label = "faq"
  } else {
    label = await classifyQuestionWithLLM(q, metadata)
  }

  return {
    shouldCollect: label === "faq",
    label,
    normalizedQuestion: label === "faq" ? normalizeQuestion(q) : undefined,
  }
}

export async function classifyQuestionIntent(
  question: string,
  metadata?: FAQCandidateMetadata
): Promise<SharedQuestionIntent> {
  const q = question.trim()
  if (!q) {
    return { label: "unclear", shouldSkipKnowledgeRetrieval: true }
  }

  if (q.length < 5) {
    return { label: "unclear", shouldSkipKnowledgeRetrieval: true }
  }

  if (metadata?.answerType === "fallback") {
    return { label: "irrelevant", shouldSkipKnowledgeRetrieval: true }
  }

  if (metadata?.answerType === "answered" && (metadata?.topScore ?? 0) >= 0.55) {
    return { label: "faq", shouldSkipKnowledgeRetrieval: false }
  }

  const label = await classifyQuestionWithLLM(q, metadata)
  return {
    label,
    shouldSkipKnowledgeRetrieval: label === "greeting" || label === "meta",
  }
}

/**
 * Normalize คำถามสำหรับ deduplication (ลบคำลงท้ายและจัดรูปแบบ)
 */
export function normalizeQuestion(question: string): string {
  let normalized = question.trim()

  // ลบคำลงท้าย (Politeness markers) ทั้งภาษาไทยและอังกฤษ
  const politenessMarkers = [
    /\s*(ครับ|ค่ะ|คะ|นะ|นะคะ|นะครับ|จ้า|จ๊า|หน่อย|หน่อยครับ|หน่อยค่ะ)\s*$/gi,
    /\s*(please|pls)\s*$/gi,
  ]

  politenessMarkers.forEach(pattern => {
    normalized = normalized.replace(pattern, "")
  })

  // ลบ spacing
  normalized = normalized.replace(/\s+/g, " ").trim()

  // แปลงเป็น lowercase
  normalized = normalized.toLowerCase()

  return normalized
}

export function generateQuestionHash(normalizedQuestion: string): string {
  return crypto.createHash("sha256").update(normalizedQuestion).digest("hex")
}

export function splitMultiQuestion(question: string): string[] {
  // แยกคำถามกรณีส่งมาหลายประโยค (ใช้เครื่องหมาย ? หรือคำว่า "และ")
  const parts = question
    .split(/[?？]/)
    .map(p => p.trim())
    .filter(p => p.length > 0)

  // If no question marks, check for "และ" pattern
  if (parts.length === 1) {
    const andParts = question
      .split(/\s+และ\s+/i)
      .map(p => p.trim())
      .filter(p => p.length > 5)

    if (andParts.length > 1) {
      return andParts
    }
  }

  // If we split into multiple parts, return them; otherwise return original
  return parts.length > 1 ? parts : [question]
}

/**
 * ตรวจสอบความซ้ำซ้อน: เช็คว่าคำถามตรงกับ FAQ Candidate ที่มีอยู่หรือไม่
 * เป็นการเช็คทั้งแบบ Original (คำถามจริง) และ Canonical (คำถามที่ปรับจูนแล้ว)
 */
async function findDuplicateFAQCandidate(
  originalQuestion: string,
  canonicalQuestion: string,
  threshold = 0.82
): Promise<{
  hasDuplicate: boolean
  candidateId?: string
  status?: string
  matchedField?: string
  score?: number
}> {
  try {
    // ดึงข้อมูล Candidate ทั้งหมดจากทุก Tab (Pending, Ignored, Rejected)
    const [pending, ignored, rejected] = await Promise.all([
      prisma.fAQCandidates.findMany({
        where: { Status: "PENDING" },
        select: {
          FAQCandidateId: true,
          OriginalQuestion: true,
          Title: true,
          NormalizedQuestion: true,
          Status: true,
        },
      }),
      prisma.fAQCandidates.findMany({
        where: { Status: "IGNORED" },
        select: {
          FAQCandidateId: true,
          OriginalQuestion: true,
          Title: true,
          NormalizedQuestion: true,
          Status: true,
        },
      }),
      prisma.fAQCandidates.findMany({
        where: { Status: "REJECTED" },
        select: {
          FAQCandidateId: true,
          OriginalQuestion: true,
          Title: true,
          NormalizedQuestion: true,
          Status: true,
        },
      }),
    ])

    const allCandidates = [...pending, ...ignored, ...rejected]
    const normalizedOriginal = normalizeQuestion(originalQuestion)
    const normalizedCanonical = normalizeQuestion(canonicalQuestion)

    console.log(`[FAQ-DEDUP] Checking ${allCandidates.length} candidates (${pending.length} P, ${ignored.length} I, ${rejected.length} R)`)
    console.log(`[FAQ-DEDUP] Input: "${originalQuestion.slice(0, 40)}..." / "${canonicalQuestion.slice(0, 40)}..."`)

    // วนลูปเช็คเทียบกับทุกลูก (Title, Original, Normalized)
    for (const candidate of allCandidates) {
      // 1. เช็ค OriginalQuestion (ตรงกับ input จริงของผู้ใช้)
      if (candidate.OriginalQuestion) {
        const score = scoreFAQMatch(normalizedOriginal, candidate.OriginalQuestion)
        if (score >= 0.5) { // log คะแนนที่เกิน 0.5 สำหรับ debug
          console.log(`[FAQ-DEDUP] [${candidate.Status}] ${candidate.OriginalQuestion.slice(0, 30)}... score=${score.toFixed(2)}`)
        }
        if (score >= threshold) {
          console.log(`[FAQ-DEDUP] MATCH โดย OriginalQuestion (score ${score.toFixed(2)})`)
          return {
            hasDuplicate: true,
            candidateId: candidate.FAQCandidateId,
            status: candidate.Status,
            matchedField: "OriginalQuestion",
            score,
          }
        }
      }

      // 2. เช็ค Title (หัวข้อ FAQ)
      const title = (candidate as any).Title
      if (title) {
        const score = scoreFAQMatch(normalizedCanonical, title)
        if (score >= threshold) {
          console.log(`[FAQ-DEDUP] MATCH โดย Title (score ${score.toFixed(2)})`)
          return {            hasDuplicate: true,
            candidateId: candidate.FAQCandidateId,
            status: candidate.Status,
            matchedField: "Title",
            score,
          }
        }
      }

      // 3. เช็ค NormalizedQuestion
      if (candidate.NormalizedQuestion) {
        const score = scoreFAQMatch(normalizedCanonical, candidate.NormalizedQuestion)
        if (score >= threshold) {
          console.log(`[FAQ-DEDUP] MATCH โดย NormalizedQuestion (score ${score.toFixed(2)})`)
          return {
            hasDuplicate: true,
            candidateId: candidate.FAQCandidateId,
            status: candidate.Status,
            matchedField: "NormalizedQuestion",
            score,
          }
        }
      }
    }

    console.log(`[FAQ-DEDUP] ✗ No match found`)
    return { hasDuplicate: false }
  } catch (err) {
    console.error("[FAQ-DEDUP] Error checking for duplicates:", err)
    return { hasDuplicate: false }
  }
}

/**
 * เช็คว่าคำถามใกล้เคียงกับ INACTIVE FAQ หรือไม่ (พวกที่ถูก Reject หรือปิดใช้งาน)
 */
async function checkSimilarInactiveFAQs(
  question: string
): Promise<{ hasSimilar: boolean; similarFAQId?: string; similarQuestion?: string }> {
  try {
    // เช็คกับ FAQ ที่ตั้งค่า IsActive = false
    const inactiveFAQs = await prisma.fAQs.findMany({
      where: { IsActive: false },
      select: { FAQId: true, Question: true },
    })

    const normalizedQuery = normalizeQuestion(question)

    for (const faq of inactiveFAQs) {
      const score = scoreFAQMatch(normalizedQuery, faq.Question)
      if (score >= 0.82) {
        console.log(`[FAQ] Found similar INACTIVE FAQ (score ${score.toFixed(2)}): ${faq.Question.slice(0, 50)}`)
        return { hasSimilar: true, similarFAQId: faq.FAQId, similarQuestion: faq.Question }
      }
    }

    return { hasSimilar: false }
  } catch (err) {
    console.error("[FAQ] Error checking inactive FAQs:", err)
    return { hasSimilar: false }
  }
}

/**
 * เช็คว่าคำถามใกล้เคียงกับ APPROVED FAQ ที่เปิดใช้งานอยู่หรือไม่
 */
async function checkSimilarExistingFAQs(
  question: string
): Promise<{ hasSimilar: boolean; similarFAQId?: string }> {
  try {
    const faqs = await prisma.fAQs.findMany({
      where: { IsActive: true },
      select: { FAQId: true, Question: true },
    })

    const normalizedQuery = normalizeQuestion(question)

    for (const faq of faqs) {
      const score = scoreFAQMatch(normalizedQuery, faq.Question)
      if (score >= 0.85) {
        console.log(`[FAQ] Found similar approved FAQ (score ${score.toFixed(2)}): ${faq.Question.slice(0, 50)}`)
        return { hasSimilar: true, similarFAQId: faq.FAQId }
      }
    }

    return { hasSimilar: false }
  } catch (err) {
    console.error("[FAQ] Error checking existing FAQs:", err)
    return { hasSimilar: false }
  }
}

export async function saveFAQCandidate(params: {
  question: string
  answer: string
  channel: ConversationChannel
  metadata?: FAQCandidateMetadata
}): Promise<void> {
  try {
    // Split multi-part questions FIRST
    const questions = splitMultiQuestion(params.question)

    for (const q of questions) {
      const trimmedOriginal = q.trim()

      // 1. เช็คว่ามีอยู่ใน FAQ ที่อนุมัติแล้วหรือไม่
      const approvedCheck = await checkSimilarExistingFAQs(trimmedOriginal)
      if (approvedCheck.hasSimilar && approvedCheck.similarFAQId) {
        console.log("[FAQ] พบ FAQ ที่อนุมัติแล้วซึ่งมีความใกล้เคียง, กำลังเพิ่ม Usage count")
        await prisma.fAQs.update({
          where: { FAQId: approvedCheck.similarFAQId },
          data: { UsageCount: { increment: 1 } },
        })
        continue
      }

      // 2. เช็คว่าตรงกับ INACTIVE FAQ หรือไม่
      // ทำตรงนี้เพื่อป้องกันการสร้าง Candidate ซ้ำถ้ามีอยู่เดิมในระบบแล้ว
      const inactiveCheck = await checkSimilarInactiveFAQs(trimmedOriginal)
      if (inactiveCheck.hasSimilar && inactiveCheck.similarFAQId) {
        console.log(`[FAQ] พบ INACTIVE FAQ (เคยถูกปฏิเสธมาก่อน): ${inactiveCheck.similarQuestion?.slice(0, 50)}`)
        await prisma.fAQs.update({
          where: { FAQId: inactiveCheck.similarFAQId },
          data: { UsageCount: { increment: 1 } },
        })
        continue
      }

      // 3. Fast Duplicate Check: เช็คความซ้ำแบบเร็ว (ก่อน LLM eval)
      // เพื่อให้ IGNORED และ REJECTED candidate เพิ่ม AskCount ได้แม้ LLM จะคัดออก
      const fastDuplicateCheck = await findDuplicateFAQCandidate(trimmedOriginal, trimmedOriginal, 0.82)
      if (fastDuplicateCheck.hasDuplicate && fastDuplicateCheck.candidateId) {
        console.log(`[FAQ] พบความซ้ำซ้อนผ่าน FAST check (${fastDuplicateCheck.matchedField}): ${trimmedOriginal.slice(0, 50)}`)
        const currentStatus = fastDuplicateCheck.status
        const shouldResetToPending = currentStatus === "IGNORED"

        await prisma.fAQCandidates.update({
          where: { FAQCandidateId: fastDuplicateCheck.candidateId },
          data: {
            AskCount: { increment: 1 },
            LastAskedAt: new Date(),
            // IGNORED จะกลับไป PENDING แต่ REJECTED จะยังคงเดิม
            Status: shouldResetToPending ? "PENDING" : undefined,
          },
        } as any)
        console.log(`[FAQ] รวมเข้ากับ candidate เดิม (${currentStatus}): ${fastDuplicateCheck.candidateId}`)
        continue
      }

      // 4. LLM Assessment: ประเมินผ่าน LLM (เฉพาะคำถามใหม่แกะกล่อง)
      const assessment = await assessFAQCandidate(trimmedOriginal, params.metadata)
      if (!assessment.shouldCollect) {
        console.log("[FAQ] คำถามถูกคัดออกโดยตัวกรอง:", {
          label: assessment.label,
          question: trimmedOriginal.slice(0, 50),
        })
        continue
      }

      // 5. Canonicalize: ปรับจูนคำถามให้เป็นภาษากลาง
      const canonicalQuestion = await canonicalizeFAQQuestion(trimmedOriginal, params.metadata)
      const normalized = normalizeQuestion(canonicalQuestion)

      // 6. Deep Duplicate Check: เช็คซ้ำเชิงลึกด้วย Canonical question
      const deepDuplicateCheck = await findDuplicateFAQCandidate(trimmedOriginal, canonicalQuestion, 0.82)
      if (deepDuplicateCheck.hasDuplicate && deepDuplicateCheck.candidateId) {
        console.log(`[FAQ] พบความซ้ำซ้อนผ่าน DEEP check (${deepDuplicateCheck.matchedField}): ${trimmedOriginal.slice(0, 50)}`)
        const currentStatus = deepDuplicateCheck.status
        const shouldResetToPending = currentStatus === "IGNORED"

        await prisma.fAQCandidates.update({
          where: { FAQCandidateId: deepDuplicateCheck.candidateId },
          data: {
            AskCount: { increment: 1 },
            LastAskedAt: new Date(),
            Status: shouldResetToPending ? "PENDING" : undefined,
            // Update title if new user origin question is more descriptive
            Title: trimmedOriginal.length > (canonicalQuestion?.length || 0) ? trimmedOriginal : undefined,
          },
        } as any)
        console.log(`[FAQ] Merged with existing candidate (${currentStatus}): ${deepDuplicateCheck.candidateId}`)
        continue
      }

      // 7. Check by hash (final fallback for deduplication)
      const hash = generateQuestionHash(normalized)
      const existingByHash = await prisma.fAQCandidates.findUnique({
        where: { QuestionHash: hash },
      })

      if (existingByHash) {
        const existingAny = existingByHash as any
        await prisma.fAQCandidates.update({
          where: { QuestionHash: hash },
          data: {
            AskCount: { increment: 1 },
            LastAskedAt: new Date(),
            Title: existingAny.Title || canonicalQuestion,
          },
        } as any)
        console.log("[FAQ] Incremented count by hash match:", normalized.slice(0, 50))
        continue
      }

      // 8. Create candidate ใหม่
      try {
        await prisma.fAQCandidates.create({
          data: {
            Title: canonicalQuestion,
            OriginalQuestion: trimmedOriginal,
            NormalizedQuestion: normalized,
            BotAnswer: params.answer,
            QuestionHash: hash,
            TopScore: params.metadata?.topScore ?? null,
            AnswerType: params.metadata?.answerType ?? null,
            Channel: params.channel,
            Status: "PENDING",
          } as any,
        })
        console.log("[FAQ] New candidate saved:", normalized.slice(0, 50))
      } catch (createErr: any) {
        const message = String(createErr?.message || "")
        if (message.includes("Unknown arg `Title`") || message.includes("Unknown argument `Title`")) {
          await prisma.fAQCandidates.create({
            data: {
              OriginalQuestion: trimmedOriginal,
              NormalizedQuestion: normalized,
              BotAnswer: params.answer,
              QuestionHash: hash,
              TopScore: params.metadata?.topScore ?? null,
              AnswerType: params.metadata?.answerType ?? null,
              Channel: params.channel,
              Status: "PENDING",
            },
          })
          console.log("[FAQ] New candidate saved (no Title):", normalized.slice(0, 50))
        } else {
          throw createErr
        }
      }
    }
  } catch (err) {
    console.error("[FAQ] Failed to save candidate:", err)
  }
}

export type FAQMatch = {
  FAQId: string
  Question: string
  Answer: string
  UsageCount: number
  score: number
}

function tokenizeForOverlap(text: string): string[] {
  const normalized = normalizeQuestion(text)

  //ใช้การตัดคำภาษาไทย
  const segmenter = new Intl.Segmenter('th', { granularity: 'word' })
  const segments = [...segmenter.segment(normalized)]

  return segments
    .filter(s => s.isWordLike && s.segment.trim().length > 0)
    .map(s => s.segment.trim())
    .filter(token => token.length >= 2)
}

//FAQ ถ้า query และ faq question เหมือนกันหรือ query เป็น substring ของคำถามใน FAQ
function scoreFAQMatch(query: string, faqQuestion: string): number {
  const normalizedQuery = normalizeQuestion(query)
  const normalizedFAQ = normalizeQuestion(faqQuestion)

  if (normalizedQuery === normalizedFAQ) return 1
  if (normalizedFAQ.includes(normalizedQuery) || normalizedQuery.includes(normalizedFAQ)) return 0.9

  const qTokens = tokenizeForOverlap(normalizedQuery)
  const faqTokens = new Set(tokenizeForOverlap(normalizedFAQ))
  if (qTokens.length === 0 || faqTokens.size === 0) return 0

  const overlap = qTokens.filter(token => faqTokens.has(token)).length
  const coverage = overlap / Math.max(qTokens.length, 1)
  const faqCoverage = overlap / Math.max(faqTokens.size, 1)

  //Boost score สำหรับกรณีที่คำถามคล้ายกันมาก (overlap เยอะ) ( "วิธีตรวจสอบวันลาคงเหลือ" vs "วิธีตรวจสอบสิทธิวันลาคงเหลือ")
  const baseScore = Math.max(coverage * 0.75 + faqCoverage * 0.25, 0)

  //ถ้า overlap เยอะและ faq question ยาวกว่า query
  if (coverage >= 0.7 && faqTokens.size > qTokens.length) {
    return Math.min(baseScore + 0.15, 0.95) // Boost but cap at 0.95
  }

  //Missing word boost - if query is subset of FAQ tokens
  const isSubset = qTokens.every(token => faqTokens.has(token))
  if (isSubset && qTokens.length >= 3) {
    return Math.min(baseScore + 0.10, 0.90) // Boost for missing words case
  }

  return baseScore
}

/** Search FAQs using token overlap (legacy method) */
export async function searchFAQsByToken(query: string, limit = 3): Promise<FAQMatch[]> {
  const faqs = await prisma.fAQs.findMany({
    where: { IsActive: true },
    select: {
      FAQId: true,
      Question: true,
      Answer: true,
      UsageCount: true,
    },
  })

  return faqs
    .map(faq => ({
      ...faq,
      score: scoreFAQMatch(query, faq.Question),
    }))
    .filter(faq => faq.score >= 0.55)
    .sort((a, b) => b.score - a.score || b.UsageCount - a.UsageCount)
    .slice(0, limit)
}

/** Search FAQs using semantic embedding (pgvector) */
export async function searchFAQsByEmbedding(query: string, limit = 3): Promise<FAQMatch[]> {
  try {
    const queryVec = await embedQuery(query)
    const vecLiteral = `[${queryVec.join(",")}]`

    const results = await prisma.$queryRaw<Array<{
      faq_id: string
      question: string
      answer: string
      usage_count: number
      distance: number
    }>>(Prisma.sql`
      SELECT 
        "FAQId" as faq_id,
        "Question" as question,
        "Answer" as answer,
        "UsageCount" as usage_count,
        ("QuestionEmbedding" <=> ${Prisma.sql`${vecLiteral}::vector`}) as distance
      FROM faqs
      WHERE "IsActive" = true
        AND "QuestionEmbedding" IS NOT NULL
      ORDER BY distance ASC
      LIMIT ${Prisma.raw(String(limit * 2))}
    `)

    return results
      .map(r => ({
        FAQId: r.faq_id,
        Question: r.question,
        Answer: r.answer,
        UsageCount: r.usage_count,
        score: Math.max(0, 1 - r.distance), // Convert distance to similarity
      }))
      .filter(faq => faq.score >= 0.6) // Semantic threshold
      .sort((a, b) => b.score - a.score || b.UsageCount - a.UsageCount)
      .slice(0, limit)
  } catch (err) {
    console.error("[FAQ] Embedding search failed:", err)
    return []
  }
}

/** Hybrid search: Use token if high confidence, otherwise semantic */
export async function searchApprovedFAQs(query: string, limit = 3): Promise<FAQMatch[]> {
  // Run both searches in parallel
  const [tokenResults, semanticResults] = await Promise.all([
    searchFAQsByToken(query, limit),
    searchFAQsByEmbedding(query, limit),
  ])

  // If token search has high confidence (>= 0.8), use it
  const topTokenScore = tokenResults[0]?.score ?? 0
  if (topTokenScore >= 0.8) {
    console.log("[FAQ] Using token search (high confidence):", topTokenScore)
    return tokenResults
  }

  // If semantic search has good results (>= 0.65), use it
  const topSemanticScore = semanticResults[0]?.score ?? 0
  if (topSemanticScore >= 0.65) {
    console.log("[FAQ] Using semantic search:", topSemanticScore)
    return semanticResults
  }

  // Fallback: merge and deduplicate by FAQId, prefer higher score
  const merged = new Map<string, FAQMatch>()
  for (const faq of [...tokenResults, ...semanticResults]) {
    const existing = merged.get(faq.FAQId)
    if (!existing || faq.score > existing.score) {
      merged.set(faq.FAQId, faq)
    }
  }

  const combined = Array.from(merged.values())
    .sort((a, b) => b.score - a.score || b.UsageCount - a.UsageCount)
    .slice(0, limit)

  console.log("[FAQ] Using hybrid (merged):", combined.length, "results")
  return combined
}

export async function incrementFAQUsage(faqId: string): Promise<void> {
  try {
    await prisma.fAQs.update({
      where: { FAQId: faqId },
      data: {
        UsageCount: { increment: 1 },
      },
    })
  } catch (err) {
    console.error("[FAQ] Failed to increment FAQ usage:", err)
  }
}

/** คำนวณความมั่นใจ (Confidence) ของ FAQ จากค่า gap และลักษณะของคำถาม */
export function getFAQConfidence(faqResults: FAQMatch[], query: string): number {
  const top = faqResults[0]
  const second = faqResults[1]

  if (!top) return 0

  const gap = top.score - (second?.score ?? 0)
  const isShortQuery = query.trim().length < 12

  let confidence = top.score

  // ถ้า gap สูง → มั่นใจมากขึ้น
  if (gap > 0.1) confidence += 0.05
  if (gap > 0.15) confidence += 0.03

  // ถ้าคำถามสั้น → ต้องระวังเป็นพิเศษ (strict ขึ้น)
  if (isShortQuery) confidence *= 0.97

  // ปรับจูนคะแนนเพิ่มเติมสำหรับกรณีคะแนนความคล้ายไม่สูงมาก
  if (top.score < 0.75) confidence *= 0.98

  return Math.max(0, Math.min(1, confidence))
}
