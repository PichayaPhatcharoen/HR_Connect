"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { IoMdSearch } from "react-icons/io"
import { FaCheckCircle, FaFlag } from "react-icons/fa"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MarkdownRenderer } from "@/components/MarkdownRenderer"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

type Message = {
  messageId: string
  role: "user" | "assistant" | "system"
  content: string
  sources?: any
  createdAt: string
}

type Conversation = {
  conversationId: string
  channel: "WEB" | "LINE"
  status: "OPEN" | "CLOSED"
  sessionId: string | null
  lineUserId: string | null
  lineFriendName: string | null
  createdAt: string
  updatedAt: string
  messageCount: number
  messages: Message[]
}

type Stats = {
  totalConversations: number
  totalMessages: number
  webConversations: number
  lineConversations: number
  recentConversations: number
}

type TopQuestion = {
  question: string
  count: number
  status?: string
}

const REASON_LABELS: Record<string, string> = {
  suggested_contact: "แนะนำติดต่อ HR",
  no_document: "ไม่พบเอกสาร/ข้อมูล",
  no_data: "ไม่มีข้อมูลในเอกสาร",
  low_score: "ความเกี่ยวข้องต่ำ",
  prompt_fix_candidate: "RAG ดี แต่ตอบพลาด (Prompt)",
  unknown: "อื่นๆ",
}

type Unanswerable = {
  messageId: string
  conversationId: string
  userQuestion: string
  botResponse: string
  channel: "WEB" | "LINE"
  createdAt: string
  topScore?: number | null
  reason?:
    | "suggested_contact"
    | "no_document"
    | "no_data"
    | "low_score"
    | "prompt_fix_candidate"
    | "unknown"
  dataComplete?: boolean
}

