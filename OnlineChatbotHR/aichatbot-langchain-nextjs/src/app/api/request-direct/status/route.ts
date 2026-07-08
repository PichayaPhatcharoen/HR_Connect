import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { DirectContact_Request_Status } from "@prisma/client";

const LINE_MESSAGING_API = "https://api.line.me/v2/bot";
const LINE_HEADER = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
};

type LineMessage = { type: "text"; text: string };

async function pushMessage(userId: string, payload: LineMessage[] | LineMessage) {
  const messages = Array.isArray(payload) ? payload : [payload];

  try {
    const response = await fetch(LINE_MESSAGING_API + "/message/push", {
      method: "POST",
      headers: LINE_HEADER,
      body: JSON.stringify({
        to: userId,
        messages,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("LINE push message error:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Failed to send LINE push message:", error);
    return false;
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const id = typeof body?.id === "string" ? body.id.trim() : "";
    const status = body?.status;

    if (!id) {
      return NextResponse.json({ error: "Missing request id" }, { status: 400 });
    }
    if (status !== "ACCEPTED" && status !== "ENDING") {
      return NextResponse.json(
        { error: "Invalid status. Use ACCEPTED or ENDING" },
        { status: 400 }
      );
    }

    const session = await auth();
    const sessionUserId = session?.user?.id;
    const updateData: {
      Status: DirectContact_Request_Status;
      UserId?: string;
    } = {
      Status: status as DirectContact_Request_Status,
    };
    // Only set UserId if it exists in Users (avoids foreign key violation)
    if (sessionUserId) {
      const userExists = await prisma.users.findUnique({
        where: { UserId: sessionUserId },
        select: { UserId: true },
      });
      if (userExists) {
        updateData.UserId = sessionUserId;
      }
    }

    const updatedRequest = await prisma.directContact_Requests.update({
      where: { DirectContactRequestId: id },
      data: updateData,
      select: {
        DirectContactRequestId: true,
        LineUserId: true,
        Status: true,
      },
    });

    if (updatedRequest.LineUserId) {
      let notificationMessage = "";

      if (status === "ACCEPTED") {
        notificationMessage = "เจ้าหน้าที่ตอบรับคำขอสนทนาโดยตรงของท่านเรียบร้อยแล้ว ขณะนี้ท่านกำลังสนทนาอยู่กับเจ้าหน้าที่โดยตรง";
      } else if (status === "ENDING") {
        notificationMessage = "ขณะนี้เจ้าหน้าที่ได้จบการสนทนาโดยตรงเรียบร้อยแล้ว ตอนนี้ท่านกำลังสนทนาอยู่กับ HR Chatbot";
      }

      if (notificationMessage) {
        await pushMessage(updatedRequest.LineUserId, {
          type: "text",
          text: notificationMessage,
        });
      }
    }

    return NextResponse.json({
      message: status === "ACCEPTED" ? "Status changed to Accepted" : "Status changed to ENDING",
    });
  } catch (error: unknown) {
    console.error("[/api/request-direct/status] ERROR:", error);
    const message = error instanceof Error ? error.message : "Error updating status";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}   
