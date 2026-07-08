"use client"

import Link from "next/link"
import React, { useState, FormEvent, useRef, useEffect } from "react"
import { useSearchParams } from "next/navigation"

type Announcement = {
  id: string | number
  title: string
  content: string | null
  picture: string | null
  link?: string | null
}

export default function PushNotificationPage() {
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [link, setLink] = useState("")
  const [currentPicture, setCurrentPicture] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isFetching, setIsFetching] = useState(false)
  const searchParams = useSearchParams()
  const announcementId = searchParams.get("announcementId")
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const handleFileClick = () => fileInputRef.current?.click()
  const baseURL = process.env.NEXT_PUBLIC_BASE_URL || ""

  useEffect(() => {
    if (announcementId) {
      const fetchAnnouncement = async () => {
        try {
          setIsFetching(true)
          const res = await fetch(`/api/announcement/${announcementId}`)
          if (!res.ok) throw new Error("Announcement not found")
          const data: Announcement = await res.json()

          setTitle(data.title || "")
          setContent(data.content || "")
          setLink(data.link || "")
          setCurrentPicture(data.picture || null)
        } catch (err) {
          console.error("Error fetching announcement:", err)
        } finally {
          setIsFetching(false)
        }
      }
      fetchAnnouncement()
    }
  }, [announcementId])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const selectedFile = e.target.files[0]
      setFile(selectedFile)
      if (!title) {
        setTitle(selectedFile.name.replace(/\.[^/.]+$/, ""))
      }
    }
  }

 const handleClear = () => {
    setFile(null)
    setTitle("")
    setContent("")
    setLink("")
    setCurrentPicture(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }


  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!title.trim()) return alert("กรุณากรอกชื่อประกาศ")
    if (!content.trim()) return alert("กรุณากรอกรายละเอียด")

    const ok = window.confirm("คุณต้องการส่งประกาศหรือไม่?")
    if (!ok) return

    setIsLoading(true)

    const formData = new FormData()
    if (file) formData.append("file", file)
    if (currentPicture && !file) formData.append("existingPicture", currentPicture)
    if (announcementId) formData.append("announcementId", announcementId)
    formData.append("title", title.trim())
    formData.append("content", content.trim())
    formData.append("link", link.trim())

    try {
      const res = await fetch("/api/pushnoti", { method: "POST", body: formData })
      const data = await res.json()

      if (!res.ok) {
        console.error("error:", data)
        alert(`เกิดข้อผิดพลาด: ${data.error || "ไม่สามารถส่งประกาศได้"}`)
      } else {
        alert(data.message || "ส่งประกาศสำเร็จ!")
        handleClear()
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
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-md p-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-blue-600 mb-2">
            ส่งประกาศข่าวสารและประชาสัมพันธ์
            <br />
            เกี่ยวกับฝ่ายบุคลากรทาง LINE
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
              เพิ่มรูปภาพ
            </label>
            {currentPicture && !file && (
              <div className="mb-3">
                <img
                  src={`${baseURL}/${currentPicture}`}
                  alt="current"
                  className="w-full max-w-md h-auto rounded-md border"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none"
                  }}
                />
              </div>
            )}
            <div
              onClick={handleFileClick}
              className={`w-full h-40 rounded-md border-2 ${
                file || currentPicture ? "border-blue-200 bg-blue-600" : "border-blue-200 bg-blue-200"
              } flex flex-col justify-center items-center cursor-pointer`}
            >
              {file ? (
                <div className="text-center">
                  <p className="font-bold text-2xl text-white my-5">{file.name}</p>
                  <p className="text-sm text-white">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  <p className="text-xs text-white mt-1">คลิกเพื่อเปลี่ยนไฟล์</p>
                </div>
              ) : currentPicture ? (
                <div className="text-center">
                  <p className="font-bold text-2xl text-white my-5">
                    {currentPicture.split("/").pop()}
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
              ลิงก์
            </label>
            <input
              type="url"
              id="link"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              className="w-full p-3 rounded-md border-2 border-gray-300 focus:border-blue-500 focus:outline-none"
              placeholder="https://example.com (ไม่บังคับ)"
              disabled={isLoading}
            />
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
                {isLoading ? "กำลังส่ง" : "ส่งประกาศ"}
              </button>
          </div>
        </form>
      </div>
    </div>
  )
}
