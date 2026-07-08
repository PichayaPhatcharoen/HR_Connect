import { NextRequest, NextResponse } from "next/server";
import { UserRole, Usertitle } from "@prisma/client";
import path from "path";
import fs from "fs/promises";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";

const USERTITLE_SET = new Set<string>(Object.values(Usertitle));
const USER_ROLE_SET = new Set<string>(Object.values(UserRole));
const TITLE_TH_TO_ENUM: Record<string, Usertitle> = {
  "นาย": Usertitle.MR,
  "นาง": Usertitle.MRS,
  "นางสาว": Usertitle.MISS,
};
const TITLE_EN_TO_ENUM: Record<string, Usertitle> = {
  MR: Usertitle.MR,
  MRS: Usertitle.MRS,
  MISS: Usertitle.MISS,
  MS: Usertitle.MISS,
};

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();

    const title = (form.get("title") as string)?.trim();
    const name = (form.get("name") as string)?.trim();
    const phone = (form.get("phone") as string)?.trim();
    const username = (form.get("username") as string)?.trim();
    const password = (form.get("password") as string)?.trim();
    const email = (form.get("email") as string)?.trim();
    const role = (form.get("role") as string)?.trim();
    const file = form.get("file") as File | null;

    if (!title || !name || !phone || !username || !password || !email || !role) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const normalizedTitle = title.replace(/\./g, "").trim();
    const mappedTitle =
      TITLE_TH_TO_ENUM[normalizedTitle] ??
      TITLE_EN_TO_ENUM[normalizedTitle.toUpperCase()] ??
      normalizedTitle;
    const titleKey = mappedTitle.toUpperCase();
    const roleKey = role.toUpperCase();
    if (!USERTITLE_SET.has(titleKey)) {
      return NextResponse.json(
        { error: "Invalid title", allowed: [...USERTITLE_SET] },
        { status: 400 }
      );
    }
    if (!USER_ROLE_SET.has(roleKey)) {
      return NextResponse.json(
        { error: "Invalid role", allowed: [...USER_ROLE_SET] },
        { status: 400 }
      );
    }
    const Title = titleKey as Usertitle;
    const Role = roleKey as UserRole;

    const existUser = await prisma.users.findFirst({
      where: {
        OR: [{ Username: username }, { Email: email }],
      },
    });

    if (existUser) {
      return NextResponse.json({ error: "Username or email already exists" }, { status: 409 });
    }
    const created = await prisma.users.create({
      data: {
        Title: Title,
        Name: name,
        Phone: phone,
        Username: username,
        Password: await bcrypt.hash(password, 12),
        Email: email,
        Role: Role,
        Picture: null,
      },
      select: {
        UserId: true,
      },
    });

    if (file) {
      const mime = (file.type || "").toLowerCase();
      let ext: "png" | "jpg" | "webp" | "jpeg";
      if (mime === "image/png") ext = "png";
      else if (mime === "image/jpeg" || mime === "image/jpg") ext = "jpg";
      else if (mime === "image/webp") ext = "webp";
      else {
        await prisma.users.delete({ where: { UserId: created.UserId } });
        return NextResponse.json(
          { error: `Unsupported file type: ${mime}. Only PNG, JPEG, and WebP are supported.` },
          { status: 400 }
        );
      }

      const safeUsername = username.replace(/[^\w.\-ก-๙\[\]\(\)]+/g, "_").replace(/\s+/g, "_");
      const picturePath = `users/${created.UserId}-${safeUsername}.${ext}`;

      try {
        const buf = Buffer.from(await file.arrayBuffer());
        const dir = path.join(process.cwd(), "public", "users");
        await fs.mkdir(dir, { recursive: true });
        const fullPath = path.join(process.cwd(), "public", picturePath);
        await fs.writeFile(fullPath, buf);

        await prisma.users.update({
          where: { UserId: created.UserId },
          data: { Picture: picturePath },
        });
      } catch (fileError) {
        await prisma.users.delete({ where: { UserId: created.UserId } });
        throw fileError;
      }
    }

    return NextResponse.json({ message: "User created successfully" }, { status: 201 });
  } catch (err: any) {
    console.error("Failed to create user:", err);
    return NextResponse.json(
      { error: "Failed to create user", details: String(err?.message || err) },
      { status: 500 }
    );
  }
}
