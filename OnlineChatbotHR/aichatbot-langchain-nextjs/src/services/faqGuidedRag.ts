import { FAQMatch } from "./faqCandidate"
import { escapeTemplateBraces } from "@/lib/chatbot"

/**
 * =======FAQ-Guided RAG
 * - FAQ = ข้อมูลอ้างอิงหลัก (Immutable)
 * - RAG = เสริมข้อมูล
 * - LLM = เรียบเรียง (ผ่าน prompt ที่กำหนดไว้)
 */

/**
 * Guardrail: ตรวจสอบว่า RAG context มีความเกี่ยวข้องจริงหรือไม่
 */
function isContextRelevant(query: string, context: string): boolean {
  if (!context || context.length < 30) return false

  const segmenter = new Intl.Segmenter("th", { granularity: "word" })

  const tokens = [...segmenter.segment(query)]
    .filter(s => s.isWordLike && s.segment.trim().length >= 2)
    .map(s => s.segment.trim().toLowerCase())

  if (tokens.length === 0) {
    return context.toLowerCase().includes(query.toLowerCase())
  }

  const ctxLower = context.toLowerCase()

  let matchCount = 0
  tokens.forEach(token => {
    if (ctxLower.includes(token)) matchCount++
  })

  const requiredMatches = Math.max(1, Math.floor(tokens.length * 0.3))

  return matchCount >= requiredMatches
}

/**
 * Build prompt template ใช้ FAQ ตอบเป็น base answer + context จาก RAG
 */
export function buildFAQGuidedPrompt(
  faq: FAQMatch,
  ragContext: string,
  references: string,
  originalQuery: string
): string {
  return [
    "คุณคือ HR Chatbot ผู้เชี่ยวชาญด้านทรัพยากรบุคคล จากคณะเทคโนโลยีสารสนเทศ มหาวิทยาลัยเทคโนโลยีพระจอมเกล้าเจ้าคุณทหารลาดกระบัง",
    "",
    "==============================",
    "🔒 กฎหลัก (ห้ามละเมิด)",
    "==============================",
    "1. FAQ คือคำตอบหลัก (SOURCE OF TRUTH)",
    "2. ห้ามเปลี่ยนความหมายของ FAQ โดยเด็ดขาด",
    "3. ห้าม rewrite จนความหมายเปลี่ยน",
    "4. CONTEXT ใช้เพื่อ 'ขยาย' เท่านั้น",
    "5. ถ้า CONTEXT ขัดแย้ง → IGNORE ทันที",
    "",
    "==============================",
    "🧠 วิธีการตอบ",
    "==============================",
    "1. ใช้ FAQ เป็นแกนหลัก",
    "2. เพิ่มจาก CONTEXT เฉพาะที่ 'จำเป็นและเกี่ยวข้อง'",
    "3. ถ้า FAQ เพียงพอแล้ว → ไม่ต้องเพิ่ม",
    "4. ห้ามเพิ่มข้อมูลนอก FAQ + CONTEXT",
    "5. ตอบโดยตรง ห้ามใช้หัวข้อในคำตอบ",
    "6. ห้ามเพิ่มข้อมูลติดต่อ HR เมื่อ FAQ ตอบคำถามได้ครบถ้วนแล้ว",
    "",
    "==============================",
    escapeTemplateBraces(faq.Answer),
    "",
    "==============================",
    "📄 CONTEXT",
    "==============================",
    ragContext ? escapeTemplateBraces(ragContext) : "ไม่มีข้อมูลเพิ่มเติม",
    "",
    "==============================",
    "🔗 REFERENCES",
    "==============================",
    references ? escapeTemplateBraces(references) : "ไม่มี",
    "",
    "==============================",
    `❓ คำถามผู้ใช้: ${originalQuery ? escapeTemplateBraces(originalQuery) : ""}`,
    "==============================",
    "",
    "✍️ คำตอบ:"
  ].join("\n")
}

/**
 * ตัดสินใจว่าจะเสริมข้อมูล (Enrich) FAQ ด้วย RAG หรือไม่
 */
export function shouldEnrichFAQ(
  faq: FAQMatch,
  query: string,
  ragContext: string
): boolean {
  if (!ragContext || ragContext.includes("ไม่พบข้อความอ้างอิง")) {
    return false
  }

  //  Guardrail context ต้องเกี่ยวก่อน
  if (!isContextRelevant(query, ragContext)) {
    return false
  }

  const q = query.toLowerCase()

  // ❌ fact / short → ไม่ต้อง enrich
  const isFact =
    q.startsWith("ได้ไหม") ||
    q.startsWith("ต้อง") ||
    q.startsWith("มี") ||
    q.startsWith("ใช้") ||
    q.startsWith("เท่าไหร่") ||
    q.includes("กี่") ||
    q.includes("หรือไม่")

  if (isFact) return false

  // explanation → enrich แน่นอน
  const isExplain =
    q.includes("อะไร") ||
    q.includes("อย่างไร") ||
    q.includes("อธิบาย") ||
    q.includes("รายละเอียด") ||
    q.includes("เพราะอะไร") ||
    q.includes("ขั้นตอน") ||
    q.includes("วิธี") ||
    q.includes("ทำไง")

  if (isExplain) return true

  //  balance point (สำคัญมาก)
  if (faq.score < 0.85) return true

  // default: enrich เฉพาะ context ที่มี substance จริง
  return ragContext.length > 80
}

/**
 * key topics from FAQ
 */
export function extractFAQTopics(faqAnswer: string): string[] {
  const topics: string[] = []

  const topicPatterns = [
    { pattern: /การลา|วันลา|ลาป่วย|ลากิจ|ลาพักผ่อน/g, topic: "การลา" },
    { pattern: /เงินเดือน|ค่าจ้าง|โบนัส|ขึ้นเงิน|เงินเพิ่ม/g, topic: "เงินเดือนและค่าตอบแทน" },
    { pattern: /สวัสดิการ|ประกันสังคม|ประกันสุขภาพ|การรักษาพยาบาล/g, topic: "สวัสดิการ" },
    { pattern: /การพ้นสภาพ|ลาออก|สิ้นสุดสัญญา/g, topic: "การพ้นสภาพ" },
    { pattern: /การฝึกอบรม|อบรม|พัฒนา/g, topic: "การฝึกอบรม" },
    { pattern: /ตำแหน่ง|เลื่อนขั้น|โยกย้าย/g, topic: "ตำแหน่งและการเลื่อนขั้น" },
    { pattern: /ประเมิน|ผลงาน|KPI/g, topic: "การประเมินผลงาน" },
    { pattern: /กฎ|ระเบียบ|ข้อบังคับ|นโยบาย/g, topic: "กฎระเบียบและนโยบาย" }
  ]

  topicPatterns.forEach(({ pattern, topic }) => {
    if (pattern.test(faqAnswer)) {
      topics.push(topic)
    }
  })

  return topics
}