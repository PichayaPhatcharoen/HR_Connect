import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { ConversationChannel, ConversationType, ConversationStatus } from "@prisma/client"

export const runtime = "nodejs"

// ตรวจสอบว่าคำตอบมีข้อมูลติดต่อที่ชัดเจนหรือไม่ (เบอร์โทร, อีเมล, ลิงก์)
function hasConcreteAnswer(content: string): boolean {
  const hasPhone = /\d{2,3}[-\s]?\d{3,4}([-\s]?(ต่อ|ext\.?)\s*\d+)?/.test(content) || /ต่อ\s*\d+/.test(content)
  const hasEmail = /hr@kmitl/i.test(content) || /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(content)
  if (hasPhone || hasEmail) return true
  const facultyLineOnly = (content.includes("@143thesr") || content.includes("lin.ee/fLfASfSp")) &&
    !hasPhone && !hasEmail
  const hasOtherContact = /@[\w.-]+/.test(content) || /https?:\/\//i.test(content) || /lin\.ee\//i.test(content)
  return hasOtherContact && !facultyLineOnly
}

// โครงสร้าง Metadata สำหรับแต่ละ Message
type MessageMetadata = {
  ragUsed?: boolean
  topScore?: number | null
  suggestedContactOnly?: boolean
  answerType?: "answered" | "partial" | "fallback"
  fallbackReason?: "no_docs" | "low_conf" | "policy_restricted" | "handoff" | "unknown"
  retrievalSnapshot?: Array<{ id: number; title: string; score: number }>
  citationsShown?: boolean
  documentAdded?: boolean
  qaAdded?: boolean
  dataComplete?: boolean
} | null

/** แท็กระบุเหตุผลสำหรับคำถามที่ตอบไม่ได้ */
type UnanswerableReason = "suggested_contact" | "no_document" | "no_data" | "low_score" | "prompt_fix_candidate" | "unknown"

// ตรวจสอบว่าคำตอบแจ้งว่าไม่พบข้อมูลหรือไม่
function isNoDataAnswer(content: string): boolean {
  const text = content.toLowerCase()
  const keywords = [
    "ไม่พบข้อมูล",
    "ไม่มีข้อมูล",
    "ไม่มีรายละเอียด",
    "ไม่พบเอกสาร",
    "no data",
    "no document",
  ]
  return keywords.some(keyword => text.includes(keyword))
}

// ตรวจสอบว่าเป็นเพียงข้อความแนะนำข้อมูลติดต่ออย่างเดียวหรือไม่
function isPureContact(content: string): boolean {
  if (!content.trim()) return false
  if (isNoDataAnswer(content)) return false

  const contactHints = /ติดต่อ|สอบถาม|line|ไลน์|โทร|เบอร์|contact|email|อีเมล|hr/i
  if (!contactHints.test(content)) return false

  const contactLinePattern = /(ติดต่อ|สอบถาม|line|ไลน์|โทร|เบอร์|contact|email|อีเมล|hr).*/i
  const remaining = content
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .filter(line => !contactLinePattern.test(line))
    .join(" ")
    .trim()

  return remaining.length === 0 || remaining.length < 60
}

