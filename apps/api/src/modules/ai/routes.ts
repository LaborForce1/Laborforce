import { Router } from "express";
import { z } from "zod";
import { integrations } from "../../services/integrations.js";

export const aiRouter = Router();

aiRouter.post("/chat", (req, res) => {
  const payload = z.object({
    userId: z.string(),
    tradeType: z.string().optional(),
    businessName: z.string().optional(),
    message: z.string().min(1)
  }).parse(req.body);

  const systemPrompt = [
    "You are the LaborForce AI assistant.",
    `Trade context: ${payload.tradeType ?? "general trades"}.`,
    `Business context: ${payload.businessName ?? "independent operator"}.`,
    "Help with invoices, quotes, service agreements, follow-ups, pricing, and profile improvements."
  ].join(" ");

  res.json({
    providerReady: integrations.ai.openaiReady || integrations.ai.anthropicReady,
    conversationId: `ai_chat_${payload.userId}`,
    systemPrompt,
    reply: `Draft prepared for ${payload.tradeType ?? "trade"} workflow: ${payload.message}`
  });
});

