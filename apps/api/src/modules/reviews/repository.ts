import type { TrustBadge, UserReview, UserTag } from "@laborforce/shared";
import { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma.js";

export interface CreateReviewInput {
  reviewerId: string;
  reviewedUserId: string;
  rating: number;
  reviewText?: string | null;
  reviewType: string;
  relatedJobId?: string | null;
  relatedQcPostId?: string | null;
}

const reviewSelect = {
  id: true,
  reviewerId: true,
  reviewedUserId: true,
  rating: true,
  reviewText: true,
  reviewType: true,
  relatedJobId: true,
  relatedQcPostId: true,
  reviewerSubmitted: true,
  reviewedSubmitted: true,
  isVisible: true,
  createdAt: true,
  reviewer: {
    select: {
      id: true,
      fullName: true,
      userTag: true,
      tradeType: true,
      businessName: true,
      trustBadge: true
    }
  }
} satisfies Prisma.ReviewSelect;

type ReviewRecord = Prisma.ReviewGetPayload<{ select: typeof reviewSelect }>;

function computeTrustBadge(ratingAverage: number): TrustBadge {
  if (ratingAverage >= 4.5) return "Gold Verified";
  if (ratingAverage >= 4.0) return "Trusted";
  if (ratingAverage >= 3.0) return "Established";
  return "Under Review";
}

function mapReview(row: ReviewRecord): UserReview {
  return {
    id: row.id,
    reviewerId: row.reviewerId,
    reviewedUserId: row.reviewedUserId,
    rating: row.rating,
    reviewText: row.reviewText,
    reviewType: row.reviewType,
    relatedJobId: row.relatedJobId,
    relatedQcPostId: row.relatedQcPostId,
    reviewerSubmitted: row.reviewerSubmitted,
    reviewedSubmitted: row.reviewedSubmitted,
    isVisible: row.isVisible,
    createdAt: row.createdAt.toISOString(),
    reviewer: row.reviewer
      ? {
          id: row.reviewer.id,
          fullName: row.reviewer.fullName,
          userTag: row.reviewer.userTag as UserTag,
          tradeType: row.reviewer.tradeType,
          businessName: row.reviewer.businessName,
          trustBadge: row.reviewer.trustBadge as TrustBadge | null
        }
      : undefined
  };
}

async function refreshUserRating(tx: Prisma.TransactionClient, userId: string) {
  const aggregate = await tx.review.aggregate({
    where: { reviewedUserId: userId },
    _avg: { rating: true },
    _count: { _all: true }
  });

  const ratingAverage = Number(aggregate._avg.rating ?? 0);
  const ratingCount = aggregate._count._all;

  await tx.user.update({
    where: { id: userId },
    data: {
      ratingAverage,
      ratingCount,
      trustBadge: ratingCount > 0 ? computeTrustBadge(ratingAverage) : null
    }
  });
}

export const reviewsRepository = {
  async listReceivedByUser(reviewedUserId: string) {
    const rows = await prisma.review.findMany({
      where: { reviewedUserId, isVisible: true },
      orderBy: { createdAt: "desc" },
      select: reviewSelect
    });

    return rows.map(mapReview);
  },

  async create(input: CreateReviewInput) {
    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.review.create({
        data: {
          reviewerId: input.reviewerId,
          reviewedUserId: input.reviewedUserId,
          rating: input.rating,
          reviewText: input.reviewText ?? null,
          reviewType: input.reviewType,
          relatedJobId: input.relatedJobId ?? null,
          relatedQcPostId: input.relatedQcPostId ?? null,
          reviewerSubmitted: true,
          reviewedSubmitted: false,
          isVisible: true
        },
        select: reviewSelect
      });

      await refreshUserRating(tx, input.reviewedUserId);
      return row;
    });

    return mapReview(created);
  }
};
