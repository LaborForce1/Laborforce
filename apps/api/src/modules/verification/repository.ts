import { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma.js";

export interface VerificationSummary {
  id: string;
  userTag: string;
  verificationStatus: string;
  isVerified: boolean;
  isBusinessVerified: boolean;
  businessName: string | null;
  businessLicenseUrl: string | null;
  einNumberLast4: string | null;
  personaInquiryId: string | null;
  selfieMatchPassed: boolean;
}

export interface StartBusinessVerificationInput {
  businessName?: string | null;
  businessLicenseUrl?: string | null;
  einNumber?: string | null;
}

function maskEin(einNumber: string | null): string | null {
  if (!einNumber) {
    return null;
  }

  const digits = einNumber.replace(/\D/g, "");
  return digits.length >= 4 ? digits.slice(-4) : digits;
}

function mapVerificationSummary(row: {
  id: string;
  userTag: string;
  verificationStatus: string;
  isVerified: boolean;
  isBusinessVerified: boolean;
  businessName: string | null;
  businessLicenseUrl: string | null;
  einNumber: string | null;
  personaInquiryId: string | null;
  selfieMatchPassed: boolean;
}): VerificationSummary {
  return {
    id: row.id,
    userTag: row.userTag,
    verificationStatus: row.verificationStatus,
    isVerified: row.isVerified,
    isBusinessVerified: row.isBusinessVerified,
    businessName: row.businessName,
    businessLicenseUrl: row.businessLicenseUrl,
    einNumberLast4: maskEin(row.einNumber),
    personaInquiryId: row.personaInquiryId,
    selfieMatchPassed: row.selfieMatchPassed
  };
}

const verificationSelect = {
  id: true,
  userTag: true,
  verificationStatus: true,
  isVerified: true,
  isBusinessVerified: true,
  businessName: true,
  businessLicenseUrl: true,
  einNumber: true,
  personaInquiryId: true,
  selfieMatchPassed: true
} satisfies Prisma.UserSelect;

export const verificationRepository = {
  async findSummaryByUserId(userId: string) {
    const row = await prisma.user.findUnique({
      where: { id: userId },
      select: verificationSelect
    });

    return row ? mapVerificationSummary(row) : null;
  },

  async startBusinessVerification(userId: string, input: StartBusinessVerificationInput) {
    const row = await prisma.user.update({
      where: { id: userId },
      data: {
        businessName: input.businessName?.trim() || undefined,
        businessLicenseUrl: input.businessLicenseUrl?.trim() || null,
        einNumber: input.einNumber?.trim() || null,
        verificationStatus: "manual_review"
      },
      select: verificationSelect
    }).catch((error: unknown) => {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
        return null;
      }

      throw error;
    });

    return row ? mapVerificationSummary(row) : null;
  }
};
