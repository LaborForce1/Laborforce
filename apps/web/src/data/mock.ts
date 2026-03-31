import type { CRMContact, QuickCashPost, SocialPost, UserTag } from "@laborforce/shared";

export const userOptions: Array<{ tag: UserTag; title: string; description: string }> = [
  { tag: "employee", title: "Employee", description: "Tradespeople building a verified portfolio and finding jobs." },
  { tag: "employer", title: "Employer", description: "Contractors and businesses hiring verified local talent." },
  { tag: "customer", title: "Customer", description: "Homeowners and managers posting fast-turnaround work." }
];

export const demoQuickCash: QuickCashPost[] = [
  {
    id: "qc-1",
    customerId: "u-cust-1",
    taskTitle: "Replace ceiling fan",
    description: "Need an old fan swapped for a new one this evening.",
    tradeCategory: "Electrical",
    budgetMin: 175,
    budgetMax: 260,
    locationZip: "10003",
    latitude: 40.7318,
    longitude: -73.9892,
    status: "open",
    isSurge: true,
    estimatedHours: 2,
    escrowAmount: 220,
    assignedWorkerId: null,
    postedAt: new Date().toISOString()
  }
];

export const demoSocial: SocialPost[] = [
  {
    id: "post-1",
    authorId: "u-emp-1",
    postText: "Proof Wall update from today’s service panel cleanup and relabel.",
    photoUrls: [
      "https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=900&q=80"
    ],
    videoUrl: null,
    isProofWall: true,
    tradeTag: "Electrical",
    locationDisplay: "Manhattan, NY",
    latitude: 40.75,
    longitude: -73.99,
    respectsCount: 82,
    impressedCount: 41,
    helpfulCount: 9,
    commentsCount: 12,
    createdAt: new Date().toISOString()
  }
];

export const demoCRM: CRMContact[] = [
  {
    id: "crm-1",
    ownerId: "u-biz-1",
    contactName: "Riverside Property Group",
    contactPhone: "+1-555-3000",
    contactEmail: "ops@riverside.example",
    notes: "Follow up on rooftop units and annual maintenance contract.",
    pipelineStage: "Quoted",
    projectValue: 18400,
    lastContactAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 8).toISOString(),
    followUpAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    followUpSent: false,
    tags: ["commercial", "maintenance"]
  }
];
