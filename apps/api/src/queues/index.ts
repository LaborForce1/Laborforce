import { Queue } from "bullmq";
import { queueNames, type NotificationJobData, type ReminderJobData } from "@laborforce/shared";
import { createRedisConnection } from "./redis.js";

let reminderQueue: Queue<ReminderJobData> | null = null;
let notificationQueue: Queue<NotificationJobData> | null = null;

export function createReminderQueue() {
  reminderQueue ??= new Queue<ReminderJobData>(queueNames.reminders, {
    connection: createRedisConnection()
  });

  return reminderQueue;
}

export function createNotificationQueue() {
  notificationQueue ??= new Queue<NotificationJobData>(queueNames.notifications, {
    connection: createRedisConnection()
  });

  return notificationQueue;
}
