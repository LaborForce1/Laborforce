import { Router } from "express";
import { z } from "zod";
import { requireAuth, type AuthedRequest } from "../../middleware/auth.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { HttpError } from "../../utils/http.js";
import { jobsRepository } from "./repository.js";
import { usersRepository } from "../users/repository.js";
import { authService } from "../../services/authService.js";

export const jobsRouter = Router();

jobsRouter.get("/mine", requireAuth, asyncHandler(async (req: AuthedRequest, res) => {
  const user = await usersRepository.findById(req.userId ?? "");
  if (!user) {
    throw new HttpError(404, "User not found.");
  }

  if (user.userTag !== "employer") {
    throw new HttpError(403, "Only employers can view their private job list.");
  }

  res.json({
    items: await jobsRepository.listByEmployer(user.id)
  });
}));

jobsRouter.get("/", asyncHandler(async (req, res) => {
  const limit = z.coerce.number().int().min(1).max(100).default(25).parse(req.query.limit ?? 25);
  const radiusMiles = z.coerce.number().int().min(10).max(100).default(50).parse(req.query.radiusMiles ?? 50);
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  let user = null;

  if (token) {
    try {
      const payload = authService.verifyAccessToken(token);
      user = await usersRepository.findById(payload.sub);
    } catch {
      user = null;
    }
  }

  res.json({
    radiusMiles,
    items: await jobsRepository.listActive({
      limit,
      radiusMiles,
      origin:
        user?.latitude !== null && user?.latitude !== undefined && user?.longitude !== null && user?.longitude !== undefined
          ? {
              latitude: user.latitude,
              longitude: user.longitude
            }
          : null
    })
  });
}));

jobsRouter.post("/", requireAuth, asyncHandler(async (req: AuthedRequest, res) => {
  const payload = z.object({
    jobTitle: z.string(),
    tradeCategory: z.string(),
    description: z.string(),
    hourlyRateMin: z.number(),
    hourlyRateMax: z.number(),
    jobType: z.string(),
    benefits: z.string().optional(),
    countyLocation: z.string().min(2),
    isSurge: z.boolean().optional(),
    unionRequired: z.boolean().optional(),
    certificationsRequired: z.array(z.string()).optional()
  }).parse(req.body);

  const user = await usersRepository.findById(req.userId ?? "");
  if (!user) {
    throw new HttpError(404, "User not found.");
  }

  if (user.userTag !== "employer") {
    throw new HttpError(403, "Only employers can create job listings.");
  }

  const job = await jobsRepository.create({
    employerId: user.id,
    ...payload
  });

  res.status(201).json({
    job,
    nextStep: user.isBusinessVerified
      ? "Draft saved. Publish when you are ready to make it visible."
      : "Draft saved. Complete business verification before publishing it."
  });
}));

jobsRouter.post("/:jobId/publish", requireAuth, asyncHandler(async (req: AuthedRequest, res) => {
  const { jobId } = z.object({
    jobId: z.string().uuid()
  }).parse(req.params);

  const user = await usersRepository.findById(req.userId ?? "");
  if (!user) {
    throw new HttpError(404, "User not found.");
  }

  const job = await jobsRepository.findById(jobId);
  if (!job) {
    throw new HttpError(404, "Job not found.");
  }

  if (job.employerId !== user.id) {
    throw new HttpError(403, "You can only publish your own job listings.");
  }

  if (!user.isBusinessVerified) {
    throw new HttpError(403, "Complete business verification before publishing this job.");
  }

  if (job.status !== "draft") {
    throw new HttpError(400, "Only draft jobs can be published.");
  }

  const publishedJob = await jobsRepository.publishDraft(jobId);

  res.json({
    job: publishedJob,
    paymentMode: "development_simulation",
    message: "Draft published. Replace this with a Stripe deposit confirmation in production."
  });
}));
