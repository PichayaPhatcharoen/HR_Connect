"use client"

import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import React, { useState, FormEvent, useRef } from "react"
import CategoryTagSelector from "@/components/CategoryTagSelector"

export default function UploadDocumentPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const fromUnanswerable = searchParams.get("from") === "unanswerable"
  const [file, setFile] = useState<File | null>(null)
  const [fileName, setFileName] = useState("")
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const [customCategoryName, setCustomCategoryName] = useState<string>("")
  const [customCategoryDesc, setCustomCategoryDesc] = useState<string>("")
  const [isLoading, setIsLoading] = useState(false)

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const handleFileClick = () => fileInputRef.current?.click()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const selectedFile = e.target.files[0]
      setFile(selectedFile)
      if (!fileName) {
        setFileName(selectedFile.name.replace(/\.[^/.]+$/, ""))
      }
    }
  }

  const handleClear = () => {
    setFile(null)
    setFileName("")
    setSelectedCategoryId(null)
    setSelectedTagIds([])
    setCustomCategoryName("")
    setCustomCategoryDesc("")
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!file) return alert("กรุณาเลือกไฟล์")
    if (!fileName.trim()) return alert("กรุณากรอกชื่อเอกสาร")

    const ok = window.confirm("คุณต้องการบันทึกเอกสารหรือไม่?")
    if (!ok) return

    setIsLoading(true)

    const formData = new FormData()
    formData.append("file", file)
    formData.append("fileName", fileName.trim())

    if (selectedCategoryId) {
      formData.append("categoryId", selectedCategoryId)
    }
    
    // Add custom category name if creating new category (either from "อื่นๆ" or "+ สร้างหมวดหมู่ใหม่")
    if (customCategoryName.trim()) {
      formData.append("customCategoryName", customCategoryName.trim())
    }
    if (customCategoryDesc.trim()) {
      formData.append("customCategoryDesc", customCategoryDesc.trim())
    }
    
    if (selectedTagIds.length > 0) {
      formData.append("tagIds", JSON.stringify(selectedTagIds))
    }

    try {
      const res = await fetch("/api/document", { method: "POST", body: formData })
      const data = await res.json()

      if (!res.ok) {
        console.error("error:", data)
        alert(`เกิดข้อผิดพลาด: ${data.error || "ไม่สามารถอัปโหลดได้"}`)
      } else {
        alert("อัปโหลดสำเร็จ ระบบกำลังประมวลผลไฟล์เบื้องหลัง...")
        router.push("/management/document")
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
          <h1 className="text-4xl font-bold text-blueit mb-2">จัดการเอกสารและแบบฟอร์ม</h1>
          <p className="text-gray-700 text-lg font-semibold">
            คณะเทคโนโลยีสารสนเทศ
            <br />
            สถาบันเทคโนโลยีพระจอมเกล้าเจ้าคุณทหารลาดกระบัง
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">

          <div>
            <label className="block text-lg font-semibold mb-2">อัพโหลดเอกสาร <span className="text-red-500">*</span></label>
            <div
              onClick={handleFileClick}
              className={`w-full h-40 rounded-md border-2 ${
                file ? "border-blue-200 bg-blueit" : "border-blue-200 bg-blue-200"
              } flex flex-col justify-center items-center cursor-pointer`}
            >
              {file ? (
                <div className="text-center">
                  <p className="font-bold text-2xl text-white my-5">{file.name}</p>
                  <p className="text-sm text-white">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  <p className="text-xs text-white mt-1">คลิกเพื่อเปลี่ยนไฟล์</p>
                </div>
              ) : (
                <p className="text-blue-500 text-2xl font-bold hover:text-3xl">คลิกเพื่อเลือกไฟล์</p>
              )}
              <input
                ref={fileInputRef}
                type="file"
                id="fileInput"
                className="hidden"
                accept=".pdf,.txt,.csv,.doc,.docx,.png,.jpg,.jpeg,.gif,.bmp,.webp,.tiff"
                onChange={handleFileChange}
                disabled={isLoading}
              />
            </div>
          </div>

          <div>
            <label htmlFor="fileName" className="block text-lg font-semibold mb-2">
              ชื่อเอกสาร/แบบฟอร์ม <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="fileName"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              className="w-full p-3 rounded-md border-2 border-gray-300 focus:border-blue-500 focus:outline-none"
              placeholder="กรอกชื่อเอกสาร"
              disabled={isLoading}
              required
            />
          </div>

          <CategoryTagSelector
            selectedCategoryId={selectedCategoryId}
            selectedTagIds={selectedTagIds}
            customCategoryName={customCategoryName}
            customCategoryDesc={customCategoryDesc}
            onCategoryChange={setSelectedCategoryId}
            onTagsChange={setSelectedTagIds}
            onCustomCategoryNameChange={setCustomCategoryName}
            onCustomCategoryDescChange={setCustomCategoryDesc}
            disabled={isLoading}
          />

          <div className="pt-4 flex items-center justify-between">

            <Link href={fromUnanswerable ? "/management/chat-history?tab=unanswerable" : "/management/document"}>
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
                className="bg-blueit text-white hover:bg-blue-800 px-6 py-3 rounded-xl font-semibold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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