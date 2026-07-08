"use client";

import { useState, useEffect, useCallback, type ReactNode } from "react";
import { FaPlusCircle, FaCheckCircle, FaTimes, FaEdit, FaUndo, FaTrash, FaArchive, FaQuestionCircle, FaCheck } from "react-icons/fa";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import Link from "next/link";
import { faqCategories } from '@/constants/faqcategories';

type FAQ = {
  FAQId: string;
  Question: string;
  Answer: string;
  CategoryId: string | null;
  Category?: { Name: string } | null;
  UsageCount: number;
};

type FAQCandidate = {
  FAQCandidateId: string;
  Title?: string | null;
  OriginalQuestion: string;
  NormalizedQuestion: string;
  BotAnswer: string;
  AskCount: number;
  TopScore: number | null;
  AnswerType: string | null;
  Channel: string;
  Status: string;
  FirstAskedAt: string;
  LastAskedAt: string;
  ReviewNotes?: string | null;
};

type CandidateStats = {
  totalPending: number;
  totalApproved: number;
  totalRejected: number;
};

export default function FAQPage() {
  const [isClientMounted, setIsClientMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<"candidates" | "approved" | "rejected" | "ignored">("candidates");
  const [candidates, setCandidates] = useState<FAQCandidate[]>([]);
  const [rejectedCandidates, setRejectedCandidates] = useState<FAQCandidate[]>([]);
  const [faqList, setFaqList] = useState<FAQ[]>([]);
  const [archivedFaqs, setArchivedFaqs] = useState<FAQ[]>([]);
  const [archivedFaqCount, setArchivedFaqCount] = useState(0);
  const [stats, setStats] = useState<CandidateStats | null>(null);

  // Combined count for rejected tab (archived FAQs + rejected candidates)
  const rejectedTabCount = archivedFaqCount + rejectedCandidates.length;
  const [isLoading, setIsLoading] = useState(true);
  const [isArchivedLoading, setIsArchivedLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedChannel, setSelectedChannel] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<string>("askCount");
  const [faqSearchTerm, setFaqSearchTerm] = useState("");
  const [faqCategoryFilter, setFaqCategoryFilter] = useState<string>("ทั้งหมด");
  const [faqStatusFilter, setFaqStatusFilter] = useState<string>("ทั้งหมด");

  // สถานะ Modal ต่างๆ
  const [reviewCandidate, setReviewCandidate] = useState<FAQCandidate | null>(null);
  const [editedQuestion, setEditedQuestion] = useState("");
  const [editedAnswer, setEditedAnswer] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // สถานะ Modal สำหรับดูคำตอบเต็ม
  const [viewAnswerCandidate, setViewAnswerCandidate] = useState<FAQCandidate | null>(null);
  const [viewAnswerFAQ, setViewAnswerFAQ] = useState<FAQ | null>(null);

  // สถานะ Modal สำหรับช่วยเหลือ
  const [showHelpModal, setShowHelpModal] = useState(false);

  useEffect(() => {
    setIsClientMounted(true);
    // ตรวจสอบ URL hash เพื่อกำหนดแท็บเริ่มต้น
    if (typeof window !== 'undefined' && window.location.hash === '#approved') {
      setActiveTab('approved');
    }
  }, []);

  const fetchCandidates = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({
        status: activeTab === "candidates" ? "PENDING" : activeTab === "rejected" ? "REJECTED" : "IGNORED",
        sortBy,
        limit: "50",
      });
      if (selectedChannel !== "ALL") {
        params.append("channel", selectedChannel);
      }
      const res = await fetch(`/api/faq-candidates?${params}`);
      if (!res.ok) throw new Error("Failed to fetch candidates");
      const data = await res.json();

      if (activeTab === "rejected") {
        setRejectedCandidates(data.data || []);
      } else {
        setCandidates(data.data || []);
      }
    } catch (err) {
      console.error("Failed to load candidates:", err);
      if (activeTab === "rejected") {
        setRejectedCandidates([]);
      } else {
        setCandidates([]);
      }
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, selectedChannel, sortBy]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/faq-candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "stats" }),
      });
      if (!res.ok) throw new Error("Failed to fetch stats");
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error("Failed to load stats:", err);
    }
  }, []);

  const fetchFAQs = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/faq");
      if (!res.ok) throw new Error("Failed to fetch FAQs");
      const data: FAQ[] = await res.json();
      setFaqList(data);
    } catch (err) {
      console.error("Failed to load FAQs:", err);
      setFaqList([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchArchivedFAQs = useCallback(async ({ countOnly = false }: { countOnly?: boolean } = {}) => {
    try {
      if (!countOnly) setIsArchivedLoading(true);
      const res = await fetch("/api/faq?status=inactive");
      if (!res.ok) throw new Error("Failed to fetch archived FAQs");
      const data: FAQ[] = await res.json();
      if (!countOnly) setArchivedFaqs(data);
      setArchivedFaqCount(data.length);

      // ดึงจำนวนรายการที่ถูกปฏิเสธมาด้วยเมื่อต้องการสรุปจำนวน
      if (countOnly) {
        try {
          const rejectedRes = await fetch("/api/faq-candidates?status=REJECTED&limit=1");
          if (rejectedRes.ok) {
            const rejectedData = await rejectedRes.json();
            setRejectedCandidates(rejectedData.data || []);
          }
        } catch (err) {
          console.error("Failed to fetch rejected candidates count:", err);
          setRejectedCandidates([]);
        }
      }
    } catch (err) {
      console.error("Failed to load archived FAQs:", err);
      if (!countOnly) setArchivedFaqs([]);
      if (countOnly) setArchivedFaqCount(0);
    } finally {
      if (!countOnly) setIsArchivedLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "candidates" || activeTab === "ignored") {
      fetchCandidates();
      fetchStats();
    } else if (activeTab === "approved") {
      fetchFAQs();
    } else if (activeTab === "rejected") {
      fetchArchivedFAQs();
      fetchCandidates();
    }
  }, [activeTab, searchTerm, selectedChannel, sortBy, faqSearchTerm, faqCategoryFilter, faqStatusFilter, fetchCandidates, fetchStats, fetchFAQs, fetchArchivedFAQs]);

  useEffect(() => {
    fetchArchivedFAQs({ countOnly: true });
  }, [fetchArchivedFAQs]);

  const openReviewModal = (candidate: FAQCandidate) => {
    setReviewCandidate(candidate);
    setEditedQuestion(candidate.Title || candidate.NormalizedQuestion);
    setEditedAnswer(candidate.BotAnswer);
    setSelectedCategory("");
  };

  const closeReviewModal = () => {
    setReviewCandidate(null);
    setEditedQuestion("");
    setEditedAnswer("");
    setSelectedCategory("");
  };

  const openViewAnswerModal = (candidate: FAQCandidate) => {
    setViewAnswerCandidate(candidate);
  };

  const closeViewAnswerModal = () => {
    setViewAnswerCandidate(null);
  };

  const closeViewAnswerFAQModal = () => {
    setViewAnswerFAQ(null);
  };

  // จัดรูปแบบคำตอบของบอตให้เป็นข้อความ
  function formatMessageText(text: string): ReactNode {

    const stripped = text.replace(/\s*\[อ้างอิง\s*\d+\]\s*$/g, "").trim();
    // แยก markers **
    const boldParts = stripped.split(/\*\*([^*]*)\*\*/g);

    return boldParts.map((part, i) => {
      const isBold = i % 2 === 1;

      // ตรวจและ linkify URLs
      const urlRegex = /((?:https?:\/\/|www\.)[^\s<>]+?)(?=[\s<>]|$)/g;
      const segments = part.split(urlRegex);

      const content = segments.map((seg, j) => {
        if (/^https?:\/\//i.test(seg)) {
          return (
            <a
              key={`${i}-${j}`}
              href={seg}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 underline"
            >
              {seg}
            </a>
          );
        }
        if (/^www\./i.test(seg)) {
          return (
            <a
              key={`${i}-${j}`}
              href={`https://${seg}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 underline"
            >
              {seg}
            </a>
          );
        }
        return seg;
      });

      if (isBold) {
        return <strong key={i}>{content}</strong>;
      }
      return <span key={i}>{content}</span>;
    });
  }

  const handleApprove = async () => {
    if (!reviewCandidate) return;
    try {
      setIsSubmitting(true);
      const res = await fetch("/api/faq-candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "approve",
          candidateId: reviewCandidate.FAQCandidateId,
          editedQuestion,
          editedAnswer,
          categoryId: selectedCategory || null,
          reviewedBy: "admin",
        }),
      });
      if (!res.ok) throw new Error("Failed to approve");
      alert("อนุมัติและสร้าง FAQ เรียบร้อย");
      closeReviewModal();
      fetchCandidates();
      fetchStats();
    } catch (err) {
      console.error("Failed to approve:", err);
      alert("ไม่สามารถอนุมัติได้");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleIgnore = async (candidateId: string) => {
    if (!confirm("คำถามนี้จะถูกซ่อนไว้ชั่วคราว และจะกลับมาแสดงอีกครั้งหากมีคนถามคำถามนี้อีก\n\nยืนยันการไม่สนใจในตอนนี้?")) return;
    try {
      const res = await fetch("/api/faq-candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "ignore",
          candidateId,
          reviewedBy: "admin",
        }),
      });
      if (!res.ok) throw new Error("Failed to ignore");
      alert("ซ่อนคำถามเรียบร้อย - จะกลับมาแสดงหากถามอีกครั้ง");
      fetchCandidates();
      fetchStats();
    } catch (err) {
      console.error("Failed to ignore:", err);
      alert("ไม่สามารถซ่อนคำถามได้");
    }
  };

  const handleUnarchive = async (candidateId: string) => {
    if (!confirm("ยืนยันการนำคำถามนี้กลับมาแสดงอีกครั้ง?")) return;
    try {
      const res = await fetch("/api/faq-candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "unarchive",
          candidateId,
        }),
      });
      if (!res.ok) throw new Error("Failed to unarchive");
      alert("นำคำถามกลับมาแสดงเรียบร้อย");
      fetchCandidates();
      fetchStats();
    } catch (err) {
      console.error("Failed to unarchive:", err);
      alert("ไม่สามารถนำคำถามกลับมาได้");
    }
  };

  const handleDelete = async (candidateId: string) => {
    if (!confirm("ลบคำถามนี้อย่างถาวร?\n\nคำถามนี้จะถูกลบออกจากฐานข้อมูลและไม่สามารถกู้คืนได้")) return;
    try {
      const res = await fetch("/api/faq-candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "delete",
          candidateId,
        }),
      });
      if (!res.ok) throw new Error("Failed to delete");
      alert("ลบคำถามเรียบร้อย");
      fetchCandidates();
      fetchStats();
    } catch (err) {
      console.error("Failed to delete:", err);
      alert("ไม่สามารถลบคำถามได้");
    }
  };

  const handleArchiveFAQ = async (faqId: string) => {
    if (!confirm("ย้าย FAQ นี้ไปยังรายการปฏิเสธ?\n\nFAQ จะถูกตั้งค่าเป็นไม่ใช้งานและย้ายไปยังแท็บปฏิเสธแล้ว")) return;
    try {
      const res = await fetch(`/api/faq/${faqId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: false }),
      });
      if (!res.ok) throw new Error("Failed to archive");
      alert("ย้าย FAQ ไปยังรายการปฏิเสธเรียบร้อย");
      fetchFAQs();
      fetchArchivedFAQs({ countOnly: activeTab !== "rejected" });
    } catch (err) {
      console.error("Failed to archive FAQ:", err);
      alert("ไม่สามารถย้าย FAQ ได้");
    }
  };

  const handleRestoreFAQ = async (faqId: string) => {
    if (!confirm("นำ FAQ นี้กลับมาใช้งานอีกครั้ง?")) return;
    try {
      const res = await fetch(`/api/faq/${faqId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: true }),
      });
      if (!res.ok) throw new Error("Failed to restore FAQ");
      alert("นำ FAQ กลับมาใช้งานเรียบร้อย");
      fetchArchivedFAQs({ countOnly: activeTab !== "rejected" });
      fetchFAQs();
    } catch (err) {
      console.error("Failed to restore FAQ:", err);
      alert("ไม่สามารถนำ FAQ กลับมาได้");
    }
  };

  const handleDeleteFAQ = async (faqId: string) => {
    if (!confirm("ลบ FAQ นี้อย่างถาวร?")) return;
    try {
      const res = await fetch(`/api/faq/${faqId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete FAQ");
      alert("ลบ FAQ เรียบร้อย");
      fetchArchivedFAQs();
    } catch (err) {
      console.error("Failed to delete FAQ:", err);
      alert("ไม่สามารถลบ FAQ ได้");
    }
  };

  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectingCandidateId, setRejectingCandidateId] = useState<string>("");
  const [rejectNotes, setRejectNotes] = useState("");

  const handleReject = async (candidateId: string) => {
    setRejectingCandidateId(candidateId);
    setRejectNotes("");
    setShowRejectModal(true);
  };

  const confirmReject = async () => {
    try {
      const res = await fetch("/api/faq-candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "reject",
          candidateId: rejectingCandidateId,
          reviewedBy: "admin",
          reviewNotes: rejectNotes.trim() || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to reject");
      alert("ปฏิเสธเรียบร้อย");
      setShowRejectModal(false);
      fetchCandidates();
      // Fetch stats but don't fail if it errors
      fetchStats().catch(console.error);
    } catch (err) {
      console.error("Failed to reject:", err);
      alert("ไม่สามารถปฏิเสธได้");
    }
  };

  const handleQuickApprove = async (candidateId: string) => {
    try {
      const res = await fetch("/api/faq-candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "approve",
          candidateId,
          reviewedBy: "admin",
        }),
      });
      if (!res.ok) throw new Error("Failed to approve");
      alert("อนุมัติเรียบร้อย");
      fetchCandidates();
      // Fetch stats but don't fail if it errors
      fetchStats().catch(console.error);
      fetchFAQs();
    } catch (err) {
      console.error("Failed to approve:", err);
      alert("ไม่สามารถอนุมัติได้");
    }
  };

  const handleRecover = async (candidateId: string) => {
    try {
      const res = await fetch("/api/faq-candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "unarchive",
          candidateId,
          reviewedBy: "admin",
        }),
      });
      if (!res.ok) throw new Error("Failed to recover");
      alert("นำกลับไปรอตรวจสอบเรียบร้อย");
      fetchCandidates();
      // Fetch stats but don't fail if it errors
      fetchStats().catch(console.error);
    } catch (err) {
      console.error("Failed to recover:", err);
      alert("ไม่สามารถนำกลับได้");
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("th-TH", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const filteredCandidates = candidates.filter((c) => {
    const searchable = `${c.Title || ""} ${c.NormalizedQuestion} ${c.OriginalQuestion}`.toLowerCase();
    if (searchTerm && !searchable.includes(searchTerm.toLowerCase())) {
      return false;
    }
    return true;
  });

  const filteredFAQs = faqList.filter(faq => {
    const matchesSearch = faq.Question.toLowerCase().includes(faqSearchTerm.toLowerCase()) ||
      faq.Answer.toLowerCase().includes(faqSearchTerm.toLowerCase());
    const matchesCategory = faqCategoryFilter === "ทั้งหมด" ||
      faq.Category?.Name === faqCategoryFilter;
    return matchesSearch && matchesCategory;
  });

  const filteredArchivedFAQs = archivedFaqs.filter(faq => {
    const matchesSearch = faq.Question.toLowerCase().includes(faqSearchTerm.toLowerCase()) ||
      faq.Answer.toLowerCase().includes(faqSearchTerm.toLowerCase());
    const matchesCategory = faqCategoryFilter === "ทั้งหมด" ||
      faq.Category?.Name === faqCategoryFilter;
    const matchesStatus = faqStatusFilter === "ทั้งหมด" || faqStatusFilter === "เคยอนุมัติ";
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const filteredRejectedCandidates = rejectedCandidates.filter(candidate => {
    const matchesSearch = `${candidate.Title || ""} ${candidate.NormalizedQuestion} ${candidate.OriginalQuestion} ${candidate.BotAnswer}`.toLowerCase().includes(faqSearchTerm.toLowerCase());
    const matchesChannel = selectedChannel === "ALL" || candidate.Channel === selectedChannel;
    const matchesStatus = faqStatusFilter === "ทั้งหมด" || faqStatusFilter === "ยังไม่อนุมัติ";
    // หากมีการเลือกหมวดหมู่ ให้กรองรายการที่ถูกปฏิเสธออก (เนื่องจากไม่มีหมวดหมู่)
    // แต่จะใช้เฉพาะเมื่อสถานะเป็น "ทั้งหมด" - ถ้าสถานะเป็น "ยังไม่อนุมัติ" จะไม่สนใจหมวดหมู่
    const matchesCategoryFilter = faqCategoryFilter === "ทั้งหมด" || faqStatusFilter === "ยังไม่อนุมัติ";
    return matchesSearch && matchesChannel && matchesStatus && matchesCategoryFilter;
  });

  // แสดงผลรายการ Candidate ตามแท็บที่เลือก
  const renderCandidateItem = (candidate: FAQCandidate) => {
    const isArchived = activeTab === "ignored";

    return (
      <div key={candidate.FAQCandidateId} className="border border-gray-200 rounded-lg p-5 hover:bg-gray-50">
        <div className="flex flex-col sm:flex-row items-start justify-between mb-3 gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className={`px-3 py-1 rounded text-sm font-semibold ${candidate.Channel === "WEB" ? "bg-purple-100 text-purple-700" : "bg-orange-100 text-orange-700"
                }`}>
                {candidate.Channel === "WEB" ? "เว็บไซต์" : "LINE"}
              </span>
              <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm font-semibold">
                ถาม {candidate.AskCount} ครั้ง
              </span>
              {candidate.TopScore !== null && (
                //แปลง similarity score เป็นค่าความใกล้เคียง (%)
                <span className="text-sm text-gray-500">
                  คะแนน: {(candidate.TopScore * 100).toFixed(0)}%
                </span>
              )}
            </div>
            <p className="text-lg font-semibold text-gray-800 mb-2">
              {candidate.Title || candidate.NormalizedQuestion}
            </p>
            {candidate.Title && candidate.OriginalQuestion !== candidate.Title && (
              <p className="text-sm text-gray-500 mb-2">
                ตัวอย่างคำถามจริง: {candidate.OriginalQuestion}
              </p>
            )}
            <p className="text-sm text-gray-600 mb-2">
              คำตอบของบอต: {candidate.BotAnswer.slice(0, 150)}{candidate.BotAnswer.length > 150 ? "..." : ""}
            </p>
            <p className="text-xs text-gray-400">
              ถามครั้งแรก: {formatDate(candidate.FirstAskedAt)} | ถามล่าสุด: {formatDate(candidate.LastAskedAt)}
            </p>
            {candidate.ReviewNotes && (
              <p className="text-xs text-amber-600 mt-1 p-2 bg-amber-50 rounded border border-amber-200">
                📝 {candidate.ReviewNotes}
              </p>
            )}
          </div>
          {candidate.BotAnswer.length > 150 && (
            <button
              onClick={() => openViewAnswerModal(candidate)}
              className="flex-shrink-0 bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap"
            >
              <Eye className="w-4 h-4" /> ดูคำตอบเต็ม
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2 mt-4 max-w-2xl">
          {isArchived ? (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleUnarchive(candidate.FAQCandidateId)}
                className="border-blue-600 text-blue-600 hover:bg-blue-50 text-xs sm:text-sm whitespace-nowrap px-4 py-2"
              >
                <FaUndo className="mr-1" /> นำกลับไปรอตรวจสอบ
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleDelete(candidate.FAQCandidateId)}
                className="border-red-800 text-red-800 hover:bg-red-50 text-xs sm:text-sm whitespace-nowrap px-4 py-2"
              >
                <FaTrash className="mr-1" /> ลบ
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                onClick={() => openReviewModal(candidate)}
                className="bg-green-600 hover:bg-green-700 text-xs sm:text-sm whitespace-nowrap px-4 py-2"
              >
                <FaCheckCircle className="mr-1" /> เลือกเป็น FAQ
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleIgnore(candidate.FAQCandidateId)}
                className="border-gray-500 text-gray-600 hover:bg-gray-100 text-xs sm:text-sm whitespace-nowrap px-4 py-2"
              >
                ไม่สนใจ
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleReject(candidate.FAQCandidateId)}
                className="border-red-600 text-red-600 hover:bg-red-50 text-xs sm:text-sm whitespace-nowrap px-4 py-2"
              >
                <FaTimes className="mr-1" /> ปฏิเสธ
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleDelete(candidate.FAQCandidateId)}
                className="border-red-800 text-red-800 hover:bg-red-50 text-xs sm:text-sm whitespace-nowrap px-4 py-2"
              >
                <FaTrash className="mr-1" /> ลบ
              </Button>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen p-4 sm:p-8 bg-gray-50">
      <div className="flex flex-col gap-y-1 mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold text-blue-600">
          จัดการคำถามที่พบบ่อย (FAQ)
        </h1>
        <p className="text-black text-base sm:text-lg font-bold">
          คณะเทคโนโลยีสารสนเทศ
          <br />
          สถาบันเทคโนโลยีพระจอมเกล้าเจ้าคุณทหารลาดกระบัง
        </p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white p-5 rounded-lg shadow-md">
            <p className="text-gray-600 text-lg">รอการตรวจสอบ</p>
            <p className="text-3xl font-bold text-orange-600">{stats.totalPending}</p>
          </div>
          <div className="bg-white p-5 rounded-lg shadow-md">
            <p className="text-gray-600 text-lg">อนุมัติแล้ว</p>
            <p className="text-3xl font-bold text-green-600">{stats.totalApproved}</p>
          </div>
          <div className="bg-white p-5 rounded-lg shadow-md">
            <p className="text-gray-600 text-lg">ปฏิเสธ</p>
            <p className="text-3xl font-bold text-red-600">{rejectedTabCount}</p>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2 mb-6 border-b border-gray-200">
        <button
          onClick={() => setActiveTab("approved")}
          className={`px-4 sm:px-6 py-3 text-base sm:text-lg font-semibold border-b-2 transition-colors ${activeTab === "approved"
            ? "border-blue-600 text-blue-600"
            : "border-transparent text-gray-600 hover:text-blue-600"
            }`}
        >
          FAQ
        </button>
        <button
          onClick={() => setActiveTab("candidates")}
          className={`px-4 sm:px-6 py-3 text-base sm:text-lg font-semibold border-b-2 transition-colors ${activeTab === "candidates"
            ? "border-blue-600 text-blue-600"
            : "border-transparent text-gray-600 hover:text-blue-600"
            }`}
        >
          รอตรวจสอบ ({stats?.totalPending || 0})
        </button>
        <button
          onClick={() => setActiveTab("rejected")}
          className={`px-4 sm:px-6 py-3 text-base sm:text-lg font-semibold border-b-2 transition-colors ${activeTab === "rejected"
            ? "border-red-600 text-red-600"
            : "border-transparent text-gray-600 hover:text-red-600"
            }`}
        >
          ปฏิเสธแล้ว ({rejectedTabCount})
        </button>
        <button
          onClick={() => setActiveTab("ignored")}
          className={`px-4 sm:px-6 py-3 text-base sm:text-lg font-semibold border-b-2 transition-colors ${activeTab === "ignored"
            ? "border-gray-600 text-gray-600"
            : "border-transparent text-gray-600 hover:text-gray-800"
            }`}
        >
          ซ่อนชั่วคราว
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md mb-6">
        {activeTab === "approved" ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-base sm:text-lg font-semibold mb-2">ค้นหา</label>
              <Input
                placeholder="ค้นหาคำถามหรือคำตอบ..."
                value={faqSearchTerm}
                onChange={(e) => setFaqSearchTerm(e.target.value)}
                className="w-full border-2 border-gray-300"
              />
            </div>
            <div className="flex flex-col items-center">
              <label className="block text-base sm:text-lg font-semibold mb-2 w-full text-center">หมวดหมู่</label>
              <Select value={faqCategoryFilter} onValueChange={setFaqCategoryFilter}>
                <SelectTrigger className="border-2 border-gray-300 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {faqCategories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.name}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        ) : activeTab === "rejected" ? (
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <div className="md:col-span-2">
              <label className="block text-base sm:text-lg font-semibold mb-2">ค้นหา</label>
              <Input
                placeholder="ค้นหาคำถามหรือคำตอบ..."
                value={faqSearchTerm}
                onChange={(e) => setFaqSearchTerm(e.target.value)}
                className="w-full border-2 border-gray-300"
              />
            </div>
            <div className="flex flex-col items-center">
              <label className="block text-base sm:text-lg font-semibold mb-2 w-full text-center">สถานะ</label>
              <Select value={faqStatusFilter} onValueChange={setFaqStatusFilter}>
                <SelectTrigger className="border-2 border-gray-300 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ทั้งหมด">ทั้งหมด</SelectItem>
                  <SelectItem value="เคยอนุมัติ">เคยอนุมัติ</SelectItem>
                  <SelectItem value="ยังไม่อนุมัติ">ยังไม่อนุมัติ</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col items-center">
              <label className="block text-base sm:text-lg font-semibold mb-2 w-full text-center">หมวดหมู่</label>
              <Select
                value={faqCategoryFilter}
                onValueChange={(value) => {
                  setFaqCategoryFilter(value);
                  // เปลี่ยนไปใช้สถานะ "เคยอนุมัติ" อัตโนมัติเมื่อเลือกหมวดหมู่เฉพาะ
                  if (value !== "ทั้งหมด" && faqStatusFilter === "ทั้งหมด") {
                    setFaqStatusFilter("เคยอนุมัติ");
                  }
                }}
                disabled={faqStatusFilter === "ยังไม่อนุมัติ"}
              >
                <SelectTrigger className={`border-2 border-gray-300 w-full ${faqStatusFilter === "ยังไม่อนุมัติ" ? "bg-gray-100 opacity-50" : ""
                  }`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {faqCategories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.name}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {faqStatusFilter === "ยังไม่อนุมัติ"}
              {faqStatusFilter === "ทั้งหมด" && faqCategoryFilter !== "ทั้งหมด"}
            </div>
            <div className="flex flex-col items-center">
              <label className="block text-base sm:text-lg font-semibold mb-2 w-full text-center">ช่องทาง</label>
              <Select value={selectedChannel} onValueChange={setSelectedChannel}>
                <SelectTrigger className="border-2 border-gray-300 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">ทั้งหมด</SelectItem>
                  <SelectItem value="WEB">เว็บไซต์</SelectItem>
                  <SelectItem value="LINE">LINE</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col items-center">
              <label className="block text-base sm:text-lg font-semibold mb-2 w-full text-center">เรียงตาม</label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="border-2 border-gray-300 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="askCount">ถามบ่อยสุด</SelectItem>
                  <SelectItem value="lastAsked">ถามล่าสุด</SelectItem>
                  <SelectItem value="firstAsked">ถามเก่าสุด</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        ) : isClientMounted && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <label className="block text-base sm:text-lg font-semibold mb-2">ค้นหา</label>
              <Input
                placeholder="ค้นหาคำถาม..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full border-2 border-gray-300"
              />
            </div>
            <div className="flex flex-col items-center">
              <label className="block text-base sm:text-lg font-semibold mb-2 w-full text-center">ช่องทาง</label>
              <Select value={selectedChannel} onValueChange={setSelectedChannel}>
                <SelectTrigger className="border-2 border-gray-300 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">ทั้งหมด</SelectItem>
                  <SelectItem value="WEB">เว็บไซต์</SelectItem>
                  <SelectItem value="LINE">LINE</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col items-center">
              <label className="block text-base sm:text-lg font-semibold mb-2 w-full text-center">เรียงตาม</label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="border-2 border-gray-300 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="askCount">ถามบ่อยสุด</SelectItem>
                  <SelectItem value="lastAsked">ถามล่าสุด</SelectItem>
                  <SelectItem value="firstAsked">ถามเก่าสุด</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
        <div className="flex flex-col items-end justify-end p-5">
          {(faqSearchTerm || faqCategoryFilter !== "ทั้งหมด" || faqStatusFilter !== "ทั้งหมด" || selectedChannel !== "ALL" || sortBy !== "askCount") && (
            <button
              onClick={() => {
                setFaqSearchTerm("");
                setFaqCategoryFilter("ทั้งหมด");
                setFaqStatusFilter("ทั้งหมด");
                setSelectedChannel("ALL");
                setSortBy("askCount");
              }}
              className="text-xs text-blue-600 hover:text-blue-800 underline"
            >
              ล้างตัวกรอง
            </button>
          )}
        </div>
      </div>

      {/* แท็บรอตรวจสอบ / ซ่อนชั่วคราว */}
      {(activeTab === "candidates" || activeTab === "ignored") && (
        <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <p className="text-lg sm:text-xl font-bold">
              {activeTab === "candidates" && "คำถามจากแชตที่พบบ่อย"}
              {activeTab === "ignored" && "คำถามที่ซ่อนชั่วคราว"}
            </p>
            {activeTab === "candidates" && (
              <button
                onClick={() => setShowHelpModal(true)}
                className="text-gray-400 hover:text-blue-600 transition"
                title="วิธีใช้งาน"
              >
                <FaQuestionCircle className="w-5 h-5" />
              </button>
            )}
            {activeTab === "ignored" && (
              <button
                onClick={() => setShowHelpModal(true)}
                className="text-gray-400 hover:text-blue-600 transition"
                title="วิธีใช้งานคำถามที่ซ่อนชั่วคราว"
              >
                <FaQuestionCircle className="w-5 h-5" />
              </button>
            )}
          </div>
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : filteredCandidates.length === 0 ? (
            <p className="text-gray-500 italic">
              {activeTab === "candidates" && "ไม่มีคำถามจากแชตที่พบบ่อย"}
              {activeTab === "ignored" && "ไม่มีคำถามที่ซ่อนไว้"}
            </p>
          ) : (
            <div className="space-y-4">
              {filteredCandidates.map(renderCandidateItem)}
            </div>
          )}
        </div>
      )}

      {activeTab === "rejected" && (
        <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <p className="text-lg sm:text-xl font-bold">FAQ ที่ถูกปฏิเสธ</p>
              <button
                onClick={() => setShowHelpModal(true)}
                className="text-gray-400 hover:text-blue-600 transition"
                title="วิธีใช้งาน FAQ ที่ถูกปฏิเสธ"
              >
                <FaQuestionCircle className="w-5 h-5" />
              </button>
            </div>
          </div>
          {isArchivedLoading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : filteredArchivedFAQs.length === 0 && filteredRejectedCandidates.length === 0 ? (
            <p className="text-gray-500 italic">ยังไม่มี FAQ ที่ถูกปฏิเสธ</p>
          ) : (
            <Accordion type="single" collapsible className="space-y-4">
              {/* Archived FAQs Section */}
              {filteredArchivedFAQs.map((faq) => (
                <AccordionItem key={faq.FAQId} value={faq.FAQId}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between w-full gap-3">
                    <AccordionTrigger className="flex-1 text-left">
                      <div>
                        <p className="text-lg font-bold text-red-600">{faq.Question}</p>
                        <div className="flex items-center gap-3 text-sm text-gray-500">
                          <span>ถาม {faq.UsageCount} ครั้ง</span>
                          {faq.Category?.Name && (
                            <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs">
                              {faq.Category.Name}
                            </span>
                          )}
                          <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs">
                            เคยอนุมัติ
                          </span>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <div className="flex flex-nowrap shrink-0 items-center gap-2 pr-0 sm:pr-4 mb-3">
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-green-600 text-green-600 hover:bg-green-50 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRestoreFAQ(faq.FAQId);
                        }}
                      >
                        <FaUndo className="mr-1" /> นำกลับมาใช้
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-red-800 text-red-800 hover:bg-red-50 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteFAQ(faq.FAQId);
                        }}
                      >
                        <FaTrash className="mr-1" /> ลบ
                      </Button>
                    </div>
                  </div>
                  <AccordionContent>
                    <div className="pt-4">
                      <p className="text-gray-700 whitespace-pre-wrap">{faq.Answer}</p>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}

              {/* Rejected Candidates Section */}
              {filteredRejectedCandidates.map((candidate) => (
                <AccordionItem key={candidate.FAQCandidateId} value={candidate.FAQCandidateId}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between w-full gap-3">
                    <AccordionTrigger className="flex-1 text-left">
                      <div>
                        <p className="text-lg font-bold text-red-600">{candidate.Title || candidate.NormalizedQuestion}</p>
                        <div className="flex items-center gap-3 text-sm text-gray-500">
                          <span>ถาม {candidate.AskCount} ครั้ง</span>
                          <span className={`px-3 py-1 rounded text-sm font-semibold ${candidate.Channel === "WEB" ? "bg-purple-100 text-purple-700" : "bg-orange-100 text-orange-700"
                            }`}>
                            {candidate.Channel === "WEB" ? "เว็บไซต์" : "LINE"}
                          </span>
                          {candidate.ReviewNotes && (
                            <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-xs">
                              มีเหตุผลปฏิเสธ
                            </span>
                          )}
                          <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs">
                            ยังไม่อนุมัติ
                          </span>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <div className="flex flex-nowrap shrink-0 items-center gap-2 pr-0 sm:pr-4 mb-3">
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-blue-600 text-blue-600 hover:bg-blue-50 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRecover(candidate.FAQCandidateId);
                        }}
                      >
                        <FaUndo className="mr-1" /> นำกลับไปรอตรวจสอบ
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-green-600 text-green-600 hover:bg-green-50 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          openReviewModal(candidate);
                        }}
                      >
                        <FaCheck className="mr-1" /> อนุมัติ
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-red-800 text-red-800 hover:bg-red-50 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(candidate.FAQCandidateId);
                        }}
                      >
                        <FaTrash className="mr-1" /> ลบ
                      </Button>
                    </div>
                  </div>
                  <AccordionContent>
                    <div className="pt-4 space-y-3">
                      {candidate.Title && candidate.OriginalQuestion !== candidate.Title && (
                        <div>
                          <p className="text-sm font-semibold text-gray-700 mb-1">ตัวอย่างคำถามจริง:</p>
                          <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded">{candidate.OriginalQuestion}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-semibold text-gray-700 mb-1">คำตอบของบอต:</p>
                        <div className="text-gray-700 whitespace-pre-wrap bg-gray-50 p-3 rounded border border-gray-200">
                          {formatMessageText(candidate.BotAnswer)}
                        </div>
                      </div>
                      {candidate.ReviewNotes && (
                        <div className="p-3 bg-amber-100 rounded-lg border-l-4 border-amber-500">
                          <p className="text-sm font-semibold text-amber-800 mb-1">
                            📝 เหตุผลที่ปฏิเสธ:
                          </p>
                          <p className="text-sm text-amber-700">
                            {candidate.ReviewNotes}
                          </p>
                        </div>
                      )}
                      <div className="text-xs text-gray-500 pt-2">
                        ถามครั้งแรก: {formatDate(candidate.FirstAskedAt)} | ถามล่าสุด: {formatDate(candidate.LastAskedAt)}
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </div>
      )}

      {/* Approved FAQs Tab */}
      {activeTab === "approved" && (
        <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
          <div className="flex justify-between items-center mb-4">
            <p className="text-lg sm:text-xl font-bold">FAQ</p>
            <Link href="/management/faq/addfaq">
              <Button className="bg-blue-600 hover:bg-blue-700 text-xs sm:text-sm">
                <FaPlusCircle className="mr-2" /> เพิ่ม FAQ ด้วยตนเอง
              </Button>
            </Link>
          </div>

          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : filteredFAQs.length === 0 ? (
            <p className="text-gray-500 italic">ยังไม่มี FAQ</p>
          ) : (
            <Accordion type="single" collapsible className="space-y-4">
              {filteredFAQs.map((faq) => (
                <AccordionItem key={faq.FAQId} value={faq.FAQId}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between w-full gap-3">
                    <AccordionTrigger className="flex-1 text-left">
                      <div>
                        <p className="text-lg font-bold">{faq.Question}</p>
                        <div className="flex items-center gap-3 text-sm text-gray-500">
                          <span>ใช้งาน {faq.UsageCount} ครั้ง</span>
                          {faq.Category?.Name && (
                            <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs">
                              {faq.Category.Name}
                            </span>
                          )}
                        </div>
                      </div>
                    </AccordionTrigger>
                    <div className="flex flex-nowrap shrink-0 items-center gap-2 pr-0 sm:pr-4 mb-3">
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-gray-600 text-gray-600 hover:bg-gray-50 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          setViewAnswerFAQ(faq);
                        }}
                      >
                        <Eye className="mr-1 h-3 w-3" /> ดูเต็ม
                      </Button>
                      <Link href={`/management/faq/editfaq?id=${faq.FAQId}`}>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-blue-600 text-blue-600 hover:bg-blue-50 text-xs"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <FaEdit className="mr-1" /> แก้ไข
                        </Button>
                      </Link>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-red-600 text-red-600 hover:bg-red-50 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleArchiveFAQ(faq.FAQId);
                        }}
                      >
                        <FaTimes className="mr-1" /> ปฏิเสธ
                      </Button>
                    </div>
                  </div>
                  <AccordionContent>
                    <div className="whitespace-pre-wrap leading-relaxed">{formatMessageText(faq.Answer)}</div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </div>
      )}

      {/* Review Modal */}
      <Dialog open={!!reviewCandidate} onOpenChange={(open: boolean) => !open && closeReviewModal()}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>เลือกให้เป็นคำถามที่พบบ่อย</DialogTitle>
          </DialogHeader>
          {reviewCandidate && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-2">คำถามต้นฉบับ</label>
                <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
                  {reviewCandidate.OriginalQuestion}
                </p>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">คำถาม (แก้ไขได้)</label>
                <Textarea
                  value={editedQuestion}
                  onChange={(e) => setEditedQuestion(e.target.value)}
                  rows={3}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">คำตอบ (แก้ไขได้)</label>
                <Textarea
                  value={editedAnswer}
                  onChange={(e) => setEditedAnswer(e.target.value)}
                  rows={6}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">หมวดหมู่ (ไม่บังคับ)</label>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="เลือกหมวดหมู่" />
                  </SelectTrigger>
                  <SelectContent>
                    {faqCategories.filter(cat => cat.id !== 0).map((cat) => (
                      <SelectItem key={cat.id} value={cat.name}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="bg-blue-50 p-3 rounded">
                <p className="text-sm text-gray-600">
                  <strong>สถิติ:</strong> ถาม {reviewCandidate.AskCount} ครั้ง |
                  ช่องทาง: {reviewCandidate.Channel} |
                  คะแนน: {reviewCandidate.TopScore ? (reviewCandidate.TopScore * 100).toFixed(0) + "%" : "N/A"}
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={closeReviewModal} disabled={isSubmitting}>
              ยกเลิก
            </Button>
            <Button
              onClick={handleApprove}
              disabled={isSubmitting || !editedQuestion.trim() || !editedAnswer.trim()}
              className="bg-green-600 hover:bg-green-700"
            >
              {isSubmitting ? "กำลังบันทึก..." : "เลือกให้เป็นคำถามที่พบบ่อย"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Full Answer Modal */}
      <Dialog open={!!viewAnswerCandidate} onOpenChange={(open: boolean) => !open && closeViewAnswerModal()}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>คำตอบของบอต</DialogTitle>
          </DialogHeader>
          {viewAnswerCandidate && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-2">คำถาม</label>
                <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
                  {viewAnswerCandidate.Title || viewAnswerCandidate.NormalizedQuestion}
                </p>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">คำตอบเต็ม</label>
                <div className="bg-gray-50 p-4 rounded border border-gray-200 whitespace-pre-wrap leading-relaxed">
                  {formatMessageText(viewAnswerCandidate.BotAnswer)}
                </div>
              </div>
              <div className="bg-blue-50 p-3 rounded">
                <p className="text-sm text-gray-600">
                  <strong>สถิติ:</strong> ถาม {viewAnswerCandidate.AskCount} ครั้ง |
                  ช่องทาง: {viewAnswerCandidate.Channel} |
                  คะแนน: {viewAnswerCandidate.TopScore ? (viewAnswerCandidate.TopScore * 100).toFixed(0) + "%" : "N/A"}
                </p>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={closeViewAnswerModal}>
              ปิด
            </Button>
            {activeTab === "candidates" && (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (viewAnswerCandidate) {
                      handleIgnore(viewAnswerCandidate.FAQCandidateId);
                      closeViewAnswerModal();
                    }
                  }}
                  className="border-gray-500 text-gray-600 hover:bg-gray-100"
                >
                  ไม่สนใจ
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (viewAnswerCandidate) {
                      handleReject(viewAnswerCandidate.FAQCandidateId);
                      closeViewAnswerModal();
                    }
                  }}
                  className="border-red-600 text-red-600 hover:bg-red-50"
                >
                  <FaTimes className="mr-1" /> ปฏิเสธ
                </Button>
                <Button
                  onClick={() => {
                    if (viewAnswerCandidate) {
                      openReviewModal(viewAnswerCandidate);
                      closeViewAnswerModal();
                    }
                  }}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <FaCheckCircle className="mr-1" /> เลือกให้เป็น FAQ
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Full FAQ Answer Modal */}
      <Dialog open={!!viewAnswerFAQ} onOpenChange={(open: boolean) => !open && closeViewAnswerFAQModal()}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>คำตอบของ FAQ</DialogTitle>
          </DialogHeader>
          {viewAnswerFAQ && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-2">คำถาม</label>
                <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
                  {viewAnswerFAQ.Question}
                </p>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">คำตอบเต็ม</label>
                <div className="bg-gray-50 p-4 rounded border border-gray-200 whitespace-pre-wrap leading-relaxed">
                  {formatMessageText(viewAnswerFAQ.Answer)}
                </div>
              </div>
              <div className="bg-blue-50 p-3 rounded">
                <p className="text-sm text-gray-600">
                  <strong>สถิติ:</strong> ใช้งาน {viewAnswerFAQ.UsageCount} ครั้ง
                  {viewAnswerFAQ.CategoryId && ` | หมวดหมู่: ${viewAnswerFAQ.CategoryId}`}
                </p>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={closeViewAnswerFAQModal}>
              ปิด
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Help Modal */}
      <Dialog open={showHelpModal} onOpenChange={(open: boolean) => setShowHelpModal(open)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FaQuestionCircle className="text-blue-600" />
              {activeTab === "candidates" && "วิธีใช้งาน: จัดการคำถามจากแชตที่พบบ่อย"}
              {activeTab === "rejected" && "วิธีใช้งาน: แท็บปฏิเสธแล้ว"}
              {activeTab === "ignored" && "วิธีใช้งาน: แท็บซ่อนชั่วคราว"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {activeTab === "candidates" && (
              <>
                <p className="text-sm text-gray-600">
                  คำถามที่ผู้ใช้ถามบอตบ่อย ๆ จะถูกบันทึกไว้ในหน้านี้ เพื่อให้คุณสามารถเลือกจัดการได้ตามความเหมาะสม
                </p>

                <div className="space-y-3">
                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <div className="flex items-center gap-2 mb-2">
                      <FaCheckCircle className="text-green-600" />
                      <h3 className="font-semibold text-green-800">เลือกเป็น FAQ (อนุมัติ)</h3>
                    </div>
                    <p className="text-sm text-gray-700">
                      เมื่อกดเลือก คำถามและคำตอบจะถูกบันทึกเป็น FAQ อย่างเป็นทางการ
                      เมื่อผู้ใช้ถามคำถามนี้อีกครั้ง บอตจะใช้คำตอบที่บันทึกไว้ตอบทันที
                      และยังคงนับจำนวนครั้งที่ถูกถามต่อไป
                    </p>
                  </div>

                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-gray-600 font-semibold">ไม่สนใจ (ซ่อนชั่วคราว)</span>
                    </div>
                    <p className="text-sm text-gray-700">
                      คำถามจะถูกซ่อนไปชั่วคราว แต่ระบบยังคงนับจำนวนครั้งที่ถูกถามต่อไป
                      หากมีผู้ใช้ถามคำถามนี้อีกครั้ง คำถามจะกลับมาแสดงในหน้ารอตรวจสอบอีกครั้ง
                    </p>
                  </div>

                  <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                    <div className="flex items-center gap-2 mb-2">
                      <FaTimes className="text-red-600" />
                      <h3 className="font-semibold text-red-800">ปฏิเสธ</h3>
                    </div>
                    <p className="text-sm text-gray-700">
                      คำถามจะถูกย้ายไปยังแท็บ &quot;ปฏิเสธแล้ว&quot; และจะไม่ถูกนำมาใช้ในการตอบคำถามอีก
                      แต่ระบบจะยังคงนับจำนวนครั้งที่ถูกถามต่อไป (สามารถนำกลับมาได้ในภายหลัง)
                    </p>
                  </div>

                  <div className="bg-red-100 p-4 rounded-lg border border-red-300">
                    <div className="flex items-center gap-2 mb-2">
                      <FaTrash className="text-red-700" />
                      <h3 className="font-semibold text-red-900">ลบ</h3>
                    </div>
                    <p className="text-sm text-gray-700">
                      <b>คำถามจะถูกลบออกจากฐานข้อมูลอย่างถาวร และไม่สามารถถูกกู้คืนได้</b>
                      <br></br>
                      <br></br>
                      สถิติทั้งหมดสะสมมาจะถูกลบทิ้งอย่างหมดจด และจะไม่เด้งกลับมาในหน้ารอตรวจสอบอีก
                      <br></br>
                      <br></br>
                      คำถามนี้จะกลับมาแสดงให้เห็นเป็นคำถามใหม่ เริ่มนับ 1 ใหม่ทั้งหมด ก็ต่อเมื่อ <b>"มีผู้ใช้พิมพ์เข้ามาถามบอตอีกครั้ง"</b> เท่านั้น
                    </p>
                  </div>
                </div>
              </>
            )}

            {activeTab === "rejected" && (
              <>
                <p className="text-sm text-gray-600">
                  คำถามที่ถูกปฏิเสธ และคำถามที่ถูกนำออกจากการเป็น FAQ จะอยู่ที่นี่
                </p>

                <div className="space-y-3">
                  <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                    <div className="flex items-center gap-2 mb-2">
                      <FaTimes className="text-red-600" />
                      <h3 className="font-semibold text-red-800">1. การลบ "คำถามที่ถูกปฏิเสธ (ยังไม่อนุมัติ)"</h3>
                    </div>
                    <p className="text-sm text-gray-700">
                      นี่คือคำถามจากแชทที่เคยถูกคุณกดปฏิเสธมาจากหน้ารอตรวจสอบ
                      <br></br>
                      หากคุณกดปุ่ม <b>"ลบ"</b> ในส่วนนี้...
                      <br />
                      <span className="text-red-600 font-semibold">• สถิติและประวัติการถามสะสมทั้งหมดของคำถามนี้จะถูกทำลบทิ้งอย่างถาวร </span>
                      <br />
                      • คำถามนี้จะหายไปจากระบบจนกว่าจะมีผู้ใช้งานพิมพ์ถามเข้ามาใหม่เท่านั้น
                      <br></br>
                      • ใช้เมื่อคุณต้องการลบประวัติคำถามนี้ หรือต้องการคำตอบใหม่หากมีผู้ใช้พิมพ์เข้ามาถามบอตอีกครั้ง
                    </p>
                  </div>

                  <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                    <div className="flex items-center gap-2 mb-2">
                      <FaArchive className="text-orange-600" />
                      <h3 className="font-semibold text-orange-800">2. การลบ "FAQ ที่ถูกนำออก" (เคยอนุมัติ)</h3>
                    </div>
                    <p className="text-sm text-gray-700">
                      นี่คือคำถามที่เคยได้รับการอนุมัติเป็น FAQ ไปแล้ว แต่ต่อมาถูกสั่งปิดการใช้งาน
                      <br></br>
                      หากคุณกดปุ่ม <b>"ลบ"</b> ในส่วนนี้...
                      <br />
                      <span className="text-orange-600 font-semibold">• จะเป็นการทำลายแค่ตัว "คำตอบ FAQ" นั้นทิ้งเท่านั้น และคำถาม-คำตอบเดิมจะกลับไปอยู่ในหน้ารอตรวจสอบ</span>
                      <br />
                      • คุณสามารถตัดสินใจได้ใหม่ว่า จะค้างคำถามนี้ไว้ในหน้าตรวจสอบเพื่อดูสถิติ, แต่งคำตอบ FAQ ใหม่, พิจารณาอนุมัติคำถามนี้ใหม่ หรือจะกดลบสถิติประวัติของคำถามนั้นทิ้ง (กดปฏิเสธ จากนั้นกดลบ)
                    </p>
                  </div>
                </div>
              </>
            )}

            {activeTab === "ignored" && (
              <>
                <p className="text-sm text-gray-600">
                  คำถามที่ถูกปฏิเสธด้วยตัวเลือก &quot;ไม่สนใจ&quot; จะถูกย้ายมาที่นี่ชั่วคราว
                </p>

                <div className="space-y-3">
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-gray-600 font-semibold">การทำงานของแท็บซ่อนชั่วคราว</span>
                    </div>
                    <p className="text-sm text-gray-700">
                      คำถามที่ถูกซ่อนจะไม่แสดงในแท็บรอตรวจสอบ แต่ระบบยังคงติดตามจำนวนครั้งที่ถูกถาม
                      หากมีผู้ใช้ถามคำถามนี้อีกครั้ง คำถามจะกลับไปแสดงในแท็บรอตรวจสอบอีกครั้ง
                    </p>
                  </div>

                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <div className="flex items-center gap-2 mb-2">
                      <FaArchive className="text-blue-600" />
                      <h3 className="font-semibold text-blue-800">การจัดการคำถามที่ถูกซ่อน</h3>
                    </div>
                    <p className="text-sm text-gray-700">
                      คุณสามารถนำคำถามที่ถูกซ่อนกลับไปตรวจสอบได้ หรือลบถาวรหากไม่ต้องการรักษาไว้
                      คำถามที่ถูกถามซ้ำจะกลับมาแสดงในแท็บรอตรวจสอบโดยอัตโนมัติ
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setShowHelpModal(false)} className="bg-blue-600 hover:bg-blue-700">
              เข้าใจแล้ว
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Modal */}
      <Dialog open={showRejectModal} onOpenChange={setShowRejectModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>ปฏิเสธคำถาม</DialogTitle>
            <DialogDescription>
              เพิ่มบันทึกช่วยจำเหตุผลที่ปฏิเสธคำถามนี้ (ไม่จำเป็น)
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="เหตุผลที่ปฏิเสธ..."
              value={rejectNotes}
              onChange={(e) => setRejectNotes(e.target.value)}
              className="min-h-[100px]"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRejectModal(false)}
            >
              ยกเลิก
            </Button>
            <Button
              variant="destructive"
              onClick={confirmReject}
            >
              ปฏิเสธ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
