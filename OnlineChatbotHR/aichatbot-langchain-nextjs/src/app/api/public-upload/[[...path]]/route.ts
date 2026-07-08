import { NextRequest, NextResponse } from "next/server"
import path from "path"
import fs from "fs/promises"

export const runtime = "nodejs"

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
  ".ico": "image/x-icon",
}

/** เสิร์ฟไฟล์ใต้ public/uploads และ public/users แบบอ่านจากดิสก์ทุกครั้ง — แก้กรณี Docker/production ที่รูปหลังอัปโหลดไม่ขึ้นผ่าน static file */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const { path: segments } = await params
  if (!segments?.length) {
    return new NextResponse("Not found", { status: 404 })
  }

  if (segments.some((s) => s === ".." || s === ".")) {
    return new NextResponse("Forbidden", { status: 403 })
  }

  const first = segments[0]
  if (first !== "uploads" && first !== "users") {
    return new NextResponse("Forbidden", { status: 403 })
  }

  const root = path.resolve(process.cwd(), "public")
  const resolved = path.resolve(root, ...segments)
  const relative = path.relative(root, resolved)
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return new NextResponse("Forbidden", { status: 403 })
  }

  try {
    const stat = await fs.stat(resolved)
    if (!stat.isFile()) return new NextResponse("Not found", { status: 404 })
    const buf = await fs.readFile(resolved)
    const ext = path.extname(resolved).toLowerCase()
    const contentType = MIME[ext] ?? "application/octet-stream"
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=0, must-revalidate",
      },
    })
  } catch {
    return new NextResponse("Not found", { status: 404 })
  }
}
