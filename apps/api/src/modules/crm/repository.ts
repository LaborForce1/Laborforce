import type { CRMContact, PipelineStage } from "@laborforce/shared";
import { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma.js";

export interface CreateCrmContactInput {
  ownerId: string;
  contactName: string;
  contactPhone?: string | null;
  contactEmail?: string | null;
  notes?: string | null;
  pipelineStage: PipelineStage;
  projectValue?: number | null;
  lastContactAt?: string | null;
  followUpAt?: string | null;
  tags?: string[];
}

export interface UpdateCrmContactInput {
  contactName: string;
  contactPhone?: string | null;
  contactEmail?: string | null;
  notes?: string | null;
  pipelineStage: PipelineStage;
  projectValue?: number | null;
  lastContactAt?: string | null;
  followUpAt?: string | null;
  followUpSent: boolean;
  tags?: string[];
}

const crmSelect = {
  id: true,
  ownerId: true,
  contactName: true,
  contactPhone: true,
  contactEmail: true,
  notes: true,
  pipelineStage: true,
  projectValue: true,
  lastContactAt: true,
  followUpAt: true,
  followUpSent: true,
  tags: true
} satisfies Prisma.CrmContactSelect;

type CrmRecord = Prisma.CrmContactGetPayload<{ select: typeof crmSelect }>;

function mapCrmContact(row: CrmRecord): CRMContact {
  return {
    id: row.id,
    ownerId: row.ownerId,
    contactName: row.contactName,
    contactPhone: row.contactPhone,
    contactEmail: row.contactEmail,
    notes: row.notes,
    pipelineStage: row.pipelineStage as PipelineStage,
    projectValue: row.projectValue == null ? null : Number(row.projectValue),
    lastContactAt: row.lastContactAt?.toISOString() ?? null,
    followUpAt: row.followUpAt?.toISOString() ?? null,
    followUpSent: row.followUpSent,
    tags: Array.isArray(row.tags) ? row.tags.filter((item): item is string => typeof item === "string") : []
  };
}

function toDate(value?: string | null) {
  return value ? new Date(value) : null;
}

export const crmRepository = {
  async listByOwner(ownerId: string) {
    const rows = await prisma.crmContact.findMany({
      where: { ownerId },
      orderBy: [{ pipelineStage: "asc" }, { createdAt: "desc" }],
      select: crmSelect
    });

    return rows.map(mapCrmContact);
  },

  async findByIdForOwner(id: string, ownerId: string) {
    const row = await prisma.crmContact.findFirst({
      where: { id, ownerId },
      select: crmSelect
    });

    return row ? mapCrmContact(row) : null;
  },

  async create(input: CreateCrmContactInput) {
    const row = await prisma.crmContact.create({
      data: {
        ownerId: input.ownerId,
        contactName: input.contactName,
        contactPhone: input.contactPhone ?? null,
        contactEmail: input.contactEmail ?? null,
        notes: input.notes ?? null,
        pipelineStage: input.pipelineStage,
        projectValue: input.projectValue ?? null,
        lastContactAt: toDate(input.lastContactAt),
        followUpAt: toDate(input.followUpAt),
        followUpSent: false,
        tags: input.tags ?? []
      },
      select: crmSelect
    });

    return mapCrmContact(row);
  },

  async update(id: string, ownerId: string, input: UpdateCrmContactInput) {
    const existing = await prisma.crmContact.findFirst({
      where: { id, ownerId },
      select: { id: true }
    });

    if (!existing) {
      return null;
    }

    const row = await prisma.crmContact.update({
      where: { id },
      data: {
        contactName: input.contactName,
        contactPhone: input.contactPhone ?? null,
        contactEmail: input.contactEmail ?? null,
        notes: input.notes ?? null,
        pipelineStage: input.pipelineStage,
        projectValue: input.projectValue ?? null,
        lastContactAt: toDate(input.lastContactAt),
        followUpAt: toDate(input.followUpAt),
        followUpSent: input.followUpSent,
        tags: input.tags ?? []
      },
      select: crmSelect
    });

    return mapCrmContact(row);
  }
};
