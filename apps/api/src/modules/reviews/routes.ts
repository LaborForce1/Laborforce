import { Router } from "express";
import { z } from "zod";
import { requireAuth, type AuthedRequest } from "../../middleware/auth.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { HttpError } from "../../utils/http.js";
import { usersRepository } from "../users/repository.js";
import { reviewsRepository } from "./repository.js";

export const reviewsRouter = Router();

reviewsRouter.get("/trust-badges", (_req, res) => {
  res.json({
    bands: [
      { badge: "Gold Verified", range: "4.5 - 5.0" },
      { badge: "Trusted", range: "4.0 - 4.4" },
      { badge: "Established", range: "3.0 - 3.9" },
      { badge: "Under Review", range: "< 3.0" }
    ]
  });
});

reviewsRouter.get(
  "/received/:userId",
  asyncHandler(async (req, res) => {
    const { userId } = z.object({
      userId: z.string().uuid()
    }).parse(req.params);

    const user = await usersRepository.findById(userId);
    if (!user) {
      throw new HttpError(404, "User not found.");
    }

    res.json({
      user: {
        id: user.id,
        fullName: user.fullName,
        ratingAverage: user.ratingAverage,
        ratingCount: user.ratingCount,
        trustBadge: user.trustBadge
      },
      items: await reviewsRepository.listReceivedByUser(userId)
    });
  })
);

reviewsRouter.post(
  "/",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const payload = z.object({
      reviewedUserId: z.string().uuid(),
      rating: z.number().int().min(1).max(5),
      reviewText: z.string().trim().max(600).optional().nullable(),
      reviewType: z.string().trim().min(2).max(80),
      relatedJobId: z.string().uuid().optional().nullable(),
      relatedQcPostId: z.string().uuid().optional().nullable()
    }).parse(req.body);

    const reviewer = await usersRepository.findById(req.userId ?? "");
    if (!reviewer) {
      throw new HttpError(404, "User not found.");
    }

    const reviewedUser = await usersRepository.findById(payload.reviewedUserId);
    if (!reviewedUser) {
      throw new HttpError(404, "Reviewed user not found.");
    }

    if (reviewer.id === reviewedUser.id) {
      throw new HttpError(400, "You cannot review yourself.");
    }

    const review = await reviewsRepository.create({
      reviewerId: reviewer.id,
      reviewedUserId: reviewedUser.id,
      rating: payload.rating,
      reviewText: payload.reviewText ?? null,
      reviewType: payload.reviewType,
      relatedJobId: payload.relatedJobId ?? null,
      relatedQcPostId: payload.relatedQcPostId ?? null
    });

    res.status(201).json({
      review,
      message: "Review submitted."
    });
  })
);
