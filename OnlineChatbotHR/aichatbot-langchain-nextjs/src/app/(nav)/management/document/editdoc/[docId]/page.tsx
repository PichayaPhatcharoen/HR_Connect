"use client"

import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import React, { useState, useEffect, FormEvent, useRef } from "react"
import CategoryTagSelector from "@/components/CategoryTagSelector"


type Document = {
  id: number
  fileName: string
  storagePath: string
  categoryId: string | null
  tags?: Array<{ TagId: string; Name: string }>
}

export default function EditDocumentPage() {

  const [file, setFile] = useState<File | null>(null)
  const [fileName, setFileName] = useState("")
  const [originalFileName, setOriginalFileName] = useState("")
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const [customCategoryName, setCustomCategoryName] = useState<string>("")
  const [customCategoryDesc, setCustomCategoryDesc] = useState<string>("")
  const [isLoading, setIsLoading] = useState(false)
  const [isFetching, setIsFetching] = useState(true)

  const router = useRouter()
  const { docId } = useParams()


  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const handleFileClick = () => fileInputRef.current?.click()


  useEffect(() => {
    if (!docId) return

    const fetchDocument = async () => {
      try {
        setIsFetching(true)
        const res = await fetch(`/api/document/${docId}`)
        if (!res.ok) {
          throw new Error("Document not found")
        }
        const data: Document = await res.json()
        

        setFileName(data.fileName)
        setOriginalFileName(data.fileName)
        setSelectedCategoryId(data.categoryId)
        
        if (data.tags && data.tags.length > 0) {
          setSelectedTagIds(data.tags.map(t => t.TagId))
        }

      } catch (err) {
        console.error(err)
        alert("ไม่พบเอกสารที่ต้องการแก้ไข")
        router.push("/managedocument")
      } finally {
        setIsFetching(false)
      }
    }

    fetchDocument()
  }, [docId, router])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const selectedFile = e.target.files[0]
      setFile(selectedFile)
    }
  }


  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!fileName.trim()) return alert("กรุณากรอกชื่อเอกสาร")

    const ok = window.confirm("คุณต้องการบันทึกการเปลี่ยนแปลงหรือไม่?")
    if (!ok) return 

    setIsLoading(true)

    const formData = new FormData()

    if (file) {
      formData.append("file", file)
    }
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
      const res = await fetch(`/api/document/${docId}`, { method: "PUT", body: formData })
      const data = await res.json()

      if (!res.ok) {
        console.error("error:", data)
        alert(`เกิดข้อผิดพลาด: ${data.error || "ไม่สามารถบันทึกได้"}`)
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
  

  if (isFetching) {
    return (
      <div className="flex justify-center items-center min-h-screen">
         <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="min-h-screen bg-white rounded-lg shadow-md p-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-blue-600 mb-2">แก้ไขเอกสาร</h1>

        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          
          <div>
            <label className="block text-lg font-semibold mb-2">อัพโหลดไฟล์ใหม่ (ถ้าต้องการ)</label>
            <div
              onClick={handleFileClick}
              className={`w-full h-40 rounded-md border-2 ${
                file ? "border-green-400 bg-green-50" : "border-gray-300 bg-gray-50"
              } flex flex-col justify-center items-center cursor-pointer`}
            >
              <div className="text-center">
                <p className="font-bold text-xl text-gray-700 my-2">
                  {file ? file.name : originalFileName}
                </p>
                <p className="text-sm text-gray-500">
                  {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : "ไฟล์ปัจจุบัน"}
                </p>
                <p className="text-xs text-blue-500 font-semibold mt-2">
                  {file ? "ไฟล์ใหม่ที่เลือก" : "คลิกเพื่อเปลี่ยนไฟล์"}
                </p>
              </div>
              <input
                ref={fileInputRef} type="file" className="hidden"
                onChange={handleFileChange} disabled={isLoading}
              />
            </div>
          </div>
          
          <div>
            <label htmlFor="fileName" className="block text-lg font-semibold mb-2">
              ชื่อเอกสาร/แบบฟอร์ม <span className="text-red-500">*</span>
            </label>
            <input
              type="text" id="fileName" value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              className="w-full p-3 rounded-md border-2 border-gray-300 focus:border-blue-500 focus:outline-none"
              placeholder="กรอกชื่อเอกสาร" disabled={isLoading} required
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
            <Link href="/management/document">
              <button
                type="button" disabled={isLoading}
                className="bg-gray-200 text-gray-800 hover:bg-gray-300 px-6 py-3 rounded-xl font-semibold disabled:opacity-50"
              >
                ย้อนกลับ
              </button>
            </Link>
            <button
              type="submit"
              className="bg-blue-600 text-white hover:bg-blue-800 px-6 py-3 rounded-xl font-semibold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLoading} aria-busy={isLoading}
            >
              {isLoading && <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />}
              {isLoading ? "กำลังบันทึก" : "บันทึกการเปลี่ยนแปลง"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
