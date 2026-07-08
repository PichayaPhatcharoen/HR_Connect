"use client";

import { useCallback, useEffect, useState } from "react";
import { FaCirclePlus } from "react-icons/fa6";
import { FaEdit, FaRocket, FaSpinner, FaTrash, FaChevronDown, FaInfoCircle } from "react-icons/fa";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSearchParams } from "next/navigation";
import { formatThaiBuddhistDate } from "@/lib/dateFormat";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type KnowledgeDraft = {
  KnowledgeDraftId: string;
  Title: string;
  Body: string;
  Domain: string;
  Intent: string;
  Keywords: string[];
  SourceRef: string | null;
  Status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  PublishedAt: string | null;
  CreatedAt: string;
};

const PRESET_DOMAINS: Record<string, string> = {
  general: "ทั่วไป",
  leave: "การลา",
  payroll: "เงินเดือน/สวัสดิการ",
  training: "การฝึกอบรม",
  travel: "การเดินทาง",
  benefits: "สิทธิประโยชน์",
  recruitment: "การรับสมัคร",
  regulation: "ระเบียบข้อบังคับ",
};

const INTENT_LABELS: Record<string, string> = {
  how_to: "วิธีการ/ขั้นตอน",
  general_knowledge: "ความรู้ทั่วไป",
  policy: "นโยบาย/ระเบียบ",
  eligibility: "คุณสมบัติ/เงื่อนไข",
  definition: "คำนิยาม/ความหมาย",
  checklist: "รายการตรวจสอบ",
  contact: "ผู้รับผิดชอบ/ติดต่อ",
};

const INTENT_OPTIONS = Object.entries(INTENT_LABELS);

const blankForm = () => ({
  title: "", body: "", domain: "general", customDomain: "",
  intent: "how_to", customIntent: "", keywords: "", sourceRef: "",
});

// ส่วนของ DraftForm ถูกแยกออกมาเพื่อป้องกันการเรนเดอร์ใหม่ที่ไม่จำเป็น
type DraftFormProps = {
  isNew: boolean;
  form: ReturnType<typeof blankForm>;
  setForm: React.Dispatch<React.SetStateAction<ReturnType<typeof blankForm>>>;
  editingId: string | null;
  saving: boolean;
  onSave: () => void;
  onClear: () => void;
  onCancel: () => void;
  usedDomains: string[];
  usedIntents: string[];
};

