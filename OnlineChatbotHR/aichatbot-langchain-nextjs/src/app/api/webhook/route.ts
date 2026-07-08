import { NextRequest, NextResponse } from "next/server"
import { lineBotAnswer } from "@/lib/chatbot"
import { prisma } from "@/lib/prisma"
import { DirectContact_Request_Status } from "@prisma/client"
import { fetchLineProfile, reply, LineMessage } from "@/lib/line"
import * as crypto from "crypto"


/** แปลง Markdown-heavy bot output เป็น LINE-friendly plain text */
function formatLineAnswer(text: string) {
    let formatted = text.replace(/\r\n/g, "\n")

    // ลบ strong/emphasis/code markers
    formatted = formatted
        .replace(/\*\*(.+?)\*\*/g, "$1")
        .replace(/__(.+?)__/g, "$1")
        .replace(/`([^`]+)`/g, "$1")

    // คง markers ของ list ไว้เพื่อความอ่านง่าย (trim เฉพาะช่องว่าง)
    formatted = formatted
        .replace(/^(\s*)[-*+]\s+/gm, (_, indent: string) => `${indent}- `)
        .replace(/^(\s*)(\d+)\.\s+/gm, (_, indent: string, n: string) => `${indent}${n}. `)

    return formatted.trim()
}


async function getBotReply(token: string, payload: string, userId: string) {
    //ส่ง user message --> chatbot calling fuction & เอาคำตอบมาใส่ใน replymessage
    const botreplymessage = await lineBotAnswer(payload, userId)
    const formatted = formatLineAnswer(botreplymessage)
    return reply(token, { type: "text", text: formatted })

}

async function loadingBubble(userId: string, seconds: number) {
    await fetch("https://api.line.me/v2/bot" + `/chat/loading/start`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`
        },
        body: JSON.stringify({ chatId: userId, loadingSeconds: Math.min(Math.max(seconds, 5), 60) }),
    })
}

//design ได้ที่ https://developers.line.biz/flex-simulator
async function buildAnnouncementFlex(): Promise<LineMessage> {
    const anns = await prisma.announcements.findMany({
        orderBy: { CreatedAt: "desc" },
        take: 5,
        select: { AnnouncementId: true, Title: true, Content: true, Picture: true, Link: true },
    })

    if (!anns.length) {
        return {
            type: "text",
            text: "ยังไม่มีประกาศในขณะนี้ค่ะ"
        }
    }

    const baseURL = process.env.NEXT_PUBLIC_BASE_URL

    const truncateText = (text: string, maxLength: number): string => {
        if (!text || text.length <= maxLength) return text
        return text.slice(0, maxLength - 3) + "..."
    }

    const bubbles = anns.map((a) => {
        const title = truncateText(String(a.Title || "ประกาศ").normalize("NFC"), 100)
        const content = truncateText(String(a.Content || "").normalize("NFC"), 120) || "—"

        const imageUrl = a.Picture
            ? encodeURI(`${baseURL}/${a.Picture}`)
            : `${baseURL}/home/annoucementbase.png`

        const bodyContents = [
            {
                type: "text",
                text: title,
                weight: "bold",
                size: "sm",
                wrap: true,
            },
            {
                type: "text",
                text: content,
                wrap: true,
                color: "#8c8c8c",
                size: "xs",
                margin: "md",
            },
        ]

        const bubble = {
            type: "bubble",
            size: "kilo",
            hero: {
                type: "image",
                url: imageUrl,
                size: "full",
                aspectMode: "cover",
                aspectRatio: "320:213",
            },
            body: {
                type: "box",
                layout: "vertical",
                spacing: "sm",
                paddingAll: "13px",
                contents: bodyContents,
            },
            footer: {
                type: "box",
                layout: "vertical",
                spacing: "sm",
                contents: [
                    {
                        type: "button",
                        style: "primary",
                        height: "sm",
                        action: {
                            type: "uri",
                            label: "ดูประกาศเต็ม",
                            uri: encodeURI(`${baseURL}/announce?id=${a.AnnouncementId}`),
                        },
                    },
                ],
            },
        }

        if (a.Link) {
            return {
                ...bubble,
                footer: {
                    type: "box",
                    layout: "vertical",
                    spacing: "sm",
                    contents: [
                        {
                            type: "button",
                            style: "primary",
                            height: "sm",
                            action: {
                                type: "uri",
                                label: "ดูประกาศเต็ม",
                                uri: encodeURI(`${baseURL}/announce?id=${a.AnnouncementId}`),
                            },
                        },
                        {
                            type: "button",
                            style: "link",
                            height: "sm",
                            action: {
                                type: "uri",
                                label: "ดูรายละเอียด",
                                uri: encodeURI(a.Link),
                            },
                        },
                    ],
                },
            }
        }

        return bubble
    })

    return {
        type: "flex",
        altText: "ข่าวประกาศล่าสุด",
        contents: {
            type: "carousel",
            contents: bubbles,
        },
    }
}


