import { prisma } from "@/lib/prisma"
import { MessageRole, ConversationChannel, ConversationType, ConversationStatus } from "@prisma/client"

/**
 * บันทึกประวัติการแชท (คำถามผู้ใช้ + คำตอบบอต) ลงฐานข้อมูล
 * ทำงานแบบเบื้องหลัง (Fire-and-forget) เพื่อไม่ให้ขัดขวางการตอบกลับผู้ใช้
 */
export type ChatTurnMetadata = {
  ragUsed?: boolean
  topScore?: number | null
  suggestedContactOnly?: boolean
  answerType?: "answered" | "partial" | "fallback"
  fallbackReason?: "no_docs" | "low_conf" | "policy_restricted" | "handoff" | "unknown"
  retrievalSnapshot?: Array<{ id: number; title: string; score: number }>
  citationsShown?: boolean
}

export async function saveChatTurn(params: {
  sessionId?: string
  lineUserId?: string
  userMessage: string
  botMessage: string
  sources?: any[]
  metadata?: ChatTurnMetadata
  responseTimeSeconds?: number
}) {
  try {
    // ค้นหาหรือสร้าง Conversation ใหม่
    let conversation = await prisma.conversations.findFirst({
      where: params.lineUserId
        ? { 
            LineUserId: params.lineUserId, 
            Type: ConversationType.BOT, 
            Channel: ConversationChannel.LINE, 
            Status: ConversationStatus.OPEN 
          }
        : { 
            SessionId: params.sessionId ?? undefined, 
            Type: ConversationType.BOT, 
            Channel: ConversationChannel.WEB, 
            Status: ConversationStatus.OPEN 
          },
      orderBy: { UpdatedAt: 'desc' }
    })

    // สร้าง Conversation ใหม่หากไม่พบอันที่เปิดอยู่
    if (!conversation) {
      conversation = await prisma.conversations.create({
        data: {
          LineUserId: params.lineUserId,
          SessionId: params.sessionId,
          Type: ConversationType.BOT,
          Status: ConversationStatus.OPEN,
          Channel: params.lineUserId ? ConversationChannel.LINE : ConversationChannel.WEB,
        },
      })
    }

    // บันทึกข้อความของผู้ใช้
    await prisma.messages.create({
      data: {
        ConversationId: conversation.ConversationId,
        Role: MessageRole.user,
        Content: params.userMessage,
      },
    })

    // บันทึกคำตอบของบอทพร้อมข้อมูลอ้างอิงและ RAG metadata
    await prisma.messages.create({
      data: {
        ConversationId: conversation.ConversationId,
        Role: MessageRole.assistant,
        Content: params.botMessage,
        Sources: params.sources && params.sources.length > 0 ? params.sources : undefined,
        Metadata: params.metadata ? (params.metadata as object) : undefined,
        ResponseTimeSeconds: params.responseTimeSeconds ?? undefined,
      },
    })

    // อัปเดตเวลาการใช้งานล่าสุดของบทสนทนา
    await prisma.conversations.update({
      where: { ConversationId: conversation.ConversationId },
      data: { UpdatedAt: new Date() }
    })
  } catch (err) {
    console.error("Failed to save chat history:", err)
    // ไม่ throw error เพื่อไม่ให้ระบบหยุดทำงานหากการบันทึกประวัติล้มเหลว
  }
}

/**
 * ดึงประวัติการสนทนา (Context) สำหรับนำไปใช้ใน Prompt ในอนาคต
 */
export async function getChatContext(
  id: string,
  platform: "web" | "line",
  limit = 6
) {
  try {
    const where =
      platform === "line"
        ? { LineUserId: id, Type: ConversationType.BOT, Channel: ConversationChannel.LINE }
        : { SessionId: id, Type: ConversationType.BOT, Channel: ConversationChannel.WEB }

    const conversation = await prisma.conversations.findFirst({
      where,
      include: {
        Messages: {
          orderBy: { CreatedAt: "asc" },
          take: limit,
        },
      },
    })

    if (!conversation || conversation.Messages.length === 0) return []

    // แปลงรูปแบบเพื่อให้รองรับ LangChain หรือ Prompt template
    return conversation.Messages.map((m) =>
      m.Role === MessageRole.user ? ["human", m.Content] : ["assistant", m.Content]
    )
  } catch (err) {
    console.error("Failed to get chat context:", err)
    return []
  }
}





