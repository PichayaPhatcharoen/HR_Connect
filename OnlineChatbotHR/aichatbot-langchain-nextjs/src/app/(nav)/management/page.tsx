"use client";

import { AiFillNotification } from "react-icons/ai";
import { FaUserCog } from "react-icons/fa";
import React from "react";
import Link from "next/link";
import { TbReportAnalytics } from "react-icons/tb";
import {
  HiOutlineDocumentDuplicate,
  HiOutlineChatAlt2,
  HiOutlineDatabase,
  HiOutlineUserCircle,
} from "react-icons/hi";


const Card = ({
  icon,
  title,
}: {
  icon: React.ReactNode;
  title: React.ReactNode;
}) => (
  <div className="flex h-40 flex-col items-center justify-center gap-5 rounded-xl bg-[#DAEBFF] shadow-md ring-1 ring-black/5">
    <div className="text-4xl text-black/80">{icon}</div>
    <div className="px-3 text-center text-md font-semibold text-black">
      {title}
    </div>
  </div>
);

export default function page() {
  return (
    <div className="mb-15">
      <div className="flex flex-col gap-y-1 m-15">
        <h1 className="text-4xl font-bold text-blueit">
          จัดการระบบและข้อมูล
        </h1>
        <h3 className="text-xl font-bold text-black">
          System Management & Information Management
        </h3>
      </div>
      <div className="mx-auto w-full max-w-5xl px-4">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Link href="/management/document">
            <Card
              icon={<HiOutlineDocumentDuplicate />}
              title={
                <>
                  จัดการเอกสารราชการ
                  <br />
                  และฟอร์ม
                </>
              }
            />
          </Link>

          <Link href="/management/announcement">
            <Card
              icon={<AiFillNotification />}
              title={<>จัดการประกาศข่าวสาร</>}
            />
          </Link>
          <Link href="/management/request-direct">
            <Card
              icon={<HiOutlineChatAlt2 />}
              title={
                <>
                  จัดการคำขอ
                  <br />
                  สนทนาโดยตรง
                </>
              }
            />
          </Link>
          <Link href="/management/faq">
            <Card
              icon={<HiOutlineChatAlt2 />}
              title={
                <>
                  จัดการคำถามที่พบบ่อย
                  <br />
                  (FAQ)
                </>
              }
            />
          </Link>
          <Link href="/management/qaStatic">
            <Card
              icon={<HiOutlineDatabase />}
              title={
                <>
                  จัดการคลังคำตอบคงที่
                  <br />
                  (Static QA)
                </>
              }
            />
          </Link>
          <Link href="/management/userAccount">
            <Card
              icon={<FaUserCog />}
              title={
                <>
                  จัดการระบบสิทธิ์เข้าถึง
                </>
              }
            />
          </Link>
          <Link href="/management/staffInfo">
            <Card
              icon={<HiOutlineUserCircle />}
              title={<>ข้อมูลประวัติบุคลากร</>}
            />
          </Link>
          <Link href="/management/training">
          <Card icon={<TbReportAnalytics />} title={<>การอบรมของบุคลากร</>} />
          </Link>
          <Link href="/management/chat-history">
            <Card
              icon={<HiOutlineChatAlt2 />}
              title={
                <>
                  ประวัติการสนทนา
                  <br />
                  (Chat History)
                </>
              }
            />
          </Link>
        </div>
      </div>
    </div>
  );
}
