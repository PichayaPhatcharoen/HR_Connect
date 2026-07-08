"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { IoMdSearch } from "react-icons/io";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { faqCategories } from "@/constants/faqcategories";

// Dynamically import Select components to avoid hydration mismatch
const Select = dynamic(() => import("@/components/ui/select").then(mod => ({ default: mod.Select })), { ssr: false });
const SelectContent = dynamic(() => import("@/components/ui/select").then(mod => ({ default: mod.SelectContent })), { ssr: false });
const SelectItem = dynamic(() => import("@/components/ui/select").then(mod => ({ default: mod.SelectItem })), { ssr: false });
const SelectTrigger = dynamic(() => import("@/components/ui/select").then(mod => ({ default: mod.SelectTrigger })), { ssr: false });
const SelectValue = dynamic(() => import("@/components/ui/select").then(mod => ({ default: mod.SelectValue })), { ssr: false });

type FAQ = {
  FAQId: string;
  Question: string;
  Answer: string;
  CategoryId: string | null;
  Category?: { Name: string } | null;
  UsageCount: number;
};

const Page = () => {
  const getFaqs = async (): Promise<FAQ[]> => {
    const res = await axios.get("/api/faq");
    return res.data;
  };

  const {
    data: faqs = [],
    isLoading,
  } = useQuery<FAQ[]>({
    queryKey: ["faqs"],
    queryFn: getFaqs,
  });

  const [displayQuestionAnswer, setDisplayQuestionAnswer] = useState<FAQ[]>([]);
  const [viewFAQ, setViewFAQ] = useState<FAQ | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ทั้งหมด");

  useEffect(() => {
    if (faqs.length > 0) setDisplayQuestionAnswer(faqs);
  }, [faqs]);

  useEffect(() => {
    if (faqs.length === 0) return;

    const filtered = faqs.filter((item) => {
      const matchSearch =
        item.Question.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.Answer.toLowerCase().includes(searchTerm.toLowerCase());

      const matchCategory =
        selectedCategory === "ทั้งหมด" ||
        item.Category?.Name === selectedCategory;

      return matchSearch && matchCategory;
    });

    setDisplayQuestionAnswer(filtered);
  }, [faqs, searchTerm, selectedCategory]);

  const formatMessageText = (text: string) => {
    const lines = text.split("\n");
    return lines.map((line, i) => {
      const formattedLine = line.split(/\*\*(.+?)\*\*/g).map((part, j) =>
        j % 2 === 1 ? <strong key={j}>{part}</strong> : part
      );

      return (
        <span key={i}>
          {formattedLine}
          {i < lines.length - 1 && <br />}
        </span>
      );
    });
  };

  return (
    <div className="px-6 py-10 w-full max-w-7xl mx-auto bg-white min-h-[85vh] rounded-2xl flex flex-col gap-y-6">
      
      {/* Header */}
      <div className="flex flex-col gap-y-1 mb-6">
        <h1 className="text-3xl sm:text-4xl font-bold text-blue-600">
          รายการคำถามที่พบบ่อย (FAQ)
        </h1>
        <p className="text-black text-base sm:text-lg font-bold">
          คณะเทคโนโลยีสารสนเทศ
          <br />
          สถาบันเทคโนโลยีพระจอมเกล้าเจ้าคุณทหารลาดกระบัง
        </p>
      </div>

      {/* Search + Filter */}
      <div className="w-full flex flex-col md:flex-row gap-4 md:gap-6 justify-between">
        
        {/* Left side (search + select) */}
        <div className="flex flex-col md:flex-row gap-4 w-full">
          
          {/* Search */}
          <div className="relative w-full md:w-80">
            <Input
              placeholder="ค้นหาคำถามหรือคำตอบ..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-10 pr-10"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500">
              <IoMdSearch size={20} />
            </div>
          </div>

          {/* Category */}
          <div className="w-full md:w-64">
            {typeof window !== 'undefined' ? (
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-full h-10">
                  <SelectValue placeholder="เลือกหมวดหมู่" />
                </SelectTrigger>
                <SelectContent>
                  {faqCategories.map((item) => (
                    <SelectItem key={item.id} value={item.name}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="w-full h-10 border border-gray-300 rounded-md px-3 py-2 text-sm bg-white">
                เลือกหมวดหมู่
              </div>
            )}
          </div>
        </div>

        {/* Right side button */}
        <Link href="/faq-list">
          <Button className="h-10 bg-blue-600 hover:bg-blue-700 text-white w-full md:w-auto">
            ดูรายการคำถามทั้งหมด
          </Button>
        </Link>
      </div>

      {/* FAQ List */}
      <div className="w-full">
        <div className="flex items-center justify-between mb-4">
          <p className="text-lg md:text-xl font-bold">คำถามที่พบบ่อย</p>
          <p className="text-sm text-gray-500">
            {displayQuestionAnswer.length} คำถาม
          </p>
        </div>

        <hr className="mb-4" />

        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : displayQuestionAnswer.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg">ไม่พบคำถามที่ค้นหา</p>
          </div>
        ) : (
          <div className="space-y-3">
            {displayQuestionAnswer.map((item) => (
              <div
                key={item.FAQId}
                className="border rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow p-4 sm:p-6"
              >
                <div className="flex items-start sm:items-center justify-between gap-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-1">
                    <p className="text-base sm:text-lg md:text-xl font-bold text-gray-900">
                      {item.Question}
                    </p>

                    {item.Category?.Name && (
                      <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-medium whitespace-nowrap">
                        {item.Category.Name}
                      </span>
                    )}
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    className="border-blue-600 text-blue-600 hover:bg-blue-50 text-xs sm:text-sm"
                    onClick={() => setViewFAQ(item)}
                  >
                    <Eye className="mr-1 h-4 w-4" />
                    ดูรายละเอียด
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      <Dialog open={!!viewFAQ} onOpenChange={(open) => !open && setViewFAQ(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl sm:text-2xl">
              คำถามที่พบบ่อย
            </DialogTitle>
          </DialogHeader>

          {viewFAQ && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-2">
                  คำถาม
                </label>
                <p className="text-lg font-bold">{viewFAQ.Question}</p>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">
                  คำตอบ
                </label>
                <div className="bg-gray-50 p-4 rounded border text-gray-700">
                  {formatMessageText(viewFAQ.Answer)}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setViewFAQ(null)}>
              ปิด
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Page;