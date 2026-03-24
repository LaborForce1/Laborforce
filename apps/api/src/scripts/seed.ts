import { authService } from "../services/authService.js";
import { query } from "../db/query.js";
import { applySchema } from "../db/bootstrap.js";
import { pool } from "../db/pool.js";

async function main() {
  await applySchema();

  const employerPassword = await authService.hashPassword("LaborForce123!");
  const workerPassword = await authService.hashPassword("LaborForce123!");

  await query(
    `
      INSERT INTO users (
        email,
        password_hash,
        full_name,
        phone,
        zip_code,
        user_tag,
        trade_type,
        is_verified,
        verification_status,
        selfie_match_passed,
        is_business_verified,
        business_name,
        rating_average,
        rating_count,
        trust_badge
      )
      VALUES
        ($1, $2, $3, $4, $5, 'employer', 'HVAC', TRUE, 'verified', TRUE, TRUE, 'Northside HVAC', 4.6, 18, 'Gold Verified'),
        ($6, $7, $8, $9, $10, 'employee', 'Electrician', TRUE, 'verified', TRUE, FALSE, NULL, 4.8, 33, 'Gold Verified')
      ON CONFLICT (email) DO NOTHING
    `,
    [
      "dispatch@northsidehvac.com",
      employerPassword,
      "Darren Cole",
      "+1-555-0200",
      "11211",
      "maria@laborforce.app",
      workerPassword,
      "Maria Lopez",
      "+1-555-0100",
      "10001"
    ]
  );

  const employerResult = await query<{ id: string }>(
    "SELECT id FROM users WHERE email = $1 LIMIT 1",
    ["dispatch@northsidehvac.com"]
  );
  const employerId = employerResult.rows[0]?.id;

  if (employerId) {
    const existingJob = await query<{ id: string }>(
      "SELECT id FROM job_listings WHERE employer_id = $1 AND job_title = $2 LIMIT 1",
      [employerId, "Lead HVAC Installer"]
    );

    if (!existingJob.rows[0]) {
      await query(
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
            certifications_required
          )
          VALUES (
            $1,
            'Lead HVAC Installer',
            'HVAC',
            'Install split systems, ductwork retrofits, and mentor junior crew members.',
            38,
            52,
            'full_time',
            '401k, health, truck stipend',
            'Kings County, NY',
            '11211',
            40.7171,
            -73.9565,
            'active',
            20.00,
            'held',
            TRUE,
            '["EPA 608"]'::jsonb
          )
        `,
        [employerId]
      );
    }
  }

  console.log("LaborForce seed data inserted.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
