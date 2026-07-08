import { NextResponse } from "next/server"

export const runtime = "nodejs"

const LINE_QUOTA_API = "https://api.line.me/v2/bot/message/quota"
const LINE_QUOTA_CONSUMPTION_API = "https://api.line.me/v2/bot/message/quota/consumption"
const LINE_FOLLOWERS_API = "https://api.line.me/v2/bot/insight/followers"

export type LineQuotaResponse = {
  type: "limited" | "none"
  value?: number  // Monthly message limit (เฉพาะ type "limited")
}

export type LineInsightFollowersResponse = {
  overview: {
    requestId?: string
    timestamp?: number
    delivered?: number
    uniqueImpression?: number
    uniqueClick?: number
    uniqueMediaPlayed?: number
    uniqueMediaPlayed100Percent?: number
  }
  messages?: Array<{
    seq?: number
    name?: string
    values?: Array<{
      period?: string
      value?: number
    }>
  }>
  // follower count 
  followers?: number
  targetedReaches?: number
  blocks?: number
}

export type LineQuotaConsumptionResponse = {
  totalUsage: number  // นับข้อความที่ส่่งไปแล้วในเดือนนี้
}

export type LineQuotaInfo = {
  limit: number | null  // null = unlimited (paid plan)
  used: number
  remaining: number | null  // null = unlimited
  percentageUsed: number | null
  costPerBroadcast: number  
  followersCount: number // จำนวนเพื่อนในไลน์
  isLimited: boolean
}

export async function GET() {
  try {
    const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN

    if (!channelAccessToken) {
      return NextResponse.json(
        { error: "LINE_CHANNEL_ACCESS_TOKEN not configured" },
        { status: 500 }
      )
    }

    // รับวันที่ YYYYMMdd format สำหรับ insight API
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, "")

    // Fetch quota จำนวนการใช้งานและ followers insight แบบ parallel
    const [quotaRes, consumptionRes, followersRes] = await Promise.all([
      fetch(LINE_QUOTA_API, {
        headers: {
          Authorization: `Bearer ${channelAccessToken}`,
        },
      }),
      fetch(LINE_QUOTA_CONSUMPTION_API, {
        headers: {
          Authorization: `Bearer ${channelAccessToken}`,
        },
      }),
      fetch(`${LINE_FOLLOWERS_API}?date=${today}`, {
        headers: {
          Authorization: `Bearer ${channelAccessToken}`,
        },
      }),
    ])

    if (!quotaRes.ok) {
      const err = await quotaRes.text()
      console.error("LINE Quota API error:", err)
      return NextResponse.json(
        { error: "Failed to fetch LINE quota" },
        { status: 500 }
      )
    }

    if (!consumptionRes.ok) {
      const err = await consumptionRes.text()
      console.error("LINE Quota Consumption API error:", err)
      return NextResponse.json(
        { error: "Failed to fetch LINE quota consumption" },
        { status: 500 }
      )
    }

    const quotaData: LineQuotaResponse = await quotaRes.json()
    const consumptionData: LineQuotaConsumptionResponse = await consumptionRes.json()
    
    // fallback เป็น 0 ถ้า Followers insight ล้มเหลวหรือไม่มีข้อมูล
    let followersCount = 0
    if (followersRes.ok) {
      const followersData: LineInsightFollowersResponse = await followersRes.json()
      followersCount = followersData.followers ?? 0
    } else {
      const err = await followersRes.text()
      console.warn("LINE Followers Insight API failed:", err)
    }

    // คำนวณข้อมูล quota
    const isLimited = quotaData.type === "limited"
    const limit = isLimited ? (quotaData.value ?? 0) : null
    const used = consumptionData.totalUsage ?? 0
    const remaining = isLimited ? Math.max(0, (limit ?? 0) - used) : null
    const percentageUsed = isLimited && limit ? Math.round((used / limit) * 100) : null

    const quotaInfo: LineQuotaInfo = {
      limit,
      used,
      remaining,
      percentageUsed,
      costPerBroadcast: followersCount, // quota ต่อการส่งข้อความ = จำนวนเพื่อน
      followersCount,
      isLimited,
    }

    return NextResponse.json(quotaInfo)
  } catch (error) {
    console.error("LINE Quota error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
