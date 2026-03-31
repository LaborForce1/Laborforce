import { Router } from "express";
import { integrations } from "../../services/integrations.js";

export const verificationRouter = Router();

verificationRouter.get("/status", (_req, res) => {
  res.json({
    personaReady: integrations.persona.ready,
    flow: integrations.persona.describeVerificationFlow(),
    statuses: ["pending", "verified", "failed", "manual_review"]
  });
});

