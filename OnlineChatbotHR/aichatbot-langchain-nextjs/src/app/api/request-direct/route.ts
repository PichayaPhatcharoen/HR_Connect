
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma";
import { DirectContact_Request_Status } from "@prisma/client"
import { Resend } from "resend"
import { resolveResendFromAddress } from "@/lib/resendFrom"

//prepare notification email to staff
const NOTIFY_EMAIL = "hritkmitl@gmail.com"

async function sendDirectContactEmail(params: {
  displayName: string
  message: string
  lineUserId: string
  requestId: number | string
}) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.error("[/api/request-direct] Email not sent: RESEND_API_KEY missing")
    return
  }

  const fromEmail = resolveResendFromAddress(process.env.RESEND_FROM_EMAIL)
  const resend = new Resend(apiKey)
  const { displayName, message, lineUserId, requestId } = params

  const { data, error } = await resend.emails.send({
    from: fromEmail,
    to: NOTIFY_EMAIL,
    subject: `New Direct Contact Request`,
    text: [
      "มีคำร้อง Direct Contact ใหม่เข้ามา",
      `รหัสคำร้อง: ${requestId}`,
      "",
      "ข้อความ:",
      message,

      "",
      `ตอบรับคำขอคุยโดยตรงได้ที่ https://hritkmitl.xyz/management/request-direct`,
      `ชื่อผู้ส่ง: ${displayName}`,
      `แชตโดยตรงได้ที่ https://chat.line.biz/account/@143thesr  (Line OA Message)`,
      `LINE User ID: ${lineUserId || "-"}`,

    ].join("\n"),
  })

  if (error) {
    console.error("[/api/request-direct] Resend error:", JSON.stringify(error, null, 2))
    throw new Error(`Resend: ${error.message}`)
  }
  console.log("[/api/request-direct] Email sent to", NOTIFY_EMAIL, "id:", data?.id)
}

//handle request direct
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    // console.log(body)
    const displayName = String(body?.displayName ?? "").trim()
    const message = String(body?.message ?? "").trim()
    const lineUserId = String(body?.userId ?? "").trim()

    if (!displayName || !message) {
      return NextResponse.json({ error: "ข้อมูลไม่ครบถ้วน" }, { status: 400 })
    }

    const effectiveLineUserId = lineUserId || `anonymous-${Date.now()}`

    // Ensure LineFriend exists (required FK for DirectContact_Requests)
    await prisma.lineFriends.upsert({
      where: { LineUserId: effectiveLineUserId },
      create: {
        LineUserId: effectiveLineUserId,
        DisplayName: displayName,
      },
      update: { DisplayName: displayName },
    })

    const directContact = await prisma.directContact_Requests.create({
      data: {
        DisplayName: displayName,
        Request: message,
        Status: DirectContact_Request_Status.PENDING,
        LineUserId: effectiveLineUserId,
      },
      select: { DirectContactRequestId: true, DisplayName: true, Request: true, Status: true, CreatedAt: true, LineUserId: true },
    })

//send notification email to staff
    sendDirectContactEmail({
      displayName,
      message,
      lineUserId,
      requestId: directContact.DirectContactRequestId,
    }).catch((err) => {
      console.error("[/api/request-direct] Failed to send email:", err)
    })

    return NextResponse.json(
      { success: true, message: "ส่งคำร้องสำเร็จ", requestId: directContact.DirectContactRequestId, data: {
        id: directContact.DirectContactRequestId,
        displayName: directContact.DisplayName,
        request: directContact.Request,
        status: directContact.Status,
        createdAt: directContact.CreatedAt,
        lineUserId: directContact.LineUserId,
      } },
      { status: 200 }
    )
  } catch (e: any) {
    console.error("[/api/request-direct] ERROR:", e)
    return NextResponse.json({ error: "Internal Server Error", details: e?.message ?? "unknown" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "50", 10)));
  const statusFilter = searchParams.get("status"); // "PENDING" | "ACCEPTED" | "ENDING" or empty

  const where =
    statusFilter && ["PENDING", "ACCEPTED", "ENDING"].includes(statusFilter)
      ? { Status: statusFilter as "PENDING" | "ACCEPTED" | "ENDING" }
      : undefined;

  const [requests, total] = await Promise.all([
    prisma.directContact_Requests.findMany({
      where,
      orderBy: { CreatedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.directContact_Requests.count({ where }),
  ]);

  const mapped = requests.map((r) => ({
    id: r.DirectContactRequestId,
    displayName: r.DisplayName,
    request: r.Request,
    status: r.Status,
    createdAt: r.CreatedAt,
    lineUserId: r.LineUserId,
  }));

  return NextResponse.json({
    data: mapped,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  });
}