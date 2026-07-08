"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThaiDatePicker } from "@/components/ThaiDatePicker";
import { FaCirclePlus } from "react-icons/fa6";
import { FaEdit, FaTrash } from "react-icons/fa";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { royalDecoration } from "@/constants/royalDecoration";

type EmployeeItem = { id: string; fullName: string };
type DecorationRecord = {
  id: string;
  employeeId: string;
  employeeName: string;
  decorationName: string;
  decorationCode: string;
  receivedDate: string | null;
  gazetteDate: string | null;
};

function formatDateToThaiNumeric(dateValue?: string | null): string {
  if (!dateValue) return "-";
  const [year, month, day] = dateValue.split("-");
  if (!year || !month || !day) return dateValue;
  const buddhistYear = Number(year) + 543;
  return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${buddhistYear}`;
}

export default function RoyalDecorationFormPage() {
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [list, setList] = useState<DecorationRecord[]>([]);
  const [employeeId, setEmployeeId] = useState<string>("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [employeeSearch, setEmployeeSearch] = useState<string>("");
  const [decorationCode, setDecorationCode] = useState<string>("");
  const [receivedDate, setReceivedDate] = useState("");
  const [gazetteDate, setGazetteDate] = useState("");
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(true);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [searchDecorationCode, setSearchDecorationCode] = useState<string>("all");
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetch("/api/employees")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setEmployees(
            data.map((e: { id: string; fullName: string }) => ({
              id: e.id,
              fullName: e.fullName,
            })),
          );
        }
      })
      .catch(() => setEmployees([]))
      .finally(() => setIsLoadingEmployees(false));
  }, []);

  const fetchList = () => {
    setIsLoadingList(true);
    fetch("/api/employee-decorations")
      .then((res) => res.json())
      .then((data) => (Array.isArray(data) ? setList(data) : setList([])))
      .catch(() => setList([]))
      .finally(() => setIsLoadingList(false));
  };

  useEffect(() => {
    fetchList();
  }, []);

  const handleEdit = (row: DecorationRecord) => {
    setEditingId(row.id);
    setEmployeeId(row.employeeId);
    setEmployeeSearch(row.employeeName);
    setDecorationCode(row.decorationCode);
    setReceivedDate(row.receivedDate ?? "");
    setGazetteDate(row.gazetteDate ?? "");
    setErrorMessage(null);
    setShowForm(true);
  };

  const handleDelete = async (id: string, row: DecorationRecord) => {
    const confirmed = window.confirm(
      `ต้องการลบข้อมูล "${row.employeeName}" (${row.decorationName}) ใช่หรือไม่?`
    );
    if (!confirmed) return;

    try {
      const res = await fetch("/api/employee-decorations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrorMessage(data.error || "ไม่สามารถลบได้");
        return;
      }

      window.alert("ลบข้อมูลเรียบร้อย");
      setErrorMessage(null);
      fetchList();
    } catch {
      setErrorMessage("เกิดข้อผิดพลาด ไม่สามารถลบได้");
    }
  };

  const employeeSuggestions =
    employeeSearch.trim().length === 0
      ? []
      : employees
          .filter((e) =>
            e.fullName.toLowerCase().includes(employeeSearch.toLowerCase().trim()),
          )
          .slice(0, 10);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (!employeeId || !decorationCode) {
      setErrorMessage("กรุณาเลือกชื่อบุคลากรและชื่อเครื่องราช");
      return;
    }
    const confirmed = window.confirm("ยืนยันการบันทึกหรือไม่?");
    if (!confirmed) return;
    setIsSubmitting(true);
    try {
      const method = editingId ? "PUT" : "POST";
      const res = await fetch("/api/employee-decorations", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          editingId
            ? {
                id: editingId,
                employeeId,
                decorationCode: decorationCode.trim(),
                receivedDate: receivedDate || undefined,
                gazetteDate: gazetteDate || undefined,
              }
            : {
                employeeId,
                decorationCode: decorationCode.trim(),
                receivedDate: receivedDate || undefined,
                gazetteDate: gazetteDate || undefined,
              }
        ),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrorMessage(data.error || "ไม่สามารถบันทึกได้");
        return;
      }
      window.alert(editingId ? "แก้ไขข้อมูลเรียบร้อย" : "บันทึกข้อมูลเรียบร้อย");
      setEmployeeId("");
      setEmployeeSearch("");
      setDecorationCode("");
      setReceivedDate("");
      setGazetteDate("");
      setEditingId(null);
      fetchList();
    } catch {
      setErrorMessage("เกิดข้อผิดพลาด ไม่สามารถบันทึกได้");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="pt-6 pb-12 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto w-full">
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-blueit">
            เกียรติประวัติและเครื่องราชอิสริยาภรณ์บุคลากร
          </h1>
          <p className="text-black font-semibold mt-1">
            คณะเทคโนโลยีสารสนเทศ <br />
            สถาบันเทคโนโลยีพระจอมเกล้าเจ้าคุณทหารลาดกระบัง
          </p>
        </div>

        {!showForm && (
          <div className="mb-8 flex items-center justify-between gap-4">
            <Link href="/management/staffInfo">
              <button
                type="button"
                className="bg-gray-300 text-black hover:bg-gray-400 px-6 py-3 rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isSubmitting}
              >
                ย้อนกลับ
              </button>
            </Link>
            <button
              onClick={() => {
                setEditingId(null);
                setShowForm(true);
              }}
              className="flex items-center gap-2 bg-blueit hover:bg-blue-800 text-white px-6 py-3 rounded-xl font-semibold transition-colors"
            >
              <FaCirclePlus className="text-xl" />
              เพิ่มข้อมูลเครื่องราชอิสริยาภรณ์
            </button>
          </div>
        )}

        {showForm && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label className="text-lg font-semibold">
                ชื่อบุคลากร
                <span className="text-red-500">*</span>
              </Label>
              <div className="relative mt-2">
                <Input
                  type="text"
                  placeholder="พิมพ์ชื่อเพื่อค้นหาบุคลากร"
                  className="w-full p-3 border-2 border-gray-300 focus:border-blue-500"
                  value={employeeSearch}
                  onChange={(e) => {
                    setEmployeeSearch(e.target.value);
                    setEmployeeId("");
                  }}
                  disabled={isLoadingEmployees || isSubmitting}
                />
                {employeeSuggestions.length > 0 && !employeeId && (
                  <ul className="absolute z-20 w-full bg-white border-2 rounded-md shadow-lg mt-1 max-h-48 overflow-y-auto">
                    {employeeSuggestions.map((emp) => (
                      <li
                        key={emp.id}
                        onClick={() => {
                          setEmployeeId(emp.id);
                          setEmployeeSearch(emp.fullName);
                        }}
                        className="px-4 py-2 hover:bg-blue-50 cursor-pointer border-b last:border-none"
                      >
                        {emp.fullName}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div>
              <Label className="text-lg font-semibold">
                ชื่อเครื่องราช <span className="text-red-500">*</span>
              </Label>
              <Select
                value={decorationCode}
                onValueChange={setDecorationCode}
                disabled={isSubmitting}
              >
                <SelectTrigger className="mt-2 w-full p-3 border-2 border-gray-300">
                  <SelectValue placeholder="เลือกเครื่องราชอิสริยาภรณ์" />
                </SelectTrigger>
                <SelectContent className="max-h-60 overflow-y-auto">
                  {royalDecoration.map((d) => (
                    <SelectItem key={d.code} value={d.code}>
                      {d.name} ({d.code}){d.class ? ` — ${d.class}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label className="text-lg font-semibold">วันที่ได้รับ</Label>
                <ThaiDatePicker
                  className="mt-2 w-full p-3 border-2 border-gray-300 focus:border-blue-500"
                  value={receivedDate}
                  onChange={setReceivedDate}
                  disabled={isSubmitting}
                  allowClear
                  dialogTitle="เลือกวันที่ได้รับ"
                />
              </div>
              <div>
                <Label className="text-lg font-semibold">วันที่ประกาศ</Label>
                <ThaiDatePicker
                  className="mt-2 w-full p-3 border-2 border-gray-300 focus:border-blue-500"
                  value={gazetteDate}
                  onChange={setGazetteDate}
                  disabled={isSubmitting}
                  allowClear
                  dialogTitle="เลือกวันที่ประกาศ"
                />
              </div>
            </div>

            {errorMessage && (
              <p className="text-sm text-red-600">{errorMessage}</p>
            )}

            <div className="flex items-center justify-between pt-4">
              <button
                type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingId(null);
                  }}
                className="bg-gray-300 text-black hover:bg-gray-400 px-6 py-3 rounded-xl font-semibold disabled:opacity-50"
                disabled={isSubmitting}
              >
                ย้อนกลับ
              </button>
              <button
                type="submit"
                className="bg-blueit text-white hover:bg-blue-800 px-6 py-3 rounded-xl font-semibold disabled:opacity-50"
                disabled={isSubmitting}
              >
                {isSubmitting ? "กำลังบันทึกข้อมูล" : "บันทึกข้อมูล"}
              </button>
            </div>
          </form>
        </div>
        )}

        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="p-4 border-b space-y-4">
            <h2 className="text-lg font-bold text-gray-900">
              รายการบุคลากรที่ได้รับเครื่องราชอิสริยาภรณ์
            </h2>
            <div className="flex flex-col md:flex-row gap-4 md:items-center">
              <div className="flex-1 flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex-1">
                  <Label className="text-sm font-semibold text-gray-700">
                    ค้นหาบุคลากร
                  </Label>
                  <Input
                    placeholder="ค้นหาชื่อ หรือข้อมูลที่เกี่ยวข้อง"
                    className="mt-1 w-full"
                    value={searchKeyword}
                    onChange={(e) => setSearchKeyword(e.target.value)}
                  />
                </div>
              </div>

              <div className="w-full md:w-64">
                <Label className="text-sm font-semibold text-gray-700">
                  ชื่อเครื่องราช
                </Label>
                <Select
                  value={searchDecorationCode}
                  onValueChange={setSearchDecorationCode}
                >
                  <SelectTrigger className="mt-1 w-full">
                    <SelectValue placeholder="ทั้งหมด" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60 overflow-y-auto">
                    <SelectItem value="all">ทั้งหมด</SelectItem>
                    {royalDecoration.map((d) => (
                      <SelectItem key={d.code} value={d.code}>
                        {d.name} ({d.code}){d.class ? ` — ${d.class}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          {isLoadingList ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : list.length === 0 ? (
            <p className="text-gray-500 text-center py-8">ยังไม่มีข้อมูล</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 font-semibold text-gray-700">
                      ชื่อบุคลากร
                    </th>
                    <th className="px-4 py-3 font-semibold text-gray-700">
                      ชื่อเครื่องราช
                    </th>
                    <th className="px-4 py-3 font-semibold text-gray-700">
                      วันที่ได้รับ
                    </th>
                    <th className="px-4 py-3 font-semibold text-gray-700">
                      วันที่ประกาศ
                    </th>
                    <th className="px-4 py-3 font-semibold text-gray-700">
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {list
                    .filter((row) => {
                      const matchKeyword =
                        !searchKeyword.trim() ||
                        row.employeeName
                          .toLowerCase()
                          .includes(searchKeyword.toLowerCase().trim()) ||
                        row.decorationName
                          .toLowerCase()
                          .includes(searchKeyword.toLowerCase().trim());
                      const matchDecoration =
                        searchDecorationCode === "all" ||
                        row.decorationCode === searchDecorationCode;
                      return matchKeyword && matchDecoration;
                    })
                    .map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">{row.employeeName}</td>
                      <td className="px-4 py-3">{row.decorationName}</td>
                      <td className="px-4 py-3">{formatDateToThaiNumeric(row.receivedDate)}</td>
                      <td className="px-4 py-3">{formatDateToThaiNumeric(row.gazetteDate)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-4">
                          <button
                            type="button"
                            onClick={() => handleEdit(row)}
                            className="text-blueit hover:text-blue-800 transition"
                            disabled={isSubmitting}
                            title="แก้ไข"
                          >
                            <FaEdit className="text-xl" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(row.id, row)}
                            className="text-red-600 hover:text-red-800 transition"
                            disabled={isSubmitting}
                            title="ลบ"
                          >
                            <FaTrash className="text-xl" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
