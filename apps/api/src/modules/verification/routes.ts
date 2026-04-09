import { Router } from "express";
import { z } from "zod";
import { requireAuth, type AuthedRequest } from "../../middleware/auth.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { HttpError } from "../../utils/http.js";
import { integrations } from "../../services/integrations.js";
import { usersRepository } from "../users/repository.js";
import { verificationRepository } from "./repository.js";

export const verificationRouter = Router();

verificationRouter.get("/status", (_req, res) => {
  res.json({
    personaReady: integrations.persona.ready,
    flow: integrations.persona.describeVerificationFlow(),
    statuses: ["pending", "verified", "failed", "manual_review"]
  });
});

verificationRouter.get("/me", requireAuth, asyncHandler(async (req: AuthedRequest, res) => {
  const summary = await verificationRepository.findSummaryByUserId(req.userId ?? "");
  if (!summary) {
    throw new HttpError(404, "User not found.");
  }

  const nextSteps: string[] = [];

  if (summary.userTag === "employer") {
    if (!summary.businessName?.trim()) {
      nextSteps.push("Add your business name.");
    }
    if (!summary.businessLicenseUrl) {
      nextSteps.push("Add a business license document URL.");
    }
    if (!summary.einNumberLast4) {
      nextSteps.push("Add your EIN.");
    }
    if (!summary.isBusinessVerified) {
      nextSteps.push(
        integrations.persona.ready
          ? "Complete the Persona business verification flow."
          : "Use development-mode verification until Persona is connected."
      );
    }
  } else if (!summary.isVerified) {
    nextSteps.push("Complete identity verification.");
  }

  res.json({
    personaReady: integrations.persona.ready,
    mode: integrations.persona.ready ? "persona_connected" : "development_simulation",
    summary,
    nextSteps
  });
}));

verificationRouter.post("/business/start", requireAuth, asyncHandler(async (req: AuthedRequest, res) => {
  const payload = z.object({
    businessName: z.string().trim().min(2).max(120).optional().nullable(),
    businessLicenseUrl: z.string().url().optional().nullable(),
    einNumber: z.string().trim().min(4).max(32).optional().nullable()
  }).parse(req.body);

  const user = await usersRepository.findById(req.userId ?? "");
  if (!user) {
    throw new HttpError(404, "User not found.");
  }

  if (user.userTag !== "employer") {
    throw new HttpError(403, "Only employers can start business verification.");
  }

  const summary = await verificationRepository.startBusinessVerification(user.id, {
    businessName: payload.businessName ?? user.businessName ?? null,
    businessLicenseUrl: payload.businessLicenseUrl ?? null,
    einNumber: payload.einNumber ?? null
  });

  if (!summary) {
    throw new HttpError(404, "User not found.");
  }

  res.json({
    personaReady: integrations.persona.ready,
    mode: integrations.persona.ready ? "persona_connected" : "development_simulation",
    summary,
    message: integrations.persona.ready
      ? "Business verification details saved. Hand off to Persona next."
      : "Business verification details saved. Use development-mode completion until Persona is connected."
  });
}));

verificationRouter.post("/business/complete", requireAuth, asyncHandler(async (req: AuthedRequest, res) => {
  const payload = z.object({
    businessName: z.string().trim().min(2).max(120).optional().nullable()
  }).parse(req.body);

  const user = await usersRepository.findById(req.userId ?? "");
  if (!user) {
    throw new HttpError(404, "User not found.");
  }

  if (user.userTag !== "employer") {
    throw new HttpError(403, "Only employers can complete business verification.");
  }

  const verifiedUser = await usersRepository.completeBusinessVerification(user.id, {
    businessName: payload.businessName ?? user.businessName ?? null
  });

  if (!verifiedUser) {
    throw new HttpError(404, "User not found.");
  }

  res.json({
    user: verifiedUser,
    personaReady: integrations.persona.ready,
    mode: integrations.persona.ready ? "persona_connected" : "development_simulation",
    message: integrations.persona.ready
      ? "Business verification completed with Persona."
      : "Business verification completed in development mode."
  });
}));
