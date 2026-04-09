import type { AlertItem, User } from "@laborforce/shared";
import { applicationsRepository } from "../applications/repository.js";
import { messagesRepository } from "../messages/repository.js";

function buildMessageAlerts(userId: string, conversations: Awaited<ReturnType<typeof messagesRepository.listConversations>>): AlertItem[] {
  return conversations
    .filter((conversation) => conversation.unreadCount > 0)
    .map((conversation) => ({
      id: `message-${conversation.conversationId}`,
      type: "message" as const,
      title: `New message from ${conversation.participant.fullName}`,
      body: conversation.latestMessage.messageText,
      createdAt: conversation.latestMessage.sentAt,
      isRead: false,
      actionLabel: "Open chat"
    }));
}

function buildEmployerApplicationAlerts(
  applications: Awaited<ReturnType<typeof applicationsRepository.listForEmployer>>
): AlertItem[] {
  return applications.map((application) => ({
    id: `application-${application.id}`,
    type: "application" as const,
    title: `${application.applicant.fullName} applied to ${application.job.jobTitle}`,
    body:
      application.message?.trim() ||
      `${application.applicant.tradeType ?? "Worker"} is waiting for your response.`,
    createdAt: application.appliedAt,
    isRead: application.employerViewed,
    actionLabel: "Review applicant"
  }));
}

function buildWorkerApplicationAlerts(
  applications: Awaited<ReturnType<typeof applicationsRepository.listByApplicant>>
): AlertItem[] {
  return applications
    .filter((application) => application.status !== "submitted")
    .map((application) => ({
      id: `application-${application.id}`,
      type: "application" as const,
      title: `Your application was ${application.status.replaceAll("_", " ")}`,
      body:
        application.message?.trim() ||
        "Check the Jobs tab for the latest update from the employer.",
      createdAt: application.appliedAt,
      isRead: application.employerViewed,
      actionLabel: "View jobs"
    }));
}

function buildNetworkAlert(user: User): AlertItem {
  return {
    id: `network-${user.id}`,
    type: "network",
    title: "Grow your trade network",
    body: "Connect with verified workers, employers, and customers so more opportunities find you faster.",
    createdAt: new Date().toISOString(),
    isRead: false,
    actionLabel: "Open profile"
  };
}

export const alertsRepository = {
  async buildForUser(user: User) {
    const conversations = await messagesRepository.listConversations(user.id);
    const items: AlertItem[] = [...buildMessageAlerts(user.id, conversations)];

    if (user.userTag === "employer") {
      const incomingApplications = await applicationsRepository.listForEmployer(user.id);
      items.push(...buildEmployerApplicationAlerts(incomingApplications));
    } else {
      const applications = await applicationsRepository.listByApplicant(user.id);
      items.push(...buildWorkerApplicationAlerts(applications));
    }

    items.push(buildNetworkAlert(user));
    items.sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());

    return {
      unreadCount: items.filter((item) => !item.isRead).length,
      items
    };
  }
};
