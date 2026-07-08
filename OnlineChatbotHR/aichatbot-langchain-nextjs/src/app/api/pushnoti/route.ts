import { NextResponse } from "next/server"
import path from "path"
import fs from "fs/promises"

export const runtime = "nodejs"

const LINE_BROADCAST_API = "https://api.line.me/v2/bot/message/broadcast"

export async function POST(req: Request) {
  try {
    const formData = await req.formData()

    const title = formData.get("title")?.toString() || ""
    const content = formData.get("content")?.toString() || ""
    const link = formData.get("link")?.toString() || ""
    const existingPicture = formData.get("existingPicture")?.toString() || null
    const file = formData.get("file") as File | null

    if (!title || !content) {
      return NextResponse.json(
        { error: "Title and content are required" },
        { status: 400 }
      )
    }

    let imageUrl: string | null = existingPicture

    if (file) {
      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)

      const uploadDir = path.join(
        process.cwd(),
        "public/uploads/announcements"
      )
      await fs.mkdir(uploadDir, { recursive: true })

      const fileName = `${Date.now()}-${file.name.replace(/\s+/g, "-")}`
      const filePath = path.join(uploadDir, fileName)

      await fs.writeFile(filePath, buffer)

      imageUrl = `/uploads/announcements/${fileName}`
    }

    const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/$/, "")
    const fullImageUrl = imageUrl
      ? `${baseUrl}${imageUrl.startsWith("/") ? "" : "/"}${imageUrl}`
      : null

// Create Flex Message
    const flexMessage = {
      type: "flex",
      altText: title,
      contents: {
        type: "bubble",
        hero: fullImageUrl
          ? {
              type: "image",
              url: fullImageUrl,
              size: "full",
              aspectRatio: "20:13",
              aspectMode: "cover",
            }
          : undefined,
        body: {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "text",
              text: title,
              weight: "bold",
              size: "xl",
              wrap: true,
            },
            {
              type: "text",
              text: content,
              size: "md",
              margin: "md",
              wrap: true,
            },
          ],
        },
        footer: link
          ? {
              type: "box",
              layout: "vertical",
              contents: [
                {
                  type: "button",
                  style: "link",
                  action: {
                    type: "uri",
                    label: "ดูรายละเอียด",
                    uri: link,
                  },
                },
              ],
            }
          : undefined,
      },
    }

//  Broadcast Message to line
    const lineRes = await fetch(LINE_BROADCAST_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        messages: [flexMessage],
      }),
    })

    if (!lineRes.ok) {
      const err = await lineRes.text()
      console.error("LINE API error:", err)
      return NextResponse.json(
        { error: "Failed to send LINE broadcast" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: "ส่งประกาศผ่าน LINE สำเร็จ",
    })
  } catch (error) {
    console.error("PushNoti error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}