// วิเคราะห์เหตุผลที่ตอบไม่ได้ โดยพิจารณาจากเนื้อหาและ Metadata
function getUnanswerableReason(content: string, metadata: unknown): UnanswerableReason {
  const meta = metadata as MessageMetadata
  const topScore = typeof meta?.topScore === "number" ? meta.topScore : null
  const noData = isNoDataAnswer(content)

  // กรณีแจ้งว่าไม่พบข้อมูล/ไม่พบเอกสาร
  if (noData) return "no_document"
  // กรณีแนะนำให้ติดต่อเจ้าหน้าที่เพียงอย่างเดียว
  if (isPureContact(content)) return "suggested_contact"
  // กรณีมีข้อมูลแต่คะแนนความเกี่ยวข้องต่ำมาก
  if (!noData && topScore !== null && topScore < 0.4) return "low_score"
  //fallback ให้ไปติดต่อเจ้าหน้าที่ วัดที่ score RAG ว่าดีหรือไม่ ถ้าดี = Prompt อาจจะผิด ถ้าไม่ดี = แนะนำติดต่อเจ้าหน้าที่โดยตรง
  if (meta && typeof meta === "object") {
    if (meta.fallbackReason === "handoff") {
      const ragGood = meta.ragUsed === true && topScore !== null && topScore >= 0.7
      return ragGood ? "prompt_fix_candidate" : "suggested_contact"
    }
    if (meta.fallbackReason === "no_docs") return "no_document"
    if (meta.fallbackReason === "low_conf") return "low_score"
    if (meta.suggestedContactOnly === true) return "suggested_contact"
    if (meta.ragUsed === false) return "no_document"
  }

  if (/ไม่พบเอกสาร|ไม่มีฟอร์ม/i.test(content)) return "no_document"
  if (/ไม่มี(ข้อมูล|รายละเอียด|ข้อมูลที่ต้องการ)|ไม่ได้ระบุ|ขออภัย.*ไม่มี/i.test(content)) return "no_data"

  return "unknown"
}

//สำหรับเช็คว่าควรเพิ่มไปที่ unanswerable review ไหม (ถ้าเป็นจริง = เพิ่ม)
function isUnanswerable(content: string, metadata: unknown): boolean {
  const meta = metadata as MessageMetadata

  //กำหนดเช็ค pattern ขอโทษ + แนะนำให้ติดต่อเจ้าหน้าที่โดยตรง
  const hasUnanswerablePattern = () => {
    const hasApology = /(ขออภัย|ขอโทษ|เสียใจ).{0,100}(ไม่พบ|ไม่มี|ไม่สามารถ)/i.test(content)
    const hasContactSuggest = /@143thesr|lin\.ee\/fLfASfSp/i.test(content)
    return hasApology && hasContactSuggest
  }

  if (meta && typeof meta === "object") {
    // เช็ค metadata ว่า answerType เป็น answered หรือ fallback
    if (meta.answerType === "answered") return false
    if (meta.answerType === "fallback") {
      //ยืนยันว่าเป็น pattern ขอโทษ + แนะนำให้ติดต่อเจ้าหน้าที่โดยตรง
      return hasUnanswerablePattern()
    }
    // ถ้า answerType เป็น partial (low confidence) เช็คว่าเป็น pattern ขอโทษ + แนะนำให้ติดต่อเจ้าหน้าที่โดยตรง
    if (meta.answerType === "partial") {
      return hasUnanswerablePattern()
    }
    //ถ้าข้อมูลไม่มี answerType เช็ควิธีอื่น
    const ragGood = meta.ragUsed === true && typeof meta.topScore === "number" && meta.topScore >= 0.5
    if (ragGood && meta.suggestedContactOnly !== true) return false //หาเจอ ไม่ได้แนะนำติดต่อเจ้าหน้าที่ -> false
    if (meta.suggestedContactOnly === true) return hasUnanswerablePattern() //แนะนำติดต่อเจ้าหน้าที่ -> ส่งไปเช็ค content
    if (meta.ragUsed === false) return hasUnanswerablePattern() //ไม่ได้หาเอกสาร -> ส่งไปเช็ค content
  }

  //  ถ้าไม่มี metadata -> ถ้าข้อความมี pattern ขอโทษ + แนะนำติดต่อ = ตอบไม่ได้
  if (hasUnanswerablePattern()) return true
  if (hasConcreteAnswer(content)) return false
  return true
}

