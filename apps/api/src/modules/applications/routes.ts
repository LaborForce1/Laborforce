import { Router } from "express";
import { z } from "zod";
import { requireAuth, type AuthedRequest } from "../../middleware/auth.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { HttpError } from "../../utils/http.js";
import { usersRepository } from "../users/repository.js";
import { jobsRepository } from "../jobs/repository.js";
import { applicationsRepository } from "./repository.js";

export const applicationsRouter = Router();

applicationsRouter.get("/applications/mine", requireAuth, asyncHandler(async (req: AuthedRequest, res) => {
  const user = await usersRepository.findById(req.userId ?? "");
  if (!user) {
    throw new HttpError(404, "User not found.");
  }

  if (user.userTag !== "employee") {
    throw new HttpError(403, "Only employees have personal applications.");
  }

  res.json({
    items: await applicationsRepository.listByApplicant(user.id)
  });
}));

applicationsRouter.get("/applications/employer", requireAuth, asyncHandler(async (req: AuthedRequest, res) => {
  const user = await usersRepository.findById(req.userId ?? "");
  if (!user) {
    throw new HttpError(404, "User not found.");
  }

  if (user.userTag !== "employer") {
    throw new HttpError(403, "Only employers can review incoming applications.");
  }

  res.json({
    items: await applicationsRepository.listForEmployer(user.id)
  });
}));

applicationsRouter.patch("/applications/:applicationId/status", requireAuth, asyncHandler(async (req: AuthedRequest, res) => {
  const { applicationId } = z.object({
    applicationId: z.string().uuid()
  }).parse(req.params);

  const payload = z.object({
    status: z.enum(["viewed", "shortlisted", "rejected", "hired"])
  }).parse(req.body);

  const user = await usersRepository.findById(req.userId ?? "");
  if (!user) {
    throw new HttpError(404, "User not found.");
  }

  if (user.userTag !== "employer") {
    throw new HttpError(403, "Only employers can update applicant statuses.");
  }

  const application = await applicationsRepository.updateStatusForEmployer(applicationId, user.id, payload.status);
  if (!application) {
    throw new HttpError(404, "Application not found for this employer.");
  }

  res.json({
    application,
    message: `Applicant marked as ${payload.status.replaceAll("_", " ")}.`
  });
}));

applicationsRouter.post("/jobs/:jobId/apply", requireAuth, asyncHandler(async (req: AuthedRequest, res) => {
  const { jobId } = z.object({
    jobId: z.string().uuid()
  }).parse(req.params);

  const payload = z.object({
    message: z.string().max(500).optional()
  }).parse(req.body);

  const user = await usersRepository.findById(req.userId ?? "");
  if (!user) {
    throw new HttpError(404, "User not found.");
  }

  if (user.userTag !== "employee") {
    throw new HttpError(403, "Only employees can apply to jobs.");
  }

  const job = await jobsRepository.findById(jobId);
  if (!job) {
    throw new HttpError(404, "Job not found.");
  }

  if (job.status !== "active") {
    throw new HttpError(400, "Only active jobs can accept applications.");
  }

  const existingApplication = await applicationsRepository.findByApplicantAndJob(user.id, jobId);
  if (existingApplication) {
    throw new HttpError(409, "You already applied to this job.");
  }

  const application = await applicationsRepository.create(user.id, jobId, payload.message);

  res.status(201).json({
    application,
    message: "Application submitted."
  });
}));
