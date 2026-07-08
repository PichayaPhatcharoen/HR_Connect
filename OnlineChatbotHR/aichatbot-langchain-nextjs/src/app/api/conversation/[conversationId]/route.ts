import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { ConversationStatus } from "@prisma/client"

export const runtime = "nodejs"

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const { conversationId } = await params
    const body = await req.json()
    const { status } = body

    if (!conversationId) {
      return NextResponse.json(
        { error: "Conversation ID is required" },
        { status: 400 }
      )
    }

    if (!status || !Object.values(ConversationStatus).includes(status)) {
      return NextResponse.json(
        { error: "Valid status is required (OPEN or CLOSED)" },
        { status: 400 }
      )
    }

    // Update conversation status
    const conversation = await prisma.conversations.update({
      where: { ConversationId: conversationId },
      data: { 
        Status: status,
        UpdatedAt: new Date()
      }
    })

    return NextResponse.json({
      success: true,
      conversationId: conversation.ConversationId,
      status: conversation.Status,
      message: `Conversation ${status.toLowerCase()} successfully`
    })

  } catch (error: any) {
    console.error("Failed to update conversation status:", error)
    return NextResponse.json(
      { 
        error: "Failed to update conversation status",
        details: error?.message || String(error)
      },
      { status: 500 }
    )
  }
}
