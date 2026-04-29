import { Router } from "express";
import type Stripe from "stripe";
import { z } from "zod";
import { integrations } from "../../services/integrations.js";
import { requireAuth, type AuthedRequest } from "../../middleware/auth.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { HttpError } from "../../utils/http.js";
import { usersRepository } from "../users/repository.js";
import { jobsRepository } from "../jobs/repository.js";
import { stripeClient } from "../../services/stripe.js";
import { env } from "../../config/env.js";

export const paymentsRouter = Router();

function ensurePaymentSimulationAllowed() {
  if (env.NODE_ENV === "production") {
    throw new HttpError(503, "Stripe is required before job deposits can be accepted in production.");
  }
}

async function publishPaidCheckoutSession(session: Stripe.Checkout.Session) {
  const jobId = session.metadata?.jobId;
  const employerId = session.metadata?.employerId;

  if (!jobId || !employerId) {
    throw new HttpError(400, "Stripe session is missing LaborForce job metadata.");
  }

  if (session.payment_status !== "paid") {
    return {
      published: false,
      job: null,
      message: "Stripe checkout session is not paid yet."
    };
  }

  const job = await jobsRepository.findById(jobId);
  if (!job) {
    throw new HttpError(404, "Job not found.");
  }

  if (job.employerId !== employerId) {
    throw new HttpError(400, "Stripe session employer does not match this job.");
  }

  const paymentReference =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.id;

  const publishedJob = await jobsRepository.publishDraft(job.id, paymentReference);
  if (!publishedJob) {
    throw new HttpError(404, "Job not found.");
  }

  return {
    published: publishedJob.status === "active",
    job: publishedJob,
    message: "Deposit received and job published."
  };
}

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

  if (!stripeClient) {
    ensurePaymentSimulationAllowed();

    return res.json({
      mode: "development_simulation",
      jobId,
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
    payment_intent_data: {
      metadata: {
        jobId: job.id,
        employerId: user.id,
        flow: "job_deposit"
      }
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

  res.json({
    mode: "stripe_checkout",
    jobId,
    checkoutUrl: session.url
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
    return res.json({
      job,
      paymentMode: "already_published",
      message: "This job has already been published."
    });
  }

  if (!stripeClient) {
    ensurePaymentSimulationAllowed();

    const publishedJob = await jobsRepository.publishDraft(payload.jobId);
    if (!publishedJob) {
      throw new HttpError(404, "Job not found.");
    }

    return res.json({
      job: publishedJob,
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

  const result = await publishPaidCheckoutSession(session);
  if (!result.job) {
    throw new HttpError(400, result.message);
  }

  res.json({
    job: result.job,
    paymentMode: "stripe_checkout",
    message: result.message
  });
}));

paymentsRouter.post("/webhooks/stripe", asyncHandler(async (req, res) => {
  if (!stripeClient) {
    throw new HttpError(503, "Stripe is not configured.");
  }

  if (!env.STRIPE_WEBHOOK_SECRET) {
    throw new HttpError(503, "Stripe webhook secret is not configured.");
  }

  const signature = req.header("stripe-signature");
  if (!signature) {
    throw new HttpError(400, "Missing Stripe signature.");
  }

  const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body));
  let event: Stripe.Event;

  try {
    event = stripeClient.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch {
    throw new HttpError(400, "Invalid Stripe webhook signature.");
  }

  let result: Awaited<ReturnType<typeof publishPaidCheckoutSession>> | null = null;

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
      result = await publishPaidCheckoutSession(event.data.object as Stripe.Checkout.Session);
      break;
    case "checkout.session.async_payment_failed":
    case "payment_intent.payment_failed":
    case "customer.subscription.created":
    case "customer.subscription.deleted":
    case "charge.refunded":
      break;
    default:
      break;
  }

  res.json({
    received: true,
    eventType: event.type,
    published: result?.published ?? false,
    jobId: result?.job?.id ?? null
  });
}));
