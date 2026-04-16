import { Router } from "express";
import { z } from "zod";
import { requireAuth, type AuthedRequest } from "../../middleware/auth.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { HttpError } from "../../utils/http.js";
import { jobsRepository } from "./repository.js";
import { usersRepository } from "../users/repository.js";
import { authService } from "../../services/authService.js";
import { ensureUserCoordinates, hasCoordinates, lookupUsZipCode } from "../../services/locationLookup.js";

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
      if (user) {
        user = await ensureUserCoordinates(user);
      }
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
    locationZip: z.string().min(5).max(10),
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

  const resolvedLocation = lookupUsZipCode(payload.locationZip);
  if (!resolvedLocation) {
    throw new HttpError(400, "Enter a valid US ZIP code for the job location.");
  }

  const job = await jobsRepository.create({
    employerId: user.id,
    ...payload,
    locationZip: resolvedLocation.zipCode,
    latitude: resolvedLocation.latitude,
    longitude: resolvedLocation.longitude
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

  if (!hasCoordinates(job.latitude, job.longitude)) {
    const resolvedLocation = lookupUsZipCode(job.locationZip);
    if (!resolvedLocation) {
      throw new HttpError(400, "Add a valid US ZIP code to this draft before publishing it.");
    }

    await jobsRepository.updateLocationForEmployer(jobId, user.id, {
      locationZip: resolvedLocation.zipCode,
      latitude: resolvedLocation.latitude,
      longitude: resolvedLocation.longitude
    });
  }

  const publishedJob = await jobsRepository.publishDraft(jobId);

  res.json({
    job: publishedJob,
    paymentMode: "development_simulation",
    message: "Draft published. Replace this with a Stripe deposit confirmation in production."
  });
}));

jobsRouter.patch("/:jobId", requireAuth, asyncHandler(async (req: AuthedRequest, res) => {
  const { jobId } = z.object({
    jobId: z.string().uuid()
  }).parse(req.params);

  const payload = z.object({
    jobTitle: z.string(),
    tradeCategory: z.string(),
    description: z.string(),
    hourlyRateMin: z.number(),
    hourlyRateMax: z.number(),
    jobType: z.string(),
    benefits: z.string().optional(),
    countyLocation: z.string().min(2),
    locationZip: z.string().min(5).max(10),
    unionRequired: z.boolean().optional(),
    certificationsRequired: z.array(z.string()).optional()
  }).parse(req.body);

  const user = await usersRepository.findById(req.userId ?? "");
  if (!user) {
    throw new HttpError(404, "User not found.");
  }

  if (user.userTag !== "employer") {
    throw new HttpError(403, "Only employers can edit job listings.");
  }

  const resolvedLocation = lookupUsZipCode(payload.locationZip);
  if (!resolvedLocation) {
    throw new HttpError(400, "Enter a valid US ZIP code for the job location.");
  }

  const updatedJob = await jobsRepository.updateForEmployer(jobId, user.id, {
    ...payload,
    locationZip: resolvedLocation.zipCode,
    latitude: resolvedLocation.latitude,
    longitude: resolvedLocation.longitude
  });
  if (!updatedJob) {
    throw new HttpError(404, "Job not found for this employer.");
  }

  res.json({
    job: updatedJob,
    message: "Job updated."
  });
}));

jobsRouter.patch("/:jobId/status", requireAuth, asyncHandler(async (req: AuthedRequest, res) => {
  const { jobId } = z.object({
    jobId: z.string().uuid()
  }).parse(req.params);

  const payload = z.object({
    status: z.enum(["filled", "closed"])
  }).parse(req.body);

  const user = await usersRepository.findById(req.userId ?? "");
  if (!user) {
    throw new HttpError(404, "User not found.");
  }

  if (user.userTag !== "employer") {
    throw new HttpError(403, "Only employers can manage job status.");
  }

  const updatedJob = await jobsRepository.updateStatusForEmployer(jobId, user.id, payload.status);
  if (!updatedJob) {
    throw new HttpError(404, "Job not found for this employer.");
  }

  res.json({
    job: updatedJob,
    message: `Job marked as ${payload.status}.`
  });
}));
