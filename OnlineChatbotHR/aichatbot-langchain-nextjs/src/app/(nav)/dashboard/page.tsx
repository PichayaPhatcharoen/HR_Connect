"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { HiUserGroup } from "react-icons/hi2";
import { BsGraphUpArrow } from "react-icons/bs";
import { GiJusticeStar } from "react-icons/gi";
import { GoGoal } from "react-icons/go";
import { TbClipboardSmile } from "react-icons/tb";

const Card = ({ icon, title }: { icon: ReactNode; title: ReactNode }) => (
  <div className="mx-auto relative flex h-[200px] w-full max-w-[240px] flex-col items-center justify-center rounded-xl bg-[#DAEBFF] shadow-md ring-1 ring-black/5 pb-4 md:pb-6">
    <div className="text-5xl text-black/80">{icon}</div>
    <div className="absolute bottom-4 md:bottom-6 px-3 text-center text-base font-semibold text-black">
      {title}
    </div>
  </div>
);

export default function page() {
  return (
    <div className="mb-8">
      <div className="flex flex-col gap-y-1 p-8 md:px-16 md:py-8">
        <h1 className="text-4xl font-bold text-blueit">
          แดชบอร์ดฝ่ายบริหารทรัพยากรบุคคล
        </h1>
        <h3 className="text-xl font-bold text-black">
          Human Resources Dashboard
        </h3>
      </div>
      <div className="mx-auto w-full max-w-3xl px-10">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <Link href="/dashboard/zoneA">
            <Card
              icon={<HiUserGroup />}
              title={<>ข้อมูลภาพรวม
              <br />
              และจำนวนบุคลากร</>}
            />
          </Link>

          <Link href="/dashboard/zoneB">
            <Card
              icon={<BsGraphUpArrow />}
              title={<>การอบรมและพัฒนาทักษะของบุคลากร</>}
            />
          </Link>
          <Link href="/dashboard/zoneC">
            <Card
              icon={<GiJusticeStar />}
              title={<>ข้อมูลการรับเครื่องราชอิสริยาภรณ์</>}
            />
          </Link>
          <Link href="/dashboard/zoneD">
            <Card icon={<GoGoal />} title={<>KPI ตามปีงบประมาณ</>} />
          </Link>
          <Link href="/dashboard/zoneE">
            <Card icon={<GoGoal />} title={<>KPI ตามปีการศึกษา</>} />
          </Link>
          <Link href="/dashboard/zoneF">
            <Card
              icon={<TbClipboardSmile />}
              title={<>การประเมินความพึงพอใจ</>}
            />
          </Link>
        </div>
      </div>
    </div>
  );
}
