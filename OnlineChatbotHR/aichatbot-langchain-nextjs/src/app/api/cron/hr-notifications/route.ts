import { NextRequest, NextResponse } from "next/server";
import { runDailyHrNotifications } from "@/lib/scheduler";

function authorize(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      return false;
    }
    console.warn(
      "[cron/hr-notifications] No CRON_SECRET — allowed (development only)"
    );
    return true;
  }
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    await runDailyHrNotifications();
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[cron/hr-notifications]", e);
    return NextResponse.json(
      { error: "Job failed", detail: String(e) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
