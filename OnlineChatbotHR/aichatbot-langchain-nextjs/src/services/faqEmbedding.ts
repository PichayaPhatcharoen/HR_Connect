import { prisma } from "@/lib/prisma"
import { embedQuery } from "@/lib/searchcontext"

/**
 * สร้างและบันทึก Embedding สำหรับคำถาม FAQ
 * เรียกใช้ทุกครั้งเมื่อมีการสร้างหรืออัปเดต FAQ
 */
export async function embedFAQQuestion(faqId: string, question: string): Promise<void> {
  try {
    const vector = await embedQuery(question)
    const vecLiteral = `[${vector.join(",")}]`

    await prisma.$executeRaw`
      UPDATE faqs
      SET "QuestionEmbedding" = ${vecLiteral}::vector
      WHERE "FAQId" = ${faqId}
    `

    console.log(`[FAQ] Embedded question for FAQ ${faqId}`)
  } catch (err) {
    console.error(`[FAQ] Failed to embed question for FAQ ${faqId}:`, err)
    // ไม่ throw error เนื่องจาก embedding เป็นส่วนเสริมที่ไม่ได้กระทบการทำงานหลัก
  }
}

/**
 * ทำ Batch embed สำหรับหลาย FAQs
 */
export async function embedFAQsBatch(faqs: Array<{ faqId: string; question: string }>): Promise<void> {
  console.log(`[FAQ] Batch embedding ${faqs.length} FAQs...`)
  
  for (const { faqId, question } of faqs) {
    await embedFAQQuestion(faqId, question)
    // สำหรับ Rate limiting
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  
  console.log(`[FAQ] Batch embedding completed`)
}
