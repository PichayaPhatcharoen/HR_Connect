"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ColumnDef } from "@tanstack/react-table"
import { DataTable } from "@/components/DataTable/data-table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { IoMdSearch } from "react-icons/io"
import { FaCirclePlus } from "react-icons/fa6"

type TrainingRecord = {
  id: string
  title: string
  category: string
  domain?: string
  type: string
  location: string
  locationType: string
  organizer: string
  startDate: string
  startDateRaw: string
  endDate: string
  participants: string[]
  budget: number | null
  yearBudget: string | null
  updatedAt: string
}

const formatTrainingFormat = (format: string): string => {
  const formatMap: { [key: string]: string } = {
    'ONSITE': 'ออนไซต์',
    'ONLINE': 'ออนไลน์',
    'HYBRID': 'ผสม'
  }
  return formatMap[format] || format
}

const formatTrainingCategory = (category: string): string => {
  const categoryMap: { [key: string]: string } = {
    TRAINING: "อบรม",
    CONFERENCE: "นำเสนอผลงาน",
    SEMINAR: "สัมมนา",
    OTHER: "อื่นๆ",
    'ACADEMIC': 'วิชาการ/วิจัย',
    'TECHNICAL': 'เทคนิค/ไอที',
    'MANAGEMENT': 'บริหารจัดการ',
    'SOFT_SKILLS': 'มนุษยสัมพันธ์',
    'COMPLIANCE': 'กฎระเบียบ/จริยธรรม',
  }
  return categoryMap[category] || category
}

const formatTrainingDomain = (domain: string): string => {
  const domainMap: { [key: string]: string } = {
    ACADEMIC: "วิชาการ/วิจัย",
    TECHNICAL: "เทคนิค/ไอที",
    MANAGEMENT: "บริหารจัดการ",
    SOFT_SKILLS: "การสื่อสาร/ภาวะผู้นำ",
    COMPLIANCE: "กฎระเบียบ/จริยธรรม",
    OTHER: "อื่นๆ",
  }
  return domainMap[domain] || domain
}


const formatLocationType = (locationType: string): string => {
  const locationMap: { [key: string]: string } = {
    'FACULTY': 'ในคณะ',
    'BMR': 'กรุงเทพ/ปริมณฑล',
    'PROVINCE': 'ต่างจังหวัด',
    'INTERNATIONAL': 'ต่างประเทศ',
    'ONLINE': 'ออนไลน์'
  }
  return locationMap[locationType] || locationType
}

