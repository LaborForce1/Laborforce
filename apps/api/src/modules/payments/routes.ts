import { Router } from "express";
import { z } from "zod";
import { integrations } from "../../services/integrations.js";
import { requireAuth, type AuthedRequest } from "../../middleware/auth.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { HttpError } from "../../utils/http.js";
import { usersRepository } from "../users/repository.js";
import { jobsRepository } from "../jobs/repository.js";
import { paymentsRepository } from "./repository.js";
import { stripeClient } from "../../services/stripe.js";
import { env } from "../../config/env.js";

export const paymentsRouter = Router();

paymentsRouter.get("/config", (_req, res) => {
  res.json({
    premium: {
      monthly: 19.99,
      yearly: 179
    },
    fees: {
      certificationVerification: 9.99,
      businessVerification: 14.99,
      surgeBoost: 10,
      quickCashPlatformPercent: 4
    },
    stripeReady: integrations.stripe.ready
  });
});

paymentsRouter.post("/job-deposits/:jobId/checkout", requireAuth, asyncHandler(async (req: AuthedRequest, res) => {
  const { jobId } = z.object({
    jobId: z.string().uuid()
  }).parse(req.params);

  const user = await usersRepository.findById(req.userId ?? "");
  if (!user) {
    throw new HttpError(404, "User not found.");
  }

  const job = await jobsRepository.findById(jobId);
  if (!job) {
    throw new HttpError(404, "Job not found.");
  }

  if (job.employerId !== user.id) {
    throw new HttpError(403, "You can only pay deposits for your own job listings.");
  }

  if (job.status !== "draft") {
    throw new HttpError(400, "Only draft jobs can start the deposit flow.");
  }

  const deposit = await paymentsRepository.findJobDeposit(jobId, user.id);
  if (!deposit) {
    throw new HttpError(404, "Deposit record not found for this job.");
  }

  if (!stripeClient) {
    return res.json({
      mode: "development_simulation",
      jobId,
      deposit,
      message: "Stripe is not configured locally yet. The app can simulate deposit confirmation for development."
    });
  }

  const session = await stripeClient.checkout.sessions.create({
    mode: "payment",
    success_url: `${env.WEB_URL}/?deposit=success&jobId=${job.id}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.WEB_URL}/?deposit=cancelled&jobId=${job.id}`,
    customer_email: user.email,
    metadata: {
      jobId: job.id,
      employerId: user.id,
      flow: "job_deposit"
    },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: Math.round(job.depositAmount * 100),
          product_data: {
            name: `LaborForce job deposit for ${job.jobTitle}`,
            description: "Refundable deposit used to prevent ghost job listings."
          }
        }
      }
    ]
  });

  await paymentsRepository.markDepositPending(job.id, user.id, session.payment_intent?.toString() ?? session.id);

  res.json({
    mode: "stripe_checkout",
    jobId,
    checkoutUrl: session.url,
    deposit
  });
}));

paymentsRouter.post("/job-deposits/complete", requireAuth, asyncHandler(async (req: AuthedRequest, res) => {
  const payload = z.object({
    jobId: z.string().uuid(),
    sessionId: z.string().optional()
  }).parse(req.body);

  const user = await usersRepository.findById(req.userId ?? "");
  if (!user) {
    throw new HttpError(404, "User not found.");
  }

  const job = await jobsRepository.findById(payload.jobId);
  if (!job) {
    throw new HttpError(404, "Job not found.");
  }

  if (job.employerId !== user.id) {
    throw new HttpError(403, "You can only complete deposits for your own job listings.");
  }

  if (job.status !== "draft") {
    const deposit = await paymentsRepository.findJobDeposit(payload.jobId, user.id);
    return res.json({
      job,
      deposit,
      paymentMode: "already_published",
      message: "This job has already been published."
    });
  }

  if (!stripeClient) {
    const publishedJob = await jobsRepository.publishDraft(payload.jobId);
    const deposit = await paymentsRepository.findJobDeposit(payload.jobId, user.id);
    return res.json({
      job: publishedJob,
      deposit,
      paymentMode: "development_simulation",
      message: "Draft published with a local Stripe fallback. Add STRIPE_SECRET_KEY to use real checkout."
    });
  }

  if (!payload.sessionId) {
    throw new HttpError(400, "Stripe session ID is required to confirm payment.");
  }

  const session = await stripeClient.checkout.sessions.retrieve(payload.sessionId);
  if (session.payment_status !== "paid") {
    throw new HttpError(400, "Stripe deposit has not been paid yet.");
  }

  if (session.metadata?.jobId !== payload.jobId) {
    throw new HttpError(400, "Stripe session does not match this job.");
  }

  const paymentReference =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.id;

  const publishedDeposit = await paymentsRepository.publishPaidDeposit(payload.jobId, user.id, paymentReference);
  if (!publishedDeposit) {
    throw new HttpError(404, "Deposit record not found for this job.");
  }

  const publishedJob = await jobsRepository.findById(payload.jobId);
  if (!publishedJob) {
    throw new HttpError(404, "Published job could not be reloaded.");
  }

  res.json({
    job: publishedJob,
    deposit: publishedDeposit,
    paymentMode: "stripe_checkout",
    message: "Deposit received and job published."
  });
}));

paymentsRouter.get("/job-deposits/:jobId/status", requireAuth, asyncHandler(async (req: AuthedRequest, res) => {
  const { jobId } = z.object({
    jobId: z.string().uuid()
  }).parse(req.params);

  const user = await usersRepository.findById(req.userId ?? "");
  if (!user) {
    throw new HttpError(404, "User not found.");
  }

  const deposit = await paymentsRepository.findJobDeposit(jobId, user.id);
  if (!deposit) {
    throw new HttpError(404, "Deposit record not found for this job.");
  }

  res.json({
    deposit,
    stripeReady: integrations.stripe.ready
  });
}));

paymentsRouter.post("/webhooks/stripe", asyncHandler(async (req, res) => {
  const payload = z.object({
    type: z.string(),
    data: z.object({
      object: z.object({
        id: z.string().optional(),
        payment_intent: z.string().optional().nullable(),
        metadata: z.record(z.string(), z.string()).optional()
      })
    })
  }).passthrough().parse(req.body);

  const jobId = payload.data.object.metadata?.jobId;
  const paymentReference = payload.data.object.payment_intent ?? payload.data.object.id;

  if (jobId && paymentReference) {
    if (payload.type === "checkout.session.completed" || payload.type === "payment_intent.succeeded") {
      await paymentsRepository.syncStripeWebhookPayment(jobId, paymentReference, "held");
    }

    if (payload.type === "payment_intent.payment_failed") {
      await paymentsRepository.syncStripeWebhookPayment(jobId, paymentReference, "pending");
    }

    if (payload.type === "charge.refunded") {
      await paymentsRepository.syncStripeWebhookPayment(jobId, paymentReference, "refunded");
    }
  }

  res.json({
    received: true,
    syncedJobId: jobId ?? null,
    eventType: payload.type
  });
}));
