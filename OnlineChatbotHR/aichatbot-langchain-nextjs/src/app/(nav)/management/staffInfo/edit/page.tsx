"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThaiDatePicker } from "@/components/ThaiDatePicker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { FaTrash } from "react-icons/fa";
import { executivePositions } from "@/constants/employeeInfo";
import { computeAcademicRetirementDateIso } from "@/lib/academicRetirement";

type EmployeeTypeKey = "GOVERNMENT" | "BUDGET" | "INCOME" | "SPECIAL";
type AdminPosition = {
  id?: string;
  positionPreset: string;
  positionName: string;
  startDate: string;
  endDate: string;
};
type PositionHistory = {
  id?: string;
  academicPosition: string;
  supportPosition: string;
  startDate: string;
  endDate: string;
};
type PositionMode = "view" | "add" | "edit";
type AdminPositionMode = "view" | "edit";

const positionLabel: Record<string, string> = {
  LECTURER: "อาจารย์",
  ASSISTANT_PROFESSOR: "ผู้ช่วยศาสตราจารย์",
  ASSOCIATE_PROFESSOR: "รองศาสตราจารย์",
  PROFESSOR: "ศาสตราจารย์",
  OPERATIONAL_LEVEL: "ปฏิบัติการ",
  SENIOR_PRACTITIONER: "ชำนาญการพิเศษ",
  EXPERT: "เชี่ยวชาญ",
  SENIOR_EXPERT: "เชี่ยวชาญพิเศษ",
};

