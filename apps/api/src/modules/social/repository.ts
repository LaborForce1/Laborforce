import type { SocialFeedItem, SocialPost, TrustBadge, UserTag, VerificationStatus } from "@laborforce/shared";
import { query } from "../../db/query.js";

interface SocialPostRow {
  id: string;
  author_id: string;
  post_text: string;
  photo_urls: string[];
  video_url: string | null;
  is_proof_wall: boolean;
  trade_tag: string;
  location_display: string | null;
  latitude: string | null;
  longitude: string | null;
  respects_count: number;
  impressed_count: number;
  helpful_count: number;
  comments_count: number;
  created_at: Date;
}

interface SocialFeedRow extends SocialPostRow {
  full_name: string;
  user_tag: UserTag;
  trade_type: string | null;
  business_name: string | null;
  profile_photo_url: string | null;
  verification_status: VerificationStatus;
  is_verified: boolean;
  trust_badge: TrustBadge | null;
}

export interface CreateSocialPostInput {
  authorId: string;
  postText: string;
  photoUrls?: string[];
  videoUrl?: string | null;
  isProofWall?: boolean;
  tradeTag: string;
  locationDisplay?: string | null;
}

function toNullableNumber(value: string | null) {
  return value === null ? null : Number(value);
}

function mapPost(row: SocialPostRow): SocialPost {
  return {
    id: row.id,
    authorId: row.author_id,
    postText: row.post_text,
    photoUrls: row.photo_urls ?? [],
    videoUrl: row.video_url,
    isProofWall: row.is_proof_wall,
    tradeTag: row.trade_tag,
    locationDisplay: row.location_display ?? "",
    latitude: toNullableNumber(row.latitude),
    longitude: toNullableNumber(row.longitude),
    respectsCount: row.respects_count,
    impressedCount: row.impressed_count,
    helpfulCount: row.helpful_count,
    commentsCount: row.comments_count,
    createdAt: row.created_at.toISOString()
  };
}

function mapFeedItem(row: SocialFeedRow): SocialFeedItem {
  return {
    ...mapPost(row),
    author: {
      id: row.author_id,
      fullName: row.full_name,
      userTag: row.user_tag,
      tradeType: row.trade_type,
      businessName: row.business_name,
      profilePhotoUrl: row.profile_photo_url,
      verificationStatus: row.verification_status,
      isVerified: row.is_verified,
      trustBadge: row.trust_badge
    }
  };
}

export const socialRepository = {
  async listFeed(limit: number) {
    const result = await query<SocialFeedRow>(
      `
        SELECT
          social_posts.id,
          social_posts.author_id,
          social_posts.post_text,
          ARRAY(
            SELECT jsonb_array_elements_text(social_posts.photo_urls)
          ) AS photo_urls,
          social_posts.video_url,
          social_posts.is_proof_wall,
          social_posts.trade_tag,
          social_posts.location_display,
          social_posts.latitude,
          social_posts.longitude,
          social_posts.respects_count,
          social_posts.impressed_count,
          social_posts.helpful_count,
          social_posts.comments_count,
          social_posts.created_at,
          users.full_name,
          users.user_tag,
          users.trade_type,
          users.business_name,
          users.profile_photo_url,
          users.verification_status,
          users.is_verified,
          users.trust_badge
        FROM social_posts
        INNER JOIN users ON users.id = social_posts.author_id
        ORDER BY social_posts.created_at DESC
        LIMIT $1
      `,
      [limit]
    );

    return result.rows.map(mapFeedItem);
  },

  async create(input: CreateSocialPostInput) {
    const result = await query<SocialPostRow>(
      `
        INSERT INTO social_posts (
          author_id,
          post_text,
          photo_urls,
          video_url,
          is_proof_wall,
          trade_tag,
          location_display
        )
        VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7)
        RETURNING
          id,
          author_id,
          post_text,
          ARRAY(
            SELECT jsonb_array_elements_text(photo_urls)
          ) AS photo_urls,
          video_url,
          is_proof_wall,
          trade_tag,
          location_display,
          latitude,
          longitude,
          respects_count,
          impressed_count,
          helpful_count,
          comments_count,
          created_at
      `,
      [
        input.authorId,
        input.postText,
        JSON.stringify(input.photoUrls ?? []),
        input.videoUrl ?? null,
        input.isProofWall ?? false,
        input.tradeTag,
        input.locationDisplay ?? null
      ]
    );

    return mapPost(result.rows[0]);
  }
};
