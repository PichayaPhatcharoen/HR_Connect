import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import path from "path"
import fs from "fs/promises"
import { generateSequentialUploadName } from "@/lib/sequentialUploadName"

export const runtime = "nodejs"

async function deleteIfExists(p: string) {
  try { await fs.unlink(p) } catch {}
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ announceId: string }> }
) {
  const { announceId: id } = await params
  const ann = await prisma.announcements.findUnique({ where: { AnnouncementId: id } })
  if (!ann) return NextResponse.json({ error: "not found" }, { status: 404 })
  return NextResponse.json({
    id: ann.AnnouncementId,
    title: ann.Title,
    content: ann.Content,
    picture: ann.Picture,
    link: ann.Link,
    status: ann.Status,
    position: ann.Position,
    isLatest: ann.IsLatest,
    createdAt: ann.CreatedAt,
  })
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ announceId: string }> }
) {
  const { announceId: id } = await params
  const existing = await prisma.announcements.findUnique({ where: { AnnouncementId: id } })
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 })

  try {
    const form = await req.formData()
    const file = form.get("file") as File | null

    const nextTitle =
      (form.get("title") as string)?.trim() || existing.Title || ""
    const nextContent =
      (form.get("content") as string)?.trim() ?? existing.Content ?? null
    const nextLink = (form.get("link") as string)?.trim() || null


    const rawPosition = (form.get("position") as string) || existing.Position || "TOP"
    const allowedPositions = ["TOP", "MIDDLE", "LEFT", "RIGHT"] as const
    const nextPosition = (allowedPositions.includes(rawPosition as any) ? rawPosition : existing.Position || "TOP") as (typeof allowedPositions)[number]

    const nextIsLatest = (form.get("isLatest") as string) === "true"

    const rawStatus = ((form.get("status") as string) || existing.Status || "ACTIVE").toUpperCase()
    const nextStatus = rawStatus === "INACTIVE" ? "INACTIVE" : "ACTIVE"

    if (!file) {
      const updated = await prisma.announcements.update({
        where: { AnnouncementId: id },
        data: { 
          Title: nextTitle, 
          Content: nextContent,
          Link: nextLink,
          Position: nextPosition,
          Status: nextStatus,
          IsLatest: nextIsLatest,
        },
        select: { AnnouncementId: true, Title: true, Content: true, Picture: true, CreatedAt: true, Position: true, Status: true, IsLatest: true},
      })
      return NextResponse.json({
        id: updated.AnnouncementId,
        title: updated.Title,
        content: updated.Content,
        picture: updated.Picture,
        createdAt: updated.CreatedAt,
        position: updated.Position,
        status: updated.Status,
        isLatest: updated.IsLatest,
      })
    }

    const mime = (file.type || "").toLowerCase()
    let ext: "png" | "jpg" | "webp"
    if (mime === "image/png") ext = "png"
    else if (mime === "image/jpeg") ext = "jpg"
    else if (mime === "image/webp") ext = "webp"
    else return NextResponse.json({ error: `Unsupported file type: ${mime}` }, { status: 400 })

    const annDir = path.join(process.cwd(), "public", "uploads", "Announcements")
    await fs.mkdir(annDir, { recursive: true })
    
    const sequentialFileName = await generateSequentialUploadName(
      annDir,
      "Announcements",
      ext
    )
    const picture = `uploads/Announcements/${sequentialFileName}`

    const buf = Buffer.from(await file.arrayBuffer())
    await fs.mkdir(annDir, { recursive: true })

    if (existing.Picture && existing.Picture !== picture) {
      await deleteIfExists(path.join(process.cwd(), "public", existing.Picture))
    }
    await fs.writeFile(path.join(process.cwd(), "public", picture), buf)

    const updated = await prisma.announcements.update({
      where: { AnnouncementId: id },
      data: { 
        Title: nextTitle, 
        Content: nextContent, 
        Link: nextLink,
        Picture: picture,
        Position: nextPosition,
        Status: nextStatus,
        IsLatest: nextIsLatest,
      },
      select: { AnnouncementId: true, Title: true, Content: true, Picture: true, CreatedAt: true, Position: true, Status: true, IsLatest: true},
    })
    return NextResponse.json({
      id: updated.AnnouncementId,
      title: updated.Title,
      content: updated.Content,
      picture: updated.Picture,
      createdAt: updated.CreatedAt,
      position: updated.Position,
      status: updated.Status,
      isLatest: updated.IsLatest,
    })
  } catch (e: any) {
    console.error("ANN UPDATE ERROR:", e)
    return NextResponse.json({ error: "update failed", details: String(e?.message || e) }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ announceId: string }> }
) {
  const { announceId: id } = await params
  const existing = await prisma.announcements.findUnique({ where: { AnnouncementId: id } })
  if (!existing) return new NextResponse(null, { status: 204 })

  try {
    if (existing.Picture) {
      await deleteIfExists(path.join(process.cwd(), "public", existing.Picture))
    }
    await prisma.announcements.delete({ where: { AnnouncementId: id } })
    return new NextResponse(null, { status: 204 })
  } catch (e: any) {
    console.error("ANN DELETE ERROR:", e)
    return NextResponse.json({ error: "delete failed", details: String(e?.message || e) }, { status: 500 })
  }
}