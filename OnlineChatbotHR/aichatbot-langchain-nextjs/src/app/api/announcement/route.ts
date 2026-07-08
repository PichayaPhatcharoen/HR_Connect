import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import path from "path"
import fs from "fs/promises"
import { generateSequentialUploadName } from "@/lib/sequentialUploadName"

export const runtime = "nodejs"

// GET announcements
export async function GET() {
    const docs = await prisma.announcements.findMany({
        orderBy: { CreatedAt: "desc" },
        select: {
            AnnouncementId: true,
            Title: true,
            Content: true,
            Link: true,
            Picture: true,
            CreatedAt: true,
            Status: true,
            Position: true,
            IsLatest: true,
            UserId: true,
        },
    })
    // Map to expected format
    const mappedDocs = docs.map(d => ({
        id: d.AnnouncementId,
        title: d.Title,
        content: d.Content,
        link: d.Link,
        picture: d.Picture,
        createdAt: d.CreatedAt,
        status: d.Status,
        position: d.Position,
        isLatest: d.IsLatest,
        userId: d.UserId,
    }));
    return NextResponse.json(mappedDocs)
}

export async function POST(req: NextRequest) {
    const session = await auth()
    const userId = session?.user?.id
    //for debug
    // const headerDump: Record<string,string> = {}
    // req.headers.forEach((v, k) => headerDump[k] = v)

    // console.log("headers:", headerDump)
    // const ct = req.headers.get("content-type") || ""
    // console.log("content-type:", ct)

    try {
        const form = await req.formData()
        const file = form.get("file") as File | null
        if (!file) {
            return NextResponse.json({ error: "Error! you cannot submit without document" }, { status: 400 })
        }


        // รับชื่อจากฟอร์ม/ไฟล์จริง - เก็บ original ไว้สำหรับ title ในฐานข้อมูล
        const originalTitle = (form.get("title") as string)?.trim() || file.name

        const content = (form.get("content") as string)?.trim()
        const link = (form.get("link") as string)?.trim() || null

        const rawStatus = ((form.get("status") as string) || "ACTIVE").toUpperCase()
        const status = rawStatus === "INACTIVE" ? "INACTIVE" : "ACTIVE"

        const rawPosition = (form.get("position") as string) || "TOP"
        const allowedPositions = ["TOP", "MIDDLE", "LEFT", "RIGHT"] as const
        const position = (allowedPositions.includes(rawPosition as any) ? rawPosition : "TOP") as (typeof allowedPositions)[number]

        const isLatest = (form.get("isLatest") as string) === "true"

        // สร้าง row -> เอา id ไปตั้งชื่อ picture
        const created = await prisma.announcements.create({
            data: {
                Title: originalTitle,  // ใช้ชื่อเดิม ไม่แทนที่ whitespace
                Picture: `waitingfor_id`,
                Content: content,
                Link: link,
                Status: status,
                Position: position,
                IsLatest: isLatest,
                UserId: userId || null,
            },
            select: {
                AnnouncementId: true,
            },
        })


        const typecheck = (file.type).toLocaleLowerCase()
        let ext: string | null
        switch (typecheck) {
            case "image/png":
                ext = "png"
                break
            case "image/jpeg":
                ext = "jpg"
                break
            case "image/webp":
                ext = "webp"
                break
            default:
                return NextResponse.json(
                    { error: `Unsupported file type: ${typecheck}` },
                    { status: 400 }
                )
        }

        const annDir = path.join(process.cwd(), "public", "uploads", "Announcements")
        await fs.mkdir(annDir, { recursive: true })
        
        const sequentialFileName = await generateSequentialUploadName(
            annDir,
            "Announcements",
            ext
        )
        const picture = `uploads/Announcements/${sequentialFileName}`

        try {
            // เขียนไฟล์ลง public/uploads/Announcements/<id-safetitle>
            const buf = Buffer.from(await file.arrayBuffer())
            const fullPath = path.join(process.cwd(), "public", picture)
            await fs.writeFile(fullPath, buf)


            // อัปเดตDB ให้ใส่ picture
            const updated = await prisma.announcements.update({
                where: { AnnouncementId: created.AnnouncementId },
                data: {
                    Picture: picture,
                },
                select: {
                    AnnouncementId: true,
                    Title: true,
                    Picture: true,
                    Content: true,
                    CreatedAt: true,
                },
            })
            return NextResponse.json({
                id: updated.AnnouncementId,
                title: updated.Title,
                picture: updated.Picture,
                content: updated.Content,
                createdAt: updated.CreatedAt,
            }, { status: 201 })


        } catch (fileError) {
            await prisma.announcements.delete({
                where: { AnnouncementId: created.AnnouncementId },
            })
            throw fileError
        }


    } catch (err: any) {
        console.error("ERROR AS JSON:", JSON.stringify(err, null, 2))
        return NextResponse.json({ error: "Failed to announce document", details: err }, { status: 500 })
    }
}