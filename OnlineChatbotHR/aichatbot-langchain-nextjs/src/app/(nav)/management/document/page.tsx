"use client"

import Link from "next/link"
import React, { useState, useEffect, useCallback } from "react"
import { FaSearch, FaEdit, FaTrash, FaFolder } from "react-icons/fa"
import { FaCirclePlus } from "react-icons/fa6"
import { formatThaiBuddhistDate } from "@/lib/dateFormat"

type Tag = {
  TagId: string
  Name: string
  CategoryId?: string
}

type Document = {
  id: number
  fileName: string
  storagePath: string
  mimeType: string | null
  bytes: number | null
  categoryId: string | null
  categoryName: string | null
  tags?: Tag[]
  tagIds?: string[]
  createdAt: string
  updatedAt: string
  chunkCount?: number
}

type Category = {
  CategoryId: string
  Name: string
  Description?: string | null
}

export default function DocumentManagementPage() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [filteredDocuments, setFilteredDocuments] = useState<Document[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("")
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [allTags, setAllTags] = useState<Tag[]>([])

  const fetchDocuments = useCallback(async () => {
    try {
      setIsLoading(true)
      const response = await fetch("/api/document")
      if (!response.ok) {
        throw new Error("Failed to fetch documents")
      }
      const data: Document[] = await response.json()
      setDocuments(data)
    } catch (error) {
      console.error("Error fetching documents:", error)
      alert("ไม่สามารถโหลดเอกสารได้")
    } finally {
      setIsLoading(false)
    }
  }, [])

  const fetchCategories = useCallback(async () => {
    try {
      const response = await fetch("/api/document-categories")
      if (response.ok) {
        const data = await response.json()
        setCategories(data)
      }
    } catch (error) {
      console.error("Error fetching categories:", error)
    }
  }, [])

  const fetchAllTags = useCallback(async () => {
    try {
      const response = await fetch("/api/document-tags")
      if (response.ok) {
        const data = await response.json()
        setAllTags(data)
      }
    } catch (error) {
      console.error("Error fetching tags:", error)
    }
  }, [])

  const filterDocuments = useCallback(() => {
    let filtered = documents

    // ค้นหาตามชื่อไฟล์
    if (searchTerm.trim()) {
      filtered = filtered.filter((doc) =>
        doc.fileName.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // กรองตามหมวดหมู่
    if (selectedCategoryId) {
      filtered = filtered.filter((doc) => doc.categoryId === selectedCategoryId)
    }

    // กรองตามแท็ก (ตรรกะ AND - เอกสารต้องมีแท็กที่เลือกครบถ้วน)
    if (selectedTagIds.length > 0) {
      filtered = filtered.filter((doc) => {
        const docTagIds = doc.tags?.map(t => t.TagId) || doc.tagIds || []
        return selectedTagIds.every(tagId => docTagIds.includes(tagId))
      })
    }

    setFilteredDocuments(filtered)
  }, [documents, searchTerm, selectedCategoryId, selectedTagIds])

  // โหลดข้อมูลเอกสารและหมวดหมู่เมื่อเริ่มหน้า
  useEffect(() => {
    fetchDocuments()
    fetchCategories()
    fetchAllTags()
  }, [fetchDocuments, fetchCategories, fetchAllTags])

  // ตรวจสอบสถานะการประมวลผล (Background polling)
  useEffect(() => {
    const hasProcessing = documents.some(d => d.chunkCount === 0)
    if (hasProcessing) {
      const timer = setInterval(async () => {
        try {
          const response = await fetch("/api/document", { cache: "no-store" })
          if (response.ok) {
            const data: Document[] = await response.json()
            setDocuments(data)
          }
        } catch (e) {
          console.error("Error fetching documents:", e)
        }
      }, 5000)
      return () => clearInterval(timer)
    }
  }, [documents])

  useEffect(() => {
    filterDocuments()
  }, [filterDocuments])

  const handleDelete = async (id: number, fileName: string) => {
    const confirmed = window.confirm(`คุณต้องการลบเอกสาร "${fileName}" ใช่หรือไม่?`)
    if (!confirmed) return

    try {
      const response = await fetch(`/api/document/${id}`, { method: "DELETE" })

      if (!response.ok) {
        throw new Error("Failed to delete document")
      }

      setDocuments((current) => current.filter((doc) => doc.id !== id))
      alert("ลบเอกสารสำเร็จ")
    } catch (error) {
      console.error("Error deleting document:", error)
      alert("ไม่สามารถลบเอกสารได้")
    }
  }

  const handleSearch = () => {
    filterDocuments()
  }

  const toggleTagFilter = (tagId: string) => {
    setSelectedTagIds(prev =>
      prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    )
  }

  const getCategoryDisplayName = (doc: Document) => {
    // ใช้ชื่อหมวดหมู่ที่ได้รับจาก API
    if (doc.categoryName) {
      return doc.categoryName
    }
    // หรือหาจากรายการหมวดหมู่สะสม
    if (doc.categoryId) {
      const cat = categories.find(c => c.CategoryId === doc.categoryId)
      if (cat) return cat.Name
    }
    return "ไม่ระบุหมวดหมู่"
  }

  // ดึงแท็กตามหมวดหมู่ที่เลือก
  const availableTags = selectedCategoryId
    ? allTags.filter(tag => tag.CategoryId === selectedCategoryId)
    : allTags

  const baseURL = process.env.NEXT_PUBLIC_BASE_URL || ""

  return (
    <div className="min-h-screen p-4 md:p-8 bg-gray-50">
      <div className="flex flex-col gap-y-1 mb-6 md:mb-8">
        <h1 className="text-2xl md:text-4xl font-bold text-blue-600">
          จัดการเอกสารราชการและแบบฟอร์ม
        </h1>
        <p className="text-black text-base md:text-lg font-bold">
          คณะเทคโนโลยีสารสนเทศ
          <br />
          สถาบันเทคโนโลยีพระจอมเกล้าเจ้าคุณทหารลาดกระบัง
        </p>
      </div>

      {/* Add Document Button */}
      <div className="flex justify-end mb-4 md:mb-6 gap-3">
        <Link href="/management/document-categories">
          <button className="flex items-center gap-x-2 text-white bg-green-600 hover:bg-green-700 rounded-md transition px-3 py-2 md:px-4 md:py-2 shadow-md text-sm md:text-base">
            <FaFolder className="text-lg md:text-xl" />
            <span className="font-semibold">จัดการหมวดหมู่/แท็ก</span>
          </button>
        </Link>
        <Link href="/management/document/adddoc">
          <button className="flex items-center gap-x-2 text-white bg-blue-600 hover:bg-blue-700 rounded-md transition px-3 py-2 md:px-4 md:py-2 shadow-md text-sm md:text-base">
            <FaCirclePlus className="text-lg md:text-xl" />
            <span className="font-semibold">เพิ่มเอกสาร</span>
          </button>
        </Link>
      </div>

      {/* Search and Filter Section */}
      <div className="bg-white p-4 md:p-6 rounded-lg shadow-md mb-4 md:mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <label className="block text-base md:text-lg font-semibold mb-2">
              ค้นหาเอกสาร
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSearch()
                }}
                className="flex-1 p-2 md:p-3 rounded-md border-2 border-gray-300 focus:border-blue-500 focus:outline-none text-sm md:text-base"
                placeholder="ค้นหาชื่อเอกสาร..."
              />
              <button
                onClick={handleSearch}
                className="bg-blue-600 hover:bg-blue-700 text-white p-2 md:p-3 rounded-md transition"
              >
                <FaSearch className="text-lg md:text-xl" />
              </button>
            </div>
          </div>

          {/* Category Filter */}
          <div className="w-full md:w-72">
            <label className="block text-base md:text-lg font-semibold mb-2">
              หมวดหมู่
            </label>
            <select
              value={selectedCategoryId}
              onChange={(e) => setSelectedCategoryId(e.target.value)}
              className="w-full border-2 border-gray-300 rounded-md px-3 py-2 md:px-4 md:py-3 text-sm md:text-base text-gray-700 focus:outline-none focus:border-blue-500"
            >
              <option value="">ทั้งหมด</option>
              {categories
                .filter((cat) => cat.Name !== "อื่นๆ")
                .map((cat) => (
                  <option key={cat.CategoryId} value={cat.CategoryId}>
                    {cat.Name}
                  </option>
                ))}
            </select>
          </div>
        </div>

        <div className="mt-4 text-sm text-gray-600">
          แสดง {filteredDocuments.length} จาก {documents.length} เอกสาร
          {selectedTagIds.length > 0 && (
            <span className="ml-2">
              (กรองตามแท็ก: {selectedTagIds.length} รายการ)
            </span>
          )}
        </div>

        {/* Tag Filter */}
        {selectedCategoryId ? (
          availableTags.length > 0 && (
            <div className="mt-4">
              <label className="block text-base md:text-lg font-semibold mb-2">
                กรองตามแท็ก
                <span className="text-sm font-normal text-gray-500">
                  (แสดงเฉพาะแท็กในหมวดหมู่ที่เลือก)
                </span>
              </label>
              <div className="flex flex-wrap gap-2">
                {availableTags.map((tag) => {
                  const isSelected = selectedTagIds.includes(tag.TagId)
                  return (
                    <button
                      key={tag.TagId}
                      onClick={() => toggleTagFilter(tag.TagId)}
                      className={`px-3 py-1.5 rounded text-sm transition ${isSelected
                        ? "bg-green-600 text-white hover:bg-green-700"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                    >
                      {isSelected ? "✓ " : ""}{tag.Name}
                    </button>
                  )
                })}
              </div>
              {selectedTagIds.length > 0 && (
                <button
                  onClick={() => setSelectedTagIds([])}
                  className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
                >
                  ล้างตัวกรองแท็ก
                </button>
              )}
            </div>
          )
        ) : (
          <div className="mt-4 p-3 bg-gray-100 rounded text-gray-600 text-sm">
            โปรดเลือกหมวดหมู่เอกสารเพื่อดูแท็กที่เกี่ยวข้อง
          </div>
        )}
      </div>

      {/* Documents List */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg">ไม่พบเอกสาร</p>
            {(searchTerm || selectedCategoryId || selectedTagIds.length > 0) && (
              <p className="text-sm mt-2">ลองเปลี่ยนคำค้นหาหรือตัวกรอง</p>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredDocuments.map((doc) => (
              <div
                key={doc.id}
                className="p-4 md:p-6 hover:bg-gray-50 transition flex flex-col md:flex-row md:justify-between md:items-start gap-4"
              >
                {/* Content Container */}
                <div className="flex-1 min-w-0 space-y-3">
                  {/* Filename */}
                  <a
                    href={`${baseURL}/${doc.storagePath}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-blue-600 hover:text-blue-800 font-semibold text-base md:text-lg hover:underline break-words"
                  >
                    {doc.fileName}
                  </a>

                  {/* Category */}
                  <div>
                    <span className={`inline-flex items-center px-3 py-1.5 rounded text-sm font-medium ${doc.categoryId
                      ? "bg-blue-100 text-blue-800"
                      : "bg-gray-100 text-gray-600"
                      }`}>
                      📁 {getCategoryDisplayName(doc)}
                    </span>
                  </div>

                  {/* Tags */}
                  {doc.tags && doc.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {doc.tags.map((tag) => (
                        <span
                          key={tag.TagId}
                          className="inline-flex items-center bg-green-100 text-green-800 px-3 py-1.5 rounded text-sm"
                        >
                          🏷️ {tag.Name}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Status Indicator */}
                  <div>
                    {(doc.chunkCount ?? 0) > 0 ? (
                      <span className="inline-flex items-center text-green-600 font-semibold text-sm">
                        ✅ พร้อมใช้งาน-เพิ่มข้อมูลลงฐานข้อมูลความรู้สำเร็จ
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-amber-600 font-semibold text-sm animate-pulse">
                        ⏳ กำลังประมวลผล
                      </span>
                    )}
                  </div>

                  {/* Updated Date */}
                  <div className="text-sm text-gray-500">
                    อัปเดตล่าสุด: {formatThaiBuddhistDate(doc.updatedAt)}
                  </div>
                </div>

                {/* Actions Container */}
                <div className="flex items-center gap-x-3 justify-end md:ml-4 pt-3 md:pt-0 border-t border-gray-100 md:border-0 mt-1 md:mt-0 shrink-0">
                  <Link href={`/management/document/editdoc/${doc.id}`}>
                    <button
                      className="text-blue-600 hover:text-blue-800 transition p-2 hover:bg-blue-50 rounded"
                      title="แก้ไข"
                    >
                      <FaEdit className="text-xl" />
                    </button>
                  </Link>
                  <button
                    onClick={() => handleDelete(doc.id, doc.fileName)}
                    className="text-red-600 hover:text-red-800 transition p-2 hover:bg-red-50 rounded"
                    title="ลบ"
                  >
                    <FaTrash className="text-xl" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}