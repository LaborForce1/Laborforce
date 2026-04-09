import { createReminderQueue } from "./index.js";

function getDelayMs(dueAt: string) {
  return Math.max(0, new Date(dueAt).getTime() - Date.now());
}

export async function enqueueCrmFollowUpReminder(input: {
  userId: string;
  contactId: string;
  contactName: string;
  dueAt: string;
}) {
  try {
    const queue = createReminderQueue();

    await queue.add(
      "crm-follow-up",
      {
        kind: "crm_follow_up",
        userId: input.userId,
        entityId: input.contactId,
        message: `Follow up with ${input.contactName}.`,
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
        kind: "crm_follow_up",
        error: error instanceof Error ? error.message : "Unknown queue error"
      })
    );

    return { queued: false as const };
  }
}
