import { createReminderQueue } from "./index.js";

function getDelayMs(dueAt: string) {
  return Math.max(0, new Date(dueAt).getTime() - Date.now());
}

async function enqueueReminderJob(input: {
  kind: "application_follow_up" | "crm_follow_up" | "review_request";
  userId: string;
  entityId: string;
  message: string;
  dueAt: string;
  jobName: string;
}) {
  try {
    const queue = createReminderQueue();

    await queue.add(
      input.jobName,
      {
        kind: input.kind,
        userId: input.userId,
        entityId: input.entityId,
        message: input.message,
        dueAt: input.dueAt
      },
      {
        delay: getDelayMs(input.dueAt),
        removeOnComplete: 100,
        removeOnFail: 100
      }
    );

    return { queued: true as const };
  } catch (error) {
    console.error(
      JSON.stringify({
        service: "laborforce-api",
        queue: "laborforce:reminders",
        kind: input.kind,
        error: error instanceof Error ? error.message : "Unknown queue error"
      })
    );

    return { queued: false as const };
  }
}

export async function enqueueCrmFollowUpReminder(input: {
  userId: string;
  contactId: string;
  contactName: string;
  dueAt: string;
}) {
  return enqueueReminderJob({
    kind: "crm_follow_up",
    userId: input.userId,
    entityId: input.contactId,
    message: `Follow up with ${input.contactName}.`,
    dueAt: input.dueAt,
    jobName: "crm-follow-up"
  });
}

export async function enqueueApplicationFollowUpReminder(input: {
  employerId: string;
  applicationId: string;
  applicantName: string;
  jobTitle: string;
  dueAt: string;
}) {
  return enqueueReminderJob({
    kind: "application_follow_up",
    userId: input.employerId,
    entityId: input.applicationId,
    message: `${input.applicantName} is waiting for a response on ${input.jobTitle}.`,
    dueAt: input.dueAt,
    jobName: "application-follow-up"
  });
}
