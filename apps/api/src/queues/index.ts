import { Queue } from "bullmq";
import { queueNames, type NotificationJobData, type ReminderJobData } from "@laborforce/shared";
import { createRedisConnection } from "./redis.js";

export function createReminderQueue() {
  return new Queue<ReminderJobData>(queueNames.reminders, {
    connection: createRedisConnection()
  });
}

export function createNotificationQueue() {
  return new Queue<NotificationJobData>(queueNames.notifications, {
    connection: createRedisConnection()
  });
}
