"use client";

import React, { useMemo, useState } from "react";
import Rating from "@/components/Rating";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useMutation } from "@tanstack/react-query";
import axios, { isAxiosError } from "axios";
import { useRouter } from "next/navigation";
import {
  FEEDBACK_CATEGORIES,
  type FeedbackCategoryId,
} from "@/constants/feedbackCategories";

const createInitialCategoryRatings = (): Record<FeedbackCategoryId, number> =>
  FEEDBACK_CATEGORIES.reduce(
    (acc, category) => {
      acc[category.id] = 0;
      return acc;
    },
    {} as Record<FeedbackCategoryId, number>
  );

export default function FeedbackForm() {
  const [overallRating, setOverallRating] = useState(0);
  const [categoryRatings, setCategoryRatings] = useState<
    Record<FeedbackCategoryId, number>
  >(createInitialCategoryRatings);
  const [additionalComment, setAdditionalComment] = useState("");
  const router = useRouter();
  const hasUnratedCategory = useMemo(
    () => FEEDBACK_CATEGORIES.some((category) => categoryRatings[category.id] <= 0),
    [categoryRatings]
  );

  const { mutateAsync: submitFeedback, isPending } = useMutation({
    mutationFn: (data: {
      overallRating: number;
      categoryRatings: Array<{ category: FeedbackCategoryId; rating: number }>;
      additionalComment: string;
      source: "WEBSITE";
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
      source: "WEBSITE" as const,
    };

    try {
      const res = await submitFeedback(payload);
      console.log("OK", res.data);
      alert("ประเมินความพึงพอใจสำเร็จ");
      router.push("/");
    } catch (err: unknown) {
      console.error("RAW ERROR:", err);
      if (isAxiosError(err)) {
        alert(
          (err.response?.data as any)?.error ??
            `ส่งไม่สำเร็จ (${err.response?.status ?? "ERR"})`
        );
        return;
      }
      alert("มีข้อผิดพลาดภายในระบบ");
    }
  };

  return (
    <div className="flex flex-col justify-center items-center gap-y-10 m-10">
      <h1 className="text-3xl font-bold text-center text-blueit">
        กรุณาแบ่งปันความคิดเห็นหรือข้อเสนอแนะของคุณกับเรา
      </h1>

      <div className="flex flex-col justify-center items-center">
        <p className="text-lg mb-3">คะแนนความพึงพอใจภาพรวม</p>
        <Rating value={overallRating} onChange={setOverallRating} size={40} />
      </div>

      <div className="w-full flex flex-col gap-y-6">
        <div>
          <p className="mb-3">กรุณาให้คะแนนแต่ละด้าน</p>
          <div className="flex flex-col gap-y-3 pl-4 md:pl-6 max-w-4xl">
            {FEEDBACK_CATEGORIES.map((item, index) => (
              <React.Fragment key={item.id}>
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-8 py-0.5">
                  <p className="font-medium text-sm md:text-base">{item.name}</p>
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
                  <div className="h-px bg-gray-300/70 my-2" />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-3">ข้อเสนอแนะเพิ่มเติม</p>
          <Textarea
            placeholder="ข้อเสนอแนะเพิ่มเติม"
            className="w-full min-h-[120px]"
            value={additionalComment}
            onChange={(e) => setAdditionalComment(e.target.value)}
          />
        </div>

        <div className="flex justify-end">
          <Button
            className="bg-blueit hover:bg-blueit/90"
            onClick={handleSubmit}
            disabled={isPending || overallRating <= 0 || hasUnratedCategory}
          >
            ยืนยัน
          </Button>
        </div>
      </div>
    </div>
  );
}
