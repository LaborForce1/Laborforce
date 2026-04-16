import type { User, UserTag, VerificationStatus } from "@laborforce/shared";
import { query } from "../../db/query.js";

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  phone: string;
  zip_code: string;
  user_tag: UserTag;
  trade_type: string | null;
  is_verified: boolean;
  is_premium: boolean;
  verification_status: VerificationStatus;
  profile_photo_url: string | null;
  bio: string | null;
  years_experience: number | null;
  hourly_rate: string | null;
  open_to_work: boolean;
  rating_average: string;
  rating_count: number;
  trust_badge: User["trustBadge"] | null;
  union_status: string | null;
  latitude: string | null;
  longitude: string | null;
  is_business_verified: boolean;
  business_name: string | null;
}

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  fullName: string;
  phone: string;
  zipCode: string;
  latitude: number;
  longitude: number;
  userTag: UserTag;
  tradeType?: string;
  businessName?: string;
}

export interface UpdateProfileInput {
  fullName: string;
  zipCode: string;
  latitude: number;
  longitude: number;
  tradeType?: string | null;
  businessName?: string | null;
  bio?: string | null;
  yearsExperience?: number | null;
  hourlyRate?: number | null;
  unionStatus?: string | null;
  openToWork: boolean;
  profilePhotoUrl?: string | null;
}

export interface CompleteBusinessVerificationInput {
  businessName?: string | null;
}

export interface UpdateUserLocationInput {
  zipCode: string;
  latitude: number;
  longitude: number;
}

function toNullableNumber(value: string | null): number | null {
  return value === null ? null : Number(value);
}

export function mapUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    phone: row.phone,
    zipCode: row.zip_code,
    userTag: row.user_tag,
    tradeType: row.trade_type,
    isVerified: row.is_verified,
    isPremium: row.is_premium,
    verificationStatus: row.verification_status,
    profilePhotoUrl: row.profile_photo_url,
    bio: row.bio,
    yearsExperience: row.years_experience,
    hourlyRate: toNullableNumber(row.hourly_rate),
    openToWork: row.open_to_work,
    ratingAverage: Number(row.rating_average),
    ratingCount: row.rating_count,
    trustBadge: row.trust_badge,
    unionStatus: row.union_status,
    latitude: toNullableNumber(row.latitude),
    longitude: toNullableNumber(row.longitude),
    isBusinessVerified: row.is_business_verified,
    businessName: row.business_name
  };
}

const baseSelect = `
  SELECT
    id,
    email,
    password_hash,
    full_name,
    phone,
    zip_code,
    user_tag,
    trade_type,
    is_verified,
    is_premium,
    verification_status,
    profile_photo_url,
    bio,
    years_experience,
    hourly_rate,
    open_to_work,
    rating_average,
    rating_count,
    trust_badge,
    union_status,
    latitude,
    longitude,
    is_business_verified,
    business_name
  FROM users
`;

