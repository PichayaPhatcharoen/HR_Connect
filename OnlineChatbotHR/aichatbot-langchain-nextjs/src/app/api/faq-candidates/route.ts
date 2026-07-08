import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { FAQCandidateStatus } from "@prisma/client"
import { auth } from "@/lib/auth"
import { embedFAQQuestion } from "@/services/faqEmbedding"

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const status = searchParams.get("status") || "PENDING"
    const channel = searchParams.get("channel") || "ALL"
    const sortBy = searchParams.get("sortBy") || "askCount"
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100)
    const offset = parseInt(searchParams.get("offset") || "0")

    // สร้าง where clause สำหรับการกรองข้อมูล
    const where: any = {}

    if (status !== "ALL") {
      where.Status = status as FAQCandidateStatus
    }

    if (channel !== "ALL") {
      where.Channel = channel
    }

    // ตั้งค่าการเรียงลำดับข้อมูล (sorting)
    let orderBy: any = {}
    switch (sortBy) {
      case "askCount":
        orderBy = { AskCount: "desc" }
        break
      case "lastAsked":
        orderBy = { LastAskedAt: "desc" }
        break
      case "firstAsked":
        orderBy = { FirstAskedAt: "desc" }
        break
      default:
        orderBy = { AskCount: "desc" }
    }

    const [candidates, total] = await Promise.all([
      prisma.fAQCandidates.findMany({
        where,
        orderBy,
        take: limit,
        skip: offset,
      }),
      prisma.fAQCandidates.count({ where }),
    ])

    return NextResponse.json({
      data: candidates,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    })
  } catch (error: any) {
    console.error("Failed to fetch FAQ candidates:", error)
    return NextResponse.json(
      { error: "Failed to fetch FAQ candidates", details: error?.message },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    const sessionUserId = session?.user?.id

    const body = await req.json()
    const { type } = body

    // ดึงข้อมูลสถิติ (Stats)
    if (type === "stats") {
      const [
        totalPending,
        totalApproved,
        totalRejected,
        topCandidates,
        recentCandidates,
      ] = await Promise.all([
        prisma.fAQCandidates.count({ where: { Status: FAQCandidateStatus.PENDING } }),
        prisma.fAQCandidates.count({ where: { Status: FAQCandidateStatus.APPROVED } }),
        prisma.fAQCandidates.count({ where: { Status: FAQCandidateStatus.REJECTED } }),
        prisma.fAQCandidates.findMany({
          where: { Status: FAQCandidateStatus.PENDING },
          orderBy: { AskCount: "desc" },
          take: 10,
        }),
        prisma.fAQCandidates.findMany({
          where: { Status: FAQCandidateStatus.PENDING },
          orderBy: { LastAskedAt: "desc" },
          take: 10,
        }),
      ])

      return NextResponse.json({
        totalPending,
        totalApproved,
        totalRejected,
        topCandidates,
        recentCandidates,
      })
    }

    // อนุมัติ Candidate → สร้างเป็น FAQ
    if (type === "approve") {
      const { candidateId, editedQuestion, editedAnswer, categoryId, reviewedBy } = body

      if (!candidateId) {
        return NextResponse.json({ error: "candidateId is required" }, { status: 400 })
      }

      const candidate = await prisma.fAQCandidates.findUnique({
        where: { FAQCandidateId: candidateId },
      })

      if (!candidate) {
        return NextResponse.json({ error: "Candidate not found" }, { status: 404 })
      }

      // ตรวจสอบหมวดหมู่ (Category) - ถ้าไม่มีให้สร้างใหม่ตามชื่อที่ระบุ
      let validCategoryId: string | null = null
      if (categoryId && categoryId !== "ทั้งหมด") {
        // ค้นหาหมวดหมู่ที่มีอยู่หลังตามชื่อ
        let existingCategory = await prisma.fAQCategories.findFirst({
          where: { Name: categoryId },
        })
        
        // หากไม่พบหมวดหมู่ ให้ทำการสร้างใหม่
        if (!existingCategory) {
          existingCategory = await prisma.fAQCategories.create({
            data: { Name: categoryId },
          })
        }
        
        validCategoryId = existingCategory.FAQCategoryId
      }

      // บันทึกข้อมูลลงตาราง FAQs
      const faq = await prisma.fAQs.create({
        data: {
          Question: editedQuestion || (candidate as any).Title || candidate.NormalizedQuestion,
          Answer: editedAnswer || candidate.BotAnswer,
          CategoryId: validCategoryId,
          UsageCount: candidate.AskCount,
        },
      })

      // อัปเดตสถานะของ Candidate เป็น APPROVED
      await prisma.fAQCandidates.update({
        where: { FAQCandidateId: candidateId },
        data: {
          Status: FAQCandidateStatus.APPROVED,
          ApprovedFAQId: faq.FAQId,
          ReviewedBy: sessionUserId || reviewedBy || null,
          ReviewedAt: new Date(),
        },
      })

      // สร้าง Embedding สำหรับคำถาม FAQ (background, non-blocking)
      embedFAQQuestion(faq.FAQId, faq.Question).catch(err =>
        console.error("[FAQ] Background embedding failed for approved candidate:", err)
      )

      return NextResponse.json({
        ok: true,
        faqId: faq.FAQId,
        message: "FAQ created successfully",
      })
    }

    // ปฏิเสธ (Reject) Candidate
    if (type === "reject") {
      const { candidateId, reviewedBy, reviewNotes } = body

      if (!candidateId) {
        return NextResponse.json({ error: "candidateId is required" }, { status: 400 })
      }

      await prisma.fAQCandidates.update({
        where: { FAQCandidateId: candidateId },
        data: {
          Status: FAQCandidateStatus.REJECTED,
          ReviewedBy: sessionUserId || reviewedBy || null,
          ReviewedAt: new Date(),
          ReviewNotes: reviewNotes || null,
        },
      })

      return NextResponse.json({
        ok: true,
        message: "Candidate rejected",
      })
    }

    // ตั้งค่าไม่สนใจ (Ignore) Candidate - จะกลับมาแสดงใหม่ถ้ามีการถามซ้ำ (เก็บ AskCount ไว้)
    if (type === "ignore") {
      const { candidateId, reviewedBy } = body

      if (!candidateId) {
        return NextResponse.json({ error: "candidateId is required" }, { status: 400 })
      }

      await prisma.fAQCandidates.update({
        where: { FAQCandidateId: candidateId },
        data: {
          Status: FAQCandidateStatus.IGNORED,
          ReviewedBy: sessionUserId || reviewedBy || null,
          ReviewedAt: new Date(),
          // เก็บ AskCount ไว้เพื่อให้กลับมาแสดงผลถูกต้องเมื่อกู้คืน
        },
      })

      return NextResponse.json({
        ok: true,
        message: "Candidate ignored - will reappear if asked again",
      })
    }

    // กู้คืน (Unarchive) จาก Rejected หรือ Ignored กลับมาเป็น PENDING
    if (type === "unarchive") {
      const { candidateId } = body

      if (!candidateId) {
        return NextResponse.json({ error: "candidateId is required" }, { status: 400 })
      }

      await prisma.fAQCandidates.update({
        where: { FAQCandidateId: candidateId },
        data: {
          Status: FAQCandidateStatus.PENDING,
          ReviewedBy: null,
          ReviewedAt: null,
          ReviewNotes: null,
        },
      })

      return NextResponse.json({
        ok: true,
        message: "Candidate reactivated to pending",
      })
    }

    // ลบ Candidate ถาวร
    if (type === "delete") {
      const { candidateId } = body

      if (!candidateId) {
        return NextResponse.json({ error: "candidateId is required" }, { status: 400 })
      }

      await prisma.fAQCandidates.delete({
        where: { FAQCandidateId: candidateId },
      })

      return NextResponse.json({
        ok: true,
        message: "Candidate permanently deleted",
      })
    }

    // รวม (Merge) Candidate ที่ซ้ำกัน
    if (type === "merge") {
      const { candidateId, targetCandidateId, reviewedBy } = body

      if (!candidateId || !targetCandidateId) {
        return NextResponse.json(
          { error: "candidateId and targetCandidateId are required" },
          { status: 400 }
        )
      }

      const [candidate, target] = await Promise.all([
        prisma.fAQCandidates.findUnique({ where: { FAQCandidateId: candidateId } }),
        prisma.fAQCandidates.findUnique({ where: { FAQCandidateId: targetCandidateId } }),
      ])

      if (!candidate || !target) {
        return NextResponse.json({ error: "Candidate(s) not found" }, { status: 404 })
      }

      // การ Merge: เพิ่ม count ให้เป้าหมาย (target) และระบุตัวต้นทางเป็น duplicate
      await Promise.all([
        prisma.fAQCandidates.update({
          where: { FAQCandidateId: targetCandidateId },
          data: {
            AskCount: { increment: candidate.AskCount },
            LastAskedAt: new Date(
              Math.max(target.LastAskedAt.getTime(), candidate.LastAskedAt.getTime())
            ),
          },
        }),
        prisma.fAQCandidates.update({
          where: { FAQCandidateId: candidateId },
          data: {
            Status: FAQCandidateStatus.DUPLICATE,
            ReviewedBy: sessionUserId || reviewedBy || null,
            ReviewedAt: new Date(),
            ReviewNotes: `Merged into ${targetCandidateId}`,
          },
        }),
      ])

      return NextResponse.json({
        ok: true,
        message: "Candidates merged successfully",
      })
    }

    return NextResponse.json({ error: "Invalid type" }, { status: 400 })
  } catch (error: any) {
    console.error("Failed to process FAQ candidate action:", error)
    return NextResponse.json(
      { error: "Failed to process action", details: error?.message },
      { status: 500 }
    )
  }
}
