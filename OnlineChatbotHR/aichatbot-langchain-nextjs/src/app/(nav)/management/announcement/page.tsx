"use client"

import Link from "next/link"
import React, { useEffect, useState, useCallback } from "react"
import { FaSearch, FaEdit, FaTrash, FaTimes } from "react-icons/fa"
import { FaCirclePlus } from "react-icons/fa6"
import { formatThaiBuddhistDate } from "@/lib/dateFormat"

const LineIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766-.028 1.08l-.164.515c-.045.149-.149.26.112.405.26.15.69.3.99.39.39.135.9.24 1.215.24.39 0 .825-.12 1.215-.24.3-.09.72-.24.99-.39.26-.145.157-.256.112-.405l-.164-.515c-.107-.314-.148-.779-.028-1.08.135-.332.667-.508 1.058-.59C19.73 19.156 24 15.125 24 10.314" />
  </svg>
)

type Announcement = {
  id: string
  title: string
  content: string | null
  picture: string
  createdAt: string
  status?: string
  position?: string
  isLatest?: boolean
}

type LineQuotaInfo = {
  limit: number | null
  used: number
  remaining: number | null
  percentageUsed: number | null
  costPerBroadcast: number
  followersCount: number
  isLimited: boolean
}

const AnnouncementManagementPage = () => {
  const [items, setItems] = useState<Announcement[]>([])
  const [filtered, setFiltered] = useState<Announcement[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null)
  const [showImageModal, setShowImageModal] = useState(false)
  const [imageModalUrl, setImageModalUrl] = useState("")

  const [lineQuota, setLineQuota] = useState<LineQuotaInfo | null>(null)
  const [isLoadingQuota, setIsLoadingQuota] = useState(false)

  const baseURL = process.env.NEXT_PUBLIC_BASE_URL || ""

  const fetchAnnouncements = useCallback(async () => {
    try {
      setIsLoading(true)
      const res = await fetch("/api/announcement", { cache: "no-store" })
      if (!res.ok) throw new Error("Failed to fetch announcements")
      const data: Announcement[] = await res.json()
      setItems(data)
    } catch (err) {
      console.error("Error fetching announcements:", err)
      alert("ไม่สามารถโหลดประกาศได้")
    } finally {
      setIsLoading(false)
    }
  }, [])

  const fetchLineQuota = useCallback(async () => {
    try {
      setIsLoadingQuota(true)
      const res = await fetch("/api/line-quota", { cache: "no-store" })
      if (!res.ok) throw new Error("Failed to fetch LINE quota")
      const data: LineQuotaInfo = await res.json()
      setLineQuota(data)
    } catch (err) {
      console.error("Error fetching LINE quota:", err)
    } finally {
      setIsLoadingQuota(false)
    }
  }, [])

  const openLineOAManager = () => {
    window.open("https://manager.line.biz/webstore/@143thesr", "_blank")
  }

  const filterAnnouncements = useCallback(() => {
    let list = items

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase()
      list = list.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          (a.content || "").toLowerCase().includes(q)
      )
    }

    setFiltered(list)
  }, [items, searchTerm])

  useEffect(() => {
    fetchAnnouncements()
    fetchLineQuota()
  }, [fetchAnnouncements, fetchLineQuota])

  useEffect(() => {
    filterAnnouncements()
  }, [filterAnnouncements])

  const handleSearch = () => filterAnnouncements()

  const handleDelete = async (id: string, title: string) => {
    const ok = window.confirm(`คุณต้องการลบประกาศ "${title}" ใช่หรือไม่?`)
    if (!ok) return

    try {
      const res = await fetch(`/api/announcement/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to delete announcement")
      setItems((cur) => cur.filter((x) => x.id !== id))
      alert("ลบประกาศสำเร็จ")
    } catch (err) {
      console.error("Error deleting announcement:", err)
      alert("ไม่สามารถลบประกาศได้")
    }
  }

  const openAnnouncementDetail = (announcement: Announcement) => {
    setSelectedAnnouncement(announcement)
  }

  const closeAnnouncementDetail = () => {
    setSelectedAnnouncement(null)
  }

  const openImageModal = (imageUrl: string) => {
    setImageModalUrl(imageUrl)
    setShowImageModal(true)
  }

  const closeImageModal = () => {
    setShowImageModal(false)
    setImageModalUrl("")
  }

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="flex flex-col gap-y-1 mb-8">
        <h1 className="text-4xl font-bold text-blueit">
          ข่าวสารและประชาสัมพันธ์
          <br />
          เกี่ยวกับฝ่ายบุคลากร
        </h1>
        <p className="text-black text-lg font-bold">
          คณะเทคโนโลยีสารสนเทศ
          <br />
          สถาบันเทคโนโลยีพระจอมเกล้าเจ้าคุณทหารลาดกระบัง
        </p>
      </div>

      <div className="mb-4">
        {/* LINE Quota Display */}
        {lineQuota && (
          <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md border-l-4 border-green-500">
            <div className="flex flex-col gap-4">
              {/* Header Section */}
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-full flex-shrink-0">
                  <LineIcon className="w-5 h-5 text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-800 text-base sm:text-lg">LINE Push Notification Quota</h3>
                  <p className="text-sm text-gray-600">
                    {lineQuota.isLimited ? (
                      <>
                        ใช้ไป <span className="font-bold text-green-600">{lineQuota.used.toLocaleString()}</span> / {lineQuota.limit?.toLocaleString()} ข้อความ
                        {lineQuota.remaining !== null && (
                          <span className="ml-2">
                            (เหลือ <span className="font-bold text-blue-600">{lineQuota.remaining.toLocaleString()}</span>)
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-green-600">แผนไม่จำกัด (Unlimited)</span>
                    )}
                  </p>
                </div>
              </div>

              {/* Stats Section - Responsive Grid */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 flex-wrap">
                {lineQuota.isLimited && lineQuota.percentageUsed !== null && (
                  <div className="flex items-center gap-2">
                    <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${lineQuota.percentageUsed > 90 ? 'bg-red-500' :
                            lineQuota.percentageUsed > 70 ? 'bg-yellow-500' : 'bg-green-500'
                          }`}
                        style={{ width: `${Math.min(lineQuota.percentageUsed, 100)}%` }}
                      />
                    </div>
                    <span className={`text-sm font-medium whitespace-nowrap ${lineQuota.percentageUsed > 90 ? 'text-red-600' :
                        lineQuota.percentageUsed > 70 ? 'text-yellow-600' : 'text-green-600'
                      }`}>
                      {lineQuota.percentageUsed}%
                    </span>
                  </div>
                )}

                <div className="text-xs sm:text-sm text-gray-600 bg-blue-50 px-3 py-2 rounded-lg border border-blue-200 flex-shrink-0">
                  <span className="block sm:inline">เพื่อนใน LINE OA: <span className="font-bold text-blue-600">{lineQuota.followersCount.toLocaleString()}</span> คน</span>
                  <span className="hidden sm:inline mx-1">=</span>
                  <span className="block sm:inline mt-1 sm:mt-0">การส่ง 1 ครั้ง ใช้ <span className="font-bold text-orange-600">{lineQuota.costPerBroadcast.toLocaleString()}</span> ข้อความ</span>
                </div>

                <button
                  onClick={openLineOAManager}
                  className="text-sm bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-md font-medium transition shadow-sm whitespace-nowrap self-start sm:ml-auto"
                  title="จัดการแผน LINE Official Account"
                >
                  จัดการแผน
                </button>
              </div>
            </div>

            {lineQuota.isLimited && lineQuota.remaining !== null && lineQuota.remaining < 100 && (
              <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                ⚠️ โควต้าเหลือน้อย! กรุณาเพิ่มโควต้าหรือเปลี่ยนเป็นแผนการใช้งาน
              </div>
            )}
          </div>
        )}

        {isLoadingQuota && (
          <div className="flex items-center gap-2 text-gray-600">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-500"></div>
            <span className="text-sm">กำลังโหลดโควต้า...</span>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-x-3 mb-2">
        <Link href="/management/announcement/pushNoti">
          <button className="flex items-center gap-x-2 text-white bg-green-500 hover:bg-green-600 rounded-md transition px-4 py-2 shadow-md">
            <span className="font-semibold">LINE Push Notification</span>
          </button>
        </Link>
        <div className="flex justify-end mb-2">
          <Link href="/management/announcement/addannounce">
            <button className="flex items-center gap-x-2 text-white bg-blue-600 hover:bg-blue-700 rounded-md transition px-4 py-2 shadow-md">
              <FaCirclePlus className="text-xl" />
              <span className="font-semibold">เพิ่มข่าวสารและประชาสัมพันธ์</span>
            </button>
          </Link>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div className="flex-1 w-full">
            <label className="block text-lg font-semibold mb-2">
              ชื่อประกาศ/คำอธิบาย
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="w-full p-3 rounded-md border-2 border-gray-300 focus:border-blue-500 focus:outline-none"
              placeholder="ค้นหาชื่อประกาศหรือรายละเอียด..."
            />
          </div>

          <button
            onClick={handleSearch}
            className="bg-blueit/80 hover:bg-blueit text-white p-3 rounded-md transition self-end"
            title="ค้นหา"
          >
            <FaSearch className="text-xl" />
          </button>
        </div>

        <div className="mt-4 text-sm text-gray-600">
          แสดง {filtered.length} จาก {items.length} ประกาศ
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blueit"></div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg">ไม่พบประกาศ</p>
            {searchTerm && (
              <p className="text-sm mt-2">ลองเปลี่ยนคำค้นหาอีกครั้ง</p>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filtered.map((a) => (
              <div
                key={a.id}
                className="flex flex-col md:flex-row md:items-center md:justify-between p-6 hover:bg-gray-50 transition gap-4"
              >
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  <div
                    className="relative w-[120px] h-[72px] rounded-md overflow-hidden bg-gray-100 flex-shrink-0 cursor-pointer hover:opacity-80 transition"
                    onClick={() => openImageModal(`${baseURL}/${a.picture}`)}
                  >
                    <img
                      src={`${baseURL}/${a.picture}`}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover blur-xl scale-110 opacity-90"
                      aria-hidden
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src =
                          "https://picsum.photos/240/135"
                      }}
                    />
                    <img
                      src={`${baseURL}/${a.picture}`}
                      alt={a.title}
                      className="absolute inset-0 w-full h-full object-contain"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src =
                          "https://picsum.photos/240/135"
                      }}
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <button
                      onClick={() => openAnnouncementDetail(a)}
                      className="text-blue-600 hover:text-blue-800 font-semibold text-lg hover:underline block text-left break-words whitespace-normal leading-tight"
                      title={a.title}
                    >
                      {a.title}
                    </button>
                    <div className="text-sm text-gray-600 mt-1 line-clamp-2">
                      {a.content || "—"}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs whitespace-nowrap">
                        {a.status || "—"}
                      </span>
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs whitespace-nowrap">
                        {a.position || "—"}
                      </span>
                      {a.isLatest && (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium whitespace-nowrap">
                          ✓ ล่าสุด
                        </span>
                      )}
                      <span className="text-xs text-gray-500 whitespace-nowrap">
                        {formatThaiBuddhistDate(a.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons - Mobile */}
                <div className="flex items-center justify-center gap-x-3 md:hidden">
                  <Link href={`/management/announcement/pushNoti?announcementId=${a.id}`}>
                    <button
                      className="bg-green-500 hover:bg-green-600 text-white p-1.5 rounded transition"
                      title="LINE Push Notification"
                    >
                      <LineIcon className="w-3 h-3" />
                    </button>
                  </Link>
                  <Link href={`/management/announcement/editannounce/${a.id}`}>
                    <button
                      className="text-blue-600 hover:text-blue-800 w-8 h-8 rounded transition flex items-center justify-center"
                      title="แก้ไข"
                    >
                      <FaEdit size={24} />
                    </button>
                  </Link>
                  <button
                    onClick={() => handleDelete(String(a.id), a.title)}
                    className="text-red-600 hover:text-red-800 transition"
                    title="ลบ"
                  >
                    <FaTrash className="text-xl" />
                  </button>
                </div>

                {/* Action Buttons - Desktop */}
                <div className="hidden md:flex items-center gap-x-3 flex-shrink-0">
                  <Link href={`/management/announcement/pushNoti?announcementId=${a.id}`}>
                    <button
                      className="bg-green-500 hover:bg-green-600 text-white p-2 rounded transition"
                      title="LINE Push Notification"
                    >
                      <LineIcon className="w-3 h-3" />
                    </button>
                  </Link>
                  <Link href={`/management/announcement/editannounce/${a.id}`}>
                    <button
                      className="text-blue-600 hover:text-blue-800 p-2 rounded transition"
                      title="แก้ไข"
                    >
                      <FaEdit size={24} />
                    </button>
                  </Link>
                  <button
                    onClick={() => handleDelete(String(a.id), a.title)}
                    className="text-red-600 hover:text-red-800 transition"
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

      {/* Announcement Detail Modal */}
      {selectedAnnouncement && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={closeAnnouncementDetail}
        >
          <div
            className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-800">รายละเอียดประกาศ</h2>
              <button
                onClick={closeAnnouncementDetail}
                className="text-gray-500 hover:text-gray-700 p-2 rounded-full hover:bg-gray-100 transition"
              >
                <FaTimes className="text-xl" />
              </button>
            </div>
            <div className="p-6">
              <div
                className="relative w-full aspect-video rounded-lg overflow-hidden bg-gray-100 mb-6 cursor-pointer"
                onClick={() => openImageModal(`${baseURL}/${selectedAnnouncement.picture}`)}
              >
                {/* Blurred background layer */}
                <img
                  src={`${baseURL}/${selectedAnnouncement.picture}`}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover blur-2xl scale-110 opacity-90"
                  aria-hidden
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = "https://picsum.photos/800/450"
                  }}
                />
                {/* Sharp image contained inside */}
                <img
                  src={`${baseURL}/${selectedAnnouncement.picture}`}
                  alt={selectedAnnouncement.title}
                  className="absolute inset-0 w-full h-full object-contain hover:opacity-90 transition"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = "https://picsum.photos/800/450"
                  }}
                />
              </div>
              <h3 className="text-2xl font-bold text-gray-800 mb-4">{selectedAnnouncement.title}</h3>
              <div className="flex gap-4 mb-4 text-sm text-gray-500">
                <span className="px-3 py-1 bg-gray-100 rounded-full">สถานะ: {selectedAnnouncement.status || "—"}</span>
                <span className="px-3 py-1 bg-gray-100 rounded-full">
                  สร้างเมื่อ {formatThaiBuddhistDate(selectedAnnouncement.createdAt)}
                </span>
              </div>
              <div className="prose max-w-none">
                <p className="text-gray-700 whitespace-pre-wrap">{selectedAnnouncement.content || "ไม่มีรายละเอียด"}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Image Full View Modal */}
      {showImageModal && (
        <div
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-[60] p-4"
          onClick={closeImageModal}
        >
          <button
            onClick={closeImageModal}
            className="absolute top-4 right-4 text-white hover:text-gray-300 p-2 rounded-full hover:bg-white/10 transition"
          >
            <FaTimes className="text-2xl" />
          </button>
          <img
            src={imageModalUrl}
            alt="Full view"
            className="max-w-full max-h-[90vh] object-contain"
            onClick={(e) => e.stopPropagation()}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = "https://picsum.photos/800/450"
            }}
          />
        </div>
      )}
    </div>
  )
}

export default AnnouncementManagementPage
