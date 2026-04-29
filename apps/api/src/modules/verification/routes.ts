import { Router } from "express";
import { z } from "zod";
import { requireAuth, type AuthedRequest } from "../../middleware/auth.js";
import { HttpError } from "../../utils/http.js";
import { integrations } from "../../services/integrations.js";
import { usersRepository } from "../users/repository.js";
import { env } from "../../config/env.js";

export const verificationRouter = Router();

function requireAdminKey(req: AuthedRequest) {
  if (!env.ADMIN_API_KEY) {
    throw new HttpError(503, "Admin verification is not configured.");
  }

  if (req.header("x-admin-api-key") !== env.ADMIN_API_KEY) {
    throw new HttpError(401, "Invalid admin API key.");
  }
}

verificationRouter.get("/status", (_req, res) => {
  res.json({
    personaReady: integrations.persona.ready,
    flow: integrations.persona.describeVerificationFlow(),
    statuses: ["pending", "verified", "failed", "manual_review"]
  });
});

verificationRouter.post("/business/complete", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    if (env.NODE_ENV === "production") {
      throw new HttpError(403, "Use the admin business approval endpoint in production.");
    }

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

verificationRouter.post("/admin/business/:userId/approve", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    requireAdminKey(req);

    const { userId } = z.object({
      userId: z.string().uuid()
    }).parse(req.params);

    const payload = z.object({
      businessName: z.string().trim().min(2).max(120).optional().nullable()
    }).parse(req.body);

    const user = await usersRepository.findById(userId);
    if (!user) {
      throw new HttpError(404, "User not found.");
    }

    if (user.userTag !== "employer") {
      throw new HttpError(403, "Only employer accounts can receive business verification.");
    }

    const verifiedUser = await usersRepository.completeBusinessVerification(user.id, {
      businessName: payload.businessName ?? user.businessName ?? null
    });

    if (!verifiedUser) {
      throw new HttpError(404, "User not found.");
    }

    res.json({
      user: verifiedUser,
      mode: "manual_admin_review",
      message: "Business verification approved."
    });
  } catch (error) {
    next(error);
  }
});

verificationRouter.post("/admin/users/:userId/approve", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    requireAdminKey(req);

    const { userId } = z.object({
      userId: z.string().uuid()
    }).parse(req.params);

    const user = await usersRepository.findById(userId);
    if (!user) {
      throw new HttpError(404, "User not found.");
    }

    const verifiedUser =
      user.userTag === "employer"
        ? await usersRepository.completeBusinessVerification(user.id, {
            businessName: user.businessName ?? null
          })
        : await usersRepository.completeAccountVerification(user.id);

    if (!verifiedUser) {
      throw new HttpError(404, "User not found.");
    }

    res.json({
      user: verifiedUser,
      mode: "manual_admin_review",
      message: "Account verification approved."
    });
  } catch (error) {
    next(error);
  }
});
