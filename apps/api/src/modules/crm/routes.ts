import { Router } from "express";
import { z } from "zod";
import { pipelineStages, type PipelineStage } from "@laborforce/shared";
import { requireAuth, type AuthedRequest } from "../../middleware/auth.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { HttpError } from "../../utils/http.js";
import { usersRepository } from "../users/repository.js";
import { crmRepository } from "./repository.js";
import { enqueueCrmFollowUpReminder } from "../../queues/reminders.js";

export const crmRouter = Router();

crmRouter.get("/pipeline", requireAuth, asyncHandler(async (req: AuthedRequest, res) => {
  const user = await usersRepository.findById(req.userId ?? "");
  if (!user) {
    throw new HttpError(404, "User not found.");
  }

  const contacts = await crmRepository.listByOwner(user.id);

  res.json({
    stages: pipelineStages.map((stage) => ({
      stage,
      items: contacts.filter((contact) => contact.pipelineStage === stage)
    }))
  });
}));

crmRouter.get("/", requireAuth, asyncHandler(async (req: AuthedRequest, res) => {
  const user = await usersRepository.findById(req.userId ?? "");
  if (!user) {
    throw new HttpError(404, "User not found.");
  }

  res.json({
    items: await crmRepository.listByOwner(user.id)
  });
}));

crmRouter.post("/", requireAuth, asyncHandler(async (req: AuthedRequest, res) => {
  const user = await usersRepository.findById(req.userId ?? "");
  if (!user) {
    throw new HttpError(404, "User not found.");
  }

  const payload = z.object({
    contactName: z.string().trim().min(2).max(120),
    contactPhone: z.string().trim().max(40).optional().nullable(),
    contactEmail: z.string().email().optional().nullable(),
    notes: z.string().trim().max(1200).optional().nullable(),
    pipelineStage: z.enum(pipelineStages as [PipelineStage, ...PipelineStage[]]).default("Lead"),
    projectValue: z.number().min(0).max(100000000).optional().nullable(),
    lastContactAt: z.string().datetime().optional().nullable(),
    followUpAt: z.string().datetime().optional().nullable(),
    tags: z.array(z.string().trim().min(1).max(40)).optional()
  }).parse(req.body);

  const contact = await crmRepository.create({
    ownerId: user.id,
    ...payload
  });

  if (contact.followUpAt) {
    await enqueueCrmFollowUpReminder({
      userId: user.id,
      contactId: contact.id,
      contactName: contact.contactName,
      dueAt: contact.followUpAt
    });
  }

  res.status(201).json({
    contact,
    message: "CRM contact created."
  });
}));

crmRouter.patch("/:contactId", requireAuth, asyncHandler(async (req: AuthedRequest, res) => {
  const { contactId } = z.object({
    contactId: z.string().uuid()
  }).parse(req.params);

  const user = await usersRepository.findById(req.userId ?? "");
  if (!user) {
    throw new HttpError(404, "User not found.");
  }

  const payload = z.object({
    contactName: z.string().trim().min(2).max(120),
    contactPhone: z.string().trim().max(40).optional().nullable(),
    contactEmail: z.string().email().optional().nullable(),
    notes: z.string().trim().max(1200).optional().nullable(),
    pipelineStage: z.enum(pipelineStages as [PipelineStage, ...PipelineStage[]]),
    projectValue: z.number().min(0).max(100000000).optional().nullable(),
    lastContactAt: z.string().datetime().optional().nullable(),
    followUpAt: z.string().datetime().optional().nullable(),
    followUpSent: z.boolean(),
    tags: z.array(z.string().trim().min(1).max(40)).optional()
  }).parse(req.body);

  const contact = await crmRepository.update(contactId, user.id, payload);
  if (!contact) {
    throw new HttpError(404, "CRM contact not found.");
  }

  if (contact.followUpAt && !contact.followUpSent) {
    await enqueueCrmFollowUpReminder({
      userId: user.id,
      contactId: contact.id,
      contactName: contact.contactName,
      dueAt: contact.followUpAt
    });
  }

  res.json({
    contact,
    message: "CRM contact updated."
  });
}));
