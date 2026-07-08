"use client"

import React, { useState, useEffect } from "react"

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

type DocumentTagSelectorProps = {
  selectedTagId: string
  selectedSubTagId: string
  onTagChange: (tagId: string) => void
  onSubTagChange: (subTagId: string) => void
  disabled?: boolean
}

export default function DocumentTagSelector({
  selectedTagId,
  selectedSubTagId,
  onTagChange,
  onSubTagChange,
  disabled = false,
}: DocumentTagSelectorProps) {
  const [tags, setTags] = useState<Tag[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [subTags, setSubTags] = useState<SubTag[]>([])

  useEffect(() => {
    fetchTags()
  }, [])

  useEffect(() => {
    if (selectedTagId) {
      const tag = tags.find((t) => t.TagId === selectedTagId)
      setSubTags(tag?.SubTags || [])
    } else {
      setSubTags([])
    }
  }, [selectedTagId, tags])

  const fetchTags = async () => {
    try {
      setIsLoading(true)
      const res = await fetch("/api/document-tags?includeSubTags=true")
      if (!res.ok) throw new Error("Failed to fetch tags")
      const data = await res.json()
      setTags(data)
    } catch (error) {
      console.error("Error fetching tags:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleTagChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newTagId = e.target.value
    onTagChange(newTagId)
    onSubTagChange("")
  }

  const handleSubTagChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onSubTagChange(e.target.value)
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div>
          <label className="block text-lg font-semibold mb-2">
            หมวดหมู่หลัก
          </label>
          <div className="w-full p-3 rounded-md border-2 border-gray-300 bg-gray-100 animate-pulse h-12"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div>
        <label htmlFor="tag" className="block text-lg font-semibold mb-2">
          หมวดหมู่หลัก
        </label>
        <div className="relative">
          <select
            id="tag"
            value={selectedTagId}
            onChange={handleTagChange}
            className="w-full p-3 pr-12 rounded-md border-2 border-gray-300 focus:border-blue-500 focus:outline-none bg-white appearance-none"
            disabled={disabled}
          >
            <option value="">-- เลือกหมวดหมู่หลัก --</option>
            {tags.map((tag) => (
              <option key={tag.TagId} value={tag.TagId}>
                {tag.Name}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-500">
            ▼
          </span>
        </div>
      </div>

      {selectedTagId && subTags.length > 0 && (
        <div className="pl-4 border-l-4 border-blue-500">
          <label htmlFor="subtag" className="block text-lg font-semibold mb-2">
            หมวดหมู่ย่อย
          </label>
          <div className="relative">
            <select
              id="subtag"
              value={selectedSubTagId}
              onChange={handleSubTagChange}
              className="w-full p-3 pr-12 rounded-md border-2 border-gray-300 focus:border-blue-500 focus:outline-none bg-white appearance-none"
              disabled={disabled}
            >
              <option value="">-- เลือกหมวดหมู่ย่อย --</option>
              {subTags.map((subTag) => (
                <option key={subTag.SubTagId} value={subTag.SubTagId}>
                  {subTag.Name}
                  {subTag.IsDynamic && " 🔄"}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-500">
              ▼
            </span>
          </div>
          {selectedSubTagId && (
            <p className="text-sm text-gray-600 mt-1">
              {subTags.find((st) => st.SubTagId === selectedSubTagId)
                ?.Description || ""}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