export default function ChatHistoryPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [topQuestions, setTopQuestions] = useState<TopQuestion[]>([])
  const [unanswerable, setUnanswerable] = useState<Unanswerable[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedChannel, setSelectedChannel] = useState("ALL")
  const [selectedStatus, setSelectedStatus] = useState("ALL")
  const [sortOrder, setSortOrder] = useState("desc")
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [foundQuestionsPage, setFoundQuestionsPage] = useState(1)
  const [totalFoundQuestionsPages, setTotalFoundQuestionsPages] = useState(1)
  const [unanswerablePage, setUnanswerablePage] = useState(1)
  const [totalUnanswerablePages, setTotalUnanswerablePages] = useState(1)
  const [activeTab, setActiveTab] = useState<
    "conversations" | "found-questions" | "unanswerable"
  >("conversations")
  const [unanswerableFilter, setUnanswerableFilter] = useState<
    "all" | "flagged" | "unflagged"
  >("all")

  // สถานะ Accordion ที่เปิดอยู่
  const [openConversationId, setOpenConversationId] = useState<string>("")
  const conversationsTopRef = useRef<HTMLDivElement | null>(null)

  // หน่วงการ mount Radix Select จนกว่า Client จะพร้อม เพื่อหลีกเลี่ยง Hydration Error
  const [selectsMounted, setSelectsMounted] = useState(false)

  const searchParams = useSearchParams()

  useEffect(() => {
    if (searchParams.get("tab") === "unanswerable") {
      setActiveTab("unanswerable")
    }
  }, [searchParams])

  useEffect(() => {
    setSelectsMounted(true)
  }, [])

  const fetchConversations = useCallback(async () => {
    try {
      setIsLoading(true)

      const params = new URLSearchParams({
        channel: selectedChannel,
        status: selectedStatus,
        sort: sortOrder,
        page: currentPage.toString(),
        limit: "20",
      })

      if (searchTerm) {
        params.append("search", searchTerm)
      }

      const res = await fetch(`/api/chat-history?${params}`)
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(
          errorData.details || errorData.error || "Failed to fetch conversations"
        )
      }

      const data = await res.json()
      setConversations(data.data || [])
      setTotalPages(data.pagination?.totalPages || 1)

      // ปิด accordion ที่เปิดอยู่เมื่อข้อมูลเปลี่ยน
      setOpenConversationId("")
    } catch (err: any) {
      console.error("Failed to load conversations:", err)
      setConversations([])
      setTotalPages(1)
      alert(`ไม่สามารถโหลดข้อมูลได้: ${err.message || "Unknown error"}`)
    } finally {
      setIsLoading(false)
    }
  }, [selectedChannel, selectedStatus, sortOrder, currentPage, searchTerm])

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/chat-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "summary" }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.details || errorData.error || "Failed to fetch stats")
      }

      const data = await res.json()
      setStats(data)
    } catch (err: any) {
      console.error("Failed to load stats:", err)
      setStats({
        totalConversations: 0,
        totalMessages: 0,
        webConversations: 0,
        lineConversations: 0,
        recentConversations: 0,
      })
    }
  }, [])

  const toggleConversationStatus = async (
    conversationId: string,
    currentStatus: "OPEN" | "CLOSED"
  ) => {
    try {
      const newStatus = currentStatus === "OPEN" ? "CLOSED" : "OPEN"
      const res = await fetch(`/api/conversation/${conversationId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!res.ok) throw new Error("Failed to update conversation status")

      setConversations((prev) =>
        prev.map((conv) =>
          conv.conversationId === conversationId
            ? { ...conv, status: newStatus }
            : conv
        )
      )

      alert(`การสนทนาถูก${newStatus === "OPEN" ? "เปิด" : "ปิด"}เรียบร้อย`)
    } catch (error) {
      console.error("Failed to toggle conversation status:", error)
      alert("ไม่สามารถอัปเดตสถานะการสนทนาได้")
    }
  }

  const fetchTopQuestions = useCallback(async () => {
    try {
      const res = await fetch("/api/chat-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "found-questions",
          page: foundQuestionsPage,
          limit: 10,
        }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(
          errorData.details || errorData.error || "Failed to fetch found questions"
        )
      }

      const data = await res.json()
      setTopQuestions(data.questions || [])
      setTotalFoundQuestionsPages(data.totalPages || 1)
    } catch (err: any) {
      console.error("Failed to load found questions:", err)
      setTopQuestions([])
    }
  }, [foundQuestionsPage])

  const deleteFoundQuestion = useCallback(
    async (question: string) => {
      if (
        !confirm(
          `คุณต้องการลบคำถาม "${question}" ใช่หรือไม่?\n\nการลบจะทำให้คำถามนี้ถูกนับจากใหม่ในครั้งถัดไปที่ผู้ใช้ถาม`
        )
      ) {
        return
      }

      try {
        const res = await fetch("/api/chat-history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "delete-found-question",
            question,
          }),
        })

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}))
          throw new Error(
            errorData.details || errorData.error || "Failed to delete question"
          )
        }

        alert("ลบคำถามเรียบร้อย คำถามนี้จะถูกนับจากใหม่ในครั้งถัดไป")
        fetchTopQuestions()
      } catch (err: any) {
        console.error("Failed to delete question:", err)
        alert("ไม่สามารถลบคำถามได้: " + err.message)
      }
    },
    [fetchTopQuestions]
  )

  const fetchUnanswerable = useCallback(async () => {
    try {
      setIsLoading(true)

      const res = await fetch("/api/chat-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "unanswerable",
          page: unanswerablePage,
          limit: 10,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        const message = data?.details || data?.error || "Failed to fetch unanswerable"
        throw new Error(message)
      }

      setUnanswerable(Array.isArray(data.unanswerable) ? data.unanswerable : [])
      setTotalUnanswerablePages(data.totalPages || 1)
    } catch (err: any) {
      console.error("Failed to load unanswerable:", err)
      setUnanswerable([])
    } finally {
      setIsLoading(false)
    }
  }, [unanswerablePage])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  useEffect(() => {
    if (activeTab === "conversations") {
      fetchConversations()
      return
    }

    if (activeTab === "found-questions") {
      fetchTopQuestions()
      return
    }

    if (activeTab === "unanswerable") {
      fetchUnanswerable()
    }
  }, [activeTab, fetchConversations, fetchTopQuestions, fetchUnanswerable])

  const updateUnanswerableFlag = async (
    messageId: string,
    flags: { dataComplete?: boolean }
  ) => {
    try {
      const res = await fetch("/api/chat-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "flag-unanswerable",
          messageId,
          ...flags,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.details || data?.error || "Failed to update flag")
      }

      setUnanswerable((prev) =>
        prev.map((item) =>
          item.messageId === messageId
            ? {
                ...item,
                ...(typeof flags.dataComplete === "boolean" && {
                  dataComplete: flags.dataComplete,
                }),
              }
            : item
        )
      )
    } catch (err: any) {
      console.error("Failed to update unanswerable flag:", err)
      alert(`ไม่สามารถอัปเดตได้: ${err.message || "Unknown error"}`)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString("th-TH", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setCurrentPage(1)
  }

  return (
    <div className="min-h-screen p-8 bg-gray-50 text-lg">
      <div className="flex flex-col gap-y-1 mb-8">
        <h1 className="text-4xl md:text-5xl font-bold text-blue-600">
          ประวัติการสนทนา
        </h1>
        <p className="text-black text-xl md:text-2xl font-bold">
          คณะเทคโนโลยีสารสนเทศ
          <br />
          สถาบันเทคโนโลยีพระจอมเกล้าเจ้าคุณทหารลาดกระบัง
        </p>
      </div>

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-5 rounded-lg shadow-md">
            <p className="text-gray-600 text-lg">ทั้งหมด</p>
            <p className="text-3xl font-bold text-blue-600">
              {stats.totalConversations}
            </p>
            <p className="text-base text-gray-500">การสนทนา</p>
          </div>
          <div className="bg-white p-5 rounded-lg shadow-md">
            <p className="text-gray-600 text-lg">ข้อความทั้งหมด</p>
            <p className="text-3xl font-bold text-green-600">
              {stats.totalMessages}
            </p>
          </div>
          <div className="bg-white p-5 rounded-lg shadow-md">
            <p className="text-gray-600 text-lg">เว็บไซต์</p>
            <p className="text-3xl font-bold text-purple-600">
              {stats.webConversations}
            </p>
          </div>
          <div className="bg-white p-5 rounded-lg shadow-md">
            <p className="text-gray-600 text-lg">LINE</p>
            <p className="text-3xl font-bold text-orange-600">
              {stats.lineConversations}
            </p>
          </div>
        </div>
      )}

      <div className="flex gap-2 mb-6 border-b border-gray-200">
        <button
          onClick={() => setActiveTab("conversations")}
          className={`px-6 py-3 text-lg font-semibold border-b-2 transition-colors ${
            activeTab === "conversations"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-600 hover:text-blue-600"
          }`}
        >
          การสนทนา
        </button>
        <button
          onClick={() => setActiveTab("found-questions")}
          className={`px-6 py-3 text-lg font-semibold border-b-2 transition-colors ${
            activeTab === "found-questions"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-600 hover:text-blue-600"
          }`}
        >
          คำถามที่พบ
        </button>
        <button
          onClick={() => setActiveTab("unanswerable")}
          className={`px-6 py-3 text-lg font-semibold border-b-2 transition-colors ${
            activeTab === "unanswerable"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-600 hover:text-blue-600"
          }`}
        >
          คำถามที่ตอบไม่ได้
        </button>
      </div>

      {activeTab === "conversations" && (
        <div ref={conversationsTopRef}>
          <div className="bg-white p-6 rounded-lg shadow-md mb-6">
            <form className="flex flex-col gap-4" onSubmit={handleSearch}>
              {/* ช่องค้นหา - แถวเต็มความกว้าง */}
              <div>
                <label className="block text-lg font-semibold mb-2">
                  ค้นหาการสนทนา
                </label>
                <div className="w-full flex flex-row gap-2">
                  <Input
                    placeholder="ค้นหาจากข้อความ..."
                    name="search"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full text-base border-2 border-gray-300 focus:border-blue-500 focus-visible:ring-0 min-h-[2.75rem]"
                  />
                  <button
                    type="submit"
                    className="bg-blue-600 text-white px-5 py-2.5 rounded-md font-semibold hover:bg-blue-700 transition whitespace-nowrap h-[2.75rem] flex items-center gap-2"
                  >
                    <IoMdSearch />
                    ค้นหา
                  </button>
                </div>
              </div>

              {/* แถวตัวกรอง */}
              <div className="flex flex-wrap items-end gap-x-2 gap-y-2 w-full">
                {/* ช่องทาง */}
                <div className="flex flex-col gap-y-1 w-full sm:w-40">
                  <label className="block text-sm md:text-base font-semibold">ช่องทาง</label>
                  {!selectsMounted ? (
                    <div
                      className="w-full text-base border-2 border-gray-300 min-h-[2.75rem] rounded-md flex items-center px-3 py-2 bg-transparent"
                      aria-hidden
                    >
                      {selectedChannel === "ALL" ? "ทั้งหมด" : selectedChannel === "WEB" ? "เว็บไซต์" : "LINE"}
                    </div>
                  ) : (
                    <Select
                      value={selectedChannel}
                      onValueChange={(value) => { setSelectedChannel(value); setCurrentPage(1) }}
                    >
                      <SelectTrigger className="w-full text-base border-2 border-gray-300 focus:border-blue-500 focus-visible:ring-0 min-h-[2.75rem]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">ทั้งหมด</SelectItem>
                        <SelectItem value="WEB">เว็บไซต์</SelectItem>
                        <SelectItem value="LINE">LINE</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* สถานะ */}
                <div className="flex flex-col gap-y-1 w-full sm:w-40">
                  <label className="block text-sm md:text-base font-semibold">สถานะ</label>
                  {!selectsMounted ? (
                    <div
                      className="w-full text-base border-2 border-gray-300 min-h-[2.75rem] rounded-md flex items-center px-3 py-2 bg-transparent"
                      aria-hidden
                    >
                      {selectedStatus === "ALL" ? "ทั้งหมด" : selectedStatus === "OPEN" ? "เปิดอยู่" : "ปิดแล้ว"}
                    </div>
                  ) : (
                    <Select
                      value={selectedStatus}
                      onValueChange={(value) => { setSelectedStatus(value); setCurrentPage(1) }}
                    >
                      <SelectTrigger className="w-full text-base border-2 border-gray-300 focus:border-blue-500 focus-visible:ring-0 min-h-[2.75rem]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">ทั้งหมด</SelectItem>
                        <SelectItem value="OPEN">เปิดอยู่</SelectItem>
                        <SelectItem value="CLOSED">ปิดแล้ว</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* เรียงลำดับ */}
                <div className="flex flex-col gap-y-1 w-auto">
                  <label className="block text-sm md:text-base font-semibold">เรียงลำดับ</label>
                  <div className="flex rounded-md border border-gray-300 overflow-hidden h-[2.75rem]">
                    <button
                      type="button"
                      onClick={() => { setSortOrder("desc"); setCurrentPage(1) }}
                      className={`px-3 py-2 text-sm font-medium transition whitespace-nowrap ${
                        sortOrder === "desc"
                          ? "bg-blue-600 text-white"
                          : "bg-white text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      ล่าสุด
                    </button>
                    <button
                      type="button"
                      onClick={() => { setSortOrder("asc"); setCurrentPage(1) }}
                      className={`px-3 py-2 text-sm font-medium transition border-l border-gray-300 whitespace-nowrap ${
                        sortOrder === "asc"
                          ? "bg-blue-600 text-white"
                          : "bg-white text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      เก่าสุด
                    </button>
                  </div>
                </div>
              </div>
            </form>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <p className="text-2xl font-bold mb-4">รายการการสนทนา</p>

            {isLoading ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : conversations.length === 0 ? (
              <p className="text-gray-500 italic text-xl">
                {searchTerm
                  ? "ไม่พบการสนทนาที่ตรงกับเงื่อนไข"
                  : "ยังไม่มีประวัติการสนทนา"}
              </p>
            ) : (
              <>
                <Accordion
                  type="single"
                  collapsible
                  value={openConversationId}
                  onValueChange={setOpenConversationId}
                  className="divide-y divide-gray-200"
                >
                  {conversations.map((conv) => (
                    <AccordionItem
                      key={conv.conversationId}
                      value={conv.conversationId}
                    >
                      <div className="flex items-center justify-between">
                        <AccordionTrigger className="text-left flex-1 hover:no-underline">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span
                                className={`px-3 py-1.5 rounded text-base font-semibold ${
                                  conv.channel === "WEB"
                                    ? "bg-purple-100 text-purple-700"
                                    : "bg-orange-100 text-orange-700"
                                }`}
                              >
                                {conv.channel === "WEB" ? "เว็บไซต์" : "LINE"}
                              </span>

                              <span
                                className={`px-3 py-1.5 rounded text-base ${
                                  conv.status === "OPEN"
                                    ? "bg-green-100 text-green-700"
                                    : "bg-gray-100 text-gray-700"
                                }`}
                              >
                                {conv.status === "OPEN" ? "เปิดอยู่" : "ปิดแล้ว"}
                              </span>

                              {conv.lineFriendName && (
                                <span className="text-lg text-gray-600">
                                  {conv.lineFriendName}
                                </span>
                              )}
                            </div>

                            <p className="text-lg text-gray-500">
                              {conv.messageCount} ข้อความ • อัพเดทล่าสุด -{" "}
                              {formatDate(conv.updatedAt)}
                            </p>
                          </div>
                        </AccordionTrigger>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleConversationStatus(
                              conv.conversationId,
                              conv.status
                            )
                          }}
                          className={`text-xs px-3 py-1 mx-4 ${
                            conv.status === "OPEN"
                              ? "border-red-600 text-red-600 hover:bg-red-50"
                              : "border-green-600 text-green-600 hover:bg-green-50"
                          }`}
                        >
                          {conv.status === "OPEN"
                            ? "ปิดการสนทนา"
                            : "เปิดการสนทนา"}
                        </Button>
                      </div>

                      <AccordionContent>
                        <div className="space-y-3 pt-2">
                          {conv.messages.map((msg) => (
                            <div
                              key={msg.messageId}
                              className={`p-4 rounded-lg ${
                                msg.role === "user"
                                  ? "bg-blue-50 border-l-4 border-blue-500"
                                  : "bg-gray-50 border-l-4 border-gray-400"
                              }`}
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-base font-semibold text-gray-600">
                                  {msg.role === "user" ? "ผู้ใช้" : "บอต"}
                                </span>
                                <span className="text-base text-gray-400">
                                  {formatDate(msg.createdAt)}
                                </span>
                              </div>

                              <MarkdownRenderer
                                content={msg.content}
                                className="text-lg"
                              />

                              {msg.sources &&
                                Array.isArray(msg.sources) &&
                                msg.sources.length > 0 && (
                                  <div className="mt-2 text-base text-gray-500">
                                    <strong>เอกสารอ้างอิง:</strong>{" "}
                                    {msg.sources.length} ไฟล์
                                  </div>
                                )}
                            </div>
                          ))}

                          <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setOpenConversationId("")
                              // Scroll back to top of list to prevent browser
                              // jumping focus to the next element after collapse
                              conversationsTopRef.current?.scrollIntoView({
                                behavior: "smooth",
                                block: "start",
                              })
                            }}
                            className="w-full py-3 mt-4 text-base text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors flex items-center justify-center gap-2"
                          >
                            ปิด
                          </button>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>

                {totalPages > 1 && (
                  <div className="flex justify-center items-center gap-2 mt-6">
                    <Button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      variant="outline"
                      className="text-lg min-h-[3rem] px-4"
                    >
                      ก่อนหน้า
                    </Button>
                    <span className="text-lg text-gray-600">
                      หน้า {currentPage} จาก {totalPages}
                    </span>
                    <Button
                      onClick={() =>
                        setCurrentPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={currentPage === totalPages}
                      variant="outline"
                      className="text-lg min-h-[3rem] px-4"
                    >
                      ถัดไป
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {activeTab === "found-questions" && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <p className="text-2xl font-bold mb-2">คำถามที่พบ</p>
              <p className="text-lg text-gray-600">
                คำถามที่ผู้ใช้ทำการถามจากประวัติการสนทนา
              </p>
            </div>

            <Link href="/management/faq">
              <Button className="bg-blue-600 hover:bg-blue-700 text-lg px-6 py-3">
                จัดการ FAQ →
              </Button>
            </Link>
          </div>

          {topQuestions.length === 0 ? (
            <p className="text-gray-500 italic text-xl">ยังไม่มีข้อมูล</p>
          ) : (
            <>
              <div className="space-y-3">
                {topQuestions.map((q, idx) => (
                  <div
                    key={idx}
                    className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex items-start justify-between">
                      <p className="flex-1 text-lg">{q.question}</p>
                      <div className="flex items-center gap-2 ml-4">
                        <span className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full text-base font-semibold">
                          {q.count} ครั้ง
                        </span>

                        {q.status === "WAS_FAQ" && (
                          <span className="px-3 py-1.5 bg-yellow-100 text-yellow-700 border border-yellow-200 rounded-full text-base font-semibold flex items-center gap-1 whitespace-nowrap">
                            เคยอยู่ใน FAQ
                          </span>
                        )}

                        {q.status === "APPROVED" && (
                          <span className="px-3 py-1.5 bg-green-100 text-green-700 rounded-full text-base font-semibold flex items-center gap-1 whitespace-nowrap">
                            <FaCheckCircle className="text-sm" /> อยู่ใน FAQ แล้ว
                          </span>
                        )}

                        {q.status !== "APPROVED" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => deleteFoundQuestion(q.question)}
                            className="text-red-600 border-red-200 hover:bg-red-50 px-3 py-1"
                          >
                            ลบ
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {totalFoundQuestionsPages > 1 && (
                <div className="flex justify-center items-center gap-2 mt-6">
                  <Button
                    onClick={() =>
                      setFoundQuestionsPage((p) => Math.max(1, p - 1))
                    }
                    disabled={foundQuestionsPage === 1}
                    variant="outline"
                    className="text-lg min-h-[3rem] px-4"
                  >
                    ก่อนหน้า
                  </Button>
                  <span className="text-lg text-gray-600">
                    หน้า {foundQuestionsPage} จาก {totalFoundQuestionsPages}
                  </span>
                  <Button
                    onClick={() =>
                      setFoundQuestionsPage((p) =>
                        Math.min(totalFoundQuestionsPages, p + 1)
                      )
                    }
                    disabled={foundQuestionsPage === totalFoundQuestionsPages}
                    variant="outline"
                    className="text-lg min-h-[3rem] px-4"
                  >
                    ถัดไป
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {activeTab === "unanswerable" && (
        <>
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="text-base font-medium text-gray-700">กรอง:</span>

              <button
                type="button"
                onClick={() => setUnanswerableFilter("all")}
                className={`px-4 py-2 rounded-lg text-base font-medium transition ${
                  unanswerableFilter === "all"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                ทั้งหมด
              </button>

              <button
                type="button"
                onClick={() => setUnanswerableFilter("flagged")}
                className={`px-4 py-2 rounded-lg text-base font-medium transition ${
                  unanswerableFilter === "flagged"
                    ? "bg-green-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                คำถามที่ทำเครื่องหมายเพิ่มข้อมูลเสร็จสิ้น
              </button>

              <button
                type="button"
                onClick={() => setUnanswerableFilter("unflagged")}
                className={`px-4 py-2 rounded-lg text-base font-medium transition ${
                  unanswerableFilter === "unflagged"
                    ? "bg-red-700 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                คำถามที่ยังไม่ได้ทำการเพิ่มข้อมูล
              </button>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <p className="text-2xl font-bold mb-4">คำถามที่บอตตอบไม่ได้</p>
            <p className="text-lg text-gray-600 mb-4">
              รายการคำถามที่บอตไม่สามารถหาคำตอบได้จากเอกสารที่มีอยู่
            </p>

            {(() => {
              const filtered =
                unanswerableFilter === "all"
                  ? unanswerable
                  : unanswerableFilter === "flagged"
                  ? unanswerable.filter((item) => item.dataComplete)
                  : unanswerable.filter((item) => !item.dataComplete)

              if (filtered.length === 0) {
                return (
                  <p className="text-gray-500 italic text-xl">
                    {unanswerable.length === 0
                      ? "ยังไม่มีคำถามที่ตอบไม่ได้"
                      : "ไม่มีรายการที่ตรงกับตัวกรอง"}
                  </p>
                )
              }

              return (
                <>
                  <div className="space-y-4">
                    {filtered.map((item) => (
                      <div
                        key={item.messageId}
                        className={`p-5 border rounded-lg ${
                          item.dataComplete
                            ? "border-green-300 bg-green-50"
                            : "border-red-200 bg-red-50"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span
                            className={`px-3 py-1.5 rounded text-base font-semibold ${
                              item.channel === "WEB"
                                ? "bg-purple-100 text-purple-700"
                                : "bg-orange-100 text-orange-700"
                            }`}
                          >
                            {item.channel === "WEB" ? "เว็บไซต์" : "LINE"}
                          </span>

                          {item.reason && (
                            <span className="px-3 py-1.5 rounded text-base font-medium bg-amber-100 text-amber-800">
                              {REASON_LABELS[item.reason] ?? item.reason}
                            </span>
                          )}

                          {item.dataComplete && (
                            <span className="px-3 py-1.5 rounded text-base font-medium bg-green-200 text-green-800 flex items-center gap-1">
                              <FaCheckCircle className="inline" /> เพิ่มข้อมูลแล้ว
                            </span>
                          )}

                          <span className="text-base text-gray-500">
                            {formatDate(item.createdAt)}
                          </span>
                        </div>

                        <div className="mb-2">
                          <p className="text-lg font-semibold text-gray-700 mb-1">
                            คำถาม: {item.userQuestion}
                          </p>
                          <p className="text-base text-gray-600 mb-2">
                            {item.botResponse}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2 py-2">
                          <Link href="/management/qaStatic">
                            <Button
                              type="button"
                              size="sm"
                              className="bg-blue-600 text-white hover:bg-blue-700 px-3 py-2"
                            >
                              เพิ่ม Q&A
                            </Button>
                          </Link>

                          <Link
                            href={`/management/faq/addfaq${
                              item.userQuestion
                                ? `?question=${encodeURIComponent(
                                    item.userQuestion
                                  )}`
                                : ""
                            }${
                              item.botResponse
                                ? `${item.userQuestion ? "&" : "?"}suggestedAnswer=${encodeURIComponent(
                                    item.botResponse
                                  )}`
                                : ""
                            }${
                              item.userQuestion || item.botResponse
                                ? "&from=unanswerable"
                                : "?from=unanswerable"
                            }`}
                          >
                            <Button
                              type="button"
                              size="sm"
                              className="bg-green-600 text-white hover:bg-green-700"
                            >
                              สร้าง FAQ
                            </Button>
                          </Link>

                          <Link href="/management/document/adddoc?from=unanswerable">
                            <Button
                              type="button"
                              size="sm"
                              className="bg-purple-600 text-white hover:bg-purple-700"
                            >
                              เพิ่มเอกสาร
                            </Button>
                          </Link>
                        </div>

                        <div className="ml-auto">
                          <button
                            type="button"
                            onClick={() =>
                              updateUnanswerableFlag(item.messageId, {
                                dataComplete: !item.dataComplete,
                              })
                            }
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-base font-medium transition ${
                              item.dataComplete
                                ? "bg-green-200 text-green-800 hover:bg-green-300"
                                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                            }`}
                            title={
                              item.dataComplete
                                ? "ยกเลิกมาร์ก (ยังไม่เพิ่มข้อมูลครบ)"
                                : "มาร์กว่าตอบเพิ่มข้อมูลแล้ว"
                            }
                          >
                            {item.dataComplete ? (
                              <>
                                <FaCheckCircle className="text-lg" />
                                เพิ่มข้อมูลแล้ว
                              </>
                            ) : (
                              <>
                                <FaFlag className="text-lg" />
                                ทำเครื่องหมายว่าเพิ่มข้อมูลเสร็จสิ้น
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {totalUnanswerablePages > 1 && (
                    <div className="flex justify-center items-center gap-2 mt-6">
                      <Button
                        onClick={() =>
                          setUnanswerablePage((p) => Math.max(1, p - 1))
                        }
                        disabled={unanswerablePage === 1}
                        variant="outline"
                        className="text-lg min-h-[3rem] px-4"
                      >
                        ก่อนหน้า
                      </Button>
                      <span className="text-lg text-gray-600">
                        หน้า {unanswerablePage} จาก {totalUnanswerablePages}
                      </span>
                      <Button
                        onClick={() =>
                          setUnanswerablePage((p) =>
                            Math.min(totalUnanswerablePages, p + 1)
                          )
                        }
                        disabled={unanswerablePage === totalUnanswerablePages}
                        variant="outline"
                        className="text-lg min-h-[3rem] px-4"
                      >
                        ถัดไป
                      </Button>
                    </div>
                  )}
                </>
              )
            })()}
          </div>
        </>
      )}
    </div>
  )
}