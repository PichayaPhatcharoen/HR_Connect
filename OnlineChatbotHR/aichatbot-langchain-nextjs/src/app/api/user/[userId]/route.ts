import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import bcrypt from "bcrypt";
import path from "path";
import fs from "fs/promises";

export const runtime = "nodejs";

async function deleteIfExists(p: string) {
  try {
    await fs.unlink(p);
  } catch {}
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId: id } = await params;

  try {
    const user = await prisma.users.findUnique({
      where: { UserId: id },
      select: {
        UserId: true,
        Name: true,
        Title: true,
        Picture: true,
        Email: true,
        Phone: true,
        Username: true,
        Role: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: user.UserId,
      name: user.Name,
      title: user.Title,
      picture: user.Picture,
      email: user.Email,
      phone: user.Phone,
      username: user.Username,
      role: user.Role,
    });
  } catch (error: any) {
    console.error("Failed to fetch user:", error);
    return NextResponse.json(
      { error: "Failed to fetch user" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId: id } = await params;

  try {
    const form = await request.formData();
    const file = form.get("file") as File | null;

    const title = (form.get("title") as string)?.trim();
    const name = (form.get("name") as string)?.trim();
    const phone = (form.get("phone") as string)?.trim();
    const username = (form.get("username") as string)?.trim();
    const password = (form.get("password") as string)?.trim();
    const email = (form.get("email") as string)?.trim();
    const role = (form.get("role") as string)?.trim();

    // เช็คว่า user มีอยู่หรือไม่
    const existingUser = await prisma.users.findUnique({
      where: { UserId: id },
    });

    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // เช็คว่า username หรือ email มีอยู่แล้วหรือถูกใช้โดย user อื่นหรือไม่
    if (username && username !== existingUser.Username) {
      const usernameExists = await prisma.users.findFirst({
        where: {
          Username: username,
          UserId: { not: id },
        },
      });
      if (usernameExists) {
        return NextResponse.json(
          { error: "Username already exists" },
          { status: 409 }
        );
      }
    }

    if (email && email !== existingUser.Email) {
      const emailExists = await prisma.users.findFirst({
        where: {
          Email: email,
          UserId: { not: id },
        },
      });
      if (emailExists) {
        return NextResponse.json(
          { error: "Email already exists" },
          { status: 409 }
        );
      }
    }

    // เตรียมข้อมูลอัปเดต
    const updateData: any = {};
    if (title) updateData.Title = title;
    if (name) updateData.Name = name;
    if (phone) updateData.Phone = phone;
    if (username) updateData.Username = username;
    if (email) updateData.Email = email;
    if (role) updateData.Role = role;
    if (password && password.trim()) {
      updateData.Password = await bcrypt.hash(password, 12);
    }

    // จัดการอัปโหลดรูปภาพ (หากมี)
    if (file) {
      const mime = (file.type || "").toLowerCase();
      let ext: "png" | "jpg" | "webp" | "jpeg";
      if (mime === "image/png") ext = "png";
      else if (mime === "image/jpeg" || mime === "image/jpg") ext = "jpg";
      else if (mime === "image/webp") ext = "webp";
      else {
        return NextResponse.json(
          { error: `Unsupported file type: ${mime}. Only PNG, JPEG, and WebP are supported.` },
          { status: 400 }
        );
      }

      // Sanitize username  สำหรับ filename
      const safeUsername = (username || existingUser.Username)
        .replace(/[^\w.\-ก-๙\[\]\(\)]+/g, "_")
        .replace(/\s+/g, "_");
      const picturePath = `users/${id}-${safeUsername}.${ext}`;

      // ลบรูปเก่า (หากมี)
      if (existingUser.Picture && existingUser.Picture !== picturePath) {
        await deleteIfExists(path.join(process.cwd(), "public", existingUser.Picture));
      }

      // เขียนไฟล์ใหม่
      const buf = Buffer.from(await file.arrayBuffer());
      const dir = path.join(process.cwd(), "public", "users");
      await fs.mkdir(dir, { recursive: true });
      const fullPath = path.join(process.cwd(), "public", picturePath);
      await fs.writeFile(fullPath, buf);

      updateData.Picture = picturePath;
    }

    const updated = await prisma.users.update({
      where: { UserId: id },
      data: updateData,
      select: {
        UserId: true,
        Name: true,
        Title: true,
        Picture: true,
        Email: true,
        Phone: true,
        Username: true,
        Role: true,
      },
    });

    return NextResponse.json({
      id: updated.UserId,
      name: updated.Name,
      title: updated.Title,
      picture: updated.Picture,
      email: updated.Email,
      phone: updated.Phone,
      username: updated.Username,
      role: updated.Role,
    });
  } catch (error: any) {
    console.error("Failed to update user:", error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
      if (error.code === "P2002") {
        return NextResponse.json(
          { error: "Username or email already exists" },
          { status: 409 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to update user", details: String(error?.message || error) },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId: id } = await params;

  try {
    const existingUser = await prisma.users.findUnique({
      where: { UserId: id },
    });

    if (!existingUser) {
      return new NextResponse(null, { status: 204 });
    }

    // ลบไฟล์รูป (ถ้ามี)
    if (existingUser.Picture) {
      await deleteIfExists(path.join(process.cwd(), "public", existingUser.Picture));
    }

    await prisma.users.delete({
      where: { UserId: id },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error: any) {
    console.error("Failed to delete user:", error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return new NextResponse(null, { status: 204 });
      }
    }

    return NextResponse.json(
      { error: "Failed to delete user", details: String(error?.message || error) },
      { status: 500 }
    );
  }
}

