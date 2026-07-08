'use client';

import { FormEvent, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { faqCategories } from '@/constants/faqcategories';

type FAQ = {
  id: string;
  question: string;
  answer: string;
  category: string;
  usageCount: number;
};

export default function EditFAQPage() {
  const searchParams = useSearchParams();
  const idParam = searchParams.get("id");
  const router = useRouter();
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [category, setCategory] = useState<string>('ทั้งหมด');
  const [customCategory, setCustomCategory] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchFAQ = async () => {
      if (!idParam) {
        setLoadError("ไม่พบคำถามที่ต้องการแก้ไข");
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const res = await fetch(`/api/faq/${idParam}`);
        if (res.status === 404) {
          setLoadError("ไม่พบข้อมูลคำถามที่เลือก");
          return;
        }
        if (!res.ok) {
          throw new Error("Failed to fetch FAQ");
        }
        const data: FAQ = await res.json();

        setQuestion(data.question);
        setAnswer(data.answer);
        const foundCategory = faqCategories.find(cat => cat.name === data.category);
        setCategory(foundCategory ? foundCategory.name : 'ทั้งหมด');
        setLoadError(null);
      } catch (err) {
        console.error("Failed to load FAQ item:", err);
        setLoadError("ไม่สามารถโหลดข้อมูลคำถามได้");
      } finally {
        setIsLoading(false);
      }
    };

    fetchFAQ();
  }, [idParam]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    if (!idParam) {
      setErrorMessage("ไม่พบคำถามที่ต้องการแก้ไข");
      return;
    }

    if (!question.trim() || !answer.trim()) {
      setErrorMessage('กรุณากรอกคำถามและคำตอบให้ครบถ้วน');
      return;
    }

    if (category === 'อื่นๆ' && !customCategory.trim()) {
      setErrorMessage('กรุณาระบุชื่อหมวดหมู่ใหม่');
      return;
    }

    const confirmed = window.confirm('ยืนยันการบันทึกการแก้ไขหรือไม่?');
    if (!confirmed) return;

    setIsSubmitting(true);
    try {
      const finalCategory = category === 'อื่นๆ' ? customCategory.trim() : category;
      
      const response = await fetch(`/api/faq/${idParam}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          question: question.trim(), 
          answer: answer.trim(),
          category: finalCategory || 'ทั้งหมด',
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setErrorMessage(data?.error || 'ไม่สามารถบันทึกข้อมูลได้');
        return;
      }

      window.alert('บันทึกข้อมูลเรียบร้อย');
      router.push('/management/faq#approved');
      router.refresh();
    } catch (error) {
      console.error('Failed to update FAQ:', error);
      setErrorMessage('ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-md p-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-blueit mb-2">
            แก้ไขคำถามที่พบบ่อย (FAQ)
          </h1>
          <p className="text-gray-700 text-lg font-semibold">
            คณะเทคโนโลยีสารสนเทศ
            <br />
            สถาบันเทคโนโลยีพระจอมเกล้าเจ้าคุณทหารลาดกระบัง
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : loadError ? (
          <div className="text-center py-12">
            <p className="text-red-500 text-lg">{loadError}</p>
            <Link href="/management/faq">
              <button className="mt-4 bg-gray-300 text-black hover:bg-gray-400 px-6 py-3 rounded-xl font-semibold">
                ย้อนกลับ
              </button>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="question" className="block text-lg font-semibold mb-2">
                คำถาม <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="question"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="กรอกคำถาม"
                className="w-full p-3 rounded-md border-2 border-gray-300 focus:border-blue-500 focus:outline-none"
                disabled={isSubmitting}
                required
              />
            </div>

            <div>
              <label htmlFor="answer" className="block text-lg font-semibold mb-2">
                คำตอบ <span className="text-red-500">*</span>
              </label>
              <textarea
                id="answer"
                value={answer}
                onChange={(event) => setAnswer(event.target.value)}
                placeholder="กรอกคำตอบ"
                className="w-full p-3 rounded-md border-2 border-gray-300 focus:border-blue-500 focus:outline-none min-h-[300px] resize-y"
                disabled={isSubmitting}
                required
              />
            </div>

            <div>
              <label className="block text-lg font-semibold mb-2">
                หมวดหมู่
              </label>
              <div className="relative">
                <select
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value);
                    if (e.target.value !== 'อื่นๆ') {
                      setCustomCategory('');
                    }
                  }}
                  className="w-full p-3 pr-12 rounded-md border-2 border-gray-300 focus:border-blue-500 focus:outline-none bg-white appearance-none"
                  disabled={isSubmitting}
                >
                  {faqCategories.map((cat) => (
                    <option key={cat.id} value={cat.name}>
                      {cat.name}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-500">
                  ▼
                </span>
              </div>
              
              {category === 'อื่นๆ' && (
                <div className="mt-3">
                  <input
                    type="text"
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    placeholder="ระบุชื่อหมวดหมู่ใหม่"
                    className="w-full p-3 rounded-md border-2 border-blue-300 focus:border-blue-500 focus:outline-none"
                    disabled={isSubmitting}
                  />
                  <p className="text-sm text-gray-500 mt-1">หมวดหมู่ใหม่จะถูกสร้างและบันทึกในระบบ</p>
                </div>
              )}
            </div>

            {errorMessage && (
              <p className="text-sm text-red-600">{errorMessage}</p>
            )}

            <div className="pt-4 flex items-center justify-between">
              <Link href="/management/faq#approved">
                <button
                  type="button"
                  className="bg-gray-300 text-black hover:bg-gray-400 px-6 py-3 rounded-xl font-semibold disabled:opacity-50"
                  disabled={isSubmitting}
                >
                  ย้อนกลับ
                </button>
              </Link>

              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  className="bg-blueit text-white hover:bg-blue-800 px-6 py-3 rounded-xl font-semibold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isSubmitting}
                  aria-busy={isSubmitting}
                >
                  {isSubmitting && (
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  )}
                  {isSubmitting ? "กำลังบันทึก" : "บันทึก"}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
