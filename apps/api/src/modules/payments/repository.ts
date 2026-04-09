import { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma.js";

export interface JobDepositSummary {
  jobId: string;
  employerId: string;
  jobTitle: string;
  status: string;
  depositAmount: number;
  depositStatus: string;
  stripePaymentIntentId: string | null;
}

function toDepositSummary(row: {
  id: string;
  employerId: string;
  jobTitle: string;
  status: string;
  depositAmount: Prisma.Decimal;
  depositStatus: string;
  stripePaymentIntentId: string | null;
}): JobDepositSummary {
  return {
    jobId: row.id,
    employerId: row.employerId,
    jobTitle: row.jobTitle,
    status: row.status,
    depositAmount: Number(row.depositAmount),
    depositStatus: row.depositStatus,
    stripePaymentIntentId: row.stripePaymentIntentId
  };
}

const depositSelect = {
  id: true,
  employerId: true,
  jobTitle: true,
  status: true,
  depositAmount: true,
  depositStatus: true,
  stripePaymentIntentId: true
} satisfies Prisma.JobListingSelect;

export const paymentsRepository = {
  async findJobDeposit(jobId: string, employerId: string) {
    const row = await prisma.jobListing.findFirst({
      where: {
        id: jobId,
        employerId
      },
      select: depositSelect
    });

    return row ? toDepositSummary(row) : null;
  },

  async markDepositPending(jobId: string, employerId: string, paymentReference?: string | null) {
    const existing = await prisma.jobListing.findFirst({
      where: {
        id: jobId,
        employerId
      },
      select: { id: true }
    });

    if (!existing) {
      return null;
    }

    const row = await prisma.jobListing.update({
      where: { id: jobId },
      data: {
        depositStatus: "pending",
        stripePaymentIntentId: paymentReference ?? undefined
      },
      select: depositSelect
    });

    return toDepositSummary(row);
  },

  async publishPaidDeposit(jobId: string, employerId: string, paymentReference: string) {
    const existing = await prisma.jobListing.findFirst({
      where: {
        id: jobId,
        employerId
      },
      select: { id: true }
    });

    if (!existing) {
      return null;
    }

    const row = await prisma.jobListing.update({
      where: { id: jobId },
      data: {
        status: "active",
        depositStatus: "held",
        stripePaymentIntentId: paymentReference,
        postedAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      },
      select: depositSelect
    });

    return toDepositSummary(row);
  },

  async syncStripeWebhookPayment(jobId: string, paymentReference: string, state: "held" | "pending" | "refunded") {
    const row = await prisma.jobListing.update({
      where: { id: jobId },
      data: {
        depositStatus: state,
        stripePaymentIntentId: paymentReference
      },
      select: depositSelect
    }).catch((error: unknown) => {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
        return null;
      }

      throw error;
    });

    return row ? toDepositSummary(row) : null;
  }
};