const DraftForm = ({ isNew, form, setForm, editingId, saving, onSave, onClear, onCancel, usedDomains, usedIntents }: DraftFormProps) => (
  <div className="bg-white border-2 border-blue-200 rounded-xl p-6 mb-6 shadow-sm">
    <h3 className="text-xl font-bold text-blue-700 mb-4 flex items-center gap-2">
      <FaEdit className="text-blue-500" />
      {isNew ? "สร้างรายการใหม่" : "แก้ไขรายการ"}
    </h3>
    <div className="space-y-4">
      <div>
        <label className="block text-base font-semibold text-gray-700 mb-1.5">
          ชื่อหัวข้อ <span className="text-red-500">*</span>
        </label>
        <Input
          value={form.title}
          onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
          placeholder="เช่น ขั้นตอนการยื่นใบลาป่วย"
          className="text-lg border-gray-300 focus-visible:ring-blue-500 p-3"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-base font-semibold text-gray-700 mb-1.5">หมวดหมู่</label>
          <select
            value={form.domain}
            onChange={e => setForm(p => ({ ...p, domain: e.target.value, customDomain: "" }))}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-base bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {Object.entries(PRESET_DOMAINS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            {usedDomains.length > 0 && (
              <optgroup label="หมวดหมู่ที่เคยใช้">
                {usedDomains.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </optgroup>
            )}
            <option value="other">อื่นๆ (กรอกเอง)</option>
          </select>
          {form.domain === "other" && (
            <Input
              className="mt-2 text-base border-gray-300 focus-visible:ring-blue-500"
              placeholder="ระบุหมวดหมู่..."
              value={form.customDomain}
              onChange={e => setForm(p => ({ ...p, customDomain: e.target.value }))}
            />
          )}
        </div>
        <div>
          <label className="block text-base font-semibold text-gray-700 mb-1.5">ประเภทความรู้ (Intent)</label>
          <select
            value={form.intent}
            onChange={e => setForm(p => ({ ...p, intent: e.target.value, customIntent: "" }))}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-base bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {INTENT_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            {usedIntents.length > 0 && (
              <optgroup label="ประเภทความรู้ที่เคยใช้">
                {usedIntents.map((i) => (
                  <option key={i} value={i}>{i}</option>
                ))}
              </optgroup>
            )}
            <option value="other">อื่นๆ (กรอกเอง)</option>
          </select>
          {form.intent === "other" && (
            <Input
              className="mt-2 text-base border-gray-300 focus-visible:ring-blue-500"
              placeholder="ระบุประเภทความรู้..."
              value={form.customIntent}
              onChange={e => setForm(p => ({ ...p, customIntent: e.target.value }))}
            />
          )}
        </div>
      </div>

      <div>
        <label className="block text-base font-semibold text-gray-700 mb-1.5">
          เนื้อหา <span className="text-red-500">*</span>
        </label>
        <p className="text-sm text-gray-400 mb-1.5">เขียนเป็นข้อความอธิบายให้ครบถ้วน - ใช้บรรทัดเปล่าเพื่อแบ่งส่วนข้อมูล</p>
        <textarea
          value={form.body}
          onChange={e => setForm(p => ({ ...p, body: e.target.value }))}
          rows={8}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed resize-y"
          placeholder={"เช่น:\nการลาป่วยต้องยื่นใบลาภายใน...\n\nเอกสารที่ต้องใช้:\n1. ใบรับรองแพทย์...\n\nวิธีการ/ขั้นตอนการยื่นเอกสาร\n1. ไปที่เว็บไซต์...."}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-base font-semibold text-gray-700 mb-1.5">คำสำคัญ (Keywords)</label>
          <p className="text-sm text-gray-400 mb-1.5">คั่นด้วยเครื่องหมายจุลภาค (,)</p>
          <Input
            value={form.keywords}
            onChange={e => setForm(p => ({ ...p, keywords: e.target.value }))}
            placeholder="เช่น ลาป่วย, ใบรับรองแพทย์"
            className="text-base border-gray-300 p-3"
          />
        </div>
        <div>
          <label className="block text-base font-semibold text-gray-700 mb-1.5">
            <span className="flex items-center gap-2">
              แหล่งอ้างอิง (Source Reference)
              <span className="group relative inline-flex">
                <FaInfoCircle className="text-blue-500 cursor-help text-base" />
                <span className="invisible group-hover:visible absolute left-full top-0 ml-2 w-80 p-4 bg-slate-800 text-white text-sm rounded-lg shadow-xl z-50 leading-relaxed">
                  <div className="space-y-3">
                    <div>
                      <p className="font-medium mb-1">หากใส่ข้อความ + ลิงก์</p>
                      <p className="text-slate-300 text-xs">ผู้ใช้จะเห็น 🔗 ลิงก์ที่คลิกได้</p>
                      <p className="text-slate-400 text-xs mt-1">ตัวอย่าง: คู่มือการลา https://hr.kmitl.ac.th/leave-manual</p>
                      <p className="text-emerald-400 text-xs">→ 🔗 คู่มือการลา</p>
                    </div>
                    <div className="border-t border-slate-600 pt-2">
                      <p className="font-medium mb-1">หากใส่แค่ข้อความ (ไม่มีลิงก์)</p>
                      <p className="text-slate-300 text-xs">ผู้ใช้จะเห็น 📄 เอกสารอ้างอิง (คลิกไม่ได้)</p>
                      <p className="text-slate-400 text-xs mt-1">ตัวอย่าง: คู่มือการลา</p>
                      <p className="text-emerald-400 text-xs">→ 📄 เอกสาร/เว็บไซต์ที่เกี่ยวข้องกับ คู่มือการลา</p>
                    </div>
                    <div className="border-t border-slate-600 pt-2">
                      <p className="font-medium mb-1">หากไม่ใส่อ้างอิงเลย</p>
                      <p className="text-slate-300 text-xs">ผู้ใช้จะเห็น 📄 ชื่อหัวข้อเดิมเป็นอ้างอิง</p>
                      <p className="text-emerald-400 text-xs">→ 📄 เอกสาร/เว็บไซต์ที่เกี่ยวข้องกับ ขั้นตอนการลา</p>
                    </div>
                  </div>
                  <span className="absolute left-0 top-3 -translate-x-1 border-4 border-transparent border-r-slate-800"/>
                </span>
              </span>
            </span>
          </label>
          <p className="text-sm text-gray-400 mb-1.5">ชื่อ + ลิงก์ (คั่นด้วยช่องว่าง)</p>
          <Input
            value={form.sourceRef}
            onChange={e => setForm(p => ({ ...p, sourceRef: e.target.value }))}
            placeholder="เช่น เว็บไซต์สำนักงานบริหารทรัพยากรบุคคล https://hr.kmitl.ac.th"
            className="text-base border-gray-300 p-3"
          />
        </div>
      </div>

      <div className="flex gap-2 pt-1 border-t border-gray-100 mt-2">
        <Button
          onClick={onSave}
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-700 flex items-center gap-2 text-base"
        >
          {saving ? <FaSpinner className="animate-spin" /> : <FaEdit />}
          {editingId ? "บันทึกการแก้ไข" : "บันทึกข้อมูล"}
        </Button>
        {isNew && (
          <Button onClick={onClear} variant="outline" type="button" className="text-base">
            ล้างฟอร์ม
          </Button>
        )}
        <Button onClick={onCancel} variant="outline" className="text-base">ยกเลิก</Button>
      </div>
    </div>
  </div>
);

function getDomainLabel(domain: string): string {
  return PRESET_DOMAINS[domain] ?? domain;
}

export default function StaticQAPage() {
  const searchParams = useSearchParams();
  const [drafts, setDrafts] = useState<KnowledgeDraft[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [openItem, setOpenItem] = useState<string>("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [form, setForm] = useState(blankForm());
  const [saving, setSaving] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("ทั้งหมด");

  const notify = (type: "ok" | "err", text: string) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 5000);
  };

  const fetchDrafts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/knowledge-review?type=drafts");
      setDrafts(res.ok ? await res.json() : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDrafts(); }, [fetchDrafts]);

  // จัดการ Deep-link จาก Chat history เพื่อดึงข้อมูลมาสร้าง Draft ใหม่
  useEffect(() => {
    if (!searchParams) return;
    if (editingId) return;
    if (showNewForm) return;

    const from = searchParams.get("from");
    if (from !== "unanswerable") return;

    const question = searchParams.get("question") || "";
    const botResponse = searchParams.get("botResponse") || "";

    if (!question.trim() && !botResponse.trim()) return;

    // เคลียร์พารามิเตอร์ URL เพื่อป้องกันการเรียกซ้ำ
    window.history.replaceState({}, '', '/management/qaStatic');

    setEditingId(null);
    setOpenItem("");
    setShowNewForm(true);
    setForm((prev) => ({
      ...prev,
      title: question.trim() ? question : prev.title,
      body: [
        question ? `คำถาม: ${question}` : "",
        botResponse ? `คำตอบเดิมของบอต: ${botResponse}` : "",
      ].filter(Boolean).join("\n\n"),
      keywords: prev.keywords,
      sourceRef: prev.sourceRef,
    }));
  }, [searchParams, editingId, showNewForm]);

  const resolvedDomain = (f: typeof form) =>
    f.domain === "other" ? f.customDomain.trim() || "other" : f.domain;

  const resolvedIntent = (f: typeof form) =>
    f.intent === "other" ? f.customIntent.trim() || "other" : f.intent;

  const usedDomains = Array.from(
    new Set(
      drafts
        .map((d) => d.Domain)
        .filter((d) => d && !(d in PRESET_DOMAINS))
    )
  ).sort((a, b) => a.localeCompare(b));

  const usedIntents = Array.from(
    new Set(
      drafts
        .map((d) => d.Intent)
        .filter((i) => i && !(i in INTENT_LABELS))
    )
  ).sort((a, b) => a.localeCompare(b));

  const cancelEdit = () => {
    setEditingId(null);
    setShowNewForm(false);
    setForm(blankForm());
    // เคลียร์ URL params
    if (typeof window !== 'undefined' && searchParams?.get('from') === 'unanswerable') {
      window.history.replaceState({}, '', '/management/qaStatic');
    }
  };

  const clearForm = () => {
    setForm(blankForm());
  };

  const openEdit = (draft: KnowledgeDraft) => {
    const isPreset = draft.Domain in PRESET_DOMAINS;
    const isPresetIntent = draft.Intent in INTENT_LABELS;
    setShowNewForm(false);
    setEditingId(draft.KnowledgeDraftId);
    setOpenItem(draft.KnowledgeDraftId);
    setForm({
      title: draft.Title,
      body: draft.Body,
      domain: isPreset ? draft.Domain : "other",
      customDomain: isPreset ? "" : draft.Domain,
      intent: isPresetIntent ? draft.Intent : "other",
      customIntent: isPresetIntent ? "" : draft.Intent,
      keywords: (draft.Keywords || []).join(", "),
      sourceRef: draft.SourceRef || "",
    });
  };

  const saveDraft = async () => {
    if (!form.title.trim() || !form.body.trim()) {
      notify("err", "กรุณากรอกชื่อหัวข้อและเนื้อหา");
      return;
    }
    if (form.domain === "other" && !form.customDomain.trim()) {
      notify("err", "กรุณากรอกชื่อหมวดหมู่");
      return;
    }
    if (form.intent === "other" && !form.customIntent.trim()) {
      notify("err", "กรุณากรอกประเภทความรู้");
      return;
    }
    setSaving(true);
    try {
      const keywords = form.keywords.split(",").map(k => k.trim()).filter(Boolean);
      const domain = resolvedDomain(form);
      const intent = resolvedIntent(form);
      const payload = editingId
        ? { type: "update-draft", draftId: editingId, title: form.title, body: form.body, domain, intent, keywords, sourceRef: form.sourceRef || null }
        : { type: "create-draft", title: form.title, body: form.body, domain, intent, keywords, sourceRef: form.sourceRef || null };
      const res = await fetch("/api/knowledge-review", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.ok) {
        notify("ok", editingId ? "แก้ไขข้อมูลเรียบร้อย" : "สร้างรายการใหม่เรียบร้อย");
        cancelEdit();
        fetchDrafts();
      } else {
        notify("err", data.error || "บันทึกไม่สำเร็จ");
      }
    } catch (e: any) {
      notify("err", e.message);
    } finally {
      setSaving(false);
    }
  };

  const approveDraft = async (draftId: string) => {
    setApprovingId(draftId);
    try {
      const res = await fetch("/api/knowledge-review", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "approve", draftId }),
      });
      const data = await res.json();
      if (data.ok) {
        notify("ok", "นำเข้าสำเร็จ เพิ่มข้อมูลเข้าระบบแล้ว");
        fetchDrafts();
      } else {
        notify("err", data.error || "นำเข้าไม่สำเร็จ");
      }
    } catch (e: any) {
      notify("err", e.message);
    } finally {
      setApprovingId(null);
    }
  };

  const deleteDraft = async (draftId: string, title: string) => {
    if (!window.confirm(`ลบครายการ:
"${title}"\n\nข้อมูลจะถูกลบออกจากระบบถาวร รวมถึง Vector Chunks ที่เกี่ยวข้อง`)) return;
    setDeletingId(draftId);
    try {
      const res = await fetch("/api/knowledge-review", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "hard-delete", draftId }),
      });
      const data = await res.json();
      if (data.ok) { notify("ok", "ลบรายการและ Chunks เรียบร้อย"); fetchDrafts(); }
      else notify("err", data.error || "ไม่สำเร็จ");
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = drafts.filter(d => {
    const matchSearch = search.trim()
      ? d.Title.toLowerCase().includes(search.toLowerCase()) ||
        d.Body.toLowerCase().includes(search.toLowerCase()) ||
        (d.Keywords || []).some(k => k.toLowerCase().includes(search.toLowerCase()))
      : true;
    
    const matchCategory = selectedCategory === "ทั้งหมด" ||
      getDomainLabel(d.Domain) === selectedCategory;
    
    return matchSearch && matchCategory;
  });

  const allCategories = ["ทั้งหมด", ...Array.from(new Set(drafts.map(d => getDomainLabel(d.Domain))))];

  return (
    <div className="min-h-screen p-6 md:p-8 bg-gray-50">
      {/* ส่วนหัวข้อ (Header) */}
      <div className="mb-6">
        <h1 className="text-4xl font-bold text-blue-600">จัดการคลังคำตอบคงที่ (Static QA)</h1>
        <p className="text-black text-lg font-bold mt-2">
          คณะเทคโนโลยีสารสนเทศ
          <br />
          สถาบันเทคโนโลยีพระจอมเกล้าเจ้าคุณทหารลาดกระบัง
        </p>
      </div>

      {/* ส่วนการแจ้งเตือน (Notifications) */}
      {msg && (
        <div className={`mb-5 px-4 py-3 rounded-lg text-base font-medium flex items-center gap-2 ${msg.type === "ok" ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"}`}>
          {msg.text}
        </div>
      )}

      {/* ส่วนเครื่องมือจัดการ (Toolbar) */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">
        <div className="flex flex-col sm:flex-row gap-3 flex-1 w-full">
          <div className="flex-1 w-full sm:max-w-sm">
            <Input
              placeholder="ค้นหาจากชื่อ เนื้อหา หรือคำสำคัญ..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="border-gray-300 focus-visible:ring-blue-500 p-3 text-base"
            />
          </div>
          <div className="w-full sm:w-64">
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-full h-[46px] text-base">
                <SelectValue placeholder="เลือกหมวดหมู่" />
              </SelectTrigger>
              <SelectContent>
                {allCategories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button
          onClick={() => { setEditingId(null); setForm(blankForm()); setOpenItem(""); setShowNewForm(true); }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 shrink-0 px-4 py-2"
        >
          <FaCirclePlus className="text-xl" /> <span className="font-semibold">สร้างรายการใหม่</span>
        </Button>
      </div>

        {showNewForm && (
          <DraftForm
            isNew={true}
            form={form}
            setForm={setForm}
            editingId={editingId}
            saving={saving}
            onSave={saveDraft}
            onClear={clearForm}
            onCancel={cancelEdit}
            usedDomains={usedDomains}
            usedIntents={usedIntents}
          />
        )}

      {/* รายการ Draft */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">{search ? "ไม่พบรายการที่ตรงกับเงื่อนไข" : "ยังไม่มีรายการข้อมูล"}</p>
          {!search && <p className="text-sm mt-1">กด "สร้างรายการใหม่" เพื่อเพิ่มความรู้ให้ระบบ</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(draft => {
            const isOpen = openItem === draft.KnowledgeDraftId;
            const isEditing = editingId === draft.KnowledgeDraftId;
            return (
              <div
                key={draft.KnowledgeDraftId}
                className={`bg-white rounded-xl border transition-shadow ${isOpen ? "shadow-md border-blue-200" : "shadow-sm border-gray-200 hover:border-gray-300"}`}
              >
                {/* ส่วนหัวของ Card */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {/* ปุ่มเปิด/ปิดเนื้อหาขยาย */}
                    <button
                      type="button"
                      onClick={() => { setOpenItem(isOpen ? "" : draft.KnowledgeDraftId); if (isOpen) setEditingId(null); }}
                      className="text-gray-400 hover:text-gray-600 shrink-0 transition-transform duration-200"
                      style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
                      aria-label="toggle"
                    >
                      <FaChevronDown />
                    </button>

                    {/* ชื่อหัวข้อและป้ายสถานะ */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 text-base truncate">{draft.Title}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className={`text-sm px-2 py-0.5 rounded-full font-medium ${draft.Status === "PUBLISHED" ? "bg-teal-100 text-teal-700" : "bg-amber-100 text-amber-700"}`}>
                          {draft.Status === "PUBLISHED" ? "เผยแพร่แล้ว" : "ฉบับร่าง (Draft)"}
                        </span>
                        <span className="text-sm px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">
                          {getDomainLabel(draft.Domain)}
                        </span>
                        <span className="text-sm text-gray-400">
                          {INTENT_LABELS[draft.Intent] ?? draft.Intent}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* ปุ่มดำเนินการ (Actions) */}
                  <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                    {draft.Status !== "PUBLISHED" && (
                      <Button
                        size="sm"
                        disabled={approvingId === draft.KnowledgeDraftId}
                        onClick={() => approveDraft(draft.KnowledgeDraftId)}
                        className="bg-teal-600 hover:bg-teal-700 text-white flex items-center gap-1.5 text-sm h-8 px-3"
                      >
                        {approvingId === draft.KnowledgeDraftId ? <FaSpinner className="animate-spin" /> : <FaRocket />}
                        อนุมัติ
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEdit(draft)}
                      className="flex items-center gap-1.5 text-sm h-8 px-3 border-blue-300 text-blue-600 hover:bg-blue-50"
                    >
                      <FaEdit /> แก้ไข
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={deletingId === draft.KnowledgeDraftId}
                      onClick={() => deleteDraft(draft.KnowledgeDraftId, draft.Title)}
                      className="flex items-center gap-1.5 text-sm h-8 px-3 border-red-200 text-red-400 hover:bg-red-50 hover:text-red-600"
                    >
                      {deletingId === draft.KnowledgeDraftId ? <FaSpinner className="animate-spin" /> : <FaTrash />}
                      ลบ
                    </Button>
                  </div>
                </div>

                {/* เนื้อหาที่ขยายออกมา (Expanded Content) */}
                {isOpen && (
                  <div className="border-t border-gray-100 px-5 pb-5 pt-4">
                    {isEditing ? (
                      <DraftForm
                        isNew={false}
                        form={form}
                        setForm={setForm}
                        editingId={editingId}
                        saving={saving}
                        onSave={saveDraft}
                        onClear={clearForm}
                        onCancel={cancelEdit}
                        usedDomains={usedDomains}
                        usedIntents={usedIntents}
                      />
                    ) : (
                      <div className="space-y-3">
                        <p className="text-base text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-lg p-4 leading-relaxed border border-gray-100">
                          {draft.Body}
                        </p>
                        <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-gray-500">
                          {draft.Keywords?.length > 0 && (
                            <span>คำสำคัญ: <span className="text-gray-700">{draft.Keywords.join(", ")}</span></span>
                          )}
                          {draft.SourceRef && (
                            <span>อ้างอิง: <span className="text-gray-700">{draft.SourceRef}</span></span>
                          )}
                          {draft.PublishedAt && (
                            <span>เผยแพร่: <span className="text-gray-700">{formatThaiBuddhistDate(draft.PublishedAt)}</span></span>
                          )}
                          <span>สร้างเมื่อ: <span className="text-gray-700">{formatThaiBuddhistDate(draft.CreatedAt)}</span></span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
