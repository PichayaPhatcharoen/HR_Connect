"use client"

import React, { useState, useEffect } from "react"
import { FaTimes, FaPlus, FaCheck } from "react-icons/fa"

type Tag = {
  TagId: string
  Name: string
  Description: string | null
  CategoryId: string
}

type Category = {
  CategoryId: string
  Name: string
  Description: string | null
  Tags: Tag[]
}

type CategoryTagSelectorProps = {
  selectedCategoryId: string | null
  selectedTagIds: string[]
  customCategoryName?: string
  customCategoryDesc?: string
  onCategoryChange: (categoryId: string | null) => void
  onTagsChange: (tagIds: string[]) => void
  onCustomCategoryNameChange?: (name: string) => void
  onCustomCategoryDescChange?: (desc: string) => void
  disabled?: boolean
}

export default function CategoryTagSelector({
  selectedCategoryId,
  selectedTagIds,
  customCategoryName = "",
  customCategoryDesc = "",
  onCategoryChange,
  onTagsChange,
  onCustomCategoryNameChange,
  onCustomCategoryDescChange,
  disabled = false,
}: CategoryTagSelectorProps) {
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [availableTags, setAvailableTags] = useState<Tag[]>([])
  const [showCustomTagInput, setShowCustomTagInput] = useState(false)
  const [customTagName, setCustomTagName] = useState("")
  const [customTagDesc, setCustomTagDesc] = useState("")
  const [isAddingTag, setIsAddingTag] = useState(false)

  useEffect(() => {
    fetchCategories()
  }, [])

  useEffect(() => {
    if (selectedCategoryId) {
      const category = categories.find(c => c.CategoryId === selectedCategoryId)
      setAvailableTags(category?.Tags || [])
    } else {
      setAvailableTags([])
    }
  }, [selectedCategoryId, categories])

  const fetchCategories = async () => {
    try {
      setIsLoading(true)
      const res = await fetch("/api/document-categories?includeTags=true")
      if (!res.ok) throw new Error("Failed to fetch categories")
      const data = await res.json()
      setCategories(data)
    } catch (error) {
      console.error("Error fetching categories:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCategoryId = e.target.value
    onCategoryChange(newCategoryId)
    onTagsChange([])
    setShowCustomTagInput(false)
    setCustomTagName("")
    // Reset custom category name when changing category
    if (onCustomCategoryNameChange) {
      onCustomCategoryNameChange("")
    }
    if (onCustomCategoryDescChange) {
      onCustomCategoryDescChange("")
    }
  }

  const toggleTag = (tagId: string) => {
    if (selectedTagIds.includes(tagId)) {
      onTagsChange(selectedTagIds.filter(id => id !== tagId))
    } else {
      onTagsChange([...selectedTagIds, tagId])
    }
  }

  const removeTag = (tagId: string) => {
    onTagsChange(selectedTagIds.filter(id => id !== tagId))
  }

  const handleAddCustomTag = async () => {
    if (!customTagName.trim() || !selectedCategoryId) return

    setIsAddingTag(true)
    try {
      // Check if we're in "others" category with a custom category name
      const isOthersCategory = selectedCategory?.Name === "อื่นๆ"
      const hasCustomCategoryName = customCategoryName?.trim()
      
      let targetCategoryId = selectedCategoryId
      
      // If creating tag in "อื่นๆ" with custom category name,
      // we need to create the custom category FIRST, then create tag under it
      if (isOthersCategory && hasCustomCategoryName) {
        // Create custom category first
        const categoryRes = await fetch("/api/document-categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: customCategoryName.trim(),
            description: customCategoryDesc?.trim() || null,
          }),
        })
        
        if (!categoryRes.ok) {
          throw new Error("Failed to create custom category")
        }
        
        const newCategory = await categoryRes.json()
        targetCategoryId = newCategory.CategoryId
        
        // Update parent component's category state to the new category
        onCategoryChange(targetCategoryId)
        
        // Clear custom category inputs since we now have a real category
        if (onCustomCategoryNameChange) {
          onCustomCategoryNameChange("")
        }
        if (onCustomCategoryDescChange) {
          onCustomCategoryDescChange("")
        }
      }
      
      // Now create the tag under the correct category (either original or newly created)
      const res = await fetch("/api/document-tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: customTagName.trim(),
          description: customTagDesc.trim() || null,
          categoryId: targetCategoryId,
        }),
      })

      if (!res.ok) throw new Error("Failed to create tag")

      const newTag = await res.json()
      
      // Refresh categories to show updated tags
      await fetchCategories()
      
      // Select the newly created tag
      onTagsChange([...selectedTagIds, newTag.TagId])
      setCustomTagName("")
      setCustomTagDesc("")
      setShowCustomTagInput(false)
    } catch (error) {
      console.error("Error creating tag:", error)
      alert("เกิดข้อผิดพลาดในการเพิ่ม tag")
    } finally {
      setIsAddingTag(false)
    }
  }

  const selectedTags = availableTags.filter(tag => selectedTagIds.includes(tag.TagId))
  const selectedCategory = categories.find(c => c.CategoryId === selectedCategoryId)
  const isOthersCategory = selectedCategory?.Name === "อื่นๆ"

  if (isLoading) {
    return (
      <div className="space-y-4">
        <label className="block text-xl md:text-2xl font-semibold mb-3">หมวดหมู่และ Tags</label>
        <div className="w-full p-4 rounded-lg border-2 border-gray-300 bg-gray-100 animate-pulse h-14"></div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Category Selection */}
      <div>
        <label htmlFor="category" className="block text-xl md:text-2xl font-semibold mb-3">
          หมวดหมู่ <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <select
            id="category"
            value={selectedCategoryId || ""}
            onChange={handleCategoryChange}
            className="w-full p-4 pr-12 rounded-lg border-2 border-gray-300 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white appearance-none text-base md:text-lg transition-all"
            disabled={disabled}
            required
          >
            <option value="">-- เลือกหมวดหมู่ --</option>
            {categories.map(cat => (
              <option key={cat.CategoryId} value={cat.CategoryId}>
                {cat.Name}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-gray-500 text-lg">
            ▼
          </span>
        </div>
        {selectedCategory?.Description && !isOthersCategory && (
          <p className="text-base text-gray-600 mt-2">{selectedCategory.Description}</p>
        )}

        {/* Custom Category Name Input for "อื่นๆ" */}
        {isOthersCategory && (
          <div className="mt-4 p-4 bg-amber-50 border-2 border-amber-300 rounded-lg">
            <label htmlFor="customCategoryName" className="block text-lg font-semibold mb-2 text-amber-800">
              ระบุชื่อหมวดหมู่ <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="customCategoryName"
              value={customCategoryName}
              onChange={(e) => onCustomCategoryNameChange?.(e.target.value)}
              placeholder="กรอกชื่อหมวดหมู่ที่ต้องการ..."
              className="w-full p-3 rounded-lg border-2 border-amber-300 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200 text-base bg-white mb-3"
              disabled={disabled}
              required={isOthersCategory}
            />
            <label htmlFor="customCategoryDesc" className="block text-base font-medium mb-2 text-amber-700">
              รายละเอียด (ไม่บังคับ)
            </label>
            <input
              type="text"
              id="customCategoryDesc"
              value={customCategoryDesc}
              onChange={(e) => onCustomCategoryDescChange?.(e.target.value)}
              placeholder="รายละเอียดเพิ่มเติม..."
              className="w-full p-3 rounded-lg border-2 border-amber-300 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200 text-base bg-white"
              disabled={disabled}
            />
            <p className="text-sm text-amber-700 mt-2">
              เนื่องจากเลือก "อื่นๆ" กรุณาระบุชื่อหมวดหมู่ที่ต้องการ หมวดหมู่ใหม่จะถูกสร้างอัตโนมัติเมื่อบันทึกเอกสาร
            </p>
          </div>
        )}
      </div>

      {/* Tags Multi-Select */}
      {selectedCategoryId && (
        <div className="pl-4 md:pl-6 border-l-4 border-blue-500">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <label className="block text-xl md:text-2xl font-semibold">
              Tags <span className="text-base font-normal text-gray-500">(เลือกได้หลายอัน)</span>
            </label>
            <button
              type="button"
              onClick={() => setShowCustomTagInput(!showCustomTagInput)}
              className="flex items-center justify-center gap-2 text-base font-semibold bg-green-500 text-white px-4 py-2.5 rounded-lg hover:bg-green-600 disabled:opacity-50 transition-all shadow-sm hover:shadow-md"
              disabled={disabled}
            >
              <FaPlus />
              เพิ่ม Tag ใหม่
            </button>
          </div>

          {/* Custom Tag Input */}
          {showCustomTagInput && (
            <div className="mb-4 p-4 bg-green-50 border-2 border-green-300 rounded-lg shadow-sm space-y-3">
              <div>
                <label className="block text-lg font-semibold mb-2">ชื่อ Tag ใหม่ <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={customTagName}
                  onChange={(e) => setCustomTagName(e.target.value)}
                  placeholder="กรอกชื่อ tag..."
                  className="w-full p-3 rounded-lg border-2 border-gray-300 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200 text-base"
                  disabled={isAddingTag}
                />
              </div>
              <div>
                <label className="block text-base font-medium mb-2 text-green-800">รายละเอียด (ไม่บังคับ)</label>
                <input
                  type="text"
                  value={customTagDesc}
                  onChange={(e) => setCustomTagDesc(e.target.value)}
                  placeholder="รายละเอียดเพิ่มเติม..."
                  className="w-full p-3 rounded-lg border-2 border-gray-300 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200 text-base"
                  disabled={isAddingTag}
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleAddCustomTag}
                  className="flex-1 sm:flex-none bg-green-500 text-white px-6 py-3 rounded-lg hover:bg-green-600 disabled:opacity-50 font-semibold text-base transition-all"
                  disabled={isAddingTag || !customTagName.trim()}
                >
                  {isAddingTag ? "กำลังเพิ่ม..." : "เพิ่ม"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCustomTagInput(false)
                    setCustomTagName("")
                    setCustomTagDesc("")
                  }}
                  className="flex-1 sm:flex-none bg-gray-400 text-white px-6 py-3 rounded-lg hover:bg-gray-500 font-semibold text-base transition-all"
                  disabled={isAddingTag}
                >
                  ยกเลิก
                </button>
              </div>
            </div>
          )}

          {/* Selected Tags Display */}
          {selectedTags.length > 0 && (
            <div className="flex flex-wrap gap-3 p-4 bg-blue-50 rounded-lg border-2 border-blue-300 mb-4">
              {selectedTags.map(tag => (
                <span
                  key={tag.TagId}
                  className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-full text-base font-semibold shadow-sm"
                >
                  <FaCheck className="text-sm" />
                  {tag.Name}
                  {!disabled && (
                    <button
                      type="button"
                      onClick={() => removeTag(tag.TagId)}
                      className="hover:bg-blue-700 rounded-full p-1 transition-colors"
                    >
                      <FaTimes className="text-sm" />
                    </button>
                  )}
                </span>
              ))}
            </div>
          )}

          {/* Available Tags Grid */}
          {availableTags.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {availableTags.map(tag => {
                const isSelected = selectedTagIds.includes(tag.TagId)
                return (
                  <button
                    key={tag.TagId}
                    type="button"
                    onClick={() => toggleTag(tag.TagId)}
                    disabled={disabled}
                    className={`flex items-center gap-3 p-4 rounded-lg border-2 text-left transition-all duration-200 ${
                      isSelected
                        ? "bg-blue-100 border-blue-500 shadow-md"
                        : "bg-white border-gray-200 hover:border-blue-300 hover:bg-blue-50 shadow-sm"
                    } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:shadow-md"}`}
                  >
                    <div className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
                      isSelected ? "bg-blue-500 border-blue-500" : "border-gray-300"
                    }`}>
                      {isSelected && <FaCheck className="text-white text-xs" />}
                    </div>
                    <span className="text-base md:text-lg font-medium flex-1">{tag.Name}</span>
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="text-center p-6 bg-gray-50 rounded-lg border-2 border-gray-300 border-dashed">
              <p className="text-lg text-gray-600 mb-2">ไม่มี tags ในหมวดหมู่นี้</p>
              <p className="text-base text-gray-500">คลิก "เพิ่ม Tag ใหม่" เพื่อสร้าง tag ใหม่</p>
            </div>
          )}

          <p className="text-base text-gray-600 mt-4 font-medium">
            เลือกแล้ว: {selectedTags.length} tags
          </p>
        </div>
      )}
    </div>
  )
}
