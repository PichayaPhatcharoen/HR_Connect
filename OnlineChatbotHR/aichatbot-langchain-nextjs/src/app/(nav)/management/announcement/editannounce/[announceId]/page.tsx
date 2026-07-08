"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import React, { useState, useEffect, FormEvent, useRef } from "react";

type PositionOption = string;
type StatusOption = string;

type Announcement = {
  id: string | number;
  title: string;
  content: string | null;
  picture: string | null;
  link?: string | null;
  position?: string;
  status?: string;
  isLatest?: boolean;
};

export default function EditAnnouncementPage() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [link, setLink] = useState("");
  const [position, setPosition] = useState<PositionOption>("TOP");
  const [isLatest, setIsLatest] = useState(false);
  const [status, setStatus] = useState<StatusOption>("ACTIVE");
  const [currentPicture, setCurrentPicture] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [statusOptions, setStatusOptions] = useState<string[]>([]);
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);

  const router = useRouter();
  const { announceId } = useParams<{ announceId: string }>();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const handleFileClick = () => fileInputRef.current?.click();

  // Derive preview from selected file so re-uploads always show the new image
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setPreviewUrl(null);
  }, [file]);

  // ดึงข้อมูล options จาก API
  useEffect(() => {
    const fetchOptions = async () => {
      try {
        setIsLoadingOptions(true);
        const res = await fetch("/api/announcement/options");
        if (!res.ok) throw new Error("Failed to fetch options");
        const data = await res.json();
        setStatusOptions(data.statusOptions || []);
      } catch (err) {
        console.error("Error fetching options:", err);
        setStatusOptions(["ACTIVE", "INACTIVE"]);
      } finally {
        setIsLoadingOptions(false);
      }
    };
    fetchOptions();
  }, []);

  useEffect(() => {
    if (!announceId) return;

    const fetchAnnouncement = async () => {
      try {
        setIsFetching(true);
        const res = await fetch(`/api/announcement/${announceId}`);
        if (!res.ok) throw new Error("Announcement not found");
        const data: Announcement = await res.json();

        setTitle(data.title || "");
        setContent(data.content || "");
        setLink(data.link || "");
        setCurrentPicture(data.picture || null);
        setPosition(data.position || "TOP");
        setIsLatest(data.isLatest || false);
        setStatus(data.status || "ACTIVE");
      } catch (err) {
        console.error(err);
        alert("ไม่พบประกาศที่ต้องการแก้ไข");
        router.push("/management/manageannounce");
      } finally {
        setIsFetching(false);
      }
    };

    fetchAnnouncement();
  }, [announceId, router]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      e.target.value = "";
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!title.trim()) return alert("กรุณากรอกชื่อประกาศ");

    const ok = window.confirm("คุณต้องการบันทึกการเปลี่ยนแปลงหรือไม่?");
    if (!ok) return;

    setIsLoading(true);

    const formData = new FormData();
    if (file) formData.append("file", file);
    formData.append("title", title.trim());
    formData.append("content", content.trim());
    formData.append("link", link.trim());
    formData.append("position", position);
    formData.append("isLatest", isLatest.toString());
    formData.append("status", status);

    try {
      const res = await fetch(`/api/announcement/${announceId}`, {
        method: "PUT",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        console.error("error:", data);
        alert(`เกิดข้อผิดพลาด: ${data.error || "ไม่สามารถบันทึกได้"}`);
      } else {
        alert("บันทึกการเปลี่ยนแปลงสำเร็จ!");
        router.push("/management/announcement");
      }
    } catch (err: any) {
      console.error("Network error:", err);
      alert(`เกิดข้อผิดพลาดในการเชื่อมต่อ: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  if (isFetching) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const baseURL = process.env.NEXT_PUBLIC_BASE_URL || "";
  const existingImageUrl = currentPicture
    ? currentPicture.startsWith("http")
      ? currentPicture
      : `${baseURL.replace(/\/$/, "")}${currentPicture.startsWith("/") ? "" : "/"}${currentPicture}`
    : null;

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-md p-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-blue-600 mb-2">
            ข่าวสารและประชาสัมพันธ์
            <br />
            เกี่ยวกับฝ่ายบุคลากร
          </h1>
          <p className="text-gray-700 text-lg font-semibold">
            คณะเทคโนโลยีสารสนเทศ
            <br />
            สถาบันเทคโนโลยีพระจอมเกล้าเจ้าคุณทหารลาดกระบัง
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-lg font-semibold mb-2">
              เพิ่มรูปภาพ <span className="text-red-500">*</span>
            </label>
            <div
              onClick={handleFileClick}
              className={`w-full min-h-[200px] rounded-md border-2 ${file || currentPicture || previewUrl
                ? "border-blue-200 bg-gray-100"
                : "border-blue-200 bg-blue-200"
                } flex flex-col justify-center items-center cursor-pointer overflow-hidden`}
            >
              {previewUrl ? (
                <div className="w-full h-64 flex flex-col items-center justify-center">
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="max-h-64 w-auto object-contain"
                  />
                  {file && (
                    <p className="text-sm text-gray-600 mt-2">
                      {file.name} ({(file.size / 1024).toFixed(1)} KB)
                    </p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    คลิกเพื่อเปลี่ยนไฟล์
                  </p>
                </div>
              ) : existingImageUrl ? (
                <div className="w-full h-64 flex flex-col items-center justify-center">
                  <img
                    src={existingImageUrl}
                    alt="Current"
                    className="max-h-64 w-auto object-contain"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    คลิกเพื่อเปลี่ยนไฟล์
                  </p>
                </div>
              ) : file ? (
                <div className="text-center">
                  <p className="font-bold text-2xl text-white my-5">
                    {file.name}
                  </p>
                  <p className="text-sm text-white">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  <p className="text-xs text-white mt-1">
                    คลิกเพื่อเปลี่ยนไฟล์
                  </p>
                </div>
              ) : (
                <p className="text-blue-500 text-2xl font-bold hover:text-3xl">
                  คลิกเพื่อเลือกไฟล์
                </p>
              )}

              <input
                ref={fileInputRef}
                type="file"
                id="fileInput"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Title Field */}
          <div>
            <label htmlFor="title" className="block text-lg font-semibold mb-2">
              ชื่อประกาศ <span className="text-red-500">*</span>
              <span className="text-sm font-normal text-gray-500 ml-2">
                (แนะนำไม่เกิน 100 ตัวอักษรสำหรับ LINE)
              </span>
            </label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full p-3 rounded-md border-2 border-gray-300 focus:border-blue-500 focus:outline-none"
              placeholder="กรอกชื่อประกาศ"
              disabled={isLoading}
              required
            />
            <div className="text-sm mt-1 text-right text-gray-500">
              [LINE] {title.length} / 100
              {title.length > 100 && (
                <span className="block text-xs mt-1 text-gray-400">
                  ข้อความยาวเกินไป อาจถูกตัดใน LINE
                </span>
              )}
            </div>
          </div>

          {/* Content Field */}
          <div>
            <label htmlFor="content" className="block text-lg font-semibold mb-2">
              รายละเอียด <span className="text-red-500">*</span>
              <span className="text-sm font-normal text-gray-500 ml-2">
                (แนะนำไม่เกิน 120 ตัวอักษรสำหรับ LINE)
              </span>
            </label>
            <textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full p-3 rounded-md border-2 border-gray-300 focus:border-blue-500 focus:outline-none h-32 resize-none"
              placeholder="กรอกรายละเอียด"
              disabled={isLoading}
              required
            />
            <div className="text-sm mt-1 text-right text-gray-500">
              [LINE] {content.length} / 120
              {content.length > 120 && (
                <span className="block text-xs mt-1 text-gray-400">
                  ข้อความยาวเกินไป อาจถูกตัดใน LINE
                </span>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="link" className="block text-lg font-semibold mb-2">
              Link
            </label>
            <input
              type="url"
              id="link"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              className="w-full p-3 rounded-md border-2 border-gray-300 focus:border-blue-500 focus:outline-none"
              placeholder="https://example.com (ถ้ามี)"
              disabled={isLoading}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-lg font-semibold mb-2">
                ตำแหน่งที่ต้องการแสดง
              </label>
              <div className="relative">
                <select
                  value={position}
                  onChange={(e) =>
                    setPosition(e.target.value as PositionOption)
                  }
                  className="w-full p-3 pr-12 rounded-md border-2 border-gray-300 focus:border-blue-500 focus:outline-none bg-white appearance-none"
                  disabled={isLoading || isLoadingOptions}
                >
                  <option value="TOP">TOP (carousel) – 1920x1080 (16:9)</option>
                  <option value="MIDDLE">MIDDLE – 1024x768 (5:7)</option>
                  <option value="LEFT">LEFT – 1200x1500 (4:5)</option>
                  <option value="RIGHT">RIGHT – 1200x1500 (4:5)</option>
                </select>
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-500">
                  ▼
                </span>
              </div>
            </div>

            <div>
              <label className="block text-lg font-semibold mb-2">สถานะ</label>
              <div className="relative">
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as StatusOption)}
                  className="w-full p-3 pr-12 rounded-md border-2 border-gray-300 focus:border-blue-500 focus:outline-none bg-white appearance-none"
                  disabled={isLoading || isLoadingOptions}
                >
                  {statusOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt === "ACTIVE"
                        ? "Active"
                        : opt === "INACTIVE"
                          ? "Inactive"
                          : opt}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-500">
                  ▼
                </span>
              </div>
            </div>
          </div>

          {/* IsLatest Checkbox */}
          <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <input
              type="checkbox"
              id="isLatest"
              checked={isLatest}
              onChange={(e) => setIsLatest(e.target.checked)}
              className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
              disabled={isLoading}
            />
            <label htmlFor="isLatest" className="text-base font-medium text-gray-700 cursor-pointer">
              แสดงในหมวดหมู่ "ล่าสุด" บนหน้าแรก (แสดงเฉพาะชื่อประกาศ)
            </label>
          </div>

          <div className="pt-4 flex items-center justify-between">
            <Link href="/management/announcement">
              <button
                type="button"
                className="bg-gray-300 text-black hover:bg-gray-400 px-6 py-3 rounded-xl font-semibold disabled:opacity-50"
                disabled={isLoading}
              >
                ย้อนกลับ
              </button>
            </Link>

            <button
              type="submit"
              className="bg-blue-600 text-white hover:bg-blue-800 px-6 py-3 rounded-xl font-semibold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLoading}
              aria-busy={isLoading}
            >
              {isLoading && (
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              )}
              {isLoading ? "กำลังบันทึก" : "บันทึก"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
