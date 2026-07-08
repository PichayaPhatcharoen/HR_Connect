"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { FaEdit, FaTrash } from "react-icons/fa";
import { FaCirclePlus } from "react-icons/fa6";
import { HiOutlineAcademicCap, HiOutlineUserGroup } from "react-icons/hi";
import { IoMdSearch } from "react-icons/io";

type EmployeeListItem = {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  jobTitle?: string;
  staffType: string;
  degree?: string;
  academicPosition?: string;
  supportAcademicPosition?: string;
  status: string;
  updatedAt?: string;
};

const staffTypeLabel: Record<string, string> = {
  ACADEMIC: "สายวิชาการ",
  SUPPORT: "สายสนับสนุน",
};

const academicPositionLabel: Record<string, string> = {
  LECTURER: "อาจารย์",
  ASSISTANT_PROFESSOR: "ผู้ช่วยศาสตราจารย์",
  ASSOCIATE_PROFESSOR: "รองศาสตราจารย์",
  PROFESSOR: "ศาสตราจารย์",
};

const supportPositionLabel: Record<string, string> = {
  OPERATIONAL_LEVEL: "ระดับปฏิบัติการ",
  SENIOR_PRACTITIONER: "ชำนาญการพิเศษ",
  EXPERT: "เชี่ยวชาญ",
  SENIOR_EXPERT: "เชี่ยวชาญพิเศษ",
};

const degreeLabel: Record<string, string> = {
  BACHELOR: "ตรี",
  MASTER: "โท",
  DOCTOR: "เอก",
  OTHER: "อื่นๆ",
};

