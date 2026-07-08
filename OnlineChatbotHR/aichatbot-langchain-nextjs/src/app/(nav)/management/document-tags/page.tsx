"use client"

import React, { useState, useEffect } from "react"
import { FaPlus, FaEdit, FaTrash, FaSave, FaTimes } from "react-icons/fa"

type SubTag = {
  SubTagId: string
  Name: string
  Description: string | null
  TagId: string
  DisplayOrder: number
  IsDynamic: boolean
}

type Tag = {
  TagId: string
  Name: string
  Description: string | null
  DisplayOrder: number
  SubTags?: SubTag[]
}

export default function DocumentTagsPage() {
  const [tags, setTags] = useState<Tag[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editingTag, setEditingTag] = useState<string | null>(null)
  const [editingSubTag, setEditingSubTag] = useState<string | null>(null)
  const [newTagName, setNewTagName] = useState("")
  const [newTagDesc, setNewTagDesc] = useState("")
  const [showNewTagForm, setShowNewTagForm] = useState(false)
  const [expandedTags, setExpandedTags] = useState<Set<string>>(new Set())
  const [newSubTagForms, setNewSubTagForms] = useState<Set<string>>(new Set())
  const [editForms, setEditForms] = useState<{
    [key: string]: { name: string; description: string; isDynamic?: boolean }
  }>({})

  useEffect(() => {
    fetchTags()
  }, [])

  const fetchTags = async () => {
    try {
      setIsLoading(true)
      const res = await fetch("/api/document-tags?includeSubTags=true")
      if (!res.ok) throw new Error("Failed to fetch tags")
      const data = await res.json()
      setTags(data)
    } catch (error) {
      console.error("Error:", error)
      alert("ไม่สามารถโหลดข้อมูลแท็กได้")
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return alert("กรุณากรอกชื่อแท็ก")

    try {
      const res = await fetch("/api/document-tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newTagName.trim(),
          description: newTagDesc.trim() || null,
          displayOrder: tags.length,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to create tag")
      }

      alert("สร้างแท็กสำเร็จ")
      setNewTagName("")
      setNewTagDesc("")
      setShowNewTagForm(false)
      fetchTags()
    } catch (error: any) {
      alert(`เกิดข้อผิดพลาด: ${error.message}`)
    }
  }

  const handleUpdateTag = async (tagId: string) => {
    const form = editForms[tagId]
    if (!form || !form.name.trim()) return alert("กรุณากรอกชื่อแท็ก")

    try {
      const res = await fetch("/api/document-tags", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tagId,
          name: form.name.trim(),
          description: form.description.trim() || null,
        }),
      })

      if (!res.ok) throw new Error("Failed to update tag")

      alert("อัปเดตแท็กสำเร็จ")
      setEditingTag(null)
      setEditForms((prev) => {
        const newForms = { ...prev }
        delete newForms[tagId]
        return newForms
      })
      fetchTags()
    } catch (error: any) {
      alert(`เกิดข้อผิดพลาด: ${error.message}`)
    }
  }

  const handleDeleteTag = async (tagId: string, tagName: string) => {
    if (!confirm(`คุณต้องการลบแท็ก "${tagName}" ใช่หรือไม่?`)) return

    try {
      const res = await fetch(`/api/document-tags?tagId=${tagId}`, {
        method: "DELETE",
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to delete tag")
      }

      alert("ลบแท็กสำเร็จ")
      fetchTags()
    } catch (error: any) {
      alert(`เกิดข้อผิดพลาด: ${error.message}`)
    }
  }

  const handleCreateSubTag = async (tagId: string) => {
    const form = editForms[`new-${tagId}`]
    if (!form || !form.name.trim()) return alert("กรุณากรอกชื่อซับแท็ก")

    try {
      const tag = tags.find((t) => t.TagId === tagId)
      const res = await fetch("/api/document-subtags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tagId,
          name: form.name.trim(),
          description: form.description.trim() || null,
          displayOrder: tag?.SubTags?.length || 0,
          isDynamic: form.isDynamic || false,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to create subtag")
      }

      alert("สร้างซับแท็กสำเร็จ")
      setNewSubTagForms((prev) => {
        const newSet = new Set(prev)
        newSet.delete(tagId)
        return newSet
      })
      setEditForms((prev) => {
        const newForms = { ...prev }
        delete newForms[`new-${tagId}`]
        return newForms
      })
      fetchTags()
    } catch (error: any) {
      alert(`เกิดข้อผิดพลาด: ${error.message}`)
    }
  }

  const handleUpdateSubTag = async (subTagId: string) => {
    const form = editForms[subTagId]
    if (!form || !form.name.trim()) return alert("กรุณากรอกชื่อซับแท็ก")

    try {
      const res = await fetch("/api/document-subtags", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subTagId,
          name: form.name.trim(),
          description: form.description.trim() || null,
          isDynamic: form.isDynamic,
        }),
      })

      if (!res.ok) throw new Error("Failed to update subtag")

      alert("อัปเดตซับแท็กสำเร็จ")
      setEditingSubTag(null)
      setEditForms((prev) => {
        const newForms = { ...prev }
        delete newForms[subTagId]
        return newForms
      })
      fetchTags()
    } catch (error: any) {
      alert(`เกิดข้อผิดพลาด: ${error.message}`)
    }
  }

  const handleDeleteSubTag = async (subTagId: string, subTagName: string) => {
    if (!confirm(`คุณต้องการลบซับแท็ก "${subTagName}" ใช่หรือไม่?`)) return

    try {
      const res = await fetch(`/api/document-subtags?subTagId=${subTagId}`, {
        method: "DELETE",
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to delete subtag")
      }

      alert("ลบซับแท็กสำเร็จ")
      fetchTags()
    } catch (error: any) {
      alert(`เกิดข้อผิดพลาด: ${error.message}`)
    }
  }

  const toggleExpand = (tagId: string) => {
    setExpandedTags((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(tagId)) {
        newSet.delete(tagId)
      } else {
        newSet.add(tagId)
      }
      return newSet
    })
  }

  const startEditTag = (tag: Tag) => {
    setEditingTag(tag.TagId)
    setEditForms((prev) => ({
      ...prev,
      [tag.TagId]: { name: tag.Name, description: tag.Description || "" },
    }))
  }

  const startEditSubTag = (subTag: SubTag) => {
    setEditingSubTag(subTag.SubTagId)
    setEditForms((prev) => ({
      ...prev,
      [subTag.SubTagId]: {
        name: subTag.Name,
        description: subTag.Description || "",
        isDynamic: subTag.IsDynamic,
      },
    }))
  }

  const startNewSubTag = (tagId: string) => {
    setNewSubTagForms((prev) => new Set(prev).add(tagId))
    setEditForms((prev) => ({
      ...prev,
      [`new-${tagId}`]: { name: "", description: "", isDynamic: false },
    }))
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-blue-600 mb-2">
            จัดการแท็กเอกสาร
          </h1>
          <p className="text-gray-600">
            จัดการหมวดหมู่และซับหมวดหมู่สำหรับเอกสาร
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          {!showNewTagForm ? (
            <button
              onClick={() => setShowNewTagForm(true)}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition"
            >
              <FaPlus /> เพิ่มแท็กหลักใหม่
            </button>
          ) : (
            <div className="border-2 border-blue-300 rounded-lg p-4 bg-blue-50">
              <h3 className="font-semibold text-lg mb-3">เพิ่มแท็กหลักใหม่</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    ชื่อแท็ก *
                  </label>
                  <input
                    type="text"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    className="w-full p-2 border rounded-md"
                    placeholder="เช่น สวัสดิการสถาบันฯ"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    คำอธิบาย
                  </label>
                  <input
                    type="text"
                    value={newTagDesc}
                    onChange={(e) => setNewTagDesc(e.target.value)}
                    className="w-full p-2 border rounded-md"
                    placeholder="คำอธิบายเพิ่มเติม (ถ้ามี)"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleCreateTag}
                    className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
                  >
                    <FaSave /> บันทึก
                  </button>
                  <button
                    onClick={() => {
                      setShowNewTagForm(false)
                      setNewTagName("")
                      setNewTagDesc("")
                    }}
                    className="flex items-center gap-2 bg-gray-400 text-white px-4 py-2 rounded-md hover:bg-gray-500"
                  >
                    <FaTimes /> ยกเลิก
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          {tags.map((tag) => (
            <div key={tag.TagId} className="bg-white rounded-lg shadow-md">
              <div className="p-4 border-b">
                {editingTag === tag.TagId ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        ชื่อแท็ก *
                      </label>
                      <input
                        type="text"
                        value={editForms[tag.TagId]?.name || ""}
                        onChange={(e) =>
                          setEditForms((prev) => ({
                            ...prev,
                            [tag.TagId]: {
                              ...prev[tag.TagId],
                              name: e.target.value,
                            },
                          }))
                        }
                        className="w-full p-2 border rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        คำอธิบาย
                      </label>
                      <input
                        type="text"
                        value={editForms[tag.TagId]?.description || ""}
                        onChange={(e) =>
                          setEditForms((prev) => ({
                            ...prev,
                            [tag.TagId]: {
                              ...prev[tag.TagId],
                              description: e.target.value,
                            },
                          }))
                        }
                        className="w-full p-2 border rounded-md"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleUpdateTag(tag.TagId)}
                        className="flex items-center gap-2 bg-green-600 text-white px-3 py-1 rounded-md hover:bg-green-700 text-sm"
                      >
                        <FaSave /> บันทึก
                      </button>
                      <button
                        onClick={() => {
                          setEditingTag(null)
                          setEditForms((prev) => {
                            const newForms = { ...prev }
                            delete newForms[tag.TagId]
                            return newForms
                          })
                        }}
                        className="flex items-center gap-2 bg-gray-400 text-white px-3 py-1 rounded-md hover:bg-gray-500 text-sm"
                      >
                        <FaTimes /> ยกเลิก
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div
                      className="flex-1 cursor-pointer"
                      onClick={() => toggleExpand(tag.TagId)}
                    >
                      <h2 className="text-xl font-bold text-blue-600">
                        {tag.Name}
                      </h2>
                      {tag.Description && (
                        <p className="text-sm text-gray-600">
                          {tag.Description}
                        </p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">
                        {tag.SubTags?.length || 0} ซับแท็ก
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => startEditTag(tag)}
                        className="text-blue-600 hover:text-blue-800 p-2"
                        title="แก้ไข"
                      >
                        <FaEdit />
                      </button>
                      <button
                        onClick={() => handleDeleteTag(tag.TagId, tag.Name)}
                        className="text-red-600 hover:text-red-800 p-2"
                        title="ลบ"
                      >
                        <FaTrash />
                      </button>
                      <button
                        onClick={() => toggleExpand(tag.TagId)}
                        className="text-gray-600 hover:text-gray-800 p-2 text-xl"
                      >
                        {expandedTags.has(tag.TagId) ? "▼" : "▶"}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {expandedTags.has(tag.TagId) && (
                <div className="p-4 bg-gray-50">
                  <div className="mb-4">
                    {!newSubTagForms.has(tag.TagId) ? (
                      <button
                        onClick={() => startNewSubTag(tag.TagId)}
                        className="flex items-center gap-2 bg-green-600 text-white px-3 py-1 rounded-md hover:bg-green-700 text-sm"
                      >
                        <FaPlus /> เพิ่มซับแท็ก
                      </button>
                    ) : (
                      <div className="border-2 border-green-300 rounded-lg p-3 bg-green-50">
                        <h4 className="font-semibold mb-2">เพิ่มซับแท็กใหม่</h4>
                        <div className="space-y-2">
                          <div>
                            <label className="block text-sm font-medium mb-1">
                              ชื่อซับแท็ก *
                            </label>
                            <input
                              type="text"
                              value={editForms[`new-${tag.TagId}`]?.name || ""}
                              onChange={(e) =>
                                setEditForms((prev) => ({
                                  ...prev,
                                  [`new-${tag.TagId}`]: {
                                    ...prev[`new-${tag.TagId}`],
                                    name: e.target.value,
                                  },
                                }))
                              }
                              className="w-full p-2 border rounded-md text-sm"
                              placeholder="เช่น ประกันสุขภาพกลุ่ม"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1">
                              คำอธิบาย
                            </label>
                            <input
                              type="text"
                              value={
                                editForms[`new-${tag.TagId}`]?.description || ""
                              }
                              onChange={(e) =>
                                setEditForms((prev) => ({
                                  ...prev,
                                  [`new-${tag.TagId}`]: {
                                    ...prev[`new-${tag.TagId}`],
                                    description: e.target.value,
                                  },
                                }))
                              }
                              className="w-full p-2 border rounded-md text-sm"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id={`dynamic-new-${tag.TagId}`}
                              checked={
                                editForms[`new-${tag.TagId}`]?.isDynamic ||
                                false
                              }
                              onChange={(e) =>
                                setEditForms((prev) => ({
                                  ...prev,
                                  [`new-${tag.TagId}`]: {
                                    ...prev[`new-${tag.TagId}`],
                                    isDynamic: e.target.checked,
                                  },
                                }))
                              }
                              className="w-4 h-4"
                            />
                            <label
                              htmlFor={`dynamic-new-${tag.TagId}`}
                              className="text-sm"
                            >
                              เป็นซับแท็กแบบไดนามิก (เช่น ปี พ.ศ.)
                            </label>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleCreateSubTag(tag.TagId)}
                              className="flex items-center gap-2 bg-green-600 text-white px-3 py-1 rounded-md hover:bg-green-700 text-sm"
                            >
                              <FaSave /> บันทึก
                            </button>
                            <button
                              onClick={() => {
                                setNewSubTagForms((prev) => {
                                  const newSet = new Set(prev)
                                  newSet.delete(tag.TagId)
                                  return newSet
                                })
                                setEditForms((prev) => {
                                  const newForms = { ...prev }
                                  delete newForms[`new-${tag.TagId}`]
                                  return newForms
                                })
                              }}
                              className="flex items-center gap-2 bg-gray-400 text-white px-3 py-1 rounded-md hover:bg-gray-500 text-sm"
                            >
                              <FaTimes /> ยกเลิก
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    {tag.SubTags?.map((subTag) => (
                      <div
                        key={subTag.SubTagId}
                        className="bg-white p-3 rounded-md border"
                      >
                        {editingSubTag === subTag.SubTagId ? (
                          <div className="space-y-2">
                            <div>
                              <label className="block text-sm font-medium mb-1">
                                ชื่อซับแท็ก *
                              </label>
                              <input
                                type="text"
                                value={editForms[subTag.SubTagId]?.name || ""}
                                onChange={(e) =>
                                  setEditForms((prev) => ({
                                    ...prev,
                                    [subTag.SubTagId]: {
                                      ...prev[subTag.SubTagId],
                                      name: e.target.value,
                                    },
                                  }))
                                }
                                className="w-full p-2 border rounded-md text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-1">
                                คำอธิบาย
                              </label>
                              <input
                                type="text"
                                value={
                                  editForms[subTag.SubTagId]?.description || ""
                                }
                                onChange={(e) =>
                                  setEditForms((prev) => ({
                                    ...prev,
                                    [subTag.SubTagId]: {
                                      ...prev[subTag.SubTagId],
                                      description: e.target.value,
                                    },
                                  }))
                                }
                                className="w-full p-2 border rounded-md text-sm"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                id={`dynamic-${subTag.SubTagId}`}
                                checked={
                                  editForms[subTag.SubTagId]?.isDynamic ||
                                  false
                                }
                                onChange={(e) =>
                                  setEditForms((prev) => ({
                                    ...prev,
                                    [subTag.SubTagId]: {
                                      ...prev[subTag.SubTagId],
                                      isDynamic: e.target.checked,
                                    },
                                  }))
                                }
                                className="w-4 h-4"
                              />
                              <label
                                htmlFor={`dynamic-${subTag.SubTagId}`}
                                className="text-sm"
                              >
                                เป็นซับแท็กแบบไดนามิก
                              </label>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() =>
                                  handleUpdateSubTag(subTag.SubTagId)
                                }
                                className="flex items-center gap-2 bg-green-600 text-white px-3 py-1 rounded-md hover:bg-green-700 text-sm"
                              >
                                <FaSave /> บันทึก
                              </button>
                              <button
                                onClick={() => {
                                  setEditingSubTag(null)
                                  setEditForms((prev) => {
                                    const newForms = { ...prev }
                                    delete newForms[subTag.SubTagId]
                                    return newForms
                                  })
                                }}
                                className="flex items-center gap-2 bg-gray-400 text-white px-3 py-1 rounded-md hover:bg-gray-500 text-sm"
                              >
                                <FaTimes /> ยกเลิก
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{subTag.Name}</p>
                              {subTag.Description && (
                                <p className="text-sm text-gray-600">
                                  {subTag.Description}
                                </p>
                              )}
                              {subTag.IsDynamic && (
                                <span className="inline-block mt-1 text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                                  ไดนามิก
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => startEditSubTag(subTag)}
                                className="text-blue-600 hover:text-blue-800 p-1 text-sm"
                                title="แก้ไข"
                              >
                                <FaEdit />
                              </button>
                              <button
                                onClick={() =>
                                  handleDeleteSubTag(
                                    subTag.SubTagId,
                                    subTag.Name
                                  )
                                }
                                className="text-red-600 hover:text-red-800 p-1 text-sm"
                                title="ลบ"
                              >
                                <FaTrash />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
