import type { CRMContact, FeedBundle, JobListing, QuickCashPost, SocialPost, User } from "@laborforce/shared";

export const demoUsers: User[] = [
  {
    id: "u-emp-1",
    email: "maria@laborforce.app",
    fullName: "Maria Lopez",
    phone: "+1-555-0100",
    zipCode: "10001",
    userTag: "employee",
    tradeType: "Electrician",
    isVerified: true,
    isPremium: true,
    verificationStatus: "verified",
    profilePhotoUrl: null,
    bio: "Journeyman electrician focused on residential service calls and panel upgrades.",
    yearsExperience: 9,
    hourlyRate: 48,
    openToWork: true,
    ratingAverage: 4.8,
    ratingCount: 33,
    trustBadge: "Gold Verified",
    unionStatus: "IBEW",
    latitude: 40.7506,
    longitude: -73.9972,
    isBusinessVerified: false,
    businessName: null
  },
  {
    id: "u-biz-1",
    email: "dispatch@northsidehvac.com",
    fullName: "Darren Cole",
    phone: "+1-555-0200",
    zipCode: "11211",
    userTag: "employer",
    tradeType: "HVAC",
    isVerified: true,
    isPremium: true,
    verificationStatus: "verified",
    profilePhotoUrl: null,
    bio: "Licensed HVAC contractor hiring lead installers and service techs.",
    yearsExperience: null,
    hourlyRate: null,
    openToWork: false,
    ratingAverage: 4.6,
    ratingCount: 18,
    trustBadge: "Gold Verified",
    unionStatus: null,
    latitude: 40.7171,
    longitude: -73.9565,
    isBusinessVerified: true,
    businessName: "Northside HVAC"
  }
];

export const demoJobs: JobListing[] = [
  {
    id: "job-1",
    employerId: "u-biz-1",
    jobTitle: "Lead HVAC Installer",
    tradeCategory: "HVAC",
    description: "Install split systems, ductwork retrofits, and mentor junior crew members.",
    hourlyRateMin: 38,
    hourlyRateMax: 52,
    jobType: "full_time",
    benefits: "401k, health, truck stipend",
    countyLocation: "Kings County, NY",
    locationZip: "11211",
    latitude: 40.7171,
    longitude: -73.9565,
    status: "active",
    depositAmount: 20,
    depositStatus: "held",
    applicationsCount: 14,
    viewsCount: 221,
    isSurge: true,
    unionRequired: false,
    certificationsRequired: ["EPA 608"],
    postedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString()
  }
];

export const demoQuickCash: QuickCashPost[] = [
  {
    id: "qc-1",
    customerId: "u-cust-1",
    taskTitle: "Swap bathroom exhaust fan",
    description: "Need same-day replacement of an old noisy bathroom fan in a condo.",
    tradeCategory: "Electrical",
    budgetMin: 150,
    budgetMax: 250,
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
    postText: "Panel upgrade and clean labeling for a brownstone renovation. Proof Wall update.",
    photoUrls: [
      "https://images.unsplash.com/photo-1581092919535-7146ff1a590c?auto=format&fit=crop&w=900&q=80"
    ],
    videoUrl: null,
    isProofWall: true,
    tradeTag: "Electrical",
    locationDisplay: "Manhattan, NY",
    latitude: 40.7506,
    longitude: -73.9972,
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
    notes: "Seasonal rooftop unit replacements for six properties.",
    pipelineStage: "Quoted",
    projectValue: 18400,
    lastContactAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 8).toISOString(),
    followUpAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    followUpSent: false,
    tags: ["commercial", "maintenance"]
  }
];

export const demoFeed: FeedBundle = {
  jobs: demoJobs,
  quickCash: demoQuickCash,
  social: demoSocial
};
