import { Router } from "express";
import { z } from "zod";
import { requireAuth, type AuthedRequest } from "../../middleware/auth.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { HttpError } from "../../utils/http.js";
import { usersRepository } from "./repository.js";
import { ensureUserCoordinates, lookupUsZipCode } from "../../services/locationLookup.js";

export const usersRouter = Router();

usersRouter.get("/me", requireAuth, asyncHandler(async (req: AuthedRequest, res) => {
  const user = await usersRepository.findById(req.userId ?? "");
  if (!user) {
    throw new HttpError(404, "User not found.");
  }

  res.json(await ensureUserCoordinates(user));
}));

usersRouter.get("/", asyncHandler(async (_req, res) => {
  res.json(await usersRepository.list());
}));

usersRouter.patch("/me", requireAuth, asyncHandler(async (req: AuthedRequest, res) => {
  const payload = z.object({
    fullName: z.string().trim().min(2).max(120),
    zipCode: z.string().trim().min(5).max(10),
    tradeType: z.string().trim().max(80).optional().nullable(),
    businessName: z.string().trim().max(120).optional().nullable(),
    bio: z.string().trim().max(600).optional().nullable(),
    yearsExperience: z.number().int().min(0).max(80).optional().nullable(),
    hourlyRate: z.number().min(0).max(1000).optional().nullable(),
    unionStatus: z.string().trim().max(120).optional().nullable(),
    openToWork: z.boolean(),
    profilePhotoUrl: z.string().url().optional().nullable()
  }).parse(req.body);

  const resolvedLocation = lookupUsZipCode(payload.zipCode);
  if (!resolvedLocation) {
    throw new HttpError(400, "Enter a valid US ZIP code.");
  }

  const user = await usersRepository.updateProfile(req.userId ?? "", {
    ...payload,
    zipCode: resolvedLocation.zipCode,
    latitude: resolvedLocation.latitude,
    longitude: resolvedLocation.longitude
  });
  if (!user) {
    throw new HttpError(404, "User not found.");
  }

  res.json({
    user,
    message: "Profile updated."
  });
}));
