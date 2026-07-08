"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import axios from "axios";
import { useQuery, useQueryClient } from "@tanstack/react-query";

type LiffProfile = {
  userId: string;           
  displayName: string;
  pictureUrl?: string;
};

export default function ContactStaffPage() {
  const queryClient = useQueryClient();
  const [profile, setProfile] = useState<LiffProfile | null>(null);
  const [message, setMessage] = useState("");
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [submitting, setSubmitting] = useState(false);

 
  const { data: staffStatus, isLoading: isLoadingStatus, error: statusError } = useQuery<{ isOnline: boolean; message: string }>({
    queryKey: ["staff-online-status"],
    queryFn: async () => {
      try {
        const res = await axios.get("/api/staff/online-status");
        console.log("Staff status fetched:", res.data);
        return res.data;
      } catch (error: any) {
        console.error("Error fetching staff status:", error);
        return { isOnline: false, message: "Offline" };
      }
    },
    refetchInterval: 5000,
    retry: 2,
    initialData: { isOnline: false, message: "Offline" },
    staleTime: 0,
  });

  useEffect(() => {
    const init = async () => {
      try {
        const { default: liff } = await import("@line/liff");
        await liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID || "" });
        if (!liff.isLoggedIn()) {
          liff.login();
          return;
        }

        const p = await liff.getProfile();
        setProfile(p as LiffProfile);
      
        queryClient.invalidateQueries({ queryKey: ["staff-online-status"] });
      } catch (err) {
        console.error("LIFF init error:", err);
      } finally {
        setLoadingProfile(false)
        queryClient.invalidateQueries({ queryKey: ["staff-online-status"] });
      }
    };
    init();
  }, [queryClient]);

  const canSubmit = useMemo(() => {
    return !!profile && message.trim().length > 0 && !submitting && !loadingProfile;
  }, [profile, message, submitting, loadingProfile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !profile) return;

    try {
      setSubmitting(true);

      await axios.post("/api/request-direct", {
        displayName: profile.displayName ?? "ไม่ระบุชื่อ",
        message: message.trim(),
        userId: profile.userId,
      });

      alert("ส่งคำร้องสำเร็จแล้ว! เจ้าหน้าที่จะติดต่อกลับโดยเร็วที่สุด");

      const { default: liff } = await import("@line/liff");
      if (liff.isInClient()) {
        liff.closeWindow();
      } else {
        setMessage("");
      }
    } catch (err: any) {
      console.error("Send request failed:", err);
      const apiMsg =
        err?.response?.data?.error ||
        err?.response?.data?.details ||
        "เกิดข้อผิดพลาดในการส่งคำร้อง กรุณาลองใหม่อีกครั้ง";
      alert(apiMsg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <header className="flex items-center justify-between px-4 py-3">
        <Image
          src="/home/HR_LOGO.png"
          alt="HR IT KMITL"
          width={300}
          height={300}
          priority
          className="h-24 md:h-32 w-auto"
        />
      </header>

      <div className="h-12 md:h-16 bg-blueit" />

      <main className="px-4 md:px-6 py-8 md:py-10">
        <div className="mx-auto w-full max-w-[600px] bg-white rounded-2xl p-5 md:p-6 shadow-lg">
          <h1 className="text-2xl md:text-3xl font-extrabold text-blueit">
            ติดต่อเจ้าหน้าที่โดยตรง
          </h1>
          <p className="text-black mb-4 font-medium">Contact Staff</p>

          {loadingProfile ? (
            <p className="text-gray-600 mb-6">กำลังโหลดข้อมูลผู้ใช้จาก LINE...</p>
          ) : (
            <p className="text-gray-700 mb-6">
              สวัสดีคุณ{" "}
              <span className="font-semibold">
                {profile?.displayName ?? ""}
              </span>
            </p>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-2">
            <div className="flex justify-end mb-2">
              {isLoadingStatus ? (
                <p className="text-sm font-medium text-gray-500">
                  กำลังตรวจสอบสถานะเจ้าหน้าที่...
                </p>
              ) : (
                <p className="text-sm font-medium text-gray-700">
                  <span className={staffStatus?.isOnline ? "text-green-500" : "text-gray-500"}>
                    {staffStatus?.isOnline ? "เจ้าหน้าที่พร้อมให้บริการ" : "ขณะนี้อยู่นอกเวลาทำการ"}
                  </span>
                </p>
              )}
              {statusError && (
                <p className="text-xs text-red-500 ml-2">
                  (ไม่สามารถโหลดสถานะได้)
                </p>
              )}
            </div>

            <label htmlFor="message" className="font-semibold text-black">
              คำถามที่ต้องการสอบถาม
            </label>

            <textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="พิมพ์รายละเอียดที่ต้องการติดต่อเจ้าหน้าที่..."
              className="w-full min-h-[160px] md:min-h-[180px] p-4 rounded-xl border border-gray-300 outline-none focus:ring-2 focus:ring-blueit resize-y"
              required
            />

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={!canSubmit}
                className="rounded-full bg-blueit text-white font-medium px-6 py-2 shadow hover:bg-blueit/90 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
              >
                {submitting ? "กำลังส่ง..." : "ยืนยัน"}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
