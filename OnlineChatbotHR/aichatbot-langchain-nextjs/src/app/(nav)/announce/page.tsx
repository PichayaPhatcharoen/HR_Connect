"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"

type Announcement = {
  id: string
  title: string
  content: string | null
  picture: string
  link?: string | null
  createdAt: string
}

const AnnounceDetailPage = () => {
  const searchParams = useSearchParams()
  const id = searchParams.get("id")
  const [data, setData] = useState<Announcement | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return
      try {
        setLoading(true)
        setError(null)
        const res = await fetch(`/api/announcement/${id}`, { cache: "no-store" })
        if (!res.ok) throw new Error("ไม่พบข้อมูลประกาศ")
        const json = (await res.json()) as Announcement
        setData(json)
      } catch (err: any) {
        setError(err?.message || "โหลดประกาศไม่สำเร็จ")
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [id])

  const buildSrc = (path?: string) => {
    if (!path) return ""
    if (path.startsWith("http")) return path
    if (path.startsWith("/")) return path
    return `/${path}`
  }

  return (
    <div className="min-h-screen bg-white text-black px-4 py-10 flex justify-center">
      <div className="w-full max-w-4xl">

        {loading ? (
          <div className="space-y-4">
            <div className="h-8 w-1/3 bg-gray-200 animate-pulse rounded" />
            <div className="h-[240px] bg-gray-200 animate-pulse rounded" />
            <div className="h-6 w-1/4 bg-gray-200 animate-pulse rounded" />
            <div className="h-24 bg-gray-200 animate-pulse rounded" />
          </div>
        ) : error ? (
          <p className="text-red-500">{error}</p>
        ) : !id ? (
          <p className="text-gray-500">ไม่พบรหัสประกาศ</p>
        ) : !data ? (
          <p className="text-blue-600 animate-pulse">กำลังโหลดประกาศ...</p>
        ) : (
          <div className="space-y-6 relative pb-16">
            <h2 className="text-3xl font-bold text-blue-800">{data.title}</h2>
            <div className="w-full flex justify-center">
              <img
                src={buildSrc(data.picture)}
                alt={data.title}
                className="
                  w-full
                  h-auto
                  object-contain
                  bg-gray-100
                  rounded-lg
                  shadow
                  max-w-[250px]      
                  sm:max-w-[300px]   
                  md:max-w-[350px]    
                "
              />
            </div>

            <div className="space-y-2">
              <p className="text-md font-semibold text-gray-700">รายละเอียด</p>
              <p className="text-md leading-relaxed whitespace-pre-wrap break-words">
                {data.content || "-"}
              </p>
            </div>

            <div className="space-y-1">
              <p className="text-md font-semibold text-gray-700">ลิงก์</p>
              {data.link ? (
                <a
                  href={data.link}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 underline break-all"
                >
                  {data.link}
                </a>
              ) : (
                <p className="text-sm text-gray-500">-</p>
              )}
            </div>

            <div className="flex justify-end absolute right-0 bottom-0">
              <Link
                href="/"
                className="text-blue-600 hover:underline text-sm font-medium"
              >
                กลับหน้าหลัก
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
export default AnnounceDetailPage
