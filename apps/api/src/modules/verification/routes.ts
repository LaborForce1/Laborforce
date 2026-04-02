import { Router } from "express";
import { z } from "zod";
import { requireAuth, type AuthedRequest } from "../../middleware/auth.js";
import { HttpError } from "../../utils/http.js";
import { integrations } from "../../services/integrations.js";
import { usersRepository } from "../users/repository.js";

export const verificationRouter = Router();

verificationRouter.get("/status", (_req, res) => {
  res.json({
    personaReady: integrations.persona.ready,
    flow: integrations.persona.describeVerificationFlow(),
    statuses: ["pending", "verified", "failed", "manual_review"]
  });
});

verificationRouter.post("/business/complete", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
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
  } catch (error) {
    next(error);
  }
});
