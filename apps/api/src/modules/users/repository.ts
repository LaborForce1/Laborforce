import type { TrustBadge, User, UserTag, VerificationStatus } from "@laborforce/shared";
import { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma.js";

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  fullName: string;
  phone: string;
  zipCode: string;
  userTag: UserTag;
  tradeType?: string;
  businessName?: string;
}

export interface UpdateProfileInput {
  fullName: string;
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

const userSelect = {
  id: true,
  email: true,
  fullName: true,
  phone: true,
  zipCode: true,
  userTag: true,
  tradeType: true,
  isVerified: true,
  isPremium: true,
  verificationStatus: true,
  profilePhotoUrl: true,
  bio: true,
  yearsExperience: true,
  hourlyRate: true,
  openToWork: true,
  ratingAverage: true,
  ratingCount: true,
  trustBadge: true,
  unionStatus: true,
  latitude: true,
  longitude: true,
  isBusinessVerified: true,
  businessName: true
} satisfies Prisma.UserSelect;

const userWithPasswordSelect = {
  ...userSelect,
  passwordHash: true
} satisfies Prisma.UserSelect;

type PrismaUser = Prisma.UserGetPayload<{ select: typeof userSelect }>;
type PrismaUserWithPassword = Prisma.UserGetPayload<{ select: typeof userWithPasswordSelect }>;

function toNullableNumber(value: Prisma.Decimal | null | undefined): number | null {
  return value == null ? null : Number(value);
}

export function mapUser(row: PrismaUser): User {
  return {
    id: row.id,
    email: row.email,
    fullName: row.fullName,
    phone: row.phone,
    zipCode: row.zipCode,
    userTag: row.userTag as UserTag,
    tradeType: row.tradeType,
    isVerified: row.isVerified,
    isPremium: row.isPremium,
    verificationStatus: row.verificationStatus as VerificationStatus,
    profilePhotoUrl: row.profilePhotoUrl,
    bio: row.bio,
    yearsExperience: row.yearsExperience,
    hourlyRate: toNullableNumber(row.hourlyRate),
    openToWork: row.openToWork,
    ratingAverage: Number(row.ratingAverage),
    ratingCount: row.ratingCount,
    trustBadge: row.trustBadge as TrustBadge | null,
    unionStatus: row.unionStatus,
    latitude: toNullableNumber(row.latitude),
    longitude: toNullableNumber(row.longitude),
    isBusinessVerified: row.isBusinessVerified,
    businessName: row.businessName
  };
}

export const usersRepository = {
  async create(input: CreateUserInput) {
    const row = await prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        passwordHash: input.passwordHash,
        fullName: input.fullName,
        phone: input.phone,
        zipCode: input.zipCode,
        userTag: input.userTag,
        tradeType: input.tradeType ?? null,
        businessName: input.businessName ?? null
      },
      select: userWithPasswordSelect
    });

    return {
      user: mapUser(row),
      passwordHash: row.passwordHash
    };
  },

  async findByEmail(email: string) {
    const row = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: userWithPasswordSelect
    });

    return row
      ? {
          user: mapUser(row),
          passwordHash: row.passwordHash
        }
      : null;
  },

  async findById(id: string) {
    const row = await prisma.user.findUnique({
      where: { id },
      select: userSelect
    });

    return row ? mapUser(row) : null;
  },

  async list() {
    const rows = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      select: userSelect
    });

    return rows.map(mapUser);
  },

  async updateProfile(id: string, input: UpdateProfileInput) {
    const row = await prisma.user.update({
      where: { id },
      data: {
        fullName: input.fullName,
        tradeType: input.tradeType ?? null,
        businessName: input.businessName ?? null,
        bio: input.bio ?? null,
        yearsExperience: input.yearsExperience ?? null,
        hourlyRate: input.hourlyRate ?? null,
        unionStatus: input.unionStatus ?? null,
        openToWork: input.openToWork,
        profilePhotoUrl: input.profilePhotoUrl ?? null
      },
      select: userSelect
    }).catch((error: unknown) => {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
        return null;
      }

      throw error;
    });

    return row ? mapUser(row) : null;
  },

  async completeBusinessVerification(id: string, input: CompleteBusinessVerificationInput = {}) {
    const row = await prisma.user.update({
      where: { id },
      data: {
        businessName: input.businessName?.trim() || undefined,
        isBusinessVerified: true,
        isVerified: true,
        verificationStatus: "verified"
      },
      select: userSelect
    }).catch((error: unknown) => {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
        return null;
      }

      throw error;
    });

    return row ? mapUser(row) : null;
  }
};
