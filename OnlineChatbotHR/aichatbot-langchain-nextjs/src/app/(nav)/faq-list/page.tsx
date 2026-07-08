"use client";

import { useCallback, useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { FaChevronDown } from "react-icons/fa";
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

function getDomainLabel(domain: string): string {
  return PRESET_DOMAINS[domain] ?? domain;
}

export default function FAQListPage() {
  const [drafts, setDrafts] = useState<KnowledgeDraft[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [openItem, setOpenItem] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ทั้งหมด");

  const fetchDrafts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/knowledge-review?type=drafts");
      const allDrafts = res.ok ? await res.json() : [];
      setDrafts(allDrafts.filter((d: KnowledgeDraft) => d.Status === "PUBLISHED"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDrafts(); }, [fetchDrafts]);

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
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-4xl font-bold text-blue-600">รายการคำถามทั้งหมด</h1>
        <p className="text-black text-lg font-bold mt-2">
          คณะเทคโนโลยีสารสนเทศ
          <br />
          สถาบันเทคโนโลยีพระจอมเกล้าเจ้าคุณทหารลาดกระบัง
        </p>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-5">
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

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">{search ? "ไม่พบรายการที่ตรงกับเงื่อนไข" : "ยังไม่มีรายการ"}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(draft => {
            const isOpen = openItem === draft.KnowledgeDraftId;
            return (
              <div
                key={draft.KnowledgeDraftId}
                className={`bg-white rounded-xl border transition-shadow ${isOpen ? "shadow-md border-blue-200" : "shadow-sm border-gray-200 hover:border-gray-300"}`}
              >
                {/* Card header row */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {/* Expand toggle */}
                    <button
                      type="button"
                      onClick={() => setOpenItem(isOpen ? "" : draft.KnowledgeDraftId)}
                      className="text-gray-400 hover:text-gray-600 shrink-0 transition-transform duration-200"
                      style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
                      aria-label="toggle"
                    >
                      <FaChevronDown />
                    </button>

                    {/* Title + badges */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 text-base truncate">{draft.Title}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-sm px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">
                          {getDomainLabel(draft.Domain)}
                        </span>
                        <span className="text-sm text-gray-400">
                          {INTENT_LABELS[draft.Intent] ?? draft.Intent}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expanded content */}
                {isOpen && (
                  <div className="border-t border-gray-100 px-5 pb-5 pt-4">
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
                      </div>
                    </div>
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
