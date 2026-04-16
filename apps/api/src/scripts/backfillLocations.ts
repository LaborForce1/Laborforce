import { pool } from "../db/pool.js";
import { query } from "../db/query.js";
import {
  distanceMilesBetweenCoordinates,
  formatUsZipAreaLabel,
  hasCoordinates,
  lookupUsZipCode,
  normalizeUsZipCode
} from "../services/locationLookup.js";

interface UserBackfillRow {
  id: string;
  zip_code: string;
  latitude: string | null;
  longitude: string | null;
}

interface JobBackfillRow {
  id: string;
  county_location: string | null;
  location_zip: string;
  latitude: string | null;
  longitude: string | null;
  employer_zip_code: string;
  employer_latitude: string | null;
  employer_longitude: string | null;
}

function toNullableNumber(value: string | null) {
  return value === null ? null : Number(value);
}

function coordinatesNeedZipRealignment(
  latitude: number | null,
  longitude: number | null,
  expectedLatitude: number,
  expectedLongitude: number
) {
  if (!hasCoordinates(latitude, longitude)) {
    return true;
  }

  return (
    distanceMilesBetweenCoordinates(
      { latitude: latitude ?? 0, longitude: longitude ?? 0 },
      { latitude: expectedLatitude, longitude: expectedLongitude }
    ) > 25
  );
}

function shouldReplaceAreaLabel(areaLabel: string | null, locationZip: string, fallbackAreaLabel: string) {
  const normalizedAreaLabel = areaLabel?.trim() ?? "";

  if (!normalizedAreaLabel) {
    return true;
  }

  if (normalizedAreaLabel === locationZip) {
    return true;
  }

  const normalizedZipCode = normalizeUsZipCode(normalizedAreaLabel);
  if (normalizedZipCode === locationZip) {
    return true;
  }

  return normalizedAreaLabel.toLowerCase() === fallbackAreaLabel.toLowerCase();
}

async function backfillUsers() {
  const result = await query<UserBackfillRow>(
    `
      SELECT id, zip_code, latitude, longitude
      FROM users
    `
  );

  let updatedCount = 0;
  let skippedCount = 0;

  for (const row of result.rows) {
    const resolvedLocation = lookupUsZipCode(row.zip_code);
    const latitude = toNullableNumber(row.latitude);
    const longitude = toNullableNumber(row.longitude);

    if (!resolvedLocation) {
      skippedCount += 1;
      continue;
    }

    if (!coordinatesNeedZipRealignment(latitude, longitude, resolvedLocation.latitude, resolvedLocation.longitude)) {
      continue;
    }

    await query(
      `
        UPDATE users
        SET
          zip_code = $2,
          latitude = $3,
          longitude = $4,
          updated_at = NOW()
        WHERE id = $1
      `,
      [row.id, resolvedLocation.zipCode, resolvedLocation.latitude, resolvedLocation.longitude]
    );

    updatedCount += 1;
  }

  return {
    scannedCount: result.rows.length,
    updatedCount,
    skippedCount
  };
}

async function backfillJobs() {
  const result = await query<JobBackfillRow>(
    `
      SELECT
        job_listings.id,
        job_listings.county_location,
        job_listings.location_zip,
        job_listings.latitude,
        job_listings.longitude,
        users.zip_code AS employer_zip_code,
        users.latitude AS employer_latitude,
        users.longitude AS employer_longitude
      FROM job_listings
      INNER JOIN users ON users.id = job_listings.employer_id
    `
  );

  let updatedFromJobZipCount = 0;
  let updatedFromEmployerZipCount = 0;
  let skippedCount = 0;

  for (const row of result.rows) {
    const directZipLocation = lookupUsZipCode(row.location_zip);
    const latitude = toNullableNumber(row.latitude);
    const longitude = toNullableNumber(row.longitude);

    if (directZipLocation) {
      const fallbackAreaLabel = formatUsZipAreaLabel(directZipLocation);
      const nextAreaLabel = shouldReplaceAreaLabel(row.county_location, directZipLocation.zipCode, fallbackAreaLabel)
        ? fallbackAreaLabel
        : row.county_location?.trim() ?? fallbackAreaLabel;

      if (
        !coordinatesNeedZipRealignment(latitude, longitude, directZipLocation.latitude, directZipLocation.longitude) &&
        nextAreaLabel === (row.county_location?.trim() ?? "")
      ) {
        continue;
      }

      await query(
        `
          UPDATE job_listings
          SET
            county_location = $2,
            location_zip = $3,
            latitude = $4,
            longitude = $5
          WHERE id = $1
        `,
        [row.id, nextAreaLabel, directZipLocation.zipCode, directZipLocation.latitude, directZipLocation.longitude]
      );

      updatedFromJobZipCount += 1;
      continue;
    }

    const employerZipLocation = lookupUsZipCode(row.employer_zip_code);
    const employerLatitude = toNullableNumber(row.employer_latitude);
    const employerLongitude = toNullableNumber(row.employer_longitude);

    if (!employerZipLocation) {
      skippedCount += 1;
      continue;
    }

    const fallbackAreaLabel = formatUsZipAreaLabel(employerZipLocation);
    const nextAreaLabel = shouldReplaceAreaLabel(row.county_location, row.location_zip, fallbackAreaLabel)
      ? fallbackAreaLabel
      : row.county_location?.trim() || fallbackAreaLabel;
    const nextLatitude: number = hasCoordinates(employerLatitude, employerLongitude)
      ? employerLatitude ?? employerZipLocation.latitude
      : employerZipLocation.latitude;
    const nextLongitude: number = hasCoordinates(employerLatitude, employerLongitude)
      ? employerLongitude ?? employerZipLocation.longitude
      : employerZipLocation.longitude;

    if (
      hasCoordinates(latitude, longitude) &&
      !coordinatesNeedZipRealignment(latitude, longitude, nextLatitude, nextLongitude) &&
      nextAreaLabel === (row.county_location?.trim() ?? "") &&
      row.location_zip === employerZipLocation.zipCode
    ) {
      continue;
    }

    await query(
      `
        UPDATE job_listings
        SET
          county_location = $2,
          location_zip = $3,
          latitude = $4,
          longitude = $5
        WHERE id = $1
      `,
      [row.id, nextAreaLabel, employerZipLocation.zipCode, nextLatitude, nextLongitude]
    );

    updatedFromEmployerZipCount += 1;
  }

  return {
    scannedCount: result.rows.length,
    updatedFromJobZipCount,
    updatedFromEmployerZipCount,
    skippedCount
  };
}

async function main() {
  const userResults = await backfillUsers();
  const jobResults = await backfillJobs();

  console.log(
    JSON.stringify(
      {
        users: userResults,
        jobs: jobResults
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