/**
 * GET: ดึงประวัติการแชทพร้อมตัวกรองและการทำ Pagination
 * ตัวแปร Query:
 * - channel: 'WEB' | 'LINE' | 'ALL'
 * - status: 'OPEN' | 'CLOSED' | 'ALL'
 * - page: ลำดับหน้า (default: 1)
 * - limit: จำนวนรายการต่อหน้า (default: 20)
 * - search: คำค้นหาในข้อความ
 * - startDate, endDate: ช่วงเวลา ISO
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const channel = searchParams.get("channel") || "ALL"
    const status = searchParams.get("status") || "ALL"
    const page = parseInt(searchParams.get("page") || "1")
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100)
    const search = searchParams.get("search") || ""
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const sortOrder = searchParams.get("sort") === "asc" ? "asc" : "desc"

    const skip = (page - 1) * limit

    const where: any = {
      Type: ConversationType.BOT,
    }
    if (channel !== "ALL") {
      where.Channel = channel as ConversationChannel
    }
    if (status !== "ALL") {
      where.Status = status as ConversationStatus
    }

    if (startDate || endDate) {
      where.CreatedAt = {}
      if (startDate) {
        where.CreatedAt.gte = new Date(startDate)
      }
      if (endDate) {
        where.CreatedAt.lte = new Date(endDate)
      }
    }

    // สำหรับ searching bar
    if (search) {
      where.Messages = {
        some: {
          Content: {
            contains: search,
          },
        },
      }
    }

    // ดึงข้อมูลการสนทนาตามเงื่อนไขที่ระบุ
    const [conversations, total] = await Promise.all([
      prisma.conversations.findMany({
        where,
        include: {
          Messages: {
            orderBy: { CreatedAt: "asc" },
          },
          LineFriend: {
            select: {
              DisplayName: true,
              LineUserId: true,
            },
          },
        },
        orderBy: { UpdatedAt: sortOrder },
        skip,
        take: limit,
      }),
      prisma.conversations.count({ where }),
    ])

    // เตรียมข้อมูลเพื่อส่งกลับไปยัง Frontend
    const data = conversations.map((conv) => ({
      conversationId: conv.ConversationId,
      channel: conv.Channel,
      status: conv.Status,
      sessionId: conv.SessionId,
      lineUserId: conv.LineUserId,
      lineFriendName: conv.LineFriend?.DisplayName || null,
      createdAt: conv.CreatedAt,
      updatedAt: conv.UpdatedAt,
      messageCount: conv.Messages.length,
      messages: conv.Messages.map((msg) => ({
        messageId: msg.MessageId,
        role: msg.Role,
        content: msg.Content,
        sources: msg.Sources,
        createdAt: msg.CreatedAt,
      })),
    }))

    return NextResponse.json({
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error: any) {
    console.error("Failed to fetch chat history:", error)
    return NextResponse.json(
      {
        error: "Failed to fetch chat history",
        details: error?.message || String(error)
      },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { type } = body

    // ดึงข้อมูลสรุปสถิติการใช้งานแชทบอท
    if (type === "summary") {
      const [
        totalConversations,
        totalMessages,
        webConversations,
        lineConversations,
        recentConversations,
      ] = await Promise.all([
        prisma.conversations.count({
          where: { Type: ConversationType.BOT },
        }).catch(() => 0),
        prisma.messages.count({
          where: {
            Conversation: {
              Type: ConversationType.BOT,
            },
          },
        }).catch(() => 0),
        prisma.conversations.count({
          where: {
            Type: ConversationType.BOT,
            Channel: ConversationChannel.WEB,
          },
        }).catch(() => 0),
        prisma.conversations.count({
          where: {
            Type: ConversationType.BOT,
            Channel: ConversationChannel.LINE,
          },
        }).catch(() => 0),
        prisma.conversations.count({
          where: {
            Type: ConversationType.BOT,
            CreatedAt: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // ข้อมูลย้อนหลัง 7 วัน
            },
          },
        }).catch(() => 0),
      ])

      return NextResponse.json({
        totalConversations,
        totalMessages,
        webConversations,
        lineConversations,
        recentConversations,
      })
    }

    // ดึงรายการคำถามที่มีการถามบ่อย (ทั้งที่ตอบได้และตอบไม่ได้)
    if (type === "found-questions") {
      const page = body.page || 1
      const limit = body.limit || 10
      const skip = (page - 1) * limit

      // 1. ดึง FAQCandidates ที่รอการดำเนินการ
      const faqCandidates = await prisma.fAQCandidates.findMany({
        where: {
          Status: { in: ["PENDING", "IGNORED", "APPROVED"] },
          OR: [
            { ApprovedFAQId: null },
            { ApprovedFAQ: { IsActive: false } }
          ]
        },
        include: { ApprovedFAQ: true }
      })

      // 2. ดึง FAQs ที่มีคนถามแล้ว (ใช้งานอยู่)
      const activeFaqs = await prisma.fAQs.findMany({
        where: {
          IsActive: true,
          UsageCount: { gt: 0 }
        }
      })

      const combined = [
        ...faqCandidates.map((item: any) => {
          let derivedStatus = item.Status;
          if (item.Status === "APPROVED") {
            if (item.ApprovedFAQ?.IsActive === false) {
              derivedStatus = "WAS_FAQ";
            } else if (!item.ApprovedFAQId) {
              derivedStatus = "PENDING";
            }
          }
          return {
            question: item.Title || item.NormalizedQuestion,
            count: item.AskCount,
            approvedFAQId: item.ApprovedFAQId,
            status: derivedStatus,
          };
        }),
        ...activeFaqs.map((faq: any) => ({
          question: faq.Question,
          count: faq.UsageCount,
          approvedFAQId: faq.FAQId,
          status: "APPROVED",
        }))
      ]

      // เรียงลำดับตามจำนวนการถาม (มากไปน้อย)
      combined.sort((a, b) => b.count - a.count)

      // Paginate
      const totalCount = combined.length
      const totalPages = Math.ceil(totalCount / limit)
      const topQuestions = combined.slice(skip, skip + limit)

      return NextResponse.json({
        questions: topQuestions,
        totalPages,
        currentPage: page,
        totalCount
      })
    }

    // ลบรายการคำถามที่พบออกจากรายการรอตรวจสอบ
    if (type === "delete-found-question") {
      const { question } = body

      if (!question) {
        return NextResponse.json(
          { error: "Question is required" },
          { status: 400 }
        )
      }

      // หาและลบ FAQ candidate ที่มีคำถามนี้
      const deletedCandidate = await prisma.fAQCandidates.deleteMany({
        where: {
          OR: [
            { Title: question },
            { NormalizedQuestion: question }
          ]
        }
      })

      if (deletedCandidate.count === 0) {
        return NextResponse.json(
          { error: "Question not found" },
          { status: 404 }
        )
      }

      return NextResponse.json({
        success: true,
        message: `Deleted ${deletedCandidate.count} question(s)`,
        deletedCount: deletedCandidate.count
      })
    }

    // ดึงรายการข้อความที่บอทตอบไม่ได้เพื่อให้ผู้ดูแลระบบตรวจสอบ
    if (type === "unanswerable") {
      const page = body.page || 1
      const limit = body.limit || 10
      const skip = (page - 1) * limit

      const unanswerableMessages = await prisma.messages.findMany({
        where: {
          Role: "assistant",
          Conversation: {
            Type: ConversationType.BOT,
          },
          OR: [
            { Content: { contains: "ไม่พบเอกสาร", mode: "insensitive" } },
            { Content: { contains: "ไม่มีฟอร์ม", mode: "insensitive" } },
            { Content: { contains: "ไม่ได้ระบุ", mode: "insensitive" } },
            { Content: { contains: "ไม่มีข้อมูล", mode: "insensitive" } },
            {
              AND: [
                { Content: { contains: "ไม่มี", mode: "insensitive" } },
                { Content: { contains: "ที่สามารถให้", mode: "insensitive" } },
              ],
            },
            {
              AND: [
                { Content: { contains: "ขออภัย", mode: "insensitive" } },
                { Content: { contains: "ไม่มี", mode: "insensitive" } },
              ],
            },
            { Content: { contains: "ติดต่อเจ้าหน้าที่ HR โดยตรง", mode: "insensitive" } },
            { Content: { contains: "ติดต่อฝ่ายทรัพยากรบุคคลโดยตรง", mode: "insensitive" } },
            { Content: { contains: "ติดต่อฝ่ายทรัพยากรบุคคล", mode: "insensitive" } },
            { Content: { contains: "บัญชีไลน์ id:", mode: "insensitive" } },
            {
              AND: [
                { Content: { contains: "ไม่มี", mode: "insensitive" } },
                { Content: { contains: "โดยตรง", mode: "insensitive" } },
              ],
            },
          ],
        },
        include: {
          Conversation: {
            include: {
              Messages: {
                orderBy: { CreatedAt: "asc" },
              },
            },
          },
        },
        orderBy: { CreatedAt: "desc" },
      })

      // กรองเฉพาะข้อความที่เข้าเกณฑ์ "ตอบไม่ได้" จริงๆ
      const filtered = unanswerableMessages.filter((msg) => isUnanswerable(msg.Content, msg.Metadata))

      const unanswerable = filtered.map((msg) => {
        const convMessages = msg.Conversation.Messages
        const previousUserMsg = convMessages
          .filter((m) => m.Role === "user" && m.CreatedAt < msg.CreatedAt)
          .pop()
        const meta = msg.Metadata as MessageMetadata
        return {
          messageId: msg.MessageId,
          conversationId: msg.ConversationId,
          userQuestion: previousUserMsg?.Content ?? "N/A",
          botResponse: msg.Content,
          channel: msg.Conversation.Channel,
          createdAt: msg.CreatedAt,
          topScore: typeof meta?.topScore === "number" ? meta.topScore : null,
          reason: getUnanswerableReason(msg.Content, msg.Metadata),
          dataComplete: !!meta?.dataComplete,
        }
      })

      // ทำ Deduplication โดยอิงจากหัวข้อคำถาม (เลือกรายการล่าสุด)
      const seen = new Map<string, typeof unanswerable[0]>()
      for (const item of unanswerable) {
        const normalized = item.userQuestion
          .replace(/\s+/g, " ")
          .trim()
          .toLowerCase()
        const existing = seen.get(normalized)
        if (!existing || new Date(item.createdAt) > new Date(existing.createdAt)) {
          seen.set(normalized, item)
        }
      }
      const deduplicated = Array.from(seen.values())

      const totalCount = deduplicated.length
      const totalPages = Math.ceil(totalCount / limit) || 1
      const paginated = deduplicated.slice(skip, skip + limit)

      return NextResponse.json({
        unanswerable: paginated,
        totalPages,
        currentPage: page,
        totalCount
      })
    }

    // อัปเดต Flag สถานะการจัดการคำถามที่ตอบไม่ได้
    if (type === "flag-unanswerable") {
      const { messageId, documentAdded, qaAdded, dataComplete } = body as {
        messageId?: string
        documentAdded?: boolean
        qaAdded?: boolean
        dataComplete?: boolean
      }
      if (!messageId || typeof messageId !== "string") {
        return NextResponse.json(
          { error: "Missing or invalid messageId" },
          { status: 400 }
        )
      }
      const msg = await prisma.messages.findUnique({
        where: { MessageId: messageId },
        select: { Metadata: true },
      })
      if (!msg) {
        return NextResponse.json(
          { error: "Message not found" },
          { status: 404 }
        )
      }
      const existing = (msg.Metadata as Record<string, unknown>) || {}
      const nextMetadata = {
        ...existing,
        ...(typeof documentAdded === "boolean" && { documentAdded }),
        ...(typeof qaAdded === "boolean" && { qaAdded }),
        ...(typeof dataComplete === "boolean" && { dataComplete }),
      }
      await prisma.messages.update({
        where: { MessageId: messageId },
        data: { Metadata: nextMetadata },
      })
      return NextResponse.json({
        ok: true,
        documentAdded: nextMetadata.documentAdded,
        qaAdded: nextMetadata.qaAdded,
        dataComplete: nextMetadata.dataComplete,
      })
    }

    return NextResponse.json({ error: "Invalid type" }, { status: 400 })
  } catch (error: any) {
    console.error("Failed to get chat stats:", error)
    return NextResponse.json(
      {
        error: "Failed to get chat stats",
        details: error?.message || String(error)
      },
      { status: 500 }
    )
  }
}





