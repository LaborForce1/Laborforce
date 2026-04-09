export const queueNames = {
  reminders: "laborforce:reminders",
  notifications: "laborforce:notifications"
} as const;

export type QueueName = (typeof queueNames)[keyof typeof queueNames];

export interface ReminderJobData {
  kind: "application_follow_up" | "crm_follow_up" | "review_request";
  userId: string;
  entityId: string;
  message: string;
  dueAt: string;
}

export interface NotificationJobData {
  kind: "sms" | "email" | "push";
  userId: string;
  title: string;
  body: string;
  metadata?: Record<string, string>;
}
