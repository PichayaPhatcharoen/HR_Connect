import { NextResponse } from "next/server"

export const runtime = "nodejs"

const POSITION_OPTIONS = ["TOP", "MIDDLE", "LEFT", "RIGHT"] as const
const STATUS_OPTIONS = ["ACTIVE", "INACTIVE"] as const

export async function GET() {
    return NextResponse.json({
        positionOptions: [...POSITION_OPTIONS],
        statusOptions: [...STATUS_OPTIONS],
    })
}