export async function POST(req: NextRequest) {
    // Get raw body first for LINE signature verification
    const bodyText = await req.text()
    console.log("[WEBHOOK] Raw body:", bodyText.substring(0, 200) + "...")

    // Verify LINE signature
    const signature = req.headers.get('x-line-signature')
    const lineSecret = process.env.LINE_CHANNEL_SECRET

    if (!signature) {
        console.error("[WEBHOOK] Missing LINE signature")
        return NextResponse.json({ error: "Missing signature" }, { status: 400 })
    }

    if (!lineSecret) {
        console.error("[WEBHOOK] Missing LINE_CHANNEL_SECRET environment variable")
        return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
    }

    const hash = crypto
        .createHmac('SHA256', lineSecret)
        .update(bodyText)
        .digest('base64')

    if (hash !== signature) {
        console.error("[WEBHOOK] Invalid signature", { expected: hash, received: signature })
        return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
    }

    let getevents: any
    try {
        getevents = JSON.parse(bodyText)
    } catch (e) {
        console.warn("[WEBHOOK] Empty or invalid JSON body received", { bodyLength: bodyText.length }, e)
        return NextResponse.json({ status: 200 })
    }

    const events = getevents.events
    if (!events || !Array.isArray(events)) {
        return NextResponse.json({ status: 200 })
    }

    // Send immediate 200 response to prevent LINE timeout
    // Then process events asynchronously
    const responsePromise = NextResponse.json({ status: 200 })

        // Process events in background
        ; (async () => {
            for (const event of events) {

                const userId: string | undefined = event.source?.userId
                if (userId) {
                    const profile = await fetchLineProfile(userId)

                    await prisma.lineFriends.upsert({
                        where: { LineUserId: userId },
                        update: {
                            DisplayName: profile.displayName,
                            PictureUrl: profile.pictureUrl,
                            IsActive: true,
                            BlockedAt: null,
                        },
                        create: {
                            LineUserId: userId,
                            DisplayName: profile.displayName,
                            PictureUrl: profile.pictureUrl,
                            IsActive: true,
                        },
                    })
                }

                if (event.type === "unfollow") {
                    if (userId) {
                        await prisma.lineFriends.update({
                            where: { LineUserId: userId },
                            data: {
                                IsActive: false,
                                BlockedAt: new Date(),
                            },
                        })
                    }
                    continue
                }

                if (event.type === "postback") {
                    const data = event.postback.data || ""

                    if (data === "action=faq_menu") {
                        const flex = await buildFAQFlex(0)
                        await reply(event.replyToken, flex)
                        continue
                    }

                    if (data.startsWith("faq_page=")) {
                        const page = parseInt(data.split("faq_page=")[1])
                        const flex = await buildFAQFlex(page)
                        await reply(event.replyToken, flex)
                        continue
                    }

                    if (data.startsWith("faq=")) {
                        const id = data.split("faq=")[1]
                        const flex = await buildFAQAnswerFlex(id)
                        await reply(event.replyToken, flex)
                        continue
                    }

                    continue
                }

                if (event.type !== "message") continue

                const hasAccepted =
                    (await prisma.directContact_Requests.count({
                        where: {
                            LineUserId: userId!,
                            Status: DirectContact_Request_Status.ACCEPTED,
                        },
                    })) > 0

                if (hasAccepted) continue

                if (event.message.type !== "text") {
                    await reply(event.replyToken, [
                        {
                            type: "text",
                            text:
                                "ขออภัยค่ะ ทางบอตไม่สามารถประมวลผลข้อความประเภท " +
                                event.message.type +
                                " ได้ค่ะ แต่คุณสามารถส่งข้อความเพื่อสอบถามกับแชตบอตได้เลยนะคะ",
                        },
                        { type: "sticker", packageId: "11539", stickerId: "52114110" },
                    ])
                    continue
                }

                const text: string = event.message.text

                if (text.startsWith("/")) {
                    switch (text) {
                        case "/announcement": {
                            const flex = await buildAnnouncementFlex()
                            await reply(event.replyToken, flex)
                            break
                        }
                        case "/FAQ": {
                            const flex = await buildFAQFlex(0)
                            await reply(event.replyToken, flex)
                            break
                        }
                        default: {
                            await reply(event.replyToken, {
                                type: "text",
                                text: "ขออภัย ระบบไม่รองรับคำสั่งดังกล่าวค่ะ",
                            })
                        }
                    }
                    continue
                }

                loadingBubble(userId!, 40)
                await getBotReply(event.replyToken, text, userId!)
            }
        })() // Process in background

    return responsePromise
}


export async function GET() {
    return NextResponse.json({ connection: 'true' },)
}


