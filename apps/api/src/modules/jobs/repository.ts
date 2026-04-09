import type { JobListing, ListingStatus } from "@laborforce/shared";
import { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma.js";

interface ListActiveOptions {
  limit: number;
  radiusMiles?: number;
  origin?: {
    latitude: number;
    longitude: number;
  } | null;
}

export interface CreateJobInput {
  employerId: string;
  jobTitle: string;
  tradeCategory: string;
  description: string;
  hourlyRateMin: number;
  hourlyRateMax: number;
  jobType: string;
  benefits?: string;
  countyLocation: string;
  isSurge?: boolean;
  unionRequired?: boolean;
  certificationsRequired?: string[];
}

export interface UpdateJobInput {
  jobTitle: string;
  tradeCategory: string;
  description: string;
  hourlyRateMin: number;
  hourlyRateMax: number;
  jobType: string;
  benefits?: string;
  countyLocation: string;
  unionRequired?: boolean;
  certificationsRequired?: string[];
}

const jobSelect = {
  id: true,
  employerId: true,
  jobTitle: true,
  tradeCategory: true,
  description: true,
  hourlyRateMin: true,
  hourlyRateMax: true,
  jobType: true,
  benefits: true,
  countyLocation: true,
  locationZip: true,
  latitude: true,
  longitude: true,
  status: true,
  depositAmount: true,
  depositStatus: true,
  applicationsCount: true,
  viewsCount: true,
  isSurge: true,
  unionRequired: true,
  certificationsRequired: true,
  postedAt: true,
  expiresAt: true
} satisfies Prisma.JobListingSelect;

type PrismaJobListing = Prisma.JobListingGetPayload<{ select: typeof jobSelect }>;

function toNumber(value: Prisma.Decimal | null | undefined) {
  return value == null ? 0 : Number(value);
}

function toStringArray(value: Prisma.JsonValue): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function mapJob(row: PrismaJobListing): JobListing {
  return {
    id: row.id,
    employerId: row.employerId,
    jobTitle: row.jobTitle,
    tradeCategory: row.tradeCategory,
    description: row.description,
    hourlyRateMin: toNumber(row.hourlyRateMin),
    hourlyRateMax: toNumber(row.hourlyRateMax),
    jobType: row.jobType as JobListing["jobType"],
    benefits: row.benefits,
    countyLocation: row.countyLocation ?? row.locationZip,
    locationZip: row.locationZip,
    latitude: toNumber(row.latitude),
    longitude: toNumber(row.longitude),
    status: row.status as ListingStatus,
    depositAmount: toNumber(row.depositAmount),
    depositStatus: row.depositStatus as JobListing["depositStatus"],
    applicationsCount: row.applicationsCount,
    viewsCount: row.viewsCount,
    isSurge: row.isSurge,
    unionRequired: row.unionRequired,
    certificationsRequired: toStringArray(row.certificationsRequired),
    distanceMiles: null,
    postedAt: row.postedAt.toISOString(),
    expiresAt: row.expiresAt.toISOString()
  };
}

function hasCoordinates(latitude: number, longitude: number) {
  return Number.isFinite(latitude) && Number.isFinite(longitude) && (latitude !== 0 || longitude !== 0);
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function getDistanceMiles(
  origin: { latitude: number; longitude: number },
  destination: { latitude: number; longitude: number }
) {
  const earthRadiusMiles = 3958.8;
  const latitudeDelta = toRadians(destination.latitude - origin.latitude);
  const longitudeDelta = toRadians(destination.longitude - origin.longitude);
  const originLatitude = toRadians(origin.latitude);
  const destinationLatitude = toRadians(destination.latitude);

  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(originLatitude) * Math.cos(destinationLatitude) * Math.sin(longitudeDelta / 2) ** 2;

  return earthRadiusMiles * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function getEmployerJobSortRank(status: string) {
  switch (status) {
    case "draft":
      return 0;
    case "active":
      return 1;
    default:
      return 2;
  }
}

export const jobsRepository = {
  async listActive(options: ListActiveOptions) {
    const rows = await prisma.jobListing.findMany({
      where: { status: "active" },
      orderBy: [{ isSurge: "desc" }, { postedAt: "desc" }],
      take: Math.max(options.limit, 100),
      select: jobSelect
    });

    const mappedJobs = rows.map(mapJob).map((job) => {
      if (
        options.origin &&
        hasCoordinates(options.origin.latitude, options.origin.longitude) &&
        hasCoordinates(job.latitude, job.longitude)
      ) {
        return {
          ...job,
          distanceMiles: Math.round(
            getDistanceMiles(options.origin, { latitude: job.latitude, longitude: job.longitude })
          )
        };
      }

      return job;
    });

    const filteredJobs = mappedJobs.filter((job) => {
      if (!options.origin || !options.radiusMiles) {
        return true;
      }

      if (job.distanceMiles === null || job.distanceMiles === undefined) {
        return true;
      }

      return job.distanceMiles <= options.radiusMiles;
    });

    return filteredJobs.slice(0, options.limit);
  },

  async listByEmployer(employerId: string) {
    const rows = await prisma.jobListing.findMany({
      where: { employerId },
      orderBy: { postedAt: "desc" },
      select: jobSelect
    });

    return rows
      .map(mapJob)
      .sort((left, right) => {
        const rankDelta = getEmployerJobSortRank(left.status) - getEmployerJobSortRank(right.status);
        if (rankDelta !== 0) {
          return rankDelta;
        }

        return new Date(right.postedAt).getTime() - new Date(left.postedAt).getTime();
      });
  },

  async findById(id: string) {
    const row = await prisma.jobListing.findUnique({
      where: { id },
      select: jobSelect
    });

    return row ? mapJob(row) : null;
  },

  async create(input: CreateJobInput) {
    const row = await prisma.jobListing.create({
      data: {
        employerId: input.employerId,
        jobTitle: input.jobTitle,
        tradeCategory: input.tradeCategory,
        description: input.description,
        hourlyRateMin: input.hourlyRateMin,
        hourlyRateMax: input.hourlyRateMax,
        jobType: input.jobType,
        benefits: input.benefits ?? null,
        countyLocation: input.countyLocation,
        locationZip: input.countyLocation,
        latitude: 0,
        longitude: 0,
        status: "draft",
        depositAmount: 20,
        depositStatus: "pending",
        isSurge: input.isSurge ?? false,
        unionRequired: input.unionRequired ?? false,
        certificationsRequired: input.certificationsRequired ?? []
      },
      select: jobSelect
    });

    return mapJob(row);
  },

  async publishDraft(id: string, paymentReference?: string) {
    const row = await prisma.jobListing.update({
      where: { id },
      data: {
        status: "active",
        depositStatus: "held",
        stripePaymentIntentId: paymentReference ?? `dev_simulated_${Date.now()}`,
        postedAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      },
      select: jobSelect
    });

    return mapJob(row);
  },

  async updateForEmployer(id: string, employerId: string, input: UpdateJobInput) {
    const existing = await prisma.jobListing.findFirst({
      where: { id, employerId },
      select: { id: true }
    });

    if (!existing) {
      return null;
    }

    const row = await prisma.jobListing.update({
      where: { id },
      data: {
        jobTitle: input.jobTitle,
        tradeCategory: input.tradeCategory,
        description: input.description,
        hourlyRateMin: input.hourlyRateMin,
        hourlyRateMax: input.hourlyRateMax,
        jobType: input.jobType,
        benefits: input.benefits ?? null,
        countyLocation: input.countyLocation,
        locationZip: input.countyLocation,
        unionRequired: input.unionRequired ?? false,
        certificationsRequired: input.certificationsRequired ?? []
      },
      select: jobSelect
    });

    return mapJob(row);
  },

  async updateStatusForEmployer(id: string, employerId: string, status: Extract<ListingStatus, "filled" | "closed">) {
    const existing = await prisma.jobListing.findFirst({
      where: { id, employerId },
      select: { id: true }
    });

    if (!existing) {
      return null;
    }

    const row = await prisma.jobListing.update({
      where: { id },
      data: { status },
      select: jobSelect
    });

    return mapJob(row);
  }
};
