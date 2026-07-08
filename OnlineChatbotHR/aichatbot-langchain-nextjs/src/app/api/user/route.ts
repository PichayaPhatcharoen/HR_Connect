import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const users = await prisma.users.findMany({
      select: {
        UserId: true,
        Name: true,
        Title: true,
        Picture: true,
        Email: true,
        Role: true,
      },
      orderBy: {
        Name: "asc",
      },
    });

    // Map ตาม format ที่ต้องใช้
    const mappedUsers = users.map(u => ({
      id: u.UserId,
      name: u.Name,
      title: u.Title,
      picture: u.Picture,
      email: u.Email,
      role: u.Role,
    }));

    return NextResponse.json(mappedUsers);
  } catch (error: any) {
    console.error("Failed to fetch users:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}






