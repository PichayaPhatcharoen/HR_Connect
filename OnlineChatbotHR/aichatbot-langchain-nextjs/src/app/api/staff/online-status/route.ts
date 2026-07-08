import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // ตรวจสอบว่ามีสตาฟ/adminอย่างน้อย 1 คน(STAFF or ADMIN role)ที่ online หรือไม่
    const onlineStaff = await prisma.users.findFirst({
      where: {
        Role: {
          in: ["STAFF", "ADMIN"],
        },
        IsOnline: true,
      },
      select: {
        UserId: true,
      },
    });

    const hasOnlineStaff = !!onlineStaff;

    return NextResponse.json({
      isOnline: hasOnlineStaff,
      message: hasOnlineStaff ? "Online" : "Offline",
    });
  } catch (error: any) {
    console.error("[/api/staff/online-status] ERROR:", error);
    console.error("Error details:", error?.message, error?.code);

    // Fallback ถ้าเกิด error -> Return offline status แทน
    return NextResponse.json({
      isOnline: false,
      message: "Offline",
      error: error?.message || "Error checking staff online status",
    });
  }
}


