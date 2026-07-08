"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FaCirclePlus } from "react-icons/fa6";
import { FaEdit, FaTrash } from "react-icons/fa";

type StudentInfoYearType = "ACADEMIC" | "BUDGET";
type StudentInfoRecord = {
  id: string;
  year: string;
  totalStudent: number;
  yearType: StudentInfoYearType;
};

export default function StudentCountFormPage() {
  const [list, setList] = useState<StudentInfoRecord[]>([]);
  const [year, setYear] = useState<string>("");
  const [totalStudent, setTotalStudent] = useState<string>("");
  const [budgetYear, setBudgetYear] = useState<string>("");
  const [budgetTotalStudent, setBudgetTotalStudent] = useState<string>("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingYearType, setEditingYearType] = useState<StudentInfoYearType | null>(null);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [yearMode, setYearMode] = useState<"ACADEMIC" | "BUDGET" | "ALL">("ACADEMIC");

  const fetchList = () => {
    setIsLoadingList(true);
    fetch("/api/student-info")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setList(
            data.map(
              (s: {
                id: string;
                year: string;
                totalStudent: number;
                yearType?: StudentInfoYearType;
              }) => ({
                id: s.id,
                year: s.year,
                totalStudent: s.totalStudent,
                yearType: s.yearType === "BUDGET" ? "BUDGET" : "ACADEMIC",
              })
            )
          );
        } else setList([]);
      })
      .catch(() => setList([]))
      .finally(() => setIsLoadingList(false));
  };

  useEffect(() => {
    fetchList();
  }, []);

  const handleEdit = (row: StudentInfoRecord) => {
    setEditingId(row.id);
    setEditingYearType(row.yearType);
    setYearMode(row.yearType);
    if (row.yearType === "BUDGET") {
      setBudgetYear(row.year);
      setBudgetTotalStudent(String(row.totalStudent));
    } else {
      setYear(row.year);
      setTotalStudent(String(row.totalStudent));
    }
    setErrorMessage(null);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    const ok = window.confirm("ต้องการลบข้อมูลหรือไม่?");
    if (!ok) return;

    try {
      setDeletingId(id);
      const res = await fetch("/api/student-info", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrorMessage(data.error || "ไม่สามารถลบได้");
        return;
      }

      setErrorMessage(null);
      setList((cur) => cur.filter((x) => x.id !== id));
      window.alert("ลบข้อมูลเรียบร้อย");
    } catch {
      setErrorMessage("เกิดข้อผิดพลาด ไม่สามารถลบได้");
    } finally {
      setDeletingId(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const parseInputs = (yStr: string, tStr: string) => {
      const y = yStr.trim() ? parseInt(yStr, 10) : NaN;
      const t = tStr.trim() ? parseInt(tStr, 10) : NaN;
      return { y, t };
    };

    const validate = (y: number, t: number, label: string) => {
      if (Number.isNaN(y) || Number.isNaN(t) || t < 0) {
        setErrorMessage(`กรุณากรอก${label}และจำนวนนักศึกษาให้ถูกต้อง`);
        return false;
      }
      return true;
    };

    const effectiveMode: "ACADEMIC" | "BUDGET" | "ALL" =
      editingId ? (editingYearType ?? yearMode) : yearMode;

    const academic = parseInputs(year, totalStudent);
    const budget = parseInputs(budgetYear, budgetTotalStudent);

    if (effectiveMode === "ACADEMIC") {
      if (!validate(academic.y, academic.t, "ปีการศึกษา")) return;
    } else if (effectiveMode === "BUDGET") {
      if (!validate(budget.y, budget.t, "ปีงบประมาณ")) return;
    } else {
      if (!validate(academic.y, academic.t, "ปีการศึกษา")) return;
      if (!validate(budget.y, budget.t, "ปีงบประมาณ")) return;
    }

    const confirmed = window.confirm("ยืนยันการบันทึกหรือไม่?");
    if (!confirmed) return;
    setIsSubmitting(true);
    try {
      const saveOne = async (payload: {
        id?: string;
        year: number;
        totalStudent: number;
        yearType: StudentInfoYearType;
      }) => {
        const method = payload.id ? "PUT" : "POST";
        const res = await fetch("/api/student-info", {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "ไม่สามารถบันทึกได้");
        }
      };

      if (effectiveMode === "ACADEMIC") {
        await saveOne({
          ...(editingId ? { id: editingId } : {}),
          year: academic.y,
          totalStudent: academic.t,
          yearType: "ACADEMIC",
        });
      } else if (effectiveMode === "BUDGET") {
        await saveOne({
          ...(editingId ? { id: editingId } : {}),
          year: budget.y,
          totalStudent: budget.t,
          yearType: "BUDGET",
        });
      } else {
        await saveOne({
          year: academic.y,
          totalStudent: academic.t,
          yearType: "ACADEMIC",
        });
        await saveOne({
          year: budget.y,
          totalStudent: budget.t,
          yearType: "BUDGET",
        });
      }

      window.alert(editingId ? "แก้ไขข้อมูลเรียบร้อย" : "บันทึกข้อมูลเรียบร้อย");
      setYear("");
      setTotalStudent("");
      setBudgetYear("");
      setBudgetTotalStudent("");
      setEditingId(null);
      setEditingYearType(null);
      fetchList();
    } catch (err) {
      const message =
        err instanceof Error && err.message ? err.message : "เกิดข้อผิดพลาด ไม่สามารถบันทึกได้";
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const visibleList =
    yearMode === "ALL"
      ? list
      : list.filter((x) => x.yearType === (yearMode === "BUDGET" ? "BUDGET" : "ACADEMIC"));

  const YearModeSelect = (
    <div className="flex items-center gap-3 justify-end">
      <select
        value={yearMode}
        onChange={(e) => setYearMode(e.target.value as "ACADEMIC" | "BUDGET" | "ALL")}
        disabled={isSubmitting || (editingId != null)}
        className="h-10 rounded-md border border-gray-300 bg-white px-3 pr-10 text-sm font-semibold text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
      >
        <option value="ALL">ทั้งหมด</option>
        <option value="ACADEMIC">ปีการศึกษา</option>
        <option value="BUDGET">ปีงบประมาณ</option>
      </select>
    </div>
  );

  const AcademicForm = (
    <div className="space-y-6">
      <div>
        <Label className="text-lg font-semibold">
          ปีการศึกษา <span className="text-red-500">*</span>
        </Label>
        <Input
          type="number"
          min={2500}
          max={2599}
          placeholder="เช่น 2568"
          className="mt-2 w-full max-w-xs p-3 border-2 border-gray-300 focus:border-blue-500"
          value={year}
          onChange={(e) => setYear(e.target.value)}
          disabled={isSubmitting}
        />
      </div>

      <div>
        <Label className="text-lg font-semibold">
          จำนวนนักศึกษา <span className="text-red-500">*</span>
        </Label>
        <Input
          type="number"
          min={0}
          placeholder="กรอกจำนวนนักศึกษา"
          className="mt-2 w-full max-w-xs p-3 border-2 border-gray-300 focus:border-blue-500"
          value={totalStudent}
          onChange={(e) => setTotalStudent(e.target.value)}
          disabled={isSubmitting}
        />
      </div>
    </div>
  );

  const BudgetForm = (
    <div className="space-y-6">
      <div>
        <Label className="text-lg font-semibold">
          ปีงบประมาณ <span className="text-red-500">*</span>
        </Label>
        <Input
          type="number"
          min={2500}
          max={2599}
          placeholder="เช่น 2568"
          className="mt-2 w-full max-w-xs p-3 border-2 border-gray-300 focus:border-blue-500"
          value={budgetYear}
          onChange={(e) => setBudgetYear(e.target.value)}
          disabled={isSubmitting}
        />
      </div>

      <div>
        <Label className="text-lg font-semibold">
          จำนวนนักศึกษา <span className="text-red-500">*</span>
        </Label>
        <Input
          type="number"
          min={0}
          placeholder="กรอกจำนวนนักศึกษา"
          className="mt-2 w-full max-w-xs p-3 border-2 border-gray-300 focus:border-blue-500"
          value={budgetTotalStudent}
          onChange={(e) => setBudgetTotalStudent(e.target.value)}
          disabled={isSubmitting}
        />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="pt-6 pb-12 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto w-full">
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-blueit">
            ระบบจัดเก็บสถิติจำนวนนักศึกษา
          </h1>
          <p className="text-gray-700 font-semibold mt-1">
            คณะเทคโนโลยีสารสนเทศ
            <br />
            สถาบันเทคโนโลยีพระจอมเกล้าเจ้าคุณทหารลาดกระบัง
          </p>
        </div>

        {!showForm && (
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <select
                value={yearMode}
                onChange={(e) =>
                  setYearMode(e.target.value as "ALL" | "ACADEMIC" | "BUDGET")
                }
                disabled={isSubmitting}
                className="rounded-lg border border-gray-300 bg-white px-3 pr-10 py-2 text-md font-semibold text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
              >
                <option value="ALL">ทั้งหมด</option>
                <option value="ACADEMIC">ปีการศึกษา</option>
                <option value="BUDGET">ปีงบประมาณ</option>
              </select>
            </div>

            <button
              onClick={() => {
                setEditingId(null);
                setShowForm(true);
              }}
              className="flex items-center gap-2 bg-blueit hover:bg-blue-800 text-white px-6 py-3 rounded-xl font-semibold transition-colors"
            >
              <FaCirclePlus className="text-xl" />
              เพิ่มข้อมูลจำนวนนักศึกษา
            </button>
          </div>
        )}

        {showForm && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {YearModeSelect}
              {yearMode === "ALL" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>{AcademicForm}</div>
                  <div>{BudgetForm}</div>
                </div>
              ) : yearMode === "BUDGET" ? (
                BudgetForm
              ) : (
                AcademicForm
              )}

              {errorMessage && (
                <p className="text-sm text-red-600">{errorMessage}</p>
              )}

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
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
          <h2 className="text-lg font-bold text-gray-900 p-4 border-b">
            {yearMode === "BUDGET"
              ? "สถิติจำนวนนักศึกษาตามปีงบประมาณ"
              : yearMode === "ALL"
                ? "สถิติจำนวนนักศึกษา"
                : "สถิติจำนวนนักศึกษาตามปีการศึกษา"}
          </h2>
          {isLoadingList ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : visibleList.length === 0 ? (
            <p className="text-gray-500 text-center py-8">ยังไม่มีข้อมูล</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left table-fixed">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 font-semibold text-gray-700 w-[42.857%] text-left">
                      ประจำปี (พ.ศ.)
                    </th>
                    <th className="px-4 py-3 font-semibold text-gray-700 w-[42.857%] text-left">
                      จำนวนนักศึกษา (คน)
                    </th>
                    <th className="px-4 py-3 font-semibold text-gray-700 w-[14.286%]" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {yearMode === "ALL" ? (
                    (() => {
                      const academicRows = list.filter((x) => x.yearType === "ACADEMIC");
                      const budgetRows = list.filter((x) => x.yearType === "BUDGET");

                      const SectionRow = () => (
                        <tr className="bg-gray-100">
                          <td
                            colSpan={3}
                            className="px-4 py-2 text-gray-800 font-semibold text-left"
                          >
                            สถิติจำนวนนักศึกษาตามปีงบประมาณ
                          </td>
                        </tr>
                      );

                      const AcademicSectionRow = () => (
                        <tr className="bg-gray-100">
                          <td
                            colSpan={3}
                            className="px-4 py-2 text-gray-800 font-semibold text-left"
                          >
                            สถิติจำนวนนักศึกษาตามปีการศึกษา
                          </td>
                        </tr>
                      );

                      return (
                        <>
                          {academicRows.length > 0 && <AcademicSectionRow />}
                          {academicRows.map((row) => (
                            <tr key={row.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 w-[42.857%] text-left">{row.year}</td>
                              <td className="px-4 py-3 w-[42.857%] text-left">
                                {row.totalStudent.toLocaleString()}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap w-[14.286%]">
                                <div className="flex items-center justify-center gap-3">
                                  <button
                                    type="button"
                                    onClick={() => handleEdit(row)}
                                    disabled={isSubmitting}
                                    className="text-blueit hover:text-blue-800 transition"
                                    title="แก้ไข"
                                  >
                                    <FaEdit className="text-xl" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDelete(row.id)}
                                    disabled={deletingId === row.id || isSubmitting}
                                    className="text-red-600 hover:text-red-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="ลบ"
                                  >
                                    <FaTrash className="text-xl" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                          {academicRows.length > 0 && budgetRows.length > 0 && <SectionRow />}
                          {budgetRows.map((row) => (
                            <tr key={row.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 w-[42.857%] text-left">{row.year}</td>
                              <td className="px-4 py-3 w-[42.857%] text-left">
                                {row.totalStudent.toLocaleString()}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap w-[14.286%]">
                                <div className="flex items-center justify-center gap-3">
                                  <button
                                    type="button"
                                    onClick={() => handleEdit(row)}
                                    disabled={isSubmitting}
                                    className="text-blueit hover:text-blue-800 transition"
                                    title="แก้ไข"
                                  >
                                    <FaEdit className="text-xl" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDelete(row.id)}
                                    disabled={deletingId === row.id || isSubmitting}
                                    className="text-red-600 hover:text-red-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="ลบ"
                                  >
                                    <FaTrash className="text-xl" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </>
                      );
                    })()
                  ) : (
                    visibleList.map((row) => (
                      <tr key={row.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 w-[42.857%] text-left">{row.year}</td>
                        <td className="px-4 py-3 w-[42.857%] text-left">
                          {row.totalStudent.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap w-[14.286%]">
                          <div className="flex items-center justify-center gap-3">
                            <button
                              type="button"
                              onClick={() => handleEdit(row)}
                              disabled={isSubmitting}
                              className="text-blueit hover:text-blue-800 transition"
                              title="แก้ไข"
                            >
                              <FaEdit className="text-xl" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(row.id)}
                              disabled={deletingId === row.id || isSubmitting}
                              className="text-red-600 hover:text-red-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
                              title="ลบ"
                            >
                              <FaTrash className="text-xl" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {!showForm && (
          <div className="mt-6 flex justify-end">
            <Link href="/management/staffInfo">
              <button
                type="button"
                className="bg-gray-300 text-black hover:bg-gray-400 px-6 py-3 rounded-xl font-semibold"
              >
                ย้อนกลับ
              </button>
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}