//ชั่วคราว แปะรูปแบบสำหรับแกะ payload จะได้เขียนถูก
//  "events": [
//     {
//       "replyToken": "xxxxxxxxxxxxxx",
//       "type": "message",
//       "mode": "active",
//       "timestamp": 1234567890123,
//       "source": {
//         "type": "user",
//         "userId": "xxxxxxx..."
//       },
//       "message": {
//         "id": "123456",
//         "type": "text",
//         "text": "Hello, world"
//          }
//      }
//   ]


async function buildFAQFlex(page: number = 0): Promise<LineMessage> {
    const PAGE_SIZE = 9 // LINE carousel limit is 10 bubbles (9 FAQs + 1 pagination)
    const skip = page * PAGE_SIZE

    const [faqs, totalCount] = await Promise.all([
        prisma.fAQs.findMany({
            orderBy: { UsageCount: "desc" },
            skip,
            take: PAGE_SIZE,
            select: { FAQId: true, Question: true },
        }),
        prisma.fAQs.count()
    ])

    if (!faqs.length) {
        return { type: "text", text: "ยังไม่มีคำถามที่พบบ่อยในระบบค่ะ 🙏" };
    }

    // สร้าง bubbles สำหรับแต่ละ FAQ เพื่อให้สามารถคลิกได้
    const bubbles = faqs.map((faq) => ({
        type: "bubble",
        body: {
            type: "box",
            layout: "vertical",
            contents: [
                {
                    type: "text",
                    text: faq.Question,
                    wrap: true,
                    weight: "bold",
                    margin: "md",
                },
            ],
        },
        footer: {
            type: "box",
            layout: "vertical",
            contents: [
                {
                    type: "button",
                    style: "primary",
                    height: "sm",
                    action: {
                        type: "postback",
                        label: "ดูคำตอบ",
                        data: `faq=${faq.FAQId}`,
                        displayText: faq.Question,
                    },
                },
            ],
        },
    }));

    // pagination bubble
    const hasMore = skip + PAGE_SIZE < totalCount
    const hasPrev = page > 0

    if (hasMore || hasPrev) {
        const paginationButtons = []

        if (hasPrev) {
            paginationButtons.push({
                type: "button",
                style: "secondary",
                height: "sm",
                action: {
                    type: "postback",
                    label: "← หน้าแรก",
                    data: "faq_page=0",
                    displayText: "หน้าแรก",
                },
            })
        }

        if (hasMore) {
            paginationButtons.push({
                type: "button",
                style: "primary",
                height: "sm",
                action: {
                    type: "postback",
                    label: "หน้าถัดไป →",
                    data: `faq_page=${page + 1}`,
                    displayText: "หน้าถัดไป",
                },
            })
        }

        bubbles.push({
            type: "bubble",
            body: {
                type: "box",
                layout: "vertical",
                contents: [
                    {
                        type: "text",
                        text: `แสดง ${skip + 1}-${Math.min(skip + PAGE_SIZE, totalCount)} จาก ${totalCount} รายการ`,
                        wrap: true,
                        weight: "regular",
                        margin: "md",
                    },
                ],
            },
            footer: {
                type: "box",
                layout: "vertical",
                contents: paginationButtons,
            },
        })
    }

    return {
        type: "flex",
        altText: `คำถามที่พบบ่อย (FAQ) - หน้า ${page + 1}`,
        contents: {
            type: "carousel",
            contents: bubbles,
        },
    };
}

async function buildFAQAnswerFlex(faqId: string): Promise<LineMessage> {
    const ansFAQ = await prisma.fAQs.findUnique({
        where: { FAQId: faqId },
        select: { FAQId: true, Question: true, Answer: true },
    })

    if (!ansFAQ) {
        return { type: "text", text: "คำถามที่พบบ่อยนี้ไม่มีในระบบค่ะ 🙏" }
    }

    // เพิ่มจำนวนที่ถูกถาม
    await prisma.fAQs.update({
        where: { FAQId: ansFAQ.FAQId },
        data: { UsageCount: { increment: 1 } },
    });

    //bubble structure
    const bubble = {
        type: "bubble",
        header: {
            type: "box",
            layout: "vertical",
            contents: [
                {
                    type: "text",
                    text: `Q: ${ansFAQ.Question}`,
                    weight: "bold",
                    wrap: true,
                    color: "#ffffff"
                },
            ],
            backgroundColor: "#0A4ECC",
        },
        body: {
            type: "box",
            layout: "vertical",
            contents: [
                {
                    type: "text",
                    text: `A: ${ansFAQ.Answer}`,
                    wrap: true
                },
            ],
        },
        footer: {
            type: "box",
            layout: "vertical",
            contents: [
                {
                    type: "button",
                    style: "secondary",
                    action: {
                        type: "postback",
                        label: "ย้อนกลับ",
                        data: "action=faq_menu",
                        displayText: "ย้อนกลับ",
                    },
                },
            ],
        },
    };

    return {
        type: "flex",
        altText: "คำตอบ FAQ",
        contents: bubble
    };
}


