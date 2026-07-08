"use client";

import { FormEvent, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ThaiDatePicker } from "@/components/ThaiDatePicker";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

interface Employee {
  EmployeeId: string;
  FullName: string;
}

interface TrainingDetail {
  id: string;
  title: string;
  category: string;
  categoryOther?: string;
  domain: string;
  domainOther?: string;
  format: string;
  startDate: string;
  endDate: string;
  organizer: string;
  location: string;
  locationType: string;
  budget: string;
  yearBudget: string;
  description: string;
  participants: { id: string; name: string }[];
}

export default function EditTrainingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const trainingId = searchParams.get("id");

  const [title, setTitle] = useState("");
  const [domain, setDomain] = useState("");
  const [domainOther, setDomainOther] = useState("");
  const [category, setCategory] = useState("");
  const [categoryOther, setCategoryOther] = useState("");
  const [format, setFormat] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [organizer, setOrganizer] = useState("");
  const [location, setLocation] = useState("");
  const [locationType, setLocationType] = useState("");
  const [budget, setBudget] = useState("");
  const [yearBudget, setYearBudget] = useState("");
  const [yearBudgetCustomBE, setYearBudgetCustomBE] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState(""); // คำที่ใช้ค้นหา
  const [suggestions, setSuggestions] = useState<Employee[]>([]); // รายการที่ดึงมาจาก DB
  const [selectedEmployees, setSelectedEmployees] = useState<Employee[]>([]); // รายการที่เลือกแล้ว
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    const loadTraining = async () => {
      if (!trainingId) return;
      try {
        const res = await fetch(`/api/training?id=${trainingId}`);
        if (!res.ok) {
          setErrorMessage("ไม่พบข้อมูลรายการนี้");
          return;
        }
        const data: TrainingDetail = await res.json();
        setTitle(data.title);
        setCategory(data.category || "");
        setCategoryOther(data.categoryOther || "");
        setDomain(data.domain || "");
        setDomainOther(data.domainOther || "");
        setFormat(data.format);
        setStartDate(data.startDate);
        setEndDate(data.endDate);
        setOrganizer(data.organizer || "");
        setLocation(data.location || "");
        setLocationType(data.locationType || "");
        setBudget(data.budget || "");
        const parsed = parseInt(data.yearBudget || "", 10);
        if (!Number.isNaN(parsed)) {
          const ce = parsed >= 2500 ? parsed - 543 : parsed;
          const beStr = (ce + 543).toString();
          if (beStr === "2569" || beStr === "2568" || beStr === "2567") {
            setYearBudget(beStr);
            setYearBudgetCustomBE("");
          } else {
            setYearBudget("OTHER");
            setYearBudgetCustomBE(beStr);
          }
        } else {
          setYearBudget("");
          setYearBudgetCustomBE("");
        }
        setDescription(data.description || "");
        setSelectedEmployees(
          data.participants.map((p) => ({
            EmployeeId: p.id,
            FullName: p.name,
          }))
        );
      } catch (error) {
        setErrorMessage("โหลดข้อมูลล้มเหลว กรุณาลองใหม่ (" + error + ")");
      }
    };

    loadTraining();
  }, [trainingId]);

  useEffect(() => {
    const searchEmployees = async () => {
      if (searchTerm.trim().length < 2) {
        setSuggestions([]);
        return;
      }

      setIsSearching(true);
      try {
        const response = await fetch(
          `/api/training?q=${encodeURIComponent(searchTerm)}`
        );
        if (response.ok) {
          const data = await response.json();
          setSuggestions(data);
        }
      } catch (error) {
        console.error("Search error:", error);
      } finally {
        setIsSearching(false);
      }
    };

    const timeoutId = setTimeout(searchEmployees, 500); // รอ 0.5 วินาทีหลังพิมพ์จบถึงจะยิง API
    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  // เพิ่มพนักงานเข้าลิสต์ที่เลือก
  const addEmployee = (emp: Employee) => {
    if (!selectedEmployees.find((e) => e.EmployeeId === emp.EmployeeId)) {
      setSelectedEmployees([...selectedEmployees, emp]);
    }
    setSearchTerm("");
    setSuggestions([]);
  };

  // ลบพนักงานออกจากลิสต์
  const removeEmployee = (id: string) => {
    setSelectedEmployees(selectedEmployees.filter((e) => e.EmployeeId !== id));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    if (
      !title.trim() ||
      !category ||
      !domain ||
      !format ||
      !startDate ||
      !endDate ||
      !locationType ||
      selectedEmployees.length === 0
    ) {
      window.alert("กรุณากรอกข้อมูลให้ครบถ้วน");
      return;
    }

    if (domain === "OTHER" && !domainOther.trim()) {
      window.alert("กรุณาระบุหมวดหมู่การอบรม (อื่นๆ)");
      return;
    }

    if (category === "OTHER" && !categoryOther.trim()) {
      window.alert("กรุณาระบุประเภทการอบรม (อื่นๆ)");
      return;
    }

    if (!yearBudget.trim()) {
      window.alert("กรุณาเลือกปีงบประมาณ");
      return;
    }

    if (!trainingId) {
      setErrorMessage("ไม่พบ ID ของรายการ");
      return;
    }

    const confirmed = window.confirm("ยืนยันการแก้ไขข้อมูลหรือไม่?");
    if (!confirmed) return;

    const yearBudgetBEToUse =
      yearBudget === "OTHER" ? yearBudgetCustomBE.trim() : yearBudget.trim();

    if (yearBudget === "OTHER" && !yearBudgetCustomBE.trim()) {
      window.alert("กรุณากรอกปีงบประมาณ (พ.ศ.)");
      return;
    }

    let yearBudgetCE: string | null = null;
    if (yearBudgetBEToUse) {
      const parsedBE = parseInt(yearBudgetBEToUse, 10);
      if (Number.isNaN(parsedBE)) {
        window.alert("ปีงบประมาณ (พ.ศ.) ต้องเป็นตัวเลขเท่านั้น");
        return;
      }
      yearBudgetCE = (parsedBE - 543).toString();
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/training", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: trainingId,
          title: title.trim(),
          domain,
          domainOther: domain === "OTHER" ? domainOther.trim() : null,
          category,
          categoryOther: category === "OTHER" ? categoryOther.trim() : null,
          format,
          startDate,
          endDate,
          selectedEmployees: selectedEmployees.map((emp) => ({
            id: emp.EmployeeId,
          })),
          organizer: organizer.trim(),
          location: location.trim(),
          locationType,
          budget,
          yearBudget: yearBudgetCE,
          description: description.trim(),
        }),
      });

      if (response.ok) {
        alert("แก้ไขข้อมูลสำเร็จ");
        router.push("/management/training");
      } else {
        const errorData = await response.json();
        setErrorMessage(errorData.error || "ไม่สามารถแก้ไขข้อมูลได้");
      }
    } catch (error) {
      setErrorMessage("เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง (" + error + ")");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-md p-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-blueit mb-2">
            แก้ไขรายงานสรุปการอบรม สัมมนา
            <br />
            และศึกษาดูงานของบุคลากร
          </h1>
          <p className="text-gray-700 text-lg font-semibold">
            คณะเทคโนโลยีสารสนเทศ <br />{" "}
            สถาบันเทคโนโลยีพระจอมเกล้าเจ้าคุณทหารลาดกระบัง
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            <div className="flex flex-col gap-2">
              <label className="text-lg font-semibold">
                ชื่อกิจกรรม <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="กรอกชื่อกิจกรรม"
                className="w-full h-[48px] px-3 rounded-md border-2 border-gray-300 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-lg font-semibold">
                หมวดหมู่การอบรม <span className="text-red-500">*</span>
              </label>
              <Select
                value={domain}
                onValueChange={(v) => {
                  setDomain(v);
                  if (v !== "OTHER") setDomainOther("");
                }}
              >
                <SelectTrigger className="w-full py-5.5 px-3 rounded-md border-2 border-gray-300">
                  <SelectValue placeholder="เลือกหมวดหมู่" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACADEMIC">วิชาการ/วิจัย</SelectItem>
                  <SelectItem value="TECHNICAL">เทคนิค/ไอที</SelectItem>
                  <SelectItem value="MANAGEMENT">บริหารจัดการ</SelectItem>
                  <SelectItem value="SOFT_SKILLS">การสื่อสาร/ภาวะผู้นำ</SelectItem>
                  <SelectItem value="COMPLIANCE">กฎระเบียบ/จริยธรรม</SelectItem>
                  <SelectItem value="OTHER">อื่นๆ</SelectItem>
                </SelectContent>
              </Select>
              {domain === "OTHER" && (
                <input
                  type="text"
                  value={domainOther}
                  onChange={(e) => setDomainOther(e.target.value)}
                  placeholder="ระบุหมวดหมู่การอบรม (อื่นๆ)"
                  className="w-full h-[48px] px-3 rounded-md border-2 border-gray-300 focus:border-blue-500 focus:outline-none"
                />
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-16 gap-4 items-start">
            <div className="flex flex-col gap-2 col-span-2 lg:col-span-8">
              <label className="text-lg font-semibold">
                ประเภทการอบรม <span className="text-red-500">*</span>
              </label>
              <Select
                value={category}
                onValueChange={(v) => {
                  setCategory(v);
                  if (v !== "OTHER") setCategoryOther("");
                }}
              >
                <SelectTrigger className="w-full py-5.5 px-3 rounded-md border-2 border-gray-300">
                  <SelectValue placeholder="เลือกประเภทการอบรม" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TRAINING">อบรม</SelectItem>
                  <SelectItem value="CONFERENCE">นำเสนอผลงาน</SelectItem>
                  <SelectItem value="SEMINAR">สัมมนา</SelectItem>
                  <SelectItem value="OTHER">อื่นๆ</SelectItem>
                </SelectContent>
              </Select>
              {category === "OTHER" && (
                <input
                  type="text"
                  value={categoryOther}
                  onChange={(e) => setCategoryOther(e.target.value)}
                  placeholder="ระบุประเภทการอบรม (อื่นๆ)"
                  className="w-full h-[48px] px-3 rounded-md border-2 border-gray-300 focus:border-blue-500 focus:outline-none"
                />
              )}
            </div>
            <div className="flex flex-col gap-2 col-span-2 lg:col-span-8">
              <label className="text-lg font-semibold">
                รูปแบบการอบรม <span className="text-red-500">*</span>
              </label>
              <Select value={format} onValueChange={setFormat}>
                <SelectTrigger className="w-full py-5.5 px-3 rounded-md border-2 border-gray-300">
                  <SelectValue placeholder="เลือกรูปแบบ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ONSITE">ONSITE</SelectItem>
                  <SelectItem value="ONLINE">ONLINE</SelectItem>
                  <SelectItem value="HYBRID">HYBRID</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-16 gap-4 items-end">
            <div className="flex flex-col gap-2 col-span-2 lg:col-span-8">
              <label className="text-lg font-semibold">
                วัน/เดือน/ปี เริ่ม<span className="text-red-500">*</span>
              </label>
              <ThaiDatePicker
                value={startDate}
                onChange={setStartDate}
                className="w-full h-[48px] px-3 rounded-md border-2 border-gray-300 focus:border-blue-500 focus:outline-none"
                dialogTitle="เลือกวันเริ่มอบรม"
              />
            </div>
            <div className="flex flex-col gap-2 col-span-2 lg:col-span-8">
              <label className="text-lg font-semibold">
                วัน/เดือน/ปี สิ้นสุด<span className="text-red-500">*</span>
              </label>
              <ThaiDatePicker
                value={endDate}
                onChange={setEndDate}
                className="w-full h-[48px] px-3 rounded-md border-2 border-gray-300 focus:border-blue-500 focus:outline-none"
                dialogTitle="เลือกวันสิ้นสุดอบรม"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-16 gap-4 items-start">
            <div className="flex flex-col gap-2 col-span-1 lg:col-span-8">
              <label className="text-lg font-semibold">
                ผู้เข้าร่วมอบรม <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="พิมพ์ชื่อเพื่อค้นหาผู้เข้าร่วมอบรม..."
                  className="w-full h-[48px] px-3 rounded-md border-2 border-gray-300 focus:border-blue-500 focus:outline-none"
                />
                {isSearching && <p className="text-sm text-gray-500 mt-1 absolute">กำลังค้นหา...</p>}

                {suggestions.length > 0 && (
                  <ul className="absolute z-20 w-full bg-white border-2 rounded-md shadow-lg mt-1 max-h-48 overflow-y-auto">
                    {suggestions.map((emp) => (
                      <li
                        key={emp.EmployeeId}
                        onClick={() => addEmployee(emp)}
                        className="px-4 py-2 hover:bg-blue-50 cursor-pointer border-b last:border-none"
                      >
                        {emp.FullName}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex flex-wrap gap-2 mt-1">
                {selectedEmployees.map((emp) => (
                  <div
                    key={emp.EmployeeId}
                    className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full flex items-center gap-2 text-sm border border-blue-200"
                  >
                    {emp.FullName}
                    <button
                      type="button"
                      onClick={() => removeEmployee(emp.EmployeeId)}
                      className="hover:text-red-500"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2 col-span-1 lg:col-span-8">
              <label className="text-lg font-semibold">ผู้จัดอบรม</label>
              <input
                type="text"
                value={organizer}
                onChange={(e) => setOrganizer(e.target.value)}
                placeholder="กรอกชื่อผู้จัดอบรม"
                className="w-full h-[48px] px-3 rounded-md border-2 border-gray-300 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-16 gap-4 items-start">
            <div className="flex flex-col gap-2 col-span-2 lg:col-span-8">
              <label className="text-lg font-semibold">สถานที่จัดกิจกรรม</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="กรอกสถานที่จัดกิจกรรม"
                className="w-full h-[48px] px-3 rounded-md border-2 border-gray-300 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-2 col-span-2 lg:col-span-8">
              <label className="text-lg font-semibold">
                ประเภทสถานที่ <span className="text-red-500">*</span>
              </label>
              <Select value={locationType} onValueChange={setLocationType}>
                <SelectTrigger className="w-full py-5.5 px-3 rounded-md border-2 border-gray-300">
                  <SelectValue placeholder="เลือกประเภท" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FACULTY">ในคณะ</SelectItem>
                  <SelectItem value="BMR">กรุงเทพ/ปริมณฑล</SelectItem>
                  <SelectItem value="PROVINCE">ต่างจังหวัด</SelectItem>
                  <SelectItem value="INTERNATIONAL">ต่างประเทศ</SelectItem>
                  <SelectItem value="ONLINE">ออนไลน์</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-16 gap-4 items-start">
            <div className="flex flex-col gap-2 col-span-2 lg:col-span-8">
              <label className="text-lg font-semibold">งบประมาณที่ใช้ (ถ้ามี)</label>
              <input
                type="text"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="กรอกงบประมาณที่ใช้"
                className="w-full h-[48px] px-3 rounded-md border-2 border-gray-300 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-2 col-span-2 lg:col-span-8">
              <label className="text-lg font-semibold">
                ปีงบประมาณ (พ.ศ.) <span className="text-red-500">*</span>
              </label>
              <Select
                value={yearBudget}
                onValueChange={(v) => {
                  setYearBudget(v);
                  if (v !== "OTHER") setYearBudgetCustomBE("");
                }}
              >
                <SelectTrigger className="w-full py-5.5 px-3 rounded-md border-2 border-gray-300">
                  <SelectValue placeholder="เลือกปีงบประมาณ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2570">2570</SelectItem>
                  <SelectItem value="2569">2569</SelectItem>
                  <SelectItem value="2568">2568</SelectItem>
                  <SelectItem value="2567">2567</SelectItem>
                  <SelectItem value="2566">2566</SelectItem>
                  <SelectItem value="OTHER">อื่นๆ</SelectItem>
                </SelectContent>
              </Select>
              {yearBudget === "OTHER" && (
                <input
                  type="number"
                  value={yearBudgetCustomBE}
                  onChange={(e) => setYearBudgetCustomBE(e.target.value)}
                  placeholder="กรอกปีงบประมาณ (พ.ศ.)"
                  className="w-full h-[48px] px-3 rounded-md border-2 border-gray-300 focus:border-blue-500 focus:outline-none"
                />
              )}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-lg font-semibold">คำอธิบายกิจกรรม</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="กรอกคำอธิบายกิจกรรม"
              className="w-full h-[100px] px-3 py-4 rounded-md border-2 border-gray-300 focus:border-blue-500 focus:outline-none"
            />
          </div>

          {errorMessage && (
            <p className="text-red-500 font-semibold text-center">
              {errorMessage}
            </p>
          )}

          <div className="pt-4 flex items-center justify-between">
            <Link href="/management/training">
              <button
                type="button"
                className="bg-gray-300 text-black hover:bg-gray-400 px-6 py-3 rounded-xl font-semibold"
              >
                ย้อนกลับ
              </button>
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-blueit text-white hover:bg-blue-800 px-6 py-3 rounded-xl font-semibold flex items-center gap-2 disabled:opacity-50"
            >
              {isSubmitting && (
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              )}
              {isSubmitting ? "กำลังบันทึก" : "บันทึก"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
