const LINE_MESSAGING_API = "https://api.line.me/v2/bot"
const LINE_HEADER = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
}

export type LineMessage =
  | { type: "text"; text: string }
  | { type: "flex"; altText: string; contents: any }
  | { type: "sticker"; packageId: string; stickerId: string }

export async function fetchLineProfile(userId: string) {
  try {
    const res = await fetch(
      `https://api.line.me/v2/bot/profile/${userId}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
        },
      }
    )

    if (!res.ok) {
      throw new Error(`Profile fetch failed: ${res.status}`)
    }

    const profile = await res.json()

    return {
      displayName: profile.displayName || "LINE User",
      pictureUrl: profile.pictureUrl || null,
    }
  } catch (err) {
    console.warn("Cannot fetch LINE profile:", err)
    return {
      displayName: "LINE User",
      pictureUrl: null,
    }
  }
}

export async function reply(token: string, payload: LineMessage[] | LineMessage) {
    const replymessage = Array.isArray(payload) ? payload : [payload]
    const body = {
        replyToken: token,
        messages: replymessage,
    }
    const response = await fetch(LINE_MESSAGING_API + "/message/reply", {
        method: "POST",
        headers: LINE_HEADER,
        body: JSON.stringify(body),
    })

    if (!response.ok) {
        const errorData = await response.json()
        console.error("[LINE REPLY ERROR]", {
            status: response.status,
            statusText: response.statusText,
            error: errorData,
            sentPayload: JSON.stringify(body, null, 2)
        })
    }
    return response
}

export async function multicast(
  userIds: string[],
  payload: LineMessage[] | LineMessage
) {
    const messages = Array.isArray(payload) ? payload : [payload]
    const CHUNK_SIZE = 500
    const results = []

    for (let i = 0; i < userIds.length; i += CHUNK_SIZE) {
        const chunk = userIds.slice(i, i + CHUNK_SIZE)
        try {
            const res = await fetch(
                LINE_MESSAGING_API + "/message/multicast",
                {
                    method: "POST",
                    headers: LINE_HEADER,
                    body: JSON.stringify({
                        to: chunk,
                        messages,
                    }),
                }
            )

            if (!res.ok) {
                const err = await res.json()
                console.error("Multicast error:", err)
                results.push({ success: false, error: err })
            } else {
                results.push({ success: true, count: chunk.length })
            }
        } catch (e: any) {
            console.error("Multicast exception:", e)
            results.push({ success: false, error: e.message })
        }
    }

    return results
}
