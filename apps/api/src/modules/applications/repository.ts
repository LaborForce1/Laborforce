import type { ApplicationStatus, EmployerApplicationView, JobApplication, TrustBadge, VerificationStatus } from "@laborforce/shared";
import { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma.js";

type ApplicantJobSummary = NonNullable<JobApplication["job"]>;
type ApplicantEmployerSummary = NonNullable<JobApplication["employer"]>;

const applicantApplicationSelect = {
  id: true,
  applicantId: true,
  jobListingId: true,
  status: true,
  message: true,
  appliedAt: true,
  employerViewed: true,
  jobListing: {
    select: {
      id: true,
      jobTitle: true,
      tradeCategory: true,
      countyLocation: true,
      locationZip: true,
      status: true,
      hourlyRateMin: true,
      hourlyRateMax: true,
      employer: {
        select: {
          id: true,
          fullName: true,
          businessName: true,
          verificationStatus: true
        }
      }
    }
  }
} satisfies Prisma.ApplicationSelect;

const employerApplicationSelect = {
  id: true,
  status: true,
  message: true,
  appliedAt: true,
  employerViewed: true,
  jobListing: {
    select: {
      id: true,
      jobTitle: true,
      countyLocation: true,
      locationZip: true,
      status: true
    }
  },
  applicant: {
    select: {
      id: true,
      fullName: true,
      tradeType: true,
      ratingAverage: true,
      ratingCount: true,
      trustBadge: true,
      verificationStatus: true
    }
  }
} satisfies Prisma.ApplicationSelect;

type ApplicantApplicationRecord = Prisma.ApplicationGetPayload<{ select: typeof applicantApplicationSelect }>;
type EmployerApplicationRecord = Prisma.ApplicationGetPayload<{ select: typeof employerApplicationSelect }>;

function toNumber(value: Prisma.Decimal | null | undefined): number {
  return value == null ? 0 : Number(value);
}

function mapApplication(row: ApplicantApplicationRecord): JobApplication {
  return {
    id: row.id,
    applicantId: row.applicantId,
    jobListingId: row.jobListingId,
    status: row.status as ApplicationStatus,
    message: row.message,
    appliedAt: row.appliedAt.toISOString(),
    employerViewed: row.employerViewed,
    job: {
      id: row.jobListing.id,
      jobTitle: row.jobListing.jobTitle,
      tradeCategory: row.jobListing.tradeCategory,
      countyLocation: row.jobListing.countyLocation ?? row.jobListing.locationZip ?? "County not set",
      status: row.jobListing.status as ApplicantJobSummary["status"],
      hourlyRateMin: toNumber(row.jobListing.hourlyRateMin),
      hourlyRateMax: toNumber(row.jobListing.hourlyRateMax)
    },
    employer: {
      id: row.jobListing.employer.id,
      fullName: row.jobListing.employer.fullName,
      businessName: row.jobListing.employer.businessName,
      verificationStatus: row.jobListing.employer.verificationStatus as ApplicantEmployerSummary["verificationStatus"]
    }
  };
}

function mapEmployerApplication(row: EmployerApplicationRecord): EmployerApplicationView {
  return {
    id: row.id,
    status: row.status as ApplicationStatus,
    message: row.message,
    appliedAt: row.appliedAt.toISOString(),
    employerViewed: row.employerViewed,
    job: {
      id: row.jobListing.id,
      jobTitle: row.jobListing.jobTitle,
      countyLocation: row.jobListing.countyLocation ?? row.jobListing.locationZip ?? "County not set",
      status: row.jobListing.status as EmployerApplicationView["job"]["status"]
    },
    applicant: {
      id: row.applicant.id,
      fullName: row.applicant.fullName,
      tradeType: row.applicant.tradeType,
      ratingAverage: Number(row.applicant.ratingAverage),
      ratingCount: row.applicant.ratingCount,
      trustBadge: row.applicant.trustBadge as TrustBadge | null,
      verificationStatus: row.applicant.verificationStatus as VerificationStatus
    }
  };
}

export const applicationsRepository = {
  async listByApplicant(applicantId: string) {
    const rows = await prisma.application.findMany({
      where: { applicantId },
      orderBy: { appliedAt: "desc" },
      select: applicantApplicationSelect
    });

    return rows.map(mapApplication);
  },

  async listForEmployer(employerId: string) {
    const rows = await prisma.application.findMany({
      where: {
        jobListing: {
          employerId
        }
      },
      orderBy: { appliedAt: "desc" },
      select: employerApplicationSelect
    });

    return rows.map(mapEmployerApplication);
  },

  async updateStatusForEmployer(applicationId: string, employerId: string, status: ApplicationStatus) {
    const existing = await prisma.application.findFirst({
      where: {
        id: applicationId,
        jobListing: {
          employerId
        }
      },
      select: { id: true }
    });

    if (!existing) {
      return null;
    }

    const row = await prisma.application.update({
      where: { id: applicationId },
      data: {
        status,
        employerViewed: true,
        employerResponseAt: new Date()
      },
      select: employerApplicationSelect
    });

    return mapEmployerApplication(row);
  },

  async findByApplicantAndJob(applicantId: string, jobListingId: string) {
    const row = await prisma.application.findFirst({
      where: {
        applicantId,
        jobListingId
      },
      select: applicantApplicationSelect
    });

    return row ? mapApplication(row) : null;
  },

  async create(applicantId: string, jobListingId: string, message?: string) {
    const application = await prisma.$transaction(async (tx) => {
      const created = await tx.application.create({
        data: {
          applicantId,
          jobListingId,
          message: message ?? null
        },
        select: { id: true }
      });

      await tx.jobListing.update({
        where: { id: jobListingId },
        data: {
          applicationsCount: {
            increment: 1
          }
        }
      });

      return created;
    });

    const createdApplication = await prisma.application.findUnique({
      where: { id: application.id },
      select: applicantApplicationSelect
    });

    if (!createdApplication) {
      throw new Error(`Application ${application.id} was created but could not be reloaded.`);
    }

    return mapApplication(createdApplication);
  }
};
