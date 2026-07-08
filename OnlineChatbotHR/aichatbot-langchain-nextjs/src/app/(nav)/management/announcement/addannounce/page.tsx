"use client"

import Link from "next/link"
import React, { useState, FormEvent, useRef, useEffect } from "react"

type PositionOption = string
type StatusOption = string

export default function AddAnnouncementPage() {
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [link, setLink] = useState("")
  const [position, setPosition] = useState<PositionOption>("TOP")
  const [isLatest, setIsLatest] = useState(false)
  const [status, setStatus] = useState<StatusOption>("ACTIVE")
  const [isLoading, setIsLoading] = useState(false)
  const [positionOptions, setPositionOptions] = useState<string[]>([])
  const [statusOptions, setStatusOptions] = useState<string[]>([])
  const [isLoadingOptions, setIsLoadingOptions] = useState(true)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const handleFileClick = () => fileInputRef.current?.click()

  // Revoke object URL on cleanup to avoid memory leaks
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])


useEffect(() => {
  const fetchOptions = async () => {
    try {
      setIsLoadingOptions(true)

      const url = "/api/announcement/options"

      const res = await fetch(url)

      if (!res.ok) throw new Error("Failed to fetch options")

      const data = await res.json()
      setPositionOptions(data.positionOptions || [])
      setStatusOptions(data.statusOptions || [])

      if (data.positionOptions?.length > 0) {
        setPosition(data.positionOptions[0])
      }
      if (data.statusOptions?.length > 0) {
        setStatus(data.statusOptions[0])
      }

    } catch (err) {
      console.error("Error fetching options:", err)

      setPositionOptions(["TOP", "MIDDLE", "LEFT", "RIGHT"])
      setStatusOptions(["ACTIVE", "INACTIVE"])
    } finally {
      setIsLoadingOptions(false)
    }
  }

  fetchOptions()
}, [])
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const selectedFile = e.target.files[0]
      setFile(selectedFile)
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      setPreviewUrl(selectedFile.type.startsWith("image/") ? URL.createObjectURL(selectedFile) : null)
      if (!title) {
        setTitle(selectedFile.name.replace(/\.[^/.]+$/, ""))
      }
    }
  }

 const handleClear = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setFile(null)
    setTitle("")
    setContent("")
    setLink("")
    if (positionOptions.length > 0) {
      setPosition(positionOptions[0])
    }
    if (statusOptions.length > 0) {
      setStatus(statusOptions[0])
    }
    setIsLatest(false)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }


  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!file) return alert("กรุณาเลือกไฟล์")
    if (!title.trim()) return alert("กรุณากรอกชื่อประกาศ/ข่าวสาร")

    const ok = window.confirm("คุณต้องการบันทึกประกาศ/ข่าวสารหรือไม่?")
    if (!ok) return

    setIsLoading(true)

    const formData = new FormData()
    formData.append("file", file)
    formData.append("title", title.trim())
    formData.append("content", content.trim())
    formData.append("link", link.trim())
    formData.append("position", position)
    formData.append("isLatest", isLatest.toString())
    formData.append("status", status)

    try {
      const res = await fetch("/api/announcement", { method: "POST", body: formData })
      const data = await res.json()

      if (!res.ok) {
        console.error("error:", data)
        alert(`เกิดข้อผิดพลาด: ${data.error || "ไม่สามารถอัปโหลดได้"}`)
      } else {
        alert("บันทึกสำเร็จ!")
        handleClear()
      }
    } catch (err: any) {
      console.error("Network error:", err)
      alert(`เกิดข้อผิดพลาดในการเชื่อมต่อ: ${err.message}`)
    } finally {
      setIsLoading(false)
    }
  }

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
              className={`w-full min-h-[200px] rounded-md border-2 ${
                file || previewUrl ? "border-blue-200 bg-gray-100" : "border-blue-200 bg-blue-200"
              } flex flex-col justify-center items-center cursor-pointer overflow-hidden`}
            >
              {previewUrl ? (
                <div className="relative w-full h-64 flex flex-col items-center justify-center">
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
                  <p className="text-xs text-gray-500 mt-1">คลิกเพื่อเปลี่ยนไฟล์</p>
                </div>
              ) : file ? (
                <div className="text-center">
                  <p className="font-bold text-2xl text-white my-5">{file.name}</p>
                  <p className="text-sm text-white">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  <p className="text-xs text-white mt-1">คลิกเพื่อเปลี่ยนไฟล์</p>
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

          <div>
            <label htmlFor="title" className="block text-lg font-semibold mb-2">
              ชื่อประกาศ/ข่าวสาร <span className="text-red-500">*</span>
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
              placeholder="กรอกชื่อประกาศ/ข่าวสาร"
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

          <div>
            <label htmlFor="link" className="block text-lg font-semibold mb-2">
              ลิงก์
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
              <label className="block text-lg font-semibold mb-2">ตำแหน่งที่ต้องการแสดง</label>
              <div className="relative">
                <select
                  value={position}
                  onChange={(e) => setPosition(e.target.value as PositionOption)}
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
                      {opt === "ACTIVE" ? "Active" : opt === "INACTIVE" ? "Inactive" : opt}
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

            <div className="flex items-center gap-3">
              <button
                type="button"
                className="bg-gray-300 text-black hover:bg-gray-400 px-6 py-3 rounded-xl font-semibold disabled:opacity-50"
                disabled={isLoading}
                onClick={handleClear}
              >
                ล้าง
              </button>

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
          </div>
        </form>
      </div>
    </div>
  )
}