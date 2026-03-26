import type { ApplicationStatus, EmployerApplicationView, JobApplication } from "@laborforce/shared";
import { query } from "../../db/query.js";

interface ApplicationRow {
  id: string;
  applicant_id: string;
  job_listing_id: string;
  status: ApplicationStatus;
  message: string | null;
  applied_at: Date;
  employer_viewed: boolean;
}

interface EmployerApplicationRow {
  id: string;
  status: ApplicationStatus;
  message: string | null;
  applied_at: Date;
  employer_viewed: boolean;
  job_id: string;
  job_title: string;
  county_location: string | null;
  job_status: EmployerApplicationView["job"]["status"];
  applicant_id: string;
  applicant_full_name: string;
  applicant_trade_type: string | null;
  applicant_rating_average: string;
  applicant_rating_count: number;
  applicant_trust_badge: EmployerApplicationView["applicant"]["trustBadge"] | null;
  applicant_verification_status: EmployerApplicationView["applicant"]["verificationStatus"];
}

function mapApplication(row: ApplicationRow): JobApplication {
  return {
    id: row.id,
    applicantId: row.applicant_id,
    jobListingId: row.job_listing_id,
    status: row.status,
    message: row.message,
    appliedAt: row.applied_at.toISOString(),
    employerViewed: row.employer_viewed
  };
}

function mapEmployerApplication(row: EmployerApplicationRow): EmployerApplicationView {
  return {
    id: row.id,
    status: row.status,
    message: row.message,
    appliedAt: row.applied_at.toISOString(),
    employerViewed: row.employer_viewed,
    job: {
      id: row.job_id,
      jobTitle: row.job_title,
      countyLocation: row.county_location ?? "County not set",
      status: row.job_status
    },
    applicant: {
      id: row.applicant_id,
      fullName: row.applicant_full_name,
      tradeType: row.applicant_trade_type,
      ratingAverage: Number(row.applicant_rating_average),
      ratingCount: row.applicant_rating_count,
      trustBadge: row.applicant_trust_badge,
      verificationStatus: row.applicant_verification_status
    }
  };
}

export const applicationsRepository = {
  async listByApplicant(applicantId: string) {
    const result = await query<ApplicationRow>(
      `
        SELECT
          id,
          applicant_id,
          job_listing_id,
          status,
          message,
          applied_at,
          employer_viewed
        FROM applications
        WHERE applicant_id = $1
        ORDER BY applied_at DESC
      `,
      [applicantId]
    );

    return result.rows.map(mapApplication);
  },

  async listForEmployer(employerId: string) {
    const result = await query<EmployerApplicationRow>(
      `
        SELECT
          applications.id,
          applications.status,
          applications.message,
          applications.applied_at,
          applications.employer_viewed,
          job_listings.id AS job_id,
          job_listings.job_title,
          COALESCE(job_listings.county_location, job_listings.location_zip) AS county_location,
          job_listings.status AS job_status,
          users.id AS applicant_id,
          users.full_name AS applicant_full_name,
          users.trade_type AS applicant_trade_type,
          users.rating_average AS applicant_rating_average,
          users.rating_count AS applicant_rating_count,
          users.trust_badge AS applicant_trust_badge,
          users.verification_status AS applicant_verification_status
        FROM applications
        INNER JOIN job_listings ON job_listings.id = applications.job_listing_id
        INNER JOIN users ON users.id = applications.applicant_id
        WHERE job_listings.employer_id = $1
        ORDER BY applications.applied_at DESC
      `,
      [employerId]
    );

    return result.rows.map(mapEmployerApplication);
  },

  async updateStatusForEmployer(
    applicationId: string,
    employerId: string,
    status: ApplicationStatus
  ) {
    const result = await query<EmployerApplicationRow>(
      `
        UPDATE applications
        SET
          status = $3,
          employer_viewed = true,
          employer_response_at = NOW()
        FROM job_listings, users
        WHERE
          applications.id = $1
          AND job_listings.id = applications.job_listing_id
          AND job_listings.employer_id = $2
          AND users.id = applications.applicant_id
        RETURNING
          applications.id,
          applications.status,
          applications.message,
          applications.applied_at,
          applications.employer_viewed,
          job_listings.id AS job_id,
          job_listings.job_title,
          COALESCE(job_listings.county_location, job_listings.location_zip) AS county_location,
          job_listings.status AS job_status,
          users.id AS applicant_id,
          users.full_name AS applicant_full_name,
          users.trade_type AS applicant_trade_type,
          users.rating_average AS applicant_rating_average,
          users.rating_count AS applicant_rating_count,
          users.trust_badge AS applicant_trust_badge,
          users.verification_status AS applicant_verification_status
      `,
      [applicationId, employerId, status]
    );

    const row = result.rows[0];
    return row ? mapEmployerApplication(row) : null;
  },

  async findByApplicantAndJob(applicantId: string, jobListingId: string) {
    const result = await query<ApplicationRow>(
      `
        SELECT
          id,
          applicant_id,
          job_listing_id,
          status,
          message,
          applied_at,
          employer_viewed
        FROM applications
        WHERE applicant_id = $1 AND job_listing_id = $2
        LIMIT 1
      `,
      [applicantId, jobListingId]
    );

    const row = result.rows[0];
    return row ? mapApplication(row) : null;
  },

  async create(applicantId: string, jobListingId: string, message?: string) {
    const result = await query<ApplicationRow>(
      `
        INSERT INTO applications (
          applicant_id,
          job_listing_id,
          message
        )
        VALUES ($1, $2, $3)
        RETURNING
          id,
          applicant_id,
          job_listing_id,
          status,
          message,
          applied_at,
          employer_viewed
      `,
      [applicantId, jobListingId, message ?? null]
    );

    await query(
      `
        UPDATE job_listings
        SET applications_count = applications_count + 1
        WHERE id = $1
      `,
      [jobListingId]
    );

    return mapApplication(result.rows[0]);
  }
};