export const usersRepository = {
  async create(input: CreateUserInput) {
    const result = await query<UserRow>(
      `
        INSERT INTO users (
          email,
          password_hash,
          full_name,
          phone,
          zip_code,
          latitude,
          longitude,
          user_tag,
          trade_type,
          business_name
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING
          id,
          email,
          password_hash,
          full_name,
          phone,
          zip_code,
          user_tag,
          trade_type,
          is_verified,
          is_premium,
          verification_status,
          profile_photo_url,
          bio,
          years_experience,
          hourly_rate,
          open_to_work,
          rating_average,
          rating_count,
          trust_badge,
          union_status,
          latitude,
          longitude,
          is_business_verified,
          business_name
      `,
      [
        input.email.toLowerCase(),
        input.passwordHash,
        input.fullName,
        input.phone,
        input.zipCode,
        input.latitude,
        input.longitude,
        input.userTag,
        input.tradeType ?? null,
        input.businessName ?? null
      ]
    );

    return {
      user: mapUser(result.rows[0]),
      passwordHash: result.rows[0].password_hash
    };
  },

  async findByEmail(email: string) {
    const result = await query<UserRow>(`${baseSelect} WHERE email = $1 LIMIT 1`, [email.toLowerCase()]);
    const row = result.rows[0];
    return row ? { user: mapUser(row), passwordHash: row.password_hash } : null;
  },

  async findById(id: string) {
    const result = await query<UserRow>(`${baseSelect} WHERE id = $1 LIMIT 1`, [id]);
    const row = result.rows[0];
    return row ? mapUser(row) : null;
  },

  async list() {
    const result = await query<UserRow>(`${baseSelect} ORDER BY created_at DESC LIMIT 100`);
    return result.rows.map(mapUser);
  },

  async updateProfile(id: string, input: UpdateProfileInput) {
    const result = await query<UserRow>(
      `
        UPDATE users
        SET
          full_name = $2,
          zip_code = $3,
          latitude = $4,
          longitude = $5,
          trade_type = $6,
          business_name = $7,
          bio = $8,
          years_experience = $9,
          hourly_rate = $10,
          union_status = $11,
          open_to_work = $12,
          profile_photo_url = $13,
          updated_at = NOW()
        WHERE id = $1
        RETURNING
          id,
          email,
          password_hash,
          full_name,
          phone,
          zip_code,
          user_tag,
          trade_type,
          is_verified,
          is_premium,
          verification_status,
          profile_photo_url,
          bio,
          years_experience,
          hourly_rate,
          open_to_work,
          rating_average,
          rating_count,
          trust_badge,
          union_status,
          latitude,
          longitude,
          is_business_verified,
          business_name
      `,
      [
        id,
        input.fullName,
        input.zipCode,
        input.latitude,
        input.longitude,
        input.tradeType ?? null,
        input.businessName ?? null,
        input.bio ?? null,
        input.yearsExperience ?? null,
        input.hourlyRate ?? null,
        input.unionStatus ?? null,
        input.openToWork,
        input.profilePhotoUrl ?? null
      ]
    );

    const row = result.rows[0];
    return row ? mapUser(row) : null;
  },

  async updateLocation(id: string, input: UpdateUserLocationInput) {
    const result = await query<UserRow>(
      `
        UPDATE users
        SET
          zip_code = $2,
          latitude = $3,
          longitude = $4,
          updated_at = NOW()
        WHERE id = $1
        RETURNING
          id,
          email,
          password_hash,
          full_name,
          phone,
          zip_code,
          user_tag,
          trade_type,
          is_verified,
          is_premium,
          verification_status,
          profile_photo_url,
          bio,
          years_experience,
          hourly_rate,
          open_to_work,
          rating_average,
          rating_count,
          trust_badge,
          union_status,
          latitude,
          longitude,
          is_business_verified,
          business_name
      `,
      [id, input.zipCode, input.latitude, input.longitude]
    );

    const row = result.rows[0];
    return row ? mapUser(row) : null;
  },

  async completeBusinessVerification(id: string, input: CompleteBusinessVerificationInput = {}) {
    const result = await query<UserRow>(
      `
        UPDATE users
        SET
          business_name = COALESCE(NULLIF($2, ''), business_name),
          is_business_verified = TRUE,
          is_verified = TRUE,
          verification_status = 'verified',
          updated_at = NOW()
        WHERE id = $1
        RETURNING
          id,
          email,
          password_hash,
          full_name,
          phone,
          zip_code,
          user_tag,
          trade_type,
          is_verified,
          is_premium,
          verification_status,
          profile_photo_url,
          bio,
          years_experience,
          hourly_rate,
          open_to_work,
          rating_average,
          rating_count,
          trust_badge,
          union_status,
          latitude,
          longitude,
          is_business_verified,
          business_name
      `,
      [id, input.businessName ?? null]
    );

    const row = result.rows[0];
    return row ? mapUser(row) : null;
  }
};
