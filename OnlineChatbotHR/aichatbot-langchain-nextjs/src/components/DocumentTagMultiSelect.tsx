"use client"

import React, { useState, useEffect } from "react"
import { FaTimes } from "react-icons/fa"

type Tag = {
  TagId: string
  Name: string
  Description: string | null
}

type DocumentTagMultiSelectProps = {
  selectedTagIds: string[]
  onTagsChange: (tagIds: string[]) => void
  disabled?: boolean
}

export default function DocumentTagMultiSelect({
  selectedTagIds,
  onTagsChange,
  disabled = false,
}: DocumentTagMultiSelectProps) {
  const [tags, setTags] = useState<Tag[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")

  useEffect(() => {
    fetchTags()
  }, [])

  const fetchTags = async () => {
    try {
      setIsLoading(true)
      const res = await fetch("/api/document-tags")
      if (!res.ok) throw new Error("Failed to fetch tags")
      const data = await res.json()
      setTags(data)
    } catch (error) {
      console.error("Error fetching tags:", error)
    } finally {
      setIsLoading(false)
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

  const filteredTags = tags.filter(tag =>
    tag.Name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const selectedTags = tags.filter(tag => selectedTagIds.includes(tag.TagId))

  if (isLoading) {
    return (
      <div className="space-y-3">
        <label className="block text-lg font-semibold mb-2">Tags</label>
        <div className="w-full p-3 rounded-md border-2 border-gray-300 bg-gray-100 animate-pulse h-12"></div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <label className="block text-lg font-semibold mb-2">
        Tags (เลือกได้หลายแท็ก)
      </label>

      {/* Selected Tags Display */}
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-2 p-3 bg-blue-50 rounded-md border-2 border-blue-200">
          {selectedTags.map(tag => (
            <span
              key={tag.TagId}
              className="inline-flex items-center gap-2 bg-blue-500 text-white px-3 py-1 rounded-full text-sm font-medium"
            >
              {tag.Name}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeTag(tag.TagId)}
                  className="hover:bg-blue-600 rounded-full p-1"
                >
                  <FaTimes className="text-xs" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Search Box */}
      <input
        type="text"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="ค้นหา tags..."
        className="w-full p-3 rounded-md border-2 border-gray-300 focus:border-blue-500 focus:outline-none"
        disabled={disabled}
      />

      {/* Tag Selection Grid */}
      <div className="max-h-64 overflow-y-auto border-2 border-gray-300 rounded-md p-3 bg-white">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {filteredTags.map(tag => (
            <label
              key={tag.TagId}
              className={`flex items-center gap-2 p-2 rounded cursor-pointer transition ${
                selectedTagIds.includes(tag.TagId)
                  ? "bg-blue-100 border-2 border-blue-500"
                  : "bg-gray-50 border-2 border-gray-200 hover:bg-gray-100"
              } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <input
                type="checkbox"
                checked={selectedTagIds.includes(tag.TagId)}
                onChange={() => toggleTag(tag.TagId)}
                disabled={disabled}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <span className="text-sm font-medium flex-1">{tag.Name}</span>
            </label>
          ))}
        </div>
        {filteredTags.length === 0 && (
          <p className="text-center text-gray-500 py-4">ไม่พบ tags</p>
        )}
      </div>

      <p className="text-sm text-gray-600">
        เลือกแล้ว: {selectedTags.length} tags
      </p>
    </div>
  )
}
