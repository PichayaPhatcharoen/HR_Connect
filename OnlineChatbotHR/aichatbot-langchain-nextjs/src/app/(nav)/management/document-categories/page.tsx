"use client"

import React, { useState, useEffect } from "react"
import { FaPlus, FaTrash, FaFolder, FaTag, FaExclamationTriangle, FaEdit, FaSave, FaTimes } from "react-icons/fa"

type Category = {
  CategoryId: string
  Name: string
  Description: string | null
  Tags?: Tag[]
  documentCount?: number
  _count?: {
    Tags: number
  }
}

type Tag = {
  TagId: string
  Name: string
  Description: string | null
  CategoryId: string
  Category?: {
    CategoryId: string
    Name: string
  }
  documentCount?: number
}

export default function CategoryTagManagementPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<"categories" | "tags">("categories")
  
  // Category form state
  const [showNewCategoryForm, setShowNewCategoryForm] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState("")
  const [newCategoryDesc, setNewCategoryDesc] = useState("")
  
  // Tag form state
  const [showNewTagForm, setShowNewTagForm] = useState(false)
  const [newTagName, setNewTagName] = useState("")
  const [newTagDesc, setNewTagDesc] = useState("")
  const [newTagCategoryId, setNewTagCategoryId] = useState("")
  
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null)
  const [deletingTagId, setDeletingTagId] = useState<string | null>(null)
  
  // Edit state for tags
  const [editingTagId, setEditingTagId] = useState<string | null>(null)
  const [editTagName, setEditTagName] = useState("")
  const [editTagDesc, setEditTagDesc] = useState("")
  const [editTagCategoryId, setEditTagCategoryId] = useState("")
  const [savingTagId, setSavingTagId] = useState<string | null>(null)
  
  // Edit state
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const [editCategoryName, setEditCategoryName] = useState("")
  const [editCategoryDesc, setEditCategoryDesc] = useState("")
  const [savingCategoryId, setSavingCategoryId] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setIsLoading(true)
      // Fetch categories with counts
      const [catRes, tagsRes] = await Promise.all([
        fetch("/api/document-categories?withCounts=true&includeTags=true"),
        fetch("/api/document-tags?withCounts=true"),
      ])

      if (!catRes.ok) throw new Error("Failed to fetch categories")
      if (!tagsRes.ok) throw new Error("Failed to fetch tags")

      const catData = await catRes.json()
      const tagsData = await tagsRes.json()

      setCategories(catData)
      setTags(tagsData)
    } catch (error) {
      console.error("Error:", error)
      alert("ไม่สามารถโหลดข้อมูลได้")
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return alert("กรุณากรอกชื่อหมวดหมู่")

    try {
      const res = await fetch("/api/document-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newCategoryName.trim(),
          description: newCategoryDesc.trim() || null,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to create category")
      }

      alert("สร้างหมวดหมู่สำเร็จ")
      setNewCategoryName("")
      setNewCategoryDesc("")
      setShowNewCategoryForm(false)
      fetchData()
    } catch (error: any) {
      alert(`เกิดข้อผิดพลาด: ${error.message}`)
    }
  }

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return alert("กรุณากรอกชื่อแท็ก")
    if (!newTagCategoryId) return alert("กรุณาเลือกหมวดหมู่")

    try {
      const res = await fetch("/api/document-tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newTagName.trim(),
          description: newTagDesc.trim() || null,
          categoryId: newTagCategoryId,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to create tag")
      }

      alert("สร้างแท็กสำเร็จ")
      setNewTagName("")
      setNewTagDesc("")
      setNewTagCategoryId("")
      setShowNewTagForm(false)
      fetchData()
    } catch (error: any) {
      alert(`เกิดข้อผิดพลาด: ${error.message}`)
    }
  }

  const handleDeleteCategory = async (categoryId: string, categoryName: string) => {
    const category = categories.find((c) => c.CategoryId === categoryId)
    const docCount = category?.documentCount || 0
    const tagCount = category?._count?.Tags || 0

    if (docCount > 0 || tagCount > 0) {
      alert(
        `ไม่สามารถลบหมวดหมู่ "${categoryName}" ได้\n\n` +
          `- มีเอกสารใช้งาน: ${docCount} รายการ\n` +
          `- มีแท็กในหมวดหมู่: ${tagCount} รายการ\n\n` +
          `กรุณาย้ายหรือลบเอกสารและแท็กก่อน`
      )
      return
    }

    if (!confirm(`คุณต้องการลบหมวดหมู่ "${categoryName}" ใช่หรือไม่?`)) return

    setDeletingCategoryId(categoryId)
    try {
      const res = await fetch(`/api/document-categories?categoryId=${categoryId}`, {
        method: "DELETE",
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to delete category")
      }

      alert("ลบหมวดหมู่สำเร็จ")
      fetchData()
    } catch (error: any) {
      alert(`เกิดข้อผิดพลาด: ${error.message}`)
    } finally {
      setDeletingCategoryId(null)
    }
  }

  const handleDeleteTag = async (tagId: string, tagName: string) => {
    const tag = tags.find((t) => t.TagId === tagId)
    const docCount = tag?.documentCount || 0

    if (docCount > 0) {
      alert(
        `ไม่สามารถลบแท็ก "${tagName}" ได้\n\n` +
          `มีเอกสารใช้งาน: ${docCount} รายการ\n\n` +
          `กรุณาย้ายหรือลบเอกสารที่ใช้แท็กนี้ก่อน`
      )
      return
    }

    if (!confirm(`คุณต้องการลบแท็ก "${tagName}" ใช่หรือไม่?`)) return

    setDeletingTagId(tagId)
    try {
      const res = await fetch(`/api/document-tags?tagId=${tagId}`, {
        method: "DELETE",
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to delete tag")
      }

      alert("ลบแท็กสำเร็จ")
      fetchData()
    } catch (error: any) {
      alert(`เกิดข้อผิดพลาด: ${error.message}`)
    } finally {
      setDeletingTagId(null)
    }
  }

  const handleUpdateCategory = async (categoryId: string) => {
    if (!editCategoryName.trim()) return alert("กรุณากรอกชื่อหมวดหมู่")

    setSavingCategoryId(categoryId)
    try {
      const res = await fetch("/api/document-categories", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId,
          name: editCategoryName.trim(),
          description: editCategoryDesc.trim() || null,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to update category")
      }

      alert("อัปเดตหมวดหมู่สำเร็จ")
      setEditingCategoryId(null)
      setEditCategoryName("")
      setEditCategoryDesc("")
      fetchData()
    } catch (error: any) {
      alert(`เกิดข้อผิดพลาด: ${error.message}`)
    } finally {
      setSavingCategoryId(null)
    }
  }

  const startEditCategory = (category: Category) => {
    setEditingCategoryId(category.CategoryId)
    setEditCategoryName(category.Name)
    setEditCategoryDesc(category.Description || "")
  }

  const cancelEditCategory = () => {
    setEditingCategoryId(null)
    setEditCategoryName("")
    setEditCategoryDesc("")
  }

  const handleUpdateTag = async (tagId: string) => {
    if (!editTagName.trim()) return alert("กรุณากรอกชื่อแท็ก")

    setSavingTagId(tagId)
    try {
      const res = await fetch("/api/document-tags", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tagId,
          name: editTagName.trim(),
          description: editTagDesc.trim() || null,
          categoryId: editTagCategoryId || undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to update tag")
      }

      alert("อัปเดตแท็กสำเร็จ")
      setEditingTagId(null)
      setEditTagName("")
      setEditTagDesc("")
      setEditTagCategoryId("")
      fetchData()
    } catch (error: any) {
      alert(`เกิดข้อผิดพลาด: ${error.message}`)
    } finally {
      setSavingTagId(null)
    }
  }

  const startEditTag = (tag: Tag) => {
    setEditingTagId(tag.TagId)
    setEditTagName(tag.Name)
    setEditTagDesc(tag.Description || "")
    setEditTagCategoryId(tag.CategoryId)
  }

  const cancelEditTag = () => {
    setEditingTagId(null)
    setEditTagName("")
    setEditTagDesc("")
    setEditTagCategoryId("")
  }

  const getCategoryName = (categoryId: string) => {
    const category = categories.find((c) => c.CategoryId === categoryId)
    return category?.Name || "ไม่ระบุ"
  }

  return (
    <div className="min-h-screen p-4 md:p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl md:text-4xl font-bold text-blue-600 mb-2">
            จัดการหมวดหมู่และแท็กเอกสาร
          </h1>
          <p className="text-gray-600">
            จัดการหมวดหมู่และแท็กสำหรับจัดเก็บและค้นหาเอกสาร
          </p>
        </div>

        {/* Tabs Container */}
        <div className="bg-white rounded-lg shadow-md p-4 md:p-6 mb-6">
          {/* Tab Navigation */}
          <div className="flex gap-4 border-b border-gray-200 mb-6">
            <button
              onClick={() => setActiveTab("categories")}
              className={`flex items-center gap-2 border-b-2 px-4 py-2 font-medium transition-colors ${
                activeTab === "categories"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-600 hover:text-blue-600"
              }`}
            >
              <FaFolder />
              หมวดหมู่
            </button>
            <button
              onClick={() => setActiveTab("tags")}
              className={`flex items-center gap-2 border-b-2 px-4 py-2 font-medium transition-colors ${
                activeTab === "tags"
                  ? "border-green-600 text-green-600"
                  : "border-transparent text-gray-600 hover:text-green-600"
              }`}
            >
              <FaTag />
              แท็ก
            </button>
          </div>

          {/* Categories Tab Content */}
          {activeTab === "categories" && (
            <div className="space-y-4 md:space-y-6">
              {/* New Category Button */}
              {!showNewCategoryForm && (
                <button
                  onClick={() => setShowNewCategoryForm(true)}
                  className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
                >
                  <FaPlus />
                  เพิ่มหมวดหมู่ใหม่
                </button>
              )}

              {/* New Category Form */}
              {showNewCategoryForm && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-4">เพิ่มหมวดหมู่ใหม่</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        ชื่อหมวดหมู่ <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                        placeholder="เช่น เอกสารลา, เอกสารสำคัญ"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        รายละเอียด
                      </label>
                      <input
                        type="text"
                        value={newCategoryDesc}
                        onChange={(e) => setNewCategoryDesc(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                        placeholder="รายละเอียดเพิ่มเติม (ไม่บังคับ)"
                      />
                    </div>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={handleCreateCategory}
                      className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                    >
                      <FaSave />
                      บันทึก
                    </button>
                    <button
                      onClick={() => {
                        setShowNewCategoryForm(false)
                        setNewCategoryName("")
                        setNewCategoryDesc("")
                      }}
                      className="flex items-center gap-2 bg-gray-400 text-white px-4 py-2 rounded-lg hover:bg-gray-500"
                    >
                      <FaTimes />
                      ยกเลิก
                    </button>
                  </div>
                </div>
              )}

              {/* Categories Table */}
              <div className="overflow-x-auto -mx-4 md:mx-0">
                <table className="w-full min-w-[800px] md:min-w-0">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">ชื่อหมวดหมู่</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">รายละเอียด</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">จำนวนเอกสาร</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">จำนวนแท็ก</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">สถานะ</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {isLoading ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-gray-500">กำลังโหลด...</td>
                      </tr>
                    ) : categories.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-gray-500">ไม่มีหมวดหมู่</td>
                      </tr>
                    ) : (
                      categories
                        .filter((category) => category.Name !== "อื่นๆ")
                        .map((category) => {
                          const docCount = category.documentCount || 0
                          const tagCount = category._count?.Tags || 0
                          const canDelete = docCount === 0 && tagCount === 0

                          return (
                            <tr key={category.CategoryId} className="hover:bg-gray-50">
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <FaFolder className="text-yellow-500" />
                                  {editingCategoryId === category.CategoryId ? (
                                    <input
                                      type="text"
                                      value={editCategoryName}
                                      onChange={(e) => setEditCategoryName(e.target.value)}
                                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                                    />
                                  ) : (
                                    <span className="font-medium text-gray-900">{category.Name}</span>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-gray-600">
                                {editingCategoryId === category.CategoryId ? (
                                  <input
                                    type="text"
                                    value={editCategoryDesc}
                                    onChange={(e) => setEditCategoryDesc(e.target.value)}
                                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                                  />
                                ) : (
                                  category.Description || "-"
                                )}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={`inline-flex rounded-full px-2 py-1 text-sm font-medium ${docCount > 0 ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-600"}`}>
                                  {docCount}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={`inline-flex rounded-full px-2 py-1 text-sm font-medium ${tagCount > 0 ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}>
                                  {tagCount}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                {canDelete ? (
                                  <span className="text-sm text-green-600">ลบได้</span>
                                ) : (
                                  <span className="flex items-center justify-center gap-1 text-sm text-orange-600">
                                    <FaExclamationTriangle />
                                    ใช้งานอยู่
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <div className="flex items-center justify-center gap-2">
                                  {editingCategoryId === category.CategoryId ? (
                                    <>
                                      <button
                                        onClick={() => handleUpdateCategory(category.CategoryId)}
                                        disabled={savingCategoryId === category.CategoryId}
                                        className="flex items-center gap-1 bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-green-700 disabled:opacity-50"
                                      >
                                        <FaSave />
                                        {savingCategoryId === category.CategoryId ? "กำลังบันทึก..." : "บันทึก"}
                                      </button>
                                      <button
                                        onClick={cancelEditCategory}
                                        className="flex items-center gap-1 bg-gray-400 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-gray-500"
                                      >
                                        <FaTimes />
                                        ยกเลิก
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button
                                        onClick={() => startEditCategory(category)}
                                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                                        title="แก้ไข"
                                      >
                                        <FaEdit />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteCategory(category.CategoryId, category.Name)}
                                        disabled={!canDelete || deletingCategoryId === category.CategoryId}
                                        className={`p-2 rounded-lg ${canDelete ? "text-red-600 hover:bg-red-50" : "cursor-not-allowed text-gray-300"}`}
                                        title={canDelete ? "ลบหมวดหมู่" : "ไม่สามารถลบได้ (มีเอกสารหรือแท็กใช้งาน)"}
                                      >
                                        <FaTrash />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )
                        })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Legend */}
              <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
                <p className="font-medium">หมายเหตุ:</p>
                <ul className="mt-2 list-inside list-disc space-y-1">
                  <li><span className="text-green-600">ลบได้</span> - หมวดหมู่ที่ไม่มีเอกสารและแท็กใช้งาน สามารถลบได้</li>
                  <li><span className="text-orange-600">ใช้งานอยู่</span> - หมวดหมู่ที่มีเอกสารหรือแท็กใช้งานอยู่ ต้องย้ายหรือลบเอกสารและแท็กก่อนจึงจะลบได้</li>
                </ul>
              </div>
            </div>
          )}

          {/* Tags Tab Content */}
          {activeTab === "tags" && (
            <div className="space-y-4 md:space-y-6">
              {/* New Tag Button */}
              {!showNewTagForm && (
                <button
                  onClick={() => setShowNewTagForm(true)}
                  className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
                >
                  <FaPlus />
                  เพิ่มแท็กใหม่
                </button>
              )}

              {/* New Tag Form */}
              {showNewTagForm && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-4">เพิ่มแท็กใหม่</h3>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        ชื่อแท็ก <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={newTagName}
                        onChange={(e) => setNewTagName(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-green-500 focus:outline-none"
                        placeholder="เช่น ใบลาป่วย, ใบลากิจ"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        หมวดหมู่ <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={newTagCategoryId}
                        onChange={(e) => setNewTagCategoryId(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-green-500 focus:outline-none"
                      >
                        <option value="">เลือกหมวดหมู่</option>
                        {categories
                          .filter((cat) => cat.Name !== "อื่นๆ")
                          .map((cat) => (
                            <option key={cat.CategoryId} value={cat.CategoryId}>
                              {cat.Name}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        รายละเอียด
                      </label>
                      <input
                        type="text"
                        value={newTagDesc}
                        onChange={(e) => setNewTagDesc(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-green-500 focus:outline-none"
                        placeholder="รายละเอียดเพิ่มเติม (ไม่บังคับ)"
                      />
                    </div>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={handleCreateTag}
                      className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                    >
                      <FaSave />
                      บันทึก
                    </button>
                    <button
                      onClick={() => {
                        setShowNewTagForm(false)
                        setNewTagName("")
                        setNewTagDesc("")
                        setNewTagCategoryId("")
                      }}
                      className="flex items-center gap-2 bg-gray-400 text-white px-4 py-2 rounded-lg hover:bg-gray-500"
                    >
                      <FaTimes />
                      ยกเลิก
                    </button>
                  </div>
                </div>
              )}

              {/* Tags Table */}
              <div className="overflow-x-auto -mx-4 md:mx-0">
                <table className="w-full min-w-[800px] md:min-w-0">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">ชื่อแท็ก</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">หมวดหมู่</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">รายละเอียด</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">จำนวนเอกสาร</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">สถานะ</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {isLoading ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-gray-500">กำลังโหลด...</td>
                      </tr>
                    ) : tags.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-gray-500">ไม่มีแท็ก</td>
                      </tr>
                    ) : (
                      tags.map((tag) => {
                        const docCount = tag.documentCount || 0
                        const canDelete = docCount === 0

                        return (
                          <tr key={tag.TagId} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <FaTag className="text-blue-500" />
                                {editingTagId === tag.TagId ? (
                                  <input
                                    type="text"
                                    value={editTagName}
                                    onChange={(e) => setEditTagName(e.target.value)}
                                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-green-500 focus:outline-none"
                                  />
                                ) : (
                                  <span className="font-medium text-gray-900">{tag.Name}</span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-gray-600">
                              {editingTagId === tag.TagId ? (
                                <select
                                  value={editTagCategoryId}
                                  onChange={(e) => setEditTagCategoryId(e.target.value)}
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-green-500 focus:outline-none"
                                >
                                  {categories
                                    .filter((cat) => cat.Name !== "อื่นๆ")
                                    .map((cat) => (
                                      <option key={cat.CategoryId} value={cat.CategoryId}>
                                        {cat.Name}
                                      </option>
                                    ))}
                                </select>
                              ) : (
                                getCategoryName(tag.CategoryId)
                              )}
                            </td>
                            <td className="px-4 py-3 text-gray-600">
                              {editingTagId === tag.TagId ? (
                                <input
                                  type="text"
                                  value={editTagDesc}
                                  onChange={(e) => setEditTagDesc(e.target.value)}
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-green-500 focus:outline-none"
                                />
                              ) : (
                                tag.Description || "-"
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`inline-flex rounded-full px-2 py-1 text-sm font-medium ${docCount > 0 ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-600"}`}>
                                {docCount}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              {canDelete ? (
                                <span className="text-sm text-green-600">ลบได้</span>
                              ) : (
                                <span className="flex items-center justify-center gap-1 text-sm text-orange-600" title="มีเอกสารใช้งานอยู่">
                                  <FaExclamationTriangle />
                                  ใช้งานอยู่
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex items-center justify-center gap-2">
                                {editingTagId === tag.TagId ? (
                                  <>
                                    <button
                                      onClick={() => handleUpdateTag(tag.TagId)}
                                      disabled={savingTagId === tag.TagId}
                                      className="flex items-center gap-1 bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-green-700 disabled:opacity-50"
                                    >
                                      <FaSave />
                                      {savingTagId === tag.TagId ? "กำลังบันทึก..." : "บันทึก"}
                                    </button>
                                    <button
                                      onClick={cancelEditTag}
                                      className="flex items-center gap-1 bg-gray-400 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-gray-500"
                                    >
                                      <FaTimes />
                                      ยกเลิก
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => startEditTag(tag)}
                                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                                      title="แก้ไข"
                                    >
                                      <FaEdit />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteTag(tag.TagId, tag.Name)}
                                      disabled={!canDelete || deletingTagId === tag.TagId}
                                      className={`p-2 rounded-lg ${canDelete ? "text-red-600 hover:bg-red-50" : "cursor-not-allowed text-gray-300"}`}
                                      title={canDelete ? "ลบแท็ก" : "ไม่สามารถลบได้ (มีเอกสารใช้งาน)"}
                                    >
                                      <FaTrash />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Legend */}
              <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
                <p className="font-medium">หมายเหตุ:</p>
                <ul className="mt-2 list-inside list-disc space-y-1">
                  <li><span className="text-green-600">ลบได้</span> - แท็กที่ไม่มีเอกสารใช้งาน สามารถลบได้</li>
                  <li><span className="text-orange-600">ใช้งานอยู่</span> - แท็กที่มีเอกสารใช้งานอยู่ ต้องย้ายหรือลบเอกสารก่อนจึงจะลบได้</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