export default function StaffProfilePage() {
  const [data, setData] = useState<EmployeeListItem[]>([]);
  const [filtered, setFiltered] = useState<EmployeeListItem[]>([]);
  const [search, setSearch] = useState("");
  const [staffFilter, setStaffFilter] = useState<"ALL" | "ACADEMIC" | "SUPPORT">(
    "ALL",
  );
  const [positionFilter, setPositionFilter] = useState<string>("ALL");
  const [degreeFilter, setDegreeFilter] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<"updatedAt" | "name">("updatedAt");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchData = () => {
    setError(null);
    fetch("/api/employees")
      .then((res) => {
        if (!res.ok) throw new Error("โหลดข้อมูลไม่สำเร็จ");
        return res.json();
      })
      .then(setData)
      .catch((err) => {
        console.error(err);
        setError("ไม่สามารถโหลดข้อมูลบุคลากรได้");
        setData([]);
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const q = search.toLowerCase().trim();
    let result = data.filter((e) => {
      const positionText =
        e.staffType === "ACADEMIC"
          ? e.academicPosition
            ? academicPositionLabel[e.academicPosition] ?? e.academicPosition
            : ""
          : e.supportAcademicPosition
            ? supportPositionLabel[e.supportAcademicPosition] ?? e.supportAcademicPosition
            : "";
      const matchesSearch =
        !q ||
        e.fullName.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q) ||
        (e.jobTitle && e.jobTitle.toLowerCase().includes(q)) ||
        positionText.toLowerCase().includes(q) ||
        (e.degree && (degreeLabel[e.degree] ?? e.degree).toLowerCase().includes(q)) ||
        (e.phone && e.phone.includes(q));
      const matchesStaff =
        staffFilter === "ALL" || e.staffType === staffFilter;
      const matchesDegree =
        degreeFilter === "ALL" ? true : e.degree === degreeFilter;
      const matchesPosition =
        positionFilter === "ALL"
          ? true
          : e.staffType === "ACADEMIC"
            ? e.academicPosition === positionFilter
            : e.supportAcademicPosition === positionFilter;

      return matchesSearch && matchesStaff && matchesDegree && matchesPosition;
    });

    // Client-side sorting based on selected sort option
    if (sortBy === "name") {
      result = result.sort((a, b) => a.fullName.localeCompare(b.fullName, "th"));
    } else if (sortBy === "updatedAt") {
      result = result.sort((a, b) => {
        const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return dateB - dateA; // Newest first
      });
    }

    setFiltered(result);
  }, [data, search, staffFilter, degreeFilter, positionFilter, sortBy]);

  useEffect(() => {
    setPositionFilter("ALL");
  }, [staffFilter]);

  const handleDelete = async (id: string) => {
    const confirmed = window.confirm("ต้องการลบข้อมูลบุคลากรหรือไม่?");
    if (!confirmed) return;

    setError(null);
    setDeletingId(id);
    try {
      const res = await fetch(`/api/employees/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "ไม่สามารถลบได้");
      }

      setData((cur) => cur.filter((e) => e.id !== id));
      window.alert("ลบข้อมูลเรียบร้อย");
    } catch (err) {
      console.error(err);
      setError("ไม่สามารถลบข้อมูลบุคลากรได้");
    } finally {
      setDeletingId(null);
    }
  };

  const activeStaff = data.filter((e) => e.status === "ACTIVE");
  const totalStaff = activeStaff.length;
  const academicStaff = activeStaff.filter((e) => e.staffType === "ACADEMIC").length;
  const supportStaff = activeStaff.filter((e) => e.staffType === "SUPPORT").length;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <main className="pt-6 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="flex flex-col gap-6 mb-8">
          <div className="flex flex-col gap-3">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold text-blue-600">
                ข้อมูลประวัติบุคลากร
              </h1>
              <p className="text-black text-xl md:text-2xl font-bold">
                คณะเทคโนโลยีสารสนเทศ
                <br />
                สถาบันเทคโนโลยีพระจอมเกล้าเจ้าคุณทหารลาดกระบัง
              </p>
            </div>

            <div className="flex flex-wrap gap-2 sm:gap-3 justify-start lg:justify-end">
              <Link
                href="/management/staffInfo/royal"
                className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition"
              >
                <HiOutlineAcademicCap className="text-lg" />
                <span>ข้อมูลเครื่องราชอิสริยาภรณ์</span>
              </Link>
              <Link
                href="/management/staffInfo/studentCount"
                className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition"
              >
                <HiOutlineUserGroup className="text-lg" />
                <span>สถิติจำนวนนักศึกษาตามปีการศึกษา</span>
              </Link>
              <Link
                href="/management/staffInfo/add"
                className="inline-flex items-center gap-2 rounded-md bg-blueit px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition"
              >
                <FaCirclePlus className="text-lg" />
                <span>เพิ่มข้อมูลบุคลากร</span>
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-lg shadow-md border-l-4 border-blue-400">
              <p className="text-gray-600 text-lg">จำนวนบุคลากรทั้งหมด</p>
              <p className="text-3xl font-bold text-blue-600">
                {totalStaff.toLocaleString()}
              </p>
              <p className="text-base text-gray-500">คน</p>
            </div>
            <div className="bg-white p-5 rounded-lg shadow-md">
              <p className="text-gray-600 text-lg">จำนวนบุคลากรสายวิชาการ</p>
              <p className="text-3xl font-bold text-green-600">
                {academicStaff.toLocaleString()}
              </p>
              <p className="text-base text-gray-500">คน</p>
            </div>
            <div className="bg-white p-5 rounded-lg shadow-md">
              <p className="text-gray-600 text-lg">จำนวนบุคลากรสายสนับสนุน</p>
              <p className="text-3xl font-bold text-purple-600">
                {supportStaff.toLocaleString()}
              </p>
              <p className="text-base text-gray-500">คน</p>
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md">
            <form
              className="flex flex-col gap-4"
              onSubmit={(e) => e.preventDefault()}
            >
              {/* Search row - full width */}
                <label className="block text-lg font-semibold mb-2">
                  ค้นหาบุคลากร
                </label>
              <div className="w-full flex flex-row gap-2">
                <Input
                  placeholder="ค้นหาชื่อ อีเมล เบอร์โทร หรือตำแหน่ง"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full text-base border-2 border-gray-300 focus:border-blue-500 focus-visible:ring-0 min-h-[2.75rem]"
                />
                <button
                  type="submit"
                  className="bg-blueit text-white px-5 py-2.5 rounded-md font-semibold hover:bg-blue-700 transition whitespace-nowrap h-[2.75rem]"
                >
                  <span className="flex items-center gap-2">
                    <IoMdSearch />
                    ค้นหา
                  </span>
                </button>
              </div>

              {/* Filters row */}
              <div className="flex flex-wrap items-end gap-x-2 gap-y-2 w-full">
                <div className="flex flex-col gap-y-1 w-full sm:w-44">
                  <label className="block text-sm md:text-base font-semibold">
                    วุฒิการศึกษา
                  </label>
                  <Select value={degreeFilter} onValueChange={setDegreeFilter}>
                    <SelectTrigger className="w-full text-base border-2 border-gray-300 focus:border-blue-500 focus-visible:ring-0 min-h-[2.75rem]">
                      <SelectValue placeholder="ทั้งหมด" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">ทั้งหมด</SelectItem>
                      <SelectItem value="BACHELOR">ตรี</SelectItem>
                      <SelectItem value="MASTER">โท</SelectItem>
                      <SelectItem value="DOCTOR">เอก</SelectItem>
                      <SelectItem value="OTHER">อื่นๆ</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-y-1 w-full sm:w-44">
                  <label className="block text-sm md:text-base font-semibold">
                    สายงาน
                  </label>
                  <Select
                    value={staffFilter}
                    onValueChange={(value) =>
                      setStaffFilter(value as "ALL" | "ACADEMIC" | "SUPPORT")
                    }
                  >
                    <SelectTrigger className="w-full text-base border-2 border-gray-300 focus:border-blue-500 focus-visible:ring-0 min-h-[2.75rem]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">ทั้งหมด</SelectItem>
                      <SelectItem value="ACADEMIC">สายวิชาการ</SelectItem>
                      <SelectItem value="SUPPORT">สายสนับสนุน</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-y-1 w-full sm:w-56">
                  <label className="block text-sm md:text-base font-semibold">
                    ตำแหน่งสายงาน
                  </label>
                  <Select
                    value={positionFilter}
                    onValueChange={setPositionFilter}
                  >
                    <SelectTrigger className="w-full text-base border-2 border-gray-300 focus:border-blue-500 focus-visible:ring-0 min-h-[2.75rem]">
                      <SelectValue placeholder="ทั้งหมด" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">ทั้งหมด</SelectItem>
                      {(staffFilter === "ALL" || staffFilter === "ACADEMIC") && (
                        <>
                          <SelectItem value="LECTURER">อาจารย์</SelectItem>
                          <SelectItem value="ASSISTANT_PROFESSOR">ผู้ช่วยศาสตราจารย์</SelectItem>
                          <SelectItem value="ASSOCIATE_PROFESSOR">รองศาสตราจารย์</SelectItem>
                          <SelectItem value="PROFESSOR">ศาสตราจารย์</SelectItem>
                        </>
                      )}
                      {(staffFilter === "ALL" || staffFilter === "SUPPORT") && (
                        <>
                          <SelectItem value="OPERATIONAL_LEVEL">ปฏิบัติการ</SelectItem>
                          <SelectItem value="SENIOR_PRACTITIONER">ชำนาญการพิเศษ</SelectItem>
                          <SelectItem value="EXPERT">เชี่ยวชาญ</SelectItem>
                          <SelectItem value="SENIOR_EXPERT">เชี่ยวชาญพิเศษ</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>


                <div className="flex flex-col gap-y-1 w-auto">
                  <label className="block text-sm md:text-base font-semibold">
                    เรียงตาม
                  </label>
                  <div className="flex rounded-md border border-gray-300 overflow-hidden h-[2.75rem]">
                    <button
                      type="button"
                      onClick={() => setSortBy("updatedAt")}
                      className={`px-2 md:px-3 py-2 text-xs md:text-sm font-medium transition whitespace-nowrap ${
                        sortBy === "updatedAt"
                          ? "bg-blueit text-white"
                          : "bg-white text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      แก้ไขล่าสุด
                    </button>
                    <button
                      type="button"
                      onClick={() => setSortBy("name")}
                      className={`px-2 md:px-3 py-2 text-xs md:text-sm font-medium transition border-l border-gray-300 whitespace-nowrap ${
                        sortBy === "name"
                          ? "bg-blueit text-white"
                          : "bg-white text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      ตัวอักษร ก-ฮ
                    </button>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-500 text-lg">{error}</p>
              <button
                onClick={fetchData}
                className="mt-4 bg-gray-200 text-gray-800 hover:bg-gray-300 px-4 py-2 rounded-md font-medium"
              >
                โหลดใหม่
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg">
                {data.length === 0
                  ? "ยังไม่มีข้อมูลบุคลากร"
                  : "ไม่พบรายการที่ตรงกับคำค้น"}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filtered.map((emp) => (
                <div
                  key={emp.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 hover:bg-gray-50 transition"
                >
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/management/staffInfo/edit?id=${emp.id}`}
                      className="text-blue-600 hover:text-blue-800 font-semibold text-lg hover:underline"
                    >
                      {emp.fullName}
                    </Link>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-gray-600">
                      <span>{emp.email}</span>
                      {emp.phone && <span>{emp.phone}</span>}
                      {emp.jobTitle && (
                        <span className="text-gray-500">{emp.jobTitle}</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs">
                        {staffTypeLabel[emp.staffType] ?? emp.staffType}
                      </span>
                      {(emp.academicPosition || emp.supportAcademicPosition) && (
                        <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs">
                          {emp.academicPosition
                            ? academicPositionLabel[emp.academicPosition] ?? emp.academicPosition
                            : emp.supportAcademicPosition
                              ? supportPositionLabel[emp.supportAcademicPosition] ??
                                emp.supportAcademicPosition
                              : ""}
                        </span>
                      )}
                      <span
                        className={`px-2 py-0.5 rounded text-xs ${
                          emp.status === "ACTIVE"
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {emp.status === "ACTIVE" ? "ปฏิบัติงาน" : emp.status}
                      </span>
                      {emp.updatedAt && (
                        <span className="bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded text-xs">
                          แก้ไขล่าสุด: {new Date(emp.updatedAt).toLocaleDateString("th-TH")}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex-shrink-0 flex items-center gap-x-2">
                    <Link
                      href={`/management/staffInfo/edit?id=${emp.id}`}
                      className="inline-flex items-center gap-2 text-white bg-blueit hover:bg-blue-700 rounded-md px-4 py-2 text-sm font-medium transition"
                    >
                      <FaEdit className="text-base" />
                      <span>แก้ไขข้อมูล</span>
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleDelete(emp.id)}
                      disabled={deletingId === emp.id}
                      className="inline-flex items-center justify-center text-red-600 hover:text-red-800 px-3 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="ลบข้อมูล"
                    >
                      <FaTrash className="text-xl" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
