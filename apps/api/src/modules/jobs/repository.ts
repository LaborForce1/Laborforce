import type { JobListing, ListingStatus } from "@laborforce/shared";
import { query } from "../../db/query.js";

interface JobListingRow {
  id: string;
  employer_id: string;
  job_title: string;
  trade_category: string;
  description: string;
  hourly_rate_min: string;
  hourly_rate_max: string;
  job_type: JobListing["jobType"];
  benefits: string | null;
  county_location: string | null;
  location_zip: string;
  latitude: string;
  longitude: string;
  status: ListingStatus;
  deposit_amount: string;
  deposit_status: JobListing["depositStatus"];
  applications_count: number;
  views_count: number;
  is_surge: boolean;
  union_required: boolean;
  certifications_required: string[];
  posted_at: Date;
  expires_at: Date;
}

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
  locationZip: string;
  latitude: number;
  longitude: number;
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
  locationZip: string;
  latitude: number;
  longitude: number;
  unionRequired?: boolean;
  certificationsRequired?: string[];
}

const selectFields = `
  SELECT
    id,
    employer_id,
    job_title,
    trade_category,
    description,
    hourly_rate_min,
    hourly_rate_max,
    job_type,
    benefits,
    county_location,
    location_zip,
    latitude,
    longitude,
    status,
    deposit_amount,
    deposit_status,
    applications_count,
    views_count,
    is_surge,
    union_required,
    ARRAY(
      SELECT jsonb_array_elements_text(certifications_required)
    ) AS certifications_required,
    posted_at,
    expires_at
  FROM job_listings
`;

