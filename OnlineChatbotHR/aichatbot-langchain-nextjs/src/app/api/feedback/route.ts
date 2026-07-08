import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { FeedbackSource } from "@prisma/client";
import {
  FEEDBACK_CATEGORIES,
  type FeedbackCategoryId,
} from "@/constants/feedbackCategories";

const isValidRating = (rating: number): boolean =>
  Number.isInteger(rating) && rating >= 1 && rating <= 5;

const isFeedbackSource = (value: unknown): value is FeedbackSource =>
  value === "WEBSITE" || value === "LINE";

const FEEDBACK_CATEGORY_IDS = new Set<FeedbackCategoryId>(
  FEEDBACK_CATEGORIES.map((category) => category.id)
);
const isFeedbackCategory = (value: unknown): value is FeedbackCategoryId =>
  typeof value === "string" &&
  FEEDBACK_CATEGORY_IDS.has(value as FeedbackCategoryId);

export async function POST(request: NextRequest) {
  try {
    const {
      overallRating,
      categoryRatings,
      additionalComment,
      userId,
      source,
      displayName,
      pictureUrl,
    } = await request.json();

    if (!isValidRating(Number(overallRating))) {
      return NextResponse.json(
        { error: "overallRating must be an integer between 1 and 5" },
        { status: 400 }
      );
    }

    if (!Array.isArray(categoryRatings) || categoryRatings.length === 0) {
      return NextResponse.json(
        { error: "categoryRatings is required" },
        { status: 400 }
      );
    }

    const normalizedSource: FeedbackSource = isFeedbackSource(source)
      ? source
      : "WEBSITE";

    const parsedRatings = categoryRatings.map((item) => {
      const category = item?.category;
      const rating = Number(item?.rating);

      if (!isFeedbackCategory(category) || !isValidRating(rating)) {
        throw new Error("INVALID_CATEGORY_RATING");
      }

      return { category, rating };
    });

    const scoreMap = parsedRatings.reduce((acc, item) => {
      acc[item.category] = item.rating;
      return acc;
    }, {} as Partial<Record<FeedbackCategoryId, number>>);

    const requiredCategories: FeedbackCategoryId[] = [
      "DATA_ACCURACY",
      "RESPONSE_TIME",
      "DOCUMENT_ACCESSIBILITY",
      "SERVICE_QUALITY",
      "CHANNEL_USABILITY",
    ];
    const missingCategory = requiredCategories.find(
      (category) => !isValidRating(Number(scoreMap[category]))
    );
    if (missingCategory) {
      return NextResponse.json(
        { error: `Missing or invalid score for ${missingCategory}` },
        { status: 400 }
      );
    }

    let lineUserIdToSave: string | null = null;

    if (typeof userId === "string" && userId.trim().length > 0) {
      try {
        await prisma.lineFriends.upsert({
          where: { LineUserId: userId },
          create: {
            LineUserId: userId,
            DisplayName:
              typeof displayName === "string" && displayName.trim().length > 0
                ? displayName
                : "LINE User",
            PictureUrl:
              typeof pictureUrl === "string" && pictureUrl.trim().length > 0
                ? pictureUrl
                : null,
          },
          update: {
            DisplayName:
              typeof displayName === "string" && displayName.trim().length > 0
                ? displayName
                : undefined,
            PictureUrl:
              typeof pictureUrl === "string" && pictureUrl.trim().length > 0
                ? pictureUrl
                : undefined,
            IsActive: true,
            BlockedAt: null,
          },
        });
        lineUserIdToSave = userId;
      } catch (err) {
        console.error("[/api/feedback] upsert LineFriends failed, saving anonymous:", err);
        lineUserIdToSave = null;
      }
    }

    await prisma.feedbacks.create({
      data: {
        Rating: Number(overallRating),
        Comment: additionalComment || null,
        LineUserId: lineUserIdToSave,
        Source: normalizedSource,
        DataAccuracyScore: scoreMap.DATA_ACCURACY!,
        ResponseTimeScore: scoreMap.RESPONSE_TIME!,
        DocumentAccessScore: scoreMap.DOCUMENT_ACCESSIBILITY!,
        ServiceQualityScore: scoreMap.SERVICE_QUALITY!,
        ChannelUsabilityScore: scoreMap.CHANNEL_USABILITY!,
      },
    });

    return NextResponse.json({
      message: "Feedback submitted successfully",
      overallRating: Number(overallRating),
      savedRows: 1,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "INVALID_CATEGORY_RATING") {
      return NextResponse.json(
        { error: "Invalid category or rating in categoryRatings" },
        { status: 400 }
      );
    }

    console.error("[/api/feedback] ERROR:", err);
    const code =
      typeof err === "object" && err !== null && "code" in err
        ? (err as { code: string }).code as string
        : undefined;

    if (code === "P2025") {
      return NextResponse.json({ error: "Record to connect not found" }, { status: 404 });
    }
    if (code === "P2003") {
      return NextResponse.json({ error: "Foreign key constraint failed" }, { status: 409 });
    }
    if (code === "P1001") {
      return NextResponse.json({ error: "DB connection failed (P1001)" }, { status: 503 });
    }

    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const limit = request.nextUrl.searchParams.get("limit");
  const feedbacks = await prisma.feedbacks.findMany({
    take: limit ? parseInt(limit, 10) : undefined,
    orderBy: { CreatedAt: "desc" },
  });
  return NextResponse.json(
    feedbacks.map((item) => ({
      id: item.FeedbackId,
      rating: item.Rating,
      comment: item.Comment,
      createdAt: item.CreatedAt,
      source: item.Source,
      dataAccuracyScore: item.DataAccuracyScore,
      responseTimeScore: item.ResponseTimeScore,
      documentAccessScore: item.DocumentAccessScore,
      serviceQualityScore: item.ServiceQualityScore,
      channelUsabilityScore: item.ChannelUsabilityScore,
    }))
  );
}