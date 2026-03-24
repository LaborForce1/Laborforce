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
  userTag: UserTag;
  tradeType?: string;
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
          user_tag,
          trade_type
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
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
        input.userTag,
        input.tradeType ?? null
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
  }
};

