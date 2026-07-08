"use client";

import React, { useEffect } from "react";
import Rating from "@/components/Rating";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useMutation } from "@tanstack/react-query";
import axios, { isAxiosError } from "axios";
import { useRouter } from "next/navigation";
import {
  FEEDBACK_CATEGORIES,
  type FeedbackCategoryId,
} from "@/constants/feedbackCategories";

type LiffProfile = {
  userId: string;
  displayName: string;
  pictureUrl?: string;
};

const createInitialCategoryRatings = (): Record<FeedbackCategoryId, number> =>
  FEEDBACK_CATEGORIES.reduce(
    (acc, category) => {
      acc[category.id] = 0;
      return acc;
    },
    {} as Record<FeedbackCategoryId, number>
  );

const FeedbackPage = () => {
  const [overallRating, setOverallRating] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [profile, setProfile] = useState<LiffProfile | null>(null);
  const router = useRouter();
  const [categoryRatings, setCategoryRatings] = useState<
    Record<FeedbackCategoryId, number>
  >(createInitialCategoryRatings);
  const [additionalComment, setAdditionalComment] = useState("");
  const hasUnratedCategory = useMemo(
    () => FEEDBACK_CATEGORIES.some((category) => categoryRatings[category.id] <= 0),
    [categoryRatings]
  );

  const { mutateAsync: submitFeedback, isPending } = useMutation({
    mutationFn: (data: {
      overallRating: number;
      categoryRatings: Array<{ category: FeedbackCategoryId; rating: number }>;
      additionalComment: string;
      userId?: string;
      displayName?: string;
      pictureUrl?: string;
      source: "LINE";
    }) => axios.post("/api/feedback", data),
  });

  const handleSubmit = async () => {
    if (overallRating <= 0) {
      alert("กรุณาให้คะแนนภาพรวม");
      return;
    }

    const unratedCategory = FEEDBACK_CATEGORIES.find(
      (category) => categoryRatings[category.id] <= 0
    );
    if (unratedCategory) {
      alert(`กรุณาให้คะแนนด้าน "${unratedCategory.name}"`);
      return;
    }

    const payload = {
      overallRating: Number(overallRating),
      categoryRatings: FEEDBACK_CATEGORIES.map((category) => ({
        category: category.id,
        rating: Number(categoryRatings[category.id]),
      })),
      additionalComment,
      userId: profile?.userId,
      displayName: profile?.displayName,
      pictureUrl: profile?.pictureUrl,
      source: "LINE" as const,
    };

    try {
      const res = await submitFeedback(payload);
      console.log("OK", res.data);
      alert("ประเมินความพึงพอใจสำเร็จ");
      router.push("/");
    } catch (err: unknown) {
      console.error("RAW ERROR:", err);

      if (isAxiosError(err)) {
        console.error("AXIOS FAIL (handleSubmit)", {
          status: err.response?.status,
          data: err.response?.data,
          message: err.message,
          url: err.config?.url,
          method: err.config?.method,
        });
        alert(
          err.response?.data?.error ??
          `ส่งไม่สำเร็จ (${err.response?.status ?? "ERR"})`
        );
        return;
      }

      alert("มีข้อผิดพลาดภายในระบบ");
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        const { default: liff } = await import("@line/liff");
        await liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID2 || "" });

        if (!liff.isLoggedIn()) {
          liff.login({
            redirectUri: `${window.location.origin}/feedbackform`
          });
          return;
        }

        const p = await liff.getProfile();
        setProfile(p as LiffProfile);
      } catch (err) {
        console.error("LIFF init error:", err);
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, []);

  if (isLoading || profile === null) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-white">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="h-12 md:h-16 bg-blueit" />

      <main className="px-4 md:px-6 py-8 md:py-10">
        <div className="mx-auto w-full max-w-[700px] bg-white rounded-2xl p-5 md:p-6 shadow-lg">
          <h1 className="text-2xl md:text-3xl font-extrabold text-blueit mb-5">
            แบบประเมินความพึงพอใจ
          </h1>
          <p className="text-gray-700 mb-6">
              สวัสดีคุณ{" "}
              <span className="font-semibold">
                {profile?.displayName ?? ""}
              </span>
            </p>

          <div className="flex flex-col gap-y-6">
            <section className="flex flex-col items-center">
              <p className="text-base md:text-lg mb-3 font-semibold text-black text-center">
                คะแนนความพึงพอใจภาพรวม
              </p>
              <div className="flex items-center justify-center gap-4">
                <Rating
                  value={overallRating}
                  onChange={setOverallRating}
                  size={40}
                />
              </div>
            </section>

            <section>
              <p className="mb-3 font-semibold text-black">กรุณาให้คะแนนแต่ละด้าน</p>
              <div className="flex flex-col gap-y-3 pl-1 md:pl-2">
                {FEEDBACK_CATEGORIES.map((item, index) => (
                  <React.Fragment key={item.id}>
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 md:gap-x-8 py-1">
                      <p className="font-medium text-sm md:text-base text-gray-800">
                        {item.name}
                      </p>
                      <div className="justify-self-start">
                        <Rating
                          value={categoryRatings[item.id]}
                          onChange={(value) =>
                            setCategoryRatings((prev) => ({
                              ...prev,
                              [item.id]: value,
                            }))
                          }
                          size={30}
                        />
                      </div>
                    </div>
                    {index < FEEDBACK_CATEGORIES.length - 1 && (
                      <div className="h-px bg-gray-200 my-1.5" />
                    )}
                  </React.Fragment>
                ))}
              </div>
            </section>

            <section>
              <p className="mb-3 font-semibold text-black">ข้อเสนอแนะเพิ่มเติม</p>
              <Textarea
                placeholder="พิมพ์ข้อเสนอแนะเพิ่มเติมของคุณ..."
                className="w-full min-h-[140px] md:min-h-[160px] resize-y"
                value={additionalComment}
                onChange={(e) => setAdditionalComment(e.target.value)}
              />
            </section>

            <div className="flex justify-end pt-2">
              <Button
                className="rounded-full bg-blueit hover:bg-blueit/90 px-6 py-2 font-medium shadow text-white"
                onClick={handleSubmit}
                disabled={isPending || overallRating <= 0 || hasUnratedCategory}
              >
                ยืนยัน
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default FeedbackPage;
