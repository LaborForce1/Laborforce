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
    postedAt: row.posted_at.toISOString(),
    expiresAt: row.expires_at.toISOString()
  };
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
  async listActive(limit: number) {
    const result = await query<JobListingRow>(
      `
        ${selectFields}
        WHERE status IN ('active', 'draft')
        ORDER BY is_surge DESC, posted_at DESC
        LIMIT $1
      `,
      [limit]
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
        input.countyLocation,
        0,
        0,
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
        WHERE id = $1
        ${returningFields}
      `,
      [id, paymentReference ?? `dev_simulated_${Date.now()}`]
    );

    return mapJob(result.rows[0]);
  }
};