function mapJob(row: JobListingRow): JobListing {
  return {
    id: row.id,
    employerId: row.employer_id,
    jobTitle: row.job_title,
    tradeCategory: row.trade_category,
    description: row.description,
    hourlyRateMin: Number(row.hourly_rate_min),
    hourlyRateMax: Number(row.hourly_rate_max),
    jobType: row.job_type,
    benefits: row.benefits,
    countyLocation: row.county_location ?? row.location_zip,
    locationZip: row.location_zip,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    status: row.status,
    depositAmount: Number(row.deposit_amount),
    depositStatus: row.deposit_status,
    applicationsCount: row.applications_count,
    viewsCount: row.views_count,
    isSurge: row.is_surge,
    unionRequired: row.union_required,
    certificationsRequired: row.certifications_required ?? [],
    distanceMiles: null,
    postedAt: row.posted_at.toISOString(),
    expiresAt: row.expires_at.toISOString()
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

const returningFields = `
  RETURNING
    id,
    employer_id,
    job_title,
    trade_category,
    description,
    hourly_rate_min,
    hourly_rate_max,
    job_type,
    benefits,
    county_location,
    location_zip,
    latitude,
    longitude,
    status,
    deposit_amount,
    deposit_status,
    applications_count,
    views_count,
    is_surge,
    union_required,
    ARRAY(
      SELECT jsonb_array_elements_text(certifications_required)
    ) AS certifications_required,
    posted_at,
    expires_at
`;

export const jobsRepository = {
  async listActive(options: ListActiveOptions) {
    const result = await query<JobListingRow>(
      `
        ${selectFields}
        WHERE status = 'active'
        ORDER BY is_surge DESC, posted_at DESC
        LIMIT $1
      `,
      [Math.max(options.limit, 100)]
    );

    const mappedJobs = result.rows.map(mapJob).map((job) => {
      if (
        options.origin &&
        hasCoordinates(options.origin.latitude, options.origin.longitude) &&
        hasCoordinates(job.latitude, job.longitude)
      ) {
        return {
          ...job,
          distanceMiles: Math.round(getDistanceMiles(options.origin, { latitude: job.latitude, longitude: job.longitude }))
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
    const result = await query<JobListingRow>(
      `
        ${selectFields}
        WHERE employer_id = $1
        ORDER BY
          CASE status
            WHEN 'draft' THEN 0
            WHEN 'active' THEN 1
            ELSE 2
          END,
          posted_at DESC
      `,
      [employerId]
    );

    return result.rows.map(mapJob);
  },

  async findById(id: string) {
    const result = await query<JobListingRow>(`${selectFields} WHERE id = $1 LIMIT 1`, [id]);
    const row = result.rows[0];
    return row ? mapJob(row) : null;
  },

  async create(input: CreateJobInput) {
    const result = await query<JobListingRow>(
      `
        INSERT INTO job_listings (
          employer_id,
          job_title,
          trade_category,
          description,
          hourly_rate_min,
          hourly_rate_max,
          job_type,
          benefits,
          county_location,
          location_zip,
          latitude,
          longitude,
          status,
          deposit_amount,
          deposit_status,
          is_surge,
          union_required,
          certifications_required
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
          'draft', 20.00, 'pending', $13, $14, $15::jsonb
        )
        ${returningFields}
      `,
      [
        input.employerId,
        input.jobTitle,
        input.tradeCategory,
        input.description,
        input.hourlyRateMin,
        input.hourlyRateMax,
        input.jobType,
        input.benefits ?? null,
        input.countyLocation,
        input.locationZip,
        input.latitude,
        input.longitude,
        input.isSurge ?? false,
        input.unionRequired ?? false,
        JSON.stringify(input.certificationsRequired ?? [])
      ]
    );

    return mapJob(result.rows[0]);
  },

  async publishDraft(id: string, paymentReference?: string) {
    const result = await query<JobListingRow>(
      `
        UPDATE job_listings
        SET
          status = 'active',
          deposit_status = 'held',
          stripe_payment_intent_id = COALESCE($2, stripe_payment_intent_id),
          posted_at = NOW(),
          expires_at = NOW() + INTERVAL '30 days'
        WHERE id = $1 AND status = 'draft'
        ${returningFields}
      `,
      [id, paymentReference ?? `dev_simulated_${Date.now()}`]
    );

    if (result.rows[0]) {
      return mapJob(result.rows[0]);
    }

    return this.findById(id);
  },

  async updateForEmployer(id: string, employerId: string, input: UpdateJobInput) {
    const result = await query<JobListingRow>(
      `
        UPDATE job_listings
        SET
          job_title = $3,
          trade_category = $4,
          description = $5,
          hourly_rate_min = $6,
          hourly_rate_max = $7,
          job_type = $8,
          benefits = $9,
          county_location = $10,
          location_zip = $11,
          latitude = $12,
          longitude = $13,
          union_required = $14,
          certifications_required = $15::jsonb
        WHERE id = $1 AND employer_id = $2
        ${returningFields}
      `,
      [
        id,
        employerId,
        input.jobTitle,
        input.tradeCategory,
        input.description,
        input.hourlyRateMin,
        input.hourlyRateMax,
        input.jobType,
        input.benefits ?? null,
        input.countyLocation,
        input.locationZip,
        input.latitude,
        input.longitude,
        input.unionRequired ?? false,
        JSON.stringify(input.certificationsRequired ?? [])
      ]
    );

    const row = result.rows[0];
    return row ? mapJob(row) : null;
  },

  async updateLocationForEmployer(
    id: string,
    employerId: string,
    input: { locationZip: string; latitude: number; longitude: number }
  ) {
    const result = await query<JobListingRow>(
      `
        UPDATE job_listings
        SET
          location_zip = $3,
          latitude = $4,
          longitude = $5
        WHERE id = $1 AND employer_id = $2
        ${returningFields}
      `,
      [id, employerId, input.locationZip, input.latitude, input.longitude]
    );

    const row = result.rows[0];
    return row ? mapJob(row) : null;
  },

  async updateStatusForEmployer(id: string, employerId: string, status: Extract<ListingStatus, "filled" | "closed">) {
    const result = await query<JobListingRow>(
      `
        UPDATE job_listings
        SET status = $3
        WHERE id = $1 AND employer_id = $2
        ${returningFields}
      `,
      [id, employerId, status]
    );

    const row = result.rows[0];
    return row ? mapJob(row) : null;
  }
};
