import schedule from "node-schedule";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { Resend } from "resend";
import { computeAcademicRetirementDateIsoFromDb } from "@/lib/academicRetirement";
import { resolveResendFromAddress } from "@/lib/resendFrom";

function getHrNotificationEmail(): string {
  const fromEnv = process.env.HR_NOTIFICATION_EMAIL?.trim();
  if (fromEnv) return fromEnv;
  return "hritkmitl@gmail.com";
}

async function sendResendEmail(
  resend: Resend,
  params: { from: string; to: string; subject: string; text: string }
): Promise<boolean> {
  try {
    const { data, error } = await resend.emails.send({
      from: params.from,
      to: params.to,
      subject: params.subject,
      text: params.text,
    });
    if (error) {
      console.error("[scheduler] Resend API returned error:", error);
      return false;
    }
    if (data?.id) {
      console.log("[scheduler] Resend message id:", data.id);
    }
    return true;
  } catch (e) {
    console.error("[scheduler] Resend send threw:", e);
    return false;
  }
}

export function startScheduler() {
  console.log("Scheduler initialized (daily at 00:00 server time)");

  schedule.scheduleJob("0 0 * * *", async () => {
    try {
      await runDailyHrNotifications();
    } catch (err) {
      console.error("[scheduler] Daily job failed:", err);
    }
  });
}

/** เรียกจาก cron (Vercel / ปุ่มเทส) หรือ HR_NOTIFICATIONS_RUN_ON_START */
export async function runDailyHrNotifications(): Promise<void> {
  console.log("[scheduler] Running HR notification job", new Date().toISOString());

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey?.trim()) {
    console.warn("[scheduler] Skip email: RESEND_API_KEY not set");
    return;
  }

  const resendFrom = resolveResendFromAddress(process.env.RESEND_FROM_EMAIL);
  const hrEmail = getHrNotificationEmail();
  const resend = new Resend(resendKey);
  const now = new Date();
  const twoMonthsLater = new Date();
  twoMonthsLater.setMonth(now.getMonth() + 2);

  const contracts = await prisma.employeeContracts.findMany({
    where: {
      IsActive: true,
      NotifiedHR: false,
      EndDate: {
        gte: now,
        lte: twoMonthsLater,
      },
      Employee: {
        StaffType: "SUPPORT",
        Status: "ACTIVE",
      },
    },
    include: {
      Employee: {
        include: {
          Position: {
            where: { EndDate: null },
            select: {
              SupportPosition: true,
              AcademicPosition: true,
            },
          },
        },
      },
    },
  });

  if (contracts.length > 0) {
    for (const contract of contracts) {
      const emp = contract.Employee;
      const position = emp.Position?.[0];
      const positionName =
        emp.StaffType === "SUPPORT"
          ? position?.SupportPosition
          : position?.AcademicPosition;

      console.log("[scheduler] Contract expiring email:", emp.FullName);

      const ok = await sendResendEmail(resend, {
        from: resendFrom,
        to: hrEmail,
        subject: "แจ้งเตือนบุคลากรใกล้ครบกำหนดสิ้นสุดสัญญาจ้าง",
        text: `
เรียน ฝ่ายทรัพยากรบุคคล

ชื่อ-นามสกุล: ${emp.FullName}
ประเภทบุคลากร: ${emp.StaffType}
ตำแหน่ง: ${positionName ?? "-"}

Email: ${emp.Email}

วันที่หมดสัญญา:
${contract.EndDate.toLocaleDateString("th-TH")}

จึงเรียนมาเพื่อโปรดพิจารณาดำเนินการในส่วนที่เกี่ยวข้อง
ระบบบริหารจัดการบุคลากร (HR System)
`,
      });

      if (ok) {
        await prisma.employeeContracts.update({
          where: { ContractId: contract.ContractId },
          data: { NotifiedHR: true },
        });
      }
    }
    console.log(`[scheduler] Processed ${contracts.length} contract notification(s)`);
  } else {
    console.log("[scheduler] No contracts expiring");
  }

  const academicPositionRows = (await prisma.positions.findMany({
    where: {
      AcademicPosition: { not: null },
      EndDate: null,
      AcademicRetirementNotifiedHR: false,
      Employee: {
        StaffType: "ACADEMIC",
        Status: "ACTIVE",
      },
    } as Prisma.PositionsWhereInput,
    include: {
      Employee: true,
    },
  })) as Array<{
    PositionId: string;
    Employee: {
      BirthDate: Date;
      FullName: string;
      Email: string;
      JobTitle: string | null;
    };
  }>;

  const retiringSoon = academicPositionRows.filter((row) => {
    const retireIso = computeAcademicRetirementDateIsoFromDb(row.Employee.BirthDate);
    if (!retireIso) return false;
    const retire = new Date(retireIso);
    return (
      retire.getTime() >= now.getTime() &&
      retire.getTime() <= twoMonthsLater.getTime()
    );
  });

  if (retiringSoon.length === 0) {
    console.log("[scheduler] No academic retirements in notification window");
    return;
  }

  for (const row of retiringSoon) {
    const emp = row.Employee;
    const retireIso = computeAcademicRetirementDateIsoFromDb(emp.BirthDate)!;
    console.log("[scheduler] Retirement email:", emp.FullName);

    const ok = await sendResendEmail(resend, {
      from: resendFrom,
      to: hrEmail,
      subject: "แจ้งเตือนบุคลากรสายวิชาการใกล้ถึงวันเกษียณอายุ",
      text: `
เรียน ฝ่ายทรัพยากรบุคคล

ชื่อ-นามสกุล: ${emp.FullName}
สายงาน: สายวิชาการ
ตำแหน่งงาน: ${emp.JobTitle?.trim() || "-"}

Email: ${emp.Email}

วันเกษียณอายุ (60 ปีบริบูรณ์ ณ 30 ก.ย. ตามปีงบประมาณ):
${new Date(retireIso).toLocaleDateString("th-TH")}

จึงเรียนมาเพื่อโปรดพิจารณาดำเนินการในส่วนที่เกี่ยวข้อง
ระบบบริหารจัดการบุคลากร (HR System)
`,
    });

    if (ok) {
      await prisma.positions.update({
        where: { PositionId: row.PositionId },
        data: { AcademicRetirementNotifiedHR: true } as Prisma.PositionsUpdateInput,
      });
    }
  }

  console.log(
    `[scheduler] Processed ${retiringSoon.length} retirement notification(s)`
  );
}
