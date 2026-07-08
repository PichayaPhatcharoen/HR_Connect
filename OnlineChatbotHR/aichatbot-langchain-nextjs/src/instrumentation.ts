import { startScheduler, runDailyHrNotifications } from "@/lib/scheduler";

export async function register() {
  console.log("Starting scheduler...");
  startScheduler();

  if (process.env.HR_NOTIFICATIONS_RUN_ON_START === "1") {
    void runDailyHrNotifications().catch((e) =>
      console.error("[scheduler] Run on start failed:", e)
    );
  }
}