export default function TrainingPage() {
  const [data, setData] = useState<TrainingRecord[]>([])
  const [filtered, setFiltered] = useState<TrainingRecord[]>([])
  const [search, setSearch] = useState("")
  const [year, setYear] = useState("ALL")
  const [categoryFilter, setCategoryFilter] = useState("ALL")
  const [domain, setDomain] = useState("ALL")
  const [location, setLocation] = useState("ALL")

  const dataArray = Array.isArray(data) ? data : []

  const normalizeYearBudgetToCE = (raw: string | null): string | null => {
    if (!raw) return null
    const parsed = parseInt(raw, 10)
    if (Number.isNaN(parsed)) return null
    const ce = parsed >= 2500 ? parsed - 543 : parsed
    return ce.toString()
  }

  const yearOptionsCE = Array.from(
    new Set(
      dataArray
        .map((t) => normalizeYearBudgetToCE(t.yearBudget ?? null))
        .filter((y): y is string => typeof y === "string" && y.trim().length > 0)
    )
  ).sort((a, b) => parseInt(b, 10) - parseInt(a, 10))

  const refreshData = () => {
    fetch("/api/training")
      .then(async (res) => {
        const json = await res.json().catch(() => null)
        if (!Array.isArray(json)) {
          console.error("Expected array from /api/training, got:", json)
          setData([])
          return
        }
        const sorted = [...json].sort((a, b) => {
          const at = a?.updatedAt ? new Date(a.updatedAt).getTime() : 0
          const bt = b?.updatedAt ? new Date(b.updatedAt).getTime() : 0
          return bt - at
        })
        setData(sorted)
      })
      .catch((err) => {
        console.error("Failed to fetch /api/training:", err)
        setData([])
      })
  }

  useEffect(() => {
    refreshData()
  }, [])

  const columns: ColumnDef<TrainingRecord>[] = [
    {
      accessorKey: "startDateRaw",
      header: "วันที่",
      enableSorting: true,
      cell: ({ row }) => {
        const s = row.original.startDate
        const e = row.original.endDate
        return s === e ? s : `${s} - ${e}`
      },
      sortingFn: "alphanumeric",
    },
    {
      accessorKey: "title",
      header: "กิจกรรม",
      enableSorting: true,
      sortingFn: "alphanumeric",
    },
    {
      accessorKey: "participants",
      header: "ผู้เข้าร่วม",
      cell: ({ row }) => {
        const names = row.original.participants
        if (!names || names.length === 0) return "-"
        if (names.length <= 2) {
          return names.join(", ")
        }
        return `${names.slice(0, 2).join(", ")} และอีก ${names.length - 2} คน`
      },
      accessorFn: (row) => (row.participants ? row.participants.join(", ") : ""),
    },
    {
      accessorKey: "organizer",
      header: "ผู้จัด",
      cell: ({ row }) => row.original.organizer || "-",
    },
    {
      accessorKey: "location",
      header: "สถานที่",
      cell: ({ row }) => {
        const location = row.original.location
        const locationType = row.original.locationType
        if (location && location !== locationType) {
          return `${location} (${formatLocationType(locationType)})`
        }
        return formatLocationType(locationType)
      },
    },
    {
      accessorKey: "type",
      header: "รูปแบบ",
      cell: ({ row }) => formatTrainingFormat(row.original.type),
    },
    {
      accessorKey: "category",
      header: "ประเภท",
      cell: ({ row }) => formatTrainingCategory(row.original.category),
    },
    {
      accessorKey: "budget",
      header: "งบประมาณที่ใช้",
      cell: ({ row }) =>
        row.original.budget
          ? row.original.budget.toLocaleString()
          : "-",
    },
    {
      id: "view",
      header: "",
      enableSorting: false,
      cell: ({ row }) => (
        <Link
          href={`/management/training/edittraining?id=${row.original.id}`}
          className="text-blue-600 hover:underline"
        >
          ดู
        </Link>
      ),
    },
    {
      id: "delete",
      header: "",
      enableSorting: false,
      cell: ({ row }) => {
        const handleDelete = async () => {
          if (!confirm("คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลการอบรมนี้?")) {
            return;
          }

          try {
            const response = await fetch(`/api/training?id=${row.original.id}`, {
              method: "DELETE",
            });

            if (!response.ok) {
              const error = await response.json();
              alert(error.error || "เกิดข้อผิดพลาดในการลบข้อมูล");
              return;
            }

            // Refresh data after deletion
            refreshData();
            alert("ลบข้อมูลสำเร็จ");
          } catch (error) {
            console.error("Delete error:", error);
            alert("เกิดข้อผิดพลาดในการลบข้อมูล");
          }
        };

        return (
          <button
            onClick={handleDelete}
            className="text-red-600 hover:underline cursor-pointer"
          >
            ลบ
          </button>
        );
      },
    },
  ]

  useEffect(() => {
    let result = data

    if (search) {
      result = result.filter((t) =>
        t.title.includes(search) ||
        t.participants.join(",").includes(search) ||
        t.location.includes(search)
      )
    }

    if (year !== "ALL") {
      result = result.filter(
        (t) => normalizeYearBudgetToCE(t.yearBudget ?? null) === year
      )
    }

    if (categoryFilter !== "ALL") {
      result = result.filter((t) => t.category === categoryFilter)
    }

    if (location !== "ALL") {
      result = result.filter((t) => {
        const locationMap: { [key: string]: string } = {
          'Online': 'ONLINE',
          'BMR': 'BMR',
          'Thailand': 'PROVINCE',
          'Faculty': 'FACULTY',
          'Japan': 'INTERNATIONAL'
        }
        return t.locationType === locationMap[location]
      })
    }

    if (domain !== "ALL") {
      result = result.filter((t) => (t.domain || "") === domain)
    }

    setFiltered(result)
  }, [data, search, year, categoryFilter, location, domain])

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <h1 className="text-5xl font-bold text-blue-600">
        รายงานสรุปการอบรม สัมมนา และศึกษาดูงานของบุคลากร
      </h1>
      <p className="font-bold mt-2 text-xl">
        คณะเทคโนโลยีสารสนเทศ
        <br />
        สถาบันเทคโนโลยีพระจอมเกล้าเจ้าคุณทหารลาดกระบัง
      </p>

      <div className="flex justify-end mb-6">
        <Link href="/management/training/addtraining">
          <button className="flex items-center gap-x-2 text-white bg-blue-600 hover:bg-blue-700 rounded-md transition px-4 py-2 shadow-md">
            <FaCirclePlus className="text-xl" />
            <span className="font-semibold">เพิ่มการอบรมใหม่</span>
          </button>
        </Link>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
      <div className="grid grid-cols-2 lg:grid-cols-16 gap-4 items-end">
    <div className="flex flex-col gap-1 col-span-2 lg:col-span-7">

      <label className="text-sm font-semibold text-gray-700">
        ค้นหาการอบรม
      </label>
      <Input
        placeholder="ค้นหาชื่อกิจกรรม คน สถานที่"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
    </div>

    <div className="flex flex-col gap-1 col-span-1 lg:col-span-2">

      <label className="text-sm font-semibold text-gray-700">
        ปีงบประมาณ
      </label>
      <Select value={year} onValueChange={setYear}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="ทุกปี" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">ทุกปี</SelectItem>
          {yearOptionsCE.map((y) => {
            const parsed = parseInt(y, 10)
            const labelBE = Number.isNaN(parsed) ? y : (parsed + 543).toString()
            return (
              <SelectItem key={y} value={y}>
                {labelBE}
              </SelectItem>
            )
          })}
        </SelectContent>
      </Select>
    </div>

    <div className="flex flex-col gap-1 col-span-1 lg:col-span-2">

      <label className="text-sm font-semibold text-gray-700">
        ประเภท
      </label>
      <Select value={categoryFilter} onValueChange={setCategoryFilter}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="ทั้งหมด" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">ทั้งหมด</SelectItem>
          <SelectItem value="TRAINING">{formatTrainingCategory("TRAINING")}</SelectItem>
          <SelectItem value="CONFERENCE">{formatTrainingCategory("CONFERENCE")}</SelectItem>
          <SelectItem value="SEMINAR">{formatTrainingCategory("SEMINAR")}</SelectItem>
          <SelectItem value="OTHER">{formatTrainingCategory("OTHER")}</SelectItem>
        </SelectContent>
      </Select>
    </div>

    <div className="flex flex-col gap-1 col-span-1 lg:col-span-2">

      <label className="text-sm font-semibold text-gray-700">
        หมวดหมู่
      </label>
      <Select value={domain} onValueChange={setDomain}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="ทั้งหมด" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">ทั้งหมด</SelectItem>
          <SelectItem value="ACADEMIC">{formatTrainingDomain("ACADEMIC")}</SelectItem>
          <SelectItem value="TECHNICAL">{formatTrainingDomain("TECHNICAL")}</SelectItem>
          <SelectItem value="MANAGEMENT">{formatTrainingDomain("MANAGEMENT")}</SelectItem>
          <SelectItem value="SOFT_SKILLS">{formatTrainingDomain("SOFT_SKILLS")}</SelectItem>
          <SelectItem value="COMPLIANCE">{formatTrainingDomain("COMPLIANCE")}</SelectItem>
          <SelectItem value="OTHER">{formatTrainingDomain("OTHER")}</SelectItem>
        </SelectContent>
      </Select>
    </div>

    <div className="flex flex-col gap-1 col-span-1 lg:col-span-2">

      <label className="text-sm font-semibold text-gray-700">
        ประเภทสถานที่
      </label>
      <Select value={location} onValueChange={setLocation}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="ทั้งหมด" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">ทั้งหมด</SelectItem>
          <SelectItem value="Online">ออนไลน์</SelectItem>
          <SelectItem value="BMR">กรุงเทพ/ปริมณฑล</SelectItem>
          <SelectItem value="Thailand">ในประเทศ</SelectItem>
          <SelectItem value="Faculty">ในคณะ</SelectItem>
          <SelectItem value="Japan">ต่างประเทศ</SelectItem>
        </SelectContent>
      </Select>
    </div>

    <div className="col-span-2 lg:col-span-1 flex justify-center">

      <Button className="w-full h-[40px] flex items-center justify-center gap-2 bg-blue-600">
        <IoMdSearch />
        <span className="lg:hidden">ค้นหา</span>
      </Button>
    </div>

  </div>
</div>

      <div className="bg-white p-6 rounded-lg shadow-md">
        <DataTable columns={columns} data={filtered} initialSorting={[{ id: "startDateRaw", desc: true }]} />
      </div>
    </div>
  )
}