function formatDateToThaiNumeric(dateValue?: string | null): string {
  if (!dateValue) return "-";
  const [year, month, day] = dateValue.split("-");
  if (!year || !month || !day) return dateValue;
  const buddhistYear = Number(year) + 543;
  return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${buddhistYear}`;
}

function getLatestPositionHistory(
  list: PositionHistory[],
  staffType: "ACADEMIC" | "SUPPORT"
): PositionHistory | null {
  const complete = list.filter((p) => {
    const code = staffType === "ACADEMIC" ? p.academicPosition : p.supportPosition;
    return !!code?.trim() && !!p.startDate?.trim();
  });
  if (complete.length === 0) return null;
  return [...complete].sort((a, b) =>
    a.startDate < b.startDate ? 1 : a.startDate > b.startDate ? -1 : 0
  )[0];
}



export default function StaffProfileEditPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const employeeId = searchParams.get("id");

  const [fullName, setFullName] = useState("");
  const [gender, setGender] = useState<string>("");
  const [birthDate, setBirthDate] = useState("");
  const [startDate, setStartDate] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [employeeTypeKey, setEmployeeTypeKey] = useState<EmployeeTypeKey>("GOVERNMENT");
  const [contractType, setContractType] = useState<string>("");
  const [contractNumber, setContractNumber] = useState<string>("");
  const [contractStartDate, setContractStartDate] = useState("");
  const [contractEndDate, setContractEndDate] = useState("");
  const [budgetAppointmentDate, setBudgetAppointmentDate] = useState("");
  const [incomeAppointmentDate, setIncomeAppointmentDate] = useState("");
  const [staffType, setStaffType] = useState<"ACADEMIC" | "SUPPORT">("ACADEMIC");
  const [jobTitle, setJobTitle] = useState("");
  const [PositionNumber, setPositionNumber] = useState("");
  const [educationLevel, setEducationLevel] = useState<string>("");
  const [educationLevelDetail, setEducationLevelDetail] = useState("");
  const [positions, setPositions] = useState<PositionHistory[]>([]);
  const [administrativePositions, setAdministrativePositions] = useState<AdminPosition[]>([]);
  const [positionMode, setPositionMode] = useState<PositionMode>("view");
  const [adminPositionMode, setAdminPositionMode] = useState<AdminPositionMode>("view");

  const [isLoading, setIsLoading] = useState(!!employeeId);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isInstitute = employeeTypeKey !== "GOVERNMENT";
  const showContractNumber = contractType === "CONTRACT";
  const showContractDates = isInstitute && !!contractType;
  const showBudgetDate = employeeTypeKey === "BUDGET";
  const showIncomeDate = employeeTypeKey === "INCOME";

  const latestJobPosition = useMemo(
    () => getLatestPositionHistory(positions, staffType),
    [positions, staffType]
  );

  const academicRetirementDateIso = useMemo(() => {
    if (staffType !== "ACADEMIC" || !birthDate.trim()) return null;
    return computeAcademicRetirementDateIso(birthDate);
  }, [staffType, birthDate]);

  useEffect(() => {
    if (!employeeId) {
      setLoadError("ไม่พบ ID บุคลากร");
      setIsLoading(false);
      return;
    }
    fetch(`/api/employees/${employeeId}`)
      .then((res) => {
        if (res.status === 404) {
          setLoadError("ไม่พบข้อมูลบุคลากร");
          return null;
        }
        if (!res.ok) throw new Error("โหลดไม่สำเร็จ");
        return res.json();
      })
      .then((data) => {
        if (!data) return;
        setFullName(data.fullName ?? "");
        setGender(data.gender ?? "");
        setBirthDate(data.birthDate ?? "");
        setStartDate(data.startDate ?? "");
        setPhone(data.phone ?? "");
        setEmail(data.email ?? "");
        if (data.employmentType === "GOVERNMENT") {
          setEmployeeTypeKey("GOVERNMENT");
        } else {
          const cat = data.employeeCategory ?? "BUDGET";
          setEmployeeTypeKey(cat === "INCOME" ? "INCOME" : cat === "SPECIAL" ? "SPECIAL" : "BUDGET");
        }
        setContractType(data.contractType ?? "");
        setContractNumber(
          data.contractNumber != null ? String(data.contractNumber) : ""
        );
        setContractStartDate(data.contractStartDate ?? "");
        setContractEndDate(data.contractEndDate ?? "");
        setBudgetAppointmentDate(data.budgetAppointmentDate ?? "");
        setIncomeAppointmentDate(data.incomeAppointmentDate ?? "");
        setStaffType(data.staffType === "SUPPORT" ? "SUPPORT" : "ACADEMIC");
        setJobTitle(data.jobTitle ?? "");
        setPositionNumber(
          data.PositionNumber != null ? String(data.PositionNumber) : ""
        );
        setEducationLevel(data.educationLevel ?? "");
        setEducationLevelDetail(data.educationLevelDetail ?? "");
        const fetchedPositions = (data.positions?.length
          ? data.positions
          : data.academicPosition || data.supportAcademicPosition
            ? [
                {
                  id: "legacy-0",
                  academicPosition: data.academicPosition ?? "",
                  supportPosition: data.supportAcademicPosition ?? "",
                  startDate: data.startDate ?? "",
                  endDate: "",
                },
              ]
            : []
        ).map((p: any, index: number) => ({
          id: p.id ?? `legacy-${index}`,
          academicPosition: p.academicPosition ?? "",
          supportPosition: p.supportPosition ?? "",
          startDate: p.startDate ?? "",
          endDate: p.endDate ?? "",
        }));
        setPositions(fetchedPositions);
        setPositionMode("view");
        setAdminPositionMode("view");
        setAdministrativePositions(
          (data.administrativePositions ?? []).map(
            (a: { id?: string; positionName?: string; startDate?: string; endDate?: string }) => {
              const name = a.positionName ?? "";
              const preset =
                executivePositions.find((p) => p.name === name)?.code ?? "OTHER";
              return {
                id: a.id,
                positionPreset: preset,
                positionName: name,
                startDate: a.startDate ?? "",
                endDate: a.endDate ?? "",
              };
            }
          )
        );
        setLoadError(null);
      })
      .catch(() => setLoadError("ไม่สามารถโหลดข้อมูลได้"))
      .finally(() => setIsLoading(false));
  }, [employeeId]);

  const addAdminPosition = () => {
    setAdministrativePositions((prev) => [
      ...prev,
      { positionPreset: "", positionName: "", startDate: "", endDate: "" },
    ]);
  };

  const updateAdminPosition = (index: number, field: keyof AdminPosition, value: string) => {
    setAdministrativePositions((prev) =>
      prev.map((a, i) => (i === index ? { ...a, [field]: value } : a))
    );
  };

  const removeAdminPosition = (index: number) => {
    setAdministrativePositions((prev) => prev.filter((_, i) => i !== index));
  };
  const addPositionHistory = () => {
    setPositionMode("add");
    setPositions((prev) => [
      ...prev,
      { id: undefined, academicPosition: "", supportPosition: "", startDate: "", endDate: "" },
    ]);
  };
  const updatePositionHistory = (index: number, field: keyof PositionHistory, value: string) => {
    setPositions((prev) =>
      prev.map((p, i) => (i === index ? { ...p, [field]: value } : p))
    );
  };
  const removePositionHistory = (index: number) => {
    setPositions((prev) => prev.filter((_, i) => i !== index));
  };
  const toggleAdminPositionMode = () => {
    setAdminPositionMode((m) => (m === "edit" ? "view" : "edit"));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (!fullName.trim() || !email.trim() || !startDate || !birthDate) {
      setErrorMessage("กรุณากรอก ชื่อ-นามสกุล, อีเมล, วันที่เข้าปฏิบัติงาน, วันเกิด");
      return;
    }
    if (!employeeId) return;
    const confirmed = window.confirm("ยืนยันการบันทึกหรือไม่?");
    if (!confirmed) return;
    setIsSubmitting(true);
    try {
      let employmentType: "GOVERNMENT" | "INSTITUTE_EMPLOYEE" = "GOVERNMENT";
      let employeeCategory: "BUDGET" | "INCOME" | "SPECIAL" | null = null;
      if (employeeTypeKey === "GOVERNMENT") {
        employmentType = "GOVERNMENT";
      } else {
        employmentType = "INSTITUTE_EMPLOYEE";
        employeeCategory = employeeTypeKey as "BUDGET" | "INCOME" | "SPECIAL";
      }

      const positionNumberValue = String(PositionNumber ?? "").trim();

      const hasIncompletePositionHistory = positions.some((p) => {
        const selected = staffType === "ACADEMIC" ? p.academicPosition : p.supportPosition;
        return !!selected !== !!p.startDate;
      });
      if (hasIncompletePositionHistory) {
        setErrorMessage("กรุณากรอกประวัติตำแหน่งงานให้ครบถ้วน");
        return;
      }
      const hasIncompleteAdminPosition = administrativePositions.some(
        (a) => !a.positionName.trim() || !a.startDate
      );
      if (hasIncompleteAdminPosition) {
        setErrorMessage("กรุณากรอกข้อมูลตำแหน่งบริหารให้ครบ");
        return;
      }
      if (educationLevel === "OTHER" && !educationLevelDetail.trim()) {
        setErrorMessage("กรุณาระบุวุฒิการศึกษา");
        return;
      }
      if (
        isInstitute &&
        (!contractType || !contractStartDate || !contractEndDate)
      ) {
        setErrorMessage(
          "กรุณาระบุประเภทสัญญา และวันที่เริ่ม–สิ้นสุดสัญญา"
        );
        return;
      }

      const latestForSubmit = getLatestPositionHistory(positions, staffType);

      const res = await fetch(`/api/employees/${employeeId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          gender: gender || undefined,
          birthDate,
          startDate,
          phone: phone.trim() || undefined,
          email: email.trim(),
          employmentType,
          employeeCategory,
          contractType: isInstitute ? contractType || undefined : undefined,
          contractNumber: 
            showContractNumber && contractNumber !== ""
              ? parseInt(contractNumber, 10)
              : undefined,
          contractStartDate: isInstitute ? contractStartDate || undefined : undefined,
          contractEndDate: isInstitute ? contractEndDate || undefined : undefined,
          budgetAppointmentDate: showBudgetDate ? budgetAppointmentDate || undefined : undefined,
          incomeAppointmentDate: showIncomeDate ? incomeAppointmentDate || undefined : undefined,
          staffType,
          jobTitle: jobTitle.trim() || undefined,
          educationLevel,
          educationLevelDetail:
            educationLevel === "OTHER" ? educationLevelDetail.trim() : undefined,
          PositionNumber:
            positionNumberValue !== ""
              ? Number.parseInt(positionNumberValue, 10)
              : undefined,
          academicPosition:
            staffType === "ACADEMIC"
              ? latestForSubmit?.academicPosition || undefined
              : undefined,
          supportAcademicPosition:
            staffType === "SUPPORT"
              ? latestForSubmit?.supportPosition || undefined
              : undefined,
          positions: positions
            .filter((p) => p.startDate && (staffType === "ACADEMIC" ? p.academicPosition : p.supportPosition))
            .map((p) => ({
              academicPosition: staffType === "ACADEMIC" ? p.academicPosition || undefined : undefined,
              supportPosition: staffType === "SUPPORT" ? p.supportPosition || undefined : undefined,
              startDate: p.startDate,
              endDate: p.endDate || undefined,
            })),
          administrativePositions: administrativePositions.map((a) => ({
              positionName: a.positionName.trim(),
              startDate: a.startDate,
              endDate: a.endDate || undefined,
            })),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrorMessage(data.error || "ไม่สามารถบันทึกได้");
        return;
      }
      window.alert("บันทึกข้อมูลเรียบร้อย");
      router.push("/management/staffInfo");
      router.refresh(); 
    } catch (error) {
      setErrorMessage("เกิดข้อผิดพลาด ไม่สามารถบันทึกได้");
      console.error("Error submitting form:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen p-8 bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen p-8 bg-gray-50">
        <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-md p-8 text-center">
          <p className="text-red-500 text-lg">{loadError}</p>
          <Link href="/management/staffInfo">
            <button className="mt-4 bg-gray-300 text-black hover:bg-gray-400 px-6 py-3 rounded-xl font-semibold">
              ย้อนกลับ
            </button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-md p-8">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-6">
          <div className="shrink-0 flex justify-center sm:justify-start">
            <Image
              src="/home/logohrit.png"
              alt="โลโก้ฝ่ายทรัพยากรบุคคล คณะเทคโนโลยีสารสนเทศ"
              width={160}
              height={48}
              className="h-auto w-[min(100%,160px)] object-contain"
              priority
            />
          </div>
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <h1 className="text-2xl sm:text-3xl font-bold text-blueit mb-2">
              แก้ไขข้อมูลประวัติบุคลากร
            </h1>
            <p className="text-gray-700 font-semibold text-sm sm:text-base">
              คณะเทคโนโลยีสารสนเทศ
              <br />
              สถาบันเทคโนโลยีพระจอมเกล้าเจ้าคุณทหารลาดกระบัง
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label className="text-lg font-semibold">
                ชื่อ-นามสกุล <span className="text-red-500">*</span>
              </Label>
              <Input
                className="mt-2 w-full p-3 border-2 border-gray-300 focus:border-blue-500"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="กรอกชื่อ-นามสกุล"
                disabled={isSubmitting}
                required
              />
            </div>
            <div>
              <Label className="text-lg font-semibold">
                เพศ <span className="text-red-500">*</span>
              </Label>
              <Select value={gender} onValueChange={setGender} disabled={isSubmitting}>
                <SelectTrigger className="mt-2 w-full p-3 border-2 border-gray-300">
                  <SelectValue placeholder="เลือกเพศ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MALE">ชาย</SelectItem>
                  <SelectItem value="FEMALE">หญิง</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label className="text-lg font-semibold">
                วันเกิด <span className="text-red-500">*</span>
              </Label>
              <ThaiDatePicker
                className="mt-2 w-full p-3 border-2 border-gray-300 focus:border-blue-500"
                value={birthDate}
                onChange={setBirthDate}
                disabled={isSubmitting}
                required
                dialogTitle="เลือกวันเกิด"
              />
            </div>
            <div>
              <Label className="text-lg font-semibold">
                วันที่เข้าปฏิบัติงาน <span className="text-red-500">*</span>
              </Label>
              <ThaiDatePicker
                className="mt-2 w-full p-3 border-2 border-gray-300 focus:border-blue-500"
                value={startDate}
                onChange={setStartDate}
                disabled={isSubmitting}
                required
                dialogTitle="เลือกวันที่เข้าปฏิบัติงาน"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label className="text-lg font-semibold">
                เบอร์โทร <span className="text-red-500">*</span>
              </Label>
              <Input
                type="tel"
                className="mt-2 w-full p-3 border-2 border-gray-300 focus:border-blue-500"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="กรอกเบอร์โทร"
                disabled={isSubmitting}
                required
              />
            </div>
            <div>
              <Label className="text-lg font-semibold">
                อีเมล <span className="text-red-500">*</span>
              </Label>
              <Input
                type="email"
                className="mt-2 w-full p-3 border-2 border-gray-300 focus:border-blue-500"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="กรอกอีเมล"
                disabled={isSubmitting}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            <div>
              <Label className="text-lg font-semibold">
                ประเภทพนักงาน <span className="text-red-500">*</span>
              </Label>
              <Select
                value={employeeTypeKey}
                onValueChange={(v) => setEmployeeTypeKey(v as EmployeeTypeKey)}
                disabled={isSubmitting}
              >
                <SelectTrigger className="mt-2 w-full p-3 border-2 border-gray-300">
                  <SelectValue placeholder="เลือกประเภทพนักงาน" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GOVERNMENT">ข้าราชการ</SelectItem>
                  <SelectItem value="BUDGET">พนักงานสถาบันเงินงบประมาณ</SelectItem>
                  <SelectItem value="INCOME">พนักงานสถาบันเงินรายได้</SelectItem>
                  <SelectItem value="SPECIAL">พนักงานสถาบันประเภทพิเศษ</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-lg font-semibold">
                วุฒิการศึกษา <span className="text-red-500">*</span>
              </Label>
              <div className="mt-2 flex w-full flex-row flex-wrap gap-2">
                <div
                  className={
                    educationLevel === "OTHER"
                      ? "min-w-0 flex-1 basis-0"
                      : "w-full min-w-0"
                  }
                >
                  <Select
                    value={educationLevel}
                    onValueChange={(v) => {
                      setEducationLevel(v);
                      if (v !== "OTHER") setEducationLevelDetail("");
                    }}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger className="box-border flex w-full items-center border-2 border-gray-300 px-3 py-0 text-sm shadow-xs data-[size=default]:h-9">
                      <SelectValue placeholder="เลือกวุฒิการศึกษา" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BACHELOR">ตรี</SelectItem>
                      <SelectItem value="MASTER">โท</SelectItem>
                      <SelectItem value="DOCTOR">เอก</SelectItem>
                      <SelectItem value="OTHER">อื่นๆ (ระบุเอง)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {educationLevel === "OTHER" && (
                  <div className="min-w-0 flex-1 basis-0">
                    <Input
                      className="h-9 box-border w-full border-2 border-gray-300 px-3 py-0 text-sm focus:border-blue-500"
                      value={educationLevelDetail}
                      onChange={(e) => setEducationLevelDetail(e.target.value)}
                      placeholder="ระบุวุฒิการศึกษา"
                      disabled={isSubmitting}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {isInstitute && (
            <div className="pl-4 border-l-4 border-blue-200 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                <div>
                  <Label className="text-lg font-semibold">สัญญาจ้าง</Label>
                  <RadioGroup
                    value={contractType}
                    onValueChange={(v) => {
                      setContractType(v);
                      if (!v) {
                        setContractStartDate("");
                        setContractEndDate("");
                      }
                    }}
                    className="flex gap-6 mt-2"
                    disabled={isSubmitting}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="PROBATION" id="contract-probation" />
                      <Label htmlFor="contract-probation" className="cursor-pointer">
                        ทดลองงาน
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="CONTRACT" id="contract-contract" />
                      <Label htmlFor="contract-contract" className="cursor-pointer">
                        สัญญาจ้าง
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
                <div>
                  {showContractNumber && (
                    <>
                      <Label className="text-lg font-semibold">
                        ครั้งที่ (สัญญาจ้าง)
                      </Label>
                      <Input
                        type="number"
                        min={1}
                        className="mt-2 w-32 p-3 border-2 border-gray-300 focus:border-blue-500"
                        value={contractNumber}
                        onChange={(e) => setContractNumber(e.target.value)}
                        placeholder="ครั้งที่"
                        disabled={isSubmitting}
                      />
                    </>
                  )}
                </div>
              </div>
              {showContractDates && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label className="text-lg font-semibold">
                      วันที่เริ่มสัญญา <span className="text-red-500">*</span>
                    </Label>
                    <ThaiDatePicker
                      className="mt-2 w-full p-3 border-2 border-gray-300 focus:border-blue-500"
                      value={contractStartDate}
                      onChange={setContractStartDate}
                      disabled={isSubmitting}
                      required
                      dialogTitle="เลือกวันที่เริ่มสัญญา"
                    />
                  </div>
                  <div>
                    <Label className="text-lg font-semibold">
                      วันที่สิ้นสุดสัญญา <span className="text-red-500">*</span>
                    </Label>
                    <ThaiDatePicker
                      className="mt-2 w-full p-3 border-2 border-gray-300 focus:border-blue-500"
                      value={contractEndDate}
                      onChange={setContractEndDate}
                      disabled={isSubmitting}
                      required
                      dialogTitle="เลือกวันที่สิ้นสุดสัญญา"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {showIncomeDate && (
            <div>
              <Label className="text-lg font-semibold">วันที่บรรจุเป็นพนง.เงินรายได้</Label>
              <ThaiDatePicker
                className="mt-2 w-full max-w-xs p-3 border-2 border-gray-300 focus:border-blue-500"
                value={incomeAppointmentDate}
                onChange={setIncomeAppointmentDate}
                disabled={isSubmitting}
                allowClear
                dialogTitle="เลือกวันที่บรรจุเป็นพนง.เงินรายได้"
              />
            </div>
          )}

          {showBudgetDate && (
            <div>
              <Label className="text-lg font-semibold">วันที่บรรจุเป็นพนง.เงินงบประมาณ</Label>
              <ThaiDatePicker
                className="mt-2 w-full max-w-xs p-3 border-2 border-gray-300 focus:border-blue-500"
                value={budgetAppointmentDate}
                onChange={setBudgetAppointmentDate}
                disabled={isSubmitting}
                allowClear
                dialogTitle="เลือกวันที่บรรจุเป็นพนง.เงินงบประมาณ"
              />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            <div>
              <Label className="text-xl font-semibold">สายงาน</Label>
              <RadioGroup
                value={staffType}
                onValueChange={(v) => setStaffType(v as "ACADEMIC" | "SUPPORT")}
                className="flex gap-8 mt-3"
                disabled={isSubmitting}
              >
                <div className="flex items-center space-x-3">
                  <RadioGroupItem
                    value="ACADEMIC"
                    id="staff-academic"
                    className="h-6 w-6"
                  />
                  <Label
                    htmlFor="staff-academic"
                    className="cursor-pointer text-md"
                  >
                    สายวิชาการ
                  </Label>
                </div>
                <div className="flex items-center space-x-3">
                  <RadioGroupItem
                    value="SUPPORT"
                    id="staff-support"
                    className="h-6 w-6"
                  />
                  <Label
                    htmlFor="staff-support"
                    className="cursor-pointer text-md"
                  >
                    สายสนับสนุน
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div>
              <Label className="text-lg font-semibold">ตำแหน่งงาน</Label>
              <p className="mt-2 text-gray-800">
                {latestJobPosition
                  ? `${positionLabel[
                      staffType === "ACADEMIC"
                        ? latestJobPosition.academicPosition
                        : latestJobPosition.supportPosition
                    ] ?? "-"}`
                  : ""}
              </p>
            </div>
          </div>

          <div>
            <Label className="text-lg font-semibold">เลขที่อัตราจ้าง</Label>
            <Input
              className="mt-2 w-full p-3 border-2 border-gray-300 focus:border-blue-500"
              value={PositionNumber}
              onChange={(e) => setPositionNumber(e.target.value)}
              placeholder="กรอกเลขที่อัตราจ้าง"
              disabled={isSubmitting}
            />
          </div>

          <div className="border-t pt-6">
            <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
              <Label className="text-lg font-semibold">การดำรงตำแหน่งบริหาร</Label>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={addAdminPosition}
                  className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                  disabled={isSubmitting}
                >
                  เพิ่ม
                </button>
                <button
                  type="button"
                  onClick={toggleAdminPositionMode}
                  className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                  disabled={
                    isSubmitting ||
                    !administrativePositions.some((x) => !!x.id)
                  }
                >
                  แก้ไข
                </button>
              </div>
            </div>
            <div className="space-y-4">
              {administrativePositions.map((a, index) =>
                adminPositionMode === "edit" || !a.id ? (
                  <div
                    key={index}
                    className="grid grid-cols-1 md:grid-cols-12 gap-4 p-4 bg-gray-50 rounded-lg"
                  >
                    <div className="md:col-span-5">
                      <Label className="text-sm">ชื่อตำแหน่ง</Label>
                      <Select
                        value={a.positionPreset}
                        onValueChange={(v) => {
                          if (v === "OTHER") {
                            updateAdminPosition(index, "positionPreset", "OTHER");
                            return;
                          }
                          const found = executivePositions.find((p) => p.code === v);
                          updateAdminPosition(index, "positionPreset", v);
                          updateAdminPosition(index, "positionName", found?.name ?? "");
                        }}
                        disabled={isSubmitting}
                      >
                        <SelectTrigger className="mt-1 w-full border-2 border-gray-300">
                          <SelectValue placeholder="เลือกตำแหน่งบริหาร" />
                        </SelectTrigger>
                        <SelectContent>
                          {executivePositions.map((p) => (
                            <SelectItem key={p.code} value={p.code}>
                              {p.name}
                            </SelectItem>
                          ))}
                          <SelectItem value="OTHER">อื่นๆ</SelectItem>
                        </SelectContent>
                      </Select>
                      {a.positionPreset === "OTHER" && (
                        <Input
                          className="mt-2 border-2 border-gray-300"
                          value={a.positionName}
                          onChange={(e) =>
                            updateAdminPosition(index, "positionName", e.target.value)
                          }
                          placeholder="พิมพ์ชื่อตำแหน่งบริหาร"
                          disabled={isSubmitting}
                        />
                      )}
                    </div>
                    <div className="md:col-span-3">
                      <Label className="text-sm">วันที่เริ่ม</Label>
                      <ThaiDatePicker
                        className="mt-1 border-2 border-gray-300"
                        value={a.startDate}
                        onChange={(v) => updateAdminPosition(index, "startDate", v)}
                        disabled={isSubmitting}
                        dialogTitle="เลือกวันที่เริ่ม"
                      />
                    </div>
                    <div className="md:col-span-3">
                      <Label className="text-sm">วันสิ้นสุด</Label>
                      <ThaiDatePicker
                        className="mt-1 border-2 border-gray-300"
                        value={a.endDate}
                        onChange={(v) => updateAdminPosition(index, "endDate", v)}
                        disabled={isSubmitting}
                        allowClear
                        dialogTitle="เลือกวันสิ้นสุด"
                      />
                    </div>
                    <div className="md:col-span-1">
                      <Label className="text-sm invisible select-none pointer-events-none" aria-hidden>
                        —
                      </Label>
                      <div className="mt-1 flex min-h-10 items-center justify-center -translate-y-1">
                        <button
                          type="button"
                          onClick={() => removeAdminPosition(index)}
                          className="text-red-600 hover:text-red-800 inline-flex p-1 rounded"
                          disabled={isSubmitting}
                          aria-label="ลบตำแหน่งบริหาร"
                        >
                          <FaTrash className="text-base" />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    key={index}
                    className="grid grid-cols-1 md:grid-cols-12 gap-4 p-4 bg-gray-50 rounded-lg"
                  >
                    <div className="md:col-span-5">
                      <Label className="text-sm">ชื่อตำแหน่ง</Label>
                      <p className="mt-2 text-gray-800">{a.positionName.trim() || "-"}</p>
                    </div>
                    <div className="md:col-span-3">
                      <Label className="text-sm">วันที่เริ่ม</Label>
                      <p className="mt-2 text-gray-800">
                        {formatDateToThaiNumeric(a.startDate)}
                      </p>
                    </div>
                    <div className="md:col-span-4">
                      <Label className="text-sm">วันสิ้นสุด</Label>
                      <p className="mt-2 text-gray-800">
                        {formatDateToThaiNumeric(a.endDate)}
                      </p>
                    </div>
                  </div>
                )
              )}
            </div>
          </div>

          <div id="position-history" className="border-t pt-6 scroll-mt-24">
            <div className="flex items-center justify-between mb-4">
              <Label className="text-lg font-semibold">ประวัติการได้รับตำแหน่ง</Label>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={addPositionHistory}
                  className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                  disabled={isSubmitting}
                >
                  เพิ่ม
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setPositionMode((m) =>
                      m === "edit" || m === "add" ? "view" : "edit"
                    )
                  }
                  className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                  disabled={isSubmitting || positions.length === 0}
                >
                  แก้ไข
                </button>
              </div>
            </div>
            <div className="space-y-4">
              {positions.map((p, index) => (
                positionMode === "edit" || !p.id ? (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-4 p-4 bg-sky-50 rounded-lg">
                    <div className="md:col-span-7">
                      <Label className="text-sm">ตำแหน่ง</Label>
                      {staffType === "ACADEMIC" ? (
                        <Select
                          value={p.academicPosition}
                          onValueChange={(v) => updatePositionHistory(index, "academicPosition", v)}
                          disabled={isSubmitting}
                        >
                          <SelectTrigger className="mt-1 w-full border-2 border-gray-300">
                            <SelectValue placeholder="เลือกตำแหน่งวิชาการ" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="LECTURER">อาจารย์</SelectItem>
                            <SelectItem value="ASSISTANT_PROFESSOR">ผู้ช่วยศาสตราจารย์</SelectItem>
                            <SelectItem value="ASSOCIATE_PROFESSOR">รองศาสตราจารย์</SelectItem>
                            <SelectItem value="PROFESSOR">ศาสตราจารย์</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Select
                          value={p.supportPosition}
                          onValueChange={(v) => updatePositionHistory(index, "supportPosition", v)}
                          disabled={isSubmitting}
                        >
                          <SelectTrigger className="mt-1 w-full border-2 border-gray-300">
                            <SelectValue placeholder="เลือกตำแหน่งสายสนับสนุน" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="OPERATIONAL_LEVEL">ปฏิบัติการ</SelectItem>
                            <SelectItem value="SENIOR_PRACTITIONER">ชำนาญการพิเศษ</SelectItem>
                            <SelectItem value="EXPERT">เชี่ยวชาญ</SelectItem>
                            <SelectItem value="SENIOR_EXPERT">เชี่ยวชาญพิเศษ</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                    <div className="md:col-span-4">
                      <Label className="text-sm">วันที่ได้รับตำแหน่ง</Label>
                      <ThaiDatePicker
                        className="mt-1 border-2 border-gray-300"
                        value={p.startDate}
                        onChange={(v) => updatePositionHistory(index, "startDate", v)}
                        disabled={isSubmitting}
                        dialogTitle="เลือกวันที่ได้รับตำแหน่ง"
                      />
                    </div>
                    <div className="md:col-span-1">
                      <Label className="text-sm invisible select-none pointer-events-none" aria-hidden>
                        —
                      </Label>
                      <div className="mt-1 flex min-h-10 items-center justify-center -translate-y-1">
                        <button
                          type="button"
                          onClick={() => removePositionHistory(index)}
                          className="text-red-600 hover:text-red-800 inline-flex p-1 rounded"
                          disabled={isSubmitting}
                          aria-label="ลบตำแหน่งงาน"
                        >
                          <FaTrash className="text-base" />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-4 p-4 bg-sky-50 rounded-lg">
                    <div className="md:col-span-7">
                      <Label className="text-sm">ตำแหน่ง</Label>
                      <p className="mt-2 text-gray-800">
                        {positionLabel[p.academicPosition || p.supportPosition] ?? "-"}
                      </p>
                    </div>
                    <div className="md:col-span-4">
                      <Label className="text-sm">วันที่ได้รับตำแหน่ง</Label>
                      <p className="mt-2 text-gray-800">
                        {formatDateToThaiNumeric(p.startDate)}
                      </p>
                    </div>
                  </div>
                )
              ))}
            </div>
          </div>

          {staffType === "ACADEMIC" && (
            <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-4">
              <Label className="text-lg font-semibold text-gray-900">
                วันเกษียณอายุ (60 ปีบริบูรณ์)
              </Label>
              <p className="mt-2 text-gray-800">
                {academicRetirementDateIso
                  ? formatDateToThaiNumeric(academicRetirementDateIso)
                  : "กรุณาระบุวันเกิดเพื่อคำนวณ"}
              </p>
            </div>
          )}

          {errorMessage && (
            <p className="w-full text-right text-sm text-red-600">{errorMessage}</p>
          )}

          <div className="pt-4 flex items-center justify-between">
            <Link href="/management/staffInfo">
              <button
                type="button"
                className="bg-gray-300 text-black hover:bg-gray-400 px-6 py-3 rounded-xl font-semibold disabled:opacity-50"
                disabled={isSubmitting}
              >
                ย้อนกลับ
              </button>
            </Link>
            <button
              type="submit"
              className="bg-blueit text-white hover:bg-blue-800 px-6 py-3 rounded-xl font-semibold flex items-center gap-2 disabled:opacity-50"
              disabled={isSubmitting}
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
