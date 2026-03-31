import { Router } from "express";
import { z } from "zod";
import { requireAuth, type AuthedRequest } from "../../middleware/auth.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { HttpError } from "../../utils/http.js";
import { demoSocial } from "../../utils/demoData.js";
import { usersRepository } from "../users/repository.js";
import { socialRepository } from "./repository.js";

export const socialRouter = Router();

socialRouter.get("/feed", asyncHandler(async (req, res) => {
  const limit = z.coerce.number().int().min(1).max(50).default(25).parse(req.query.limit ?? 25);
  const posts = await socialRepository.list(limit);

  res.json({
    audience: "everyone",
    reactions: ["Respect", "Impressed", "Helpful"],
    items: posts.length > 0 ? posts : demoSocial
  });
}));

socialRouter.post("/feed", requireAuth, asyncHandler(async (req: AuthedRequest, res) => {
  const payload = z.object({
    postText: z.string().trim().min(3).max(1200),
    photoUrls: z.array(z.string().url()).max(4).optional(),
    videoUrl: z.string().url().optional().nullable(),
    isProofWall: z.boolean().optional(),
    tradeTag: z.string().trim().min(2).max(60).optional(),
    locationDisplay: z.string().trim().min(2).max(120).optional()
  }).parse(req.body);

  const user = await usersRepository.findById(req.userId ?? "");
  if (!user) {
    throw new HttpError(404, "User not found.");
  }

  if (!user.isVerified) {
    throw new HttpError(403, "Only verified users can post to the feed.");
  }

  const post = await socialRepository.create({
    authorId: user.id,
    postText: payload.postText,
    photoUrls: payload.photoUrls,
    videoUrl: payload.videoUrl,
    isProofWall: payload.isProofWall,
    tradeTag: payload.tradeTag ?? user.tradeType ?? user.userTag,
    locationDisplay: payload.locationDisplay ?? user.zipCode
  });

  res.status(201).json({
    post
  });
}));
