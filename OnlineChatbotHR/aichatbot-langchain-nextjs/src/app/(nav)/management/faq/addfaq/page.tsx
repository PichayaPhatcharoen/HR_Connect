'use client';

import { FormEvent, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { faqCategories } from '@/constants/faqcategories';

export default function AddFAQPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [category, setCategory] = useState<string>('ทั้งหมด');
  const [customCategory, setCustomCategory] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fromUnanswerable, setFromUnanswerable] = useState(false);

  // ดึงข้อมูลล่วงหน้าจาก query parameters (กรณีมาจากคำถามที่ตอบไม่ได้)
  useEffect(() => {
    const questionParam = searchParams.get('question');
    const suggestedAnswerParam = searchParams.get('suggestedAnswer');
    const fromParam = searchParams.get('from');
    
    if (questionParam) {
      setQuestion(decodeURIComponent(questionParam));
    }
    if (suggestedAnswerParam) {
      setAnswer(decodeURIComponent(suggestedAnswerParam));
    }
    if (fromParam === 'unanswerable') {
      setFromUnanswerable(true);
    }
  }, [searchParams]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    if (!question.trim() || !answer.trim()) {
      setErrorMessage('กรุณากรอกคำถามและคำตอบให้ครบถ้วน');
      return;
    }

    if (category === 'อื่นๆ' && !customCategory.trim()) {
      setErrorMessage('กรุณาระบุชื่อหมวดหมู่ใหม่');
      return;
    }

    const confirmed = window.confirm('ยืนยันการบันทึกข้อมูลหรือไม่?');
    if (!confirmed) return;

    setIsSubmitting(true);
    try {
      const finalCategory = category === 'อื่นๆ' ? customCategory.trim() : category;
      
      const response = await fetch('/api/faq', {
        method: 'POST',
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
        throw new Error(data?.error || 'Failed to save FAQ');
      }

      window.alert('บันทึกข้อมูลเรียบร้อย');
      if (fromUnanswerable) {
        router.push('/management/chat-history?tab=unanswerable');
      } else {
        router.push('/management/faq#approved');
      }
      router.refresh();
    } catch (error) {
      console.error('Failed to save FAQ:', error);
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
            เพิ่มคำถามที่พบบ่อย (FAQ)
          </h1>
          <p className="text-gray-700 text-lg font-semibold">
            คณะเทคโนโลยีสารสนเทศ
            <br />
            สถาบันเทคโนโลยีพระจอมเกล้าเจ้าคุณทหารลาดกระบัง
          </p>
          {fromUnanswerable && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                💡 ข้อมูลถูกนำมาจากคำถามที่ตอบไม่ได้ - กรุณาตรวจสอบและแก้ไขคำตอบให้เหมาะสม
              </p>
            </div>
          )}
        </div>

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
              className="w-full p-3 rounded-md border-2 border-gray-300 focus:border-blue-500 focus:outline-none h-32 resize-none"
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
            <Link href={fromUnanswerable ? "/management/chat-history?tab=unanswerable" : "/management/faq#approved"}>
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
      </div>
    </div>

  );
}
