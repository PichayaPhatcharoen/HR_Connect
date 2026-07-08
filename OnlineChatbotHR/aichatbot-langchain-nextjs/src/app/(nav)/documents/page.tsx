"use client"

import React, { useState, useEffect } from "react"
import { FaSearch } from "react-icons/fa"
import { formatThaiBuddhistDate } from "@/lib/dateFormat"

type Tag = {
  TagId: string
  Name: string
  CategoryId?: string
}

type Category = {
  CategoryId: string
  Name: string
}

type DocumentTag = {
  TagId: string
  Name: string
}

type Document = {
  id: number
  fileName: string
  storagePath: string
  mimeType: string | null
  bytes: number | null
  categoryId: string | null
  customCategoryName: string | null
  tags?: DocumentTag[]
  tagIds?: string[]
  createdAt: string
  updatedAt: string
}

const DocumentListPage = () => {
  const [documents, setDocuments] = useState<Document[]>([])
  const [filteredDocuments, setFilteredDocuments] = useState<Document[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategoryId, setSelectedCategoryId] = useState("")
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [allTags, setAllTags] = useState<Tag[]>([])

  // Fetch documents, categories, and tags
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true)
        
        // Fetch documents
        const docsRes = await fetch("/api/document")
        if (!docsRes.ok) throw new Error("Failed to fetch documents")
        const docsData: Document[] = await docsRes.json()
        setDocuments(docsData)
        
        // Fetch categories
        const catsRes = await fetch("/api/document-categories")
        if (!catsRes.ok) throw new Error("Failed to fetch categories")
        const catsData: Category[] = await catsRes.json()
        setCategories(catsData)
        
        // Fetch tags
        const tagsRes = await fetch("/api/document-tags")
        if (!tagsRes.ok) throw new Error("Failed to fetch tags")
        const tagsData: Tag[] = await tagsRes.json()
        setAllTags(tagsData)
      } catch (error) {
        console.error("Error fetching data:", error)
        alert("ไม่สามารถโหลดข้อมูลได้")
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [])

  // Filter documents
  useEffect(() => {
    let filtered = documents

    // Search by filename
    if (searchTerm.trim()) {
      filtered = filtered.filter((doc) =>
        doc.fileName.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Filter by category
    if (selectedCategoryId) {
      filtered = filtered.filter((doc) => doc.categoryId === selectedCategoryId)
    }

    // Filter by tags (AND logic - document must have ALL selected tags)
    if (selectedTagIds.length > 0) {
      filtered = filtered.filter((doc) => {
        const docTagIds = doc.tags?.map(t => t.TagId) || doc.tagIds || []
        return selectedTagIds.every(tagId => docTagIds.includes(tagId))
      })
    }

    setFilteredDocuments(filtered)
  }, [documents, searchTerm, selectedCategoryId, selectedTagIds])

  const toggleTagFilter = (tagId: string) => {
    setSelectedTagIds(prev =>
      prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    )
  }

  const getCategoryDisplayName = (doc: Document) => {
    // If has custom category name, show it with "อื่นๆ" prefix
    if (doc.customCategoryName) {
      return `อื่นๆ: ${doc.customCategoryName}`
    }
    // Otherwise look up category name from categories list
    if (doc.categoryId) {
      const cat = categories.find(c => c.CategoryId === doc.categoryId)
      if (cat) return cat.Name
    }
    return "ไม่ระบุหมวดหมู่"
  }

  // Get tags filtered by selected category
  const availableTags = selectedCategoryId 
    ? allTags.filter(tag => tag.CategoryId === selectedCategoryId)
    : allTags

  const baseURL = process.env.NEXT_PUBLIC_BASE_URL || ""

  return (
    <div className="min-h-screen p-4 md:p-8 bg-gray-50">
      <div className="flex flex-col gap-y-1 mb-6 md:mb-8">
        <h1 className="text-2xl md:text-4xl font-bold text-blue-600">
          รายการเอกสารราชการและแบบฟอร์ม
        </h1>
        <p className="text-black text-base md:text-lg font-bold">
          คณะเทคโนโลยีสารสนเทศ
          <br />
          สถาบันเทคโนโลยีพระจอมเกล้าเจ้าคุณทหารลาดกระบัง
        </p>
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
                  if (e.key === "Enter") e.currentTarget.blur()
                }}
                className="flex-1 p-2 md:p-3 rounded-md border-2 border-gray-300 focus:border-blue-500 focus:outline-none text-sm md:text-base"
                placeholder="ค้นหาชื่อเอกสาร..."
              />
              <button
                onClick={() => {}}
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

        {/* Tag Filter - Show only when category is selected */}
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
                      className={`px-3 py-1.5 rounded text-sm transition ${
                        isSelected
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
                className="p-4 md:p-6 hover:bg-gray-50 transition"
              >
                {/* Filename */}
                <a
                  href={`${baseURL}/${doc.storagePath}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 font-semibold text-base md:text-lg hover:underline break-words block"
                >
                  {doc.fileName}
                </a>

                {/* Category */}
                <div className="mt-3">
                  <span className={`inline-flex items-center px-3 py-1.5 rounded text-sm font-medium ${
                    doc.customCategoryName 
                      ? "bg-amber-100 text-amber-800" 
                      : doc.categoryId 
                        ? "bg-blue-100 text-blue-800" 
                        : "bg-gray-100 text-gray-600"
                  }`}>
                    📁 {getCategoryDisplayName(doc)}
                  </span>
                </div>

                {/* Tags */}
                {doc.tags && doc.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
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

                {/* Updated Date */}
                <div className="mt-3 text-sm text-gray-500">
                  อัปเดตล่าสุด: {formatThaiBuddhistDate(doc.updatedAt)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default DocumentListPage