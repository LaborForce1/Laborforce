import { Router } from "express";
import { z } from "zod";
import { requireAuth, type AuthedRequest } from "../../middleware/auth.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { HttpError } from "../../utils/http.js";
import { usersRepository } from "../users/repository.js";
import { buildConversationId, messagesRepository } from "./repository.js";
import { sendNewMessageSms } from "../../services/messageNotifications.js";

export const messagesRouter = Router();

messagesRouter.get(
  "/",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const user = await usersRepository.findById(req.userId ?? "");
    if (!user) {
      throw new HttpError(404, "User not found.");
    }

    res.json({
      items: await messagesRepository.listConversations(user.id)
    });
  })
);

messagesRouter.get(
  "/conversation/:participantId",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const { participantId } = z.object({
      participantId: z.string().uuid()
    }).parse(req.params);

    const user = await usersRepository.findById(req.userId ?? "");
    if (!user) {
      throw new HttpError(404, "User not found.");
    }

    const participant = await usersRepository.findById(participantId);
    if (!participant) {
      throw new HttpError(404, "Recipient not found.");
    }

    if (!user.isVerified || !participant.isVerified) {
      throw new HttpError(403, "Only verified users can message each other.");
    }

    const conversationId = buildConversationId(user.id, participant.id);
    await messagesRepository.markConversationRead(conversationId, user.id);

    res.json({
      participant,
      conversationId,
      items: await messagesRepository.listThread(conversationId, user.id)
    });
  })
);

messagesRouter.post(
  "/",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const payload = z.object({
      recipientId: z.string().uuid(),
      messageText: z.string().trim().min(1).max(1000),
      attachmentUrl: z.string().url().optional().nullable()
    }).parse(req.body);

    const user = await usersRepository.findById(req.userId ?? "");
    if (!user) {
      throw new HttpError(404, "User not found.");
    }

    const recipient = await usersRepository.findById(payload.recipientId);
    if (!recipient) {
      throw new HttpError(404, "Recipient not found.");
    }

    if (user.id === recipient.id) {
      throw new HttpError(400, "You cannot message yourself.");
    }

    if (!user.isVerified || !recipient.isVerified) {
      throw new HttpError(403, "Only verified users can message each other.");
    }

    const message = await messagesRepository.create(
      user.id,
      recipient.id,
      payload.messageText,
      payload.attachmentUrl
    );

    void sendNewMessageSms({
      toPhone: recipient.phone,
      recipientName: recipient.fullName,
      senderName: user.fullName,
      messageText: payload.messageText
    }).catch((error) => {
      console.error(
        JSON.stringify({
          service: "laborforce-api",
          notification: "sms_failed",
          error: error instanceof Error ? error.message : "Unknown SMS error"
        })
      );
    });

    res.status(201).json({
      message,
      conversationId: message.conversationId
    });
  })
);
