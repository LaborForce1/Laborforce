import "dotenv/config";
import { Worker } from "bullmq";
import { queueNames, type NotificationJobData, type ReminderJobData } from "@laborforce/shared";
import IORedis from "ioredis";

const redisUrl = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";

function createRedisConnection() {
  return new IORedis(redisUrl, {
    maxRetriesPerRequest: null
  });
}

const reminderWorker = new Worker<ReminderJobData>(
  queueNames.reminders,
  async (job) => {
    console.log(
      JSON.stringify({
        service: "laborforce-worker",
        queue: queueNames.reminders,
        jobId: job.id,
        kind: job.data.kind,
        message: "Reminder job received."
      })
    );
  },
  {
    connection: createRedisConnection()
  }
);

const notificationWorker = new Worker<NotificationJobData>(
  queueNames.notifications,
  async (job) => {
    console.log(
      JSON.stringify({
        service: "laborforce-worker",
        queue: queueNames.notifications,
        jobId: job.id,
        kind: job.data.kind,
        message: "Notification job received."
      })
    );
  },
  {
    connection: createRedisConnection()
  }
);

reminderWorker.on("failed", (job, error) => {
  console.error(
    JSON.stringify({
      service: "laborforce-worker",
      queue: queueNames.reminders,
      jobId: job?.id ?? null,
      error: error.message
    })
  );
});

notificationWorker.on("failed", (job, error) => {
  console.error(
    JSON.stringify({
      service: "laborforce-worker",
      queue: queueNames.notifications,
      jobId: job?.id ?? null,
      error: error.message
    })
  );
});

console.log(
  JSON.stringify({
    service: "laborforce-worker",
    queues: [queueNames.reminders, queueNames.notifications],
    status: "listening"
  })
);
