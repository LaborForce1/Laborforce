import { Router } from "express";
import type { AlertItem } from "@laborforce/shared";
import { requireAuth, type AuthedRequest } from "../../middleware/auth.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { HttpError } from "../../utils/http.js";
import { usersRepository } from "../users/repository.js";
import { messagesRepository } from "../messages/repository.js";
import { applicationsRepository } from "../applications/repository.js";

export const alertsRouter = Router();

alertsRouter.get("/summary", (_req, res) => {
  res.json({
    applicationResponseWarningHours: 48,
    autoReviewRequestHours: 24,
    overdueCrmInactivityDays: 30
  });
});

alertsRouter.get("/", requireAuth, asyncHandler(async (req: AuthedRequest, res) => {
  const user = await usersRepository.findById(req.userId ?? "");
  if (!user) {
    throw new HttpError(404, "User not found.");
  }

  const items: AlertItem[] = [];
  const conversations = await messagesRepository.listConversations(user.id);

  conversations
    .filter((conversation) => conversation.unreadCount > 0)
    .forEach((conversation) => {
      items.push({
        id: `message-${conversation.conversationId}`,
        type: "message",
        title: `New message from ${conversation.participant.fullName}`,
        body: conversation.latestMessage.messageText,
        createdAt: conversation.latestMessage.sentAt,
        isRead: false,
        actionLabel: "Open chat"
      });
    });

  if (user.userTag === "employer") {
    const incomingApplications = await applicationsRepository.listForEmployer(user.id);

    incomingApplications.forEach((application) => {
      items.push({
        id: `application-${application.id}`,
        type: "application",
        title: `${application.applicant.fullName} applied to ${application.job.jobTitle}`,
        body: application.message?.trim() || `${application.applicant.tradeType ?? "Worker"} is waiting for your response.`,
        createdAt: application.appliedAt,
        isRead: application.employerViewed,
        actionLabel: "Review applicant"
      });
    });
  } else {
    const applications = await applicationsRepository.listByApplicant(user.id);

    applications
      .filter((application) => application.status !== "submitted")
      .forEach((application) => {
        items.push({
          id: `application-${application.id}`,
          type: "application",
          title: `Your application was ${application.status.replaceAll("_", " ")}`,
          body: application.message?.trim() || "Check the Jobs tab for the latest update from the employer.",
          createdAt: application.appliedAt,
          isRead: application.employerViewed,
          actionLabel: "View jobs"
        });
      });
  }

  items.push({
    id: `network-${user.id}`,
    type: "network",
    title: "Grow your trade network",
    body: "Connect with verified workers, employers, and customers so more opportunities find you faster.",
    createdAt: new Date().toISOString(),
    isRead: false,
    actionLabel: "Open profile"
  });

  items.sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());

  res.json({
    unreadCount: items.filter((item) => !item.isRead).length,
    items
  });
}));
