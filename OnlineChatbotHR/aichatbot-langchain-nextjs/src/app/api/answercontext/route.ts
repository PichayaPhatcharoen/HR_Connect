import { NextRequest, NextResponse } from "next/server"
import { answerWithSearch } from "@/lib/chatbot"
import { UIMessage } from "ai"

export const runtime = "nodejs"
export const maxDuration = 300

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const messages: UIMessage[] = body.messages

    // Get session ID จาก header หรือสร้าง anonymous session
    const sessionId = req.headers.get("x-session-id") || `anonymous-${Date.now()}`

    return (await answerWithSearch(
      { messages, stream: true },
      { sessionId }
    )) as Response
  } catch (error) {
    console.error("chat error:", error)
    return NextResponse.json({ error: "Sorry, there's an error occurred!" }, { status: 500 })
  }
}
