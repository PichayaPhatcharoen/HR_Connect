import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function PUT(request: NextRequest) {
  try {
    const session = await auth();

    console.log("PUT Session:", session);
    console.log("PUT Session user id:", session?.user?.id);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { isOnline } = await request.json();
    console.log("PUT isOnline:", isOnline);
    if (typeof isOnline !== "boolean") {
      return NextResponse.json(
        { error: "isOnline must be a boolean" },
        { status: 400 }
      );
    }


    if (!session.user.username) {
      return NextResponse.json(
        { error: "Username not found in session" },
        { status: 400 }
      );
    }


    const existingUser = await prisma.users.findUnique({
      where: { Username: session.user.username },
      select: { UserId: true, Username: true },
    });

    if (!existingUser) {
      console.error("User not found in database with username:", session.user.username);
      return NextResponse.json(
        { error: "User not found in database" },
        { status: 404 }
      );
    }

    const updatedUser = await prisma.users.update({
      where: { Username: session.user.username },
      data: { IsOnline: isOnline },
      select: {
        UserId: true,
        Name: true,
        IsOnline: true,
      },
    });

    return NextResponse.json({
      message: `Status updated to ${isOnline ? "Online" : "Offline"}`,
      user: {
        id: updatedUser.UserId,
        name: updatedUser.Name,
        isOnline: updatedUser.IsOnline,
      },
    });
  } catch (error: any) {
    console.error("[/api/user/online-status] PUT ERROR:", error);
    console.error("Error code:", error?.code);
    console.error("Error message:", error?.message);


    if (error?.code === "P2025") {
      return NextResponse.json(
        {
          error: "User not found in database",
          details: "The user ID from session does not exist in the database",
          code: error?.code
        },
        { status: 404 }
      );
    }


    if (error?.code === "P2009" || error?.message?.includes("Unknown field") || error?.message?.includes("isOnline")) {
      return NextResponse.json(
        {
          error: "Database schema error. Please run: npx prisma migrate dev && npx prisma generate",
          details: error.message,
          code: error?.code
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        error: "Error updating online status",
        details: error?.message || String(error),
        code: error?.code || "UNKNOWN"
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const session = await auth();

    console.log("GET Session:", session);
    console.log("GET Session user id:", session?.user?.id);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }


    if (!session.user.username) {
      return NextResponse.json(
        { error: "Username not found in session", isOnline: false },
        { status: 400 }
      );
    }

    const user = await prisma.users.findUnique({
      where: { Username: session.user.username },
      select: {
        UserId: true,
        Name: true,
        IsOnline: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found", isOnline: false },
        { status: 404 }
      );
    }

    return NextResponse.json({ isOnline: user.IsOnline });
  } catch (error: any) {
    console.error("[/api/user/online-status] ERROR:", error);


    if (error?.code === "P2009" || error?.message?.includes("Unknown field")) {
      return NextResponse.json(
        {
          error: "Database schema error. Please run: npx prisma migrate dev",
          details: error.message,
          isOnline: false
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        error: "Error fetching online status",
        details: error?.message || String(error),
        isOnline: false
      },
      { status: 500 }
    );
  }
}

