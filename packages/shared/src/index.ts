export type UserTag = "employee" | "employer" | "customer";
export type VerificationStatus = "pending" | "verified" | "failed" | "manual_review";
export type ListingStatus = "draft" | "active" | "filled" | "closed" | "expired";
export type JobType = "full_time" | "part_time" | "contract" | "temporary" | "same_day";
export type QuickCashStatus = "open" | "assigned" | "completed" | "cancelled" | "expired";
export type ApplicationStatus = "submitted" | "viewed" | "shortlisted" | "rejected" | "hired";
export type PipelineStage = "Lead" | "Quoted" | "Active" | "Invoiced" | "Completed";
export type TrustBadge = "Gold Verified" | "Trusted" | "Established" | "Under Review";

export interface User {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  zipCode: string;
  userTag: UserTag;
  tradeType?: string | null;
  isVerified: boolean;
  isPremium: boolean;
  verificationStatus: VerificationStatus;
  profilePhotoUrl?: string | null;
  bio?: string | null;
  yearsExperience?: number | null;
  hourlyRate?: number | null;
  openToWork: boolean;
  ratingAverage: number;
  ratingCount: number;
  trustBadge?: TrustBadge | null;
  unionStatus?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  isBusinessVerified: boolean;
  businessName?: string | null;
}

export interface JobListing {
  id: string;
  employerId: string;
  jobTitle: string;
  tradeCategory: string;
  description: string;
  hourlyRateMin: number;
  hourlyRateMax: number;
  jobType: JobType;
  benefits?: string | null;
  countyLocation: string;
  locationZip: string;
  latitude: number;
  longitude: number;
  status: ListingStatus;
  depositAmount: number;
  depositStatus: "pending" | "held" | "refunded" | "forfeited";
  applicationsCount: number;
  viewsCount: number;
  isSurge: boolean;
  unionRequired: boolean;
  certificationsRequired: string[];
  distanceMiles?: number | null;
  postedAt: string;
  expiresAt: string;
}

export interface QuickCashPost {
  id: string;
  customerId: string;
  taskTitle: string;
  description: string;
  tradeCategory: string;
  budgetMin: number;
  budgetMax: number;
  locationZip: string;
  latitude: number;
  longitude: number;
  status: QuickCashStatus;
  isSurge: boolean;
  estimatedHours: number;
  escrowAmount: number;
  assignedWorkerId?: string | null;
  postedAt: string;
}

export interface SocialPost {
  id: string;
  authorId: string;
  postText: string;
  photoUrls: string[];
  videoUrl?: string | null;
  isProofWall: boolean;
  tradeTag: string;
  locationDisplay: string;
  latitude?: number | null;
  longitude?: number | null;
  respectsCount: number;
  impressedCount: number;
  helpfulCount: number;
  commentsCount: number;
  createdAt: string;
}

export interface SocialFeedAuthor {
  id: string;
  fullName: string;
  userTag: UserTag;
  tradeType?: string | null;
  businessName?: string | null;
  profilePhotoUrl?: string | null;
  verificationStatus: VerificationStatus;
  isVerified: boolean;
  trustBadge?: TrustBadge | null;
}

export interface SocialFeedItem extends SocialPost {
  author: SocialFeedAuthor;
}

export interface CRMContact {
  id: string;
  ownerId: string;
  contactName: string;
  contactPhone?: string | null;
  contactEmail?: string | null;
  notes?: string | null;
  pipelineStage: PipelineStage;
  projectValue?: number | null;
  lastContactAt?: string | null;
  followUpAt?: string | null;
  followUpSent: boolean;
  tags: string[];
}

export interface FeedBundle {
  jobs: JobListing[];
  quickCash: QuickCashPost[];
  social: SocialPost[];
}

export interface JobApplication {
  id: string;
  applicantId: string;
  jobListingId: string;
  status: ApplicationStatus;
  message?: string | null;
  appliedAt: string;
  employerViewed: boolean;
  job?: {
    id: string;
    jobTitle: string;
    tradeCategory: string;
    countyLocation: string;
    status: ListingStatus;
    hourlyRateMin: number;
    hourlyRateMax: number;
  };
  employer?: {
    id: string;
    fullName: string;
    businessName?: string | null;
    verificationStatus: VerificationStatus;
  };
}

export interface EmployerApplicationView {
  id: string;
  status: ApplicationStatus;
  message?: string | null;
  appliedAt: string;
  employerViewed: boolean;
  job: {
    id: string;
    jobTitle: string;
    countyLocation: string;
    status: ListingStatus;
  };
  applicant: {
    id: string;
    fullName: string;
    tradeType?: string | null;
    ratingAverage: number;
    ratingCount: number;
    trustBadge?: TrustBadge | null;
    verificationStatus: VerificationStatus;
  };
}

export interface Message {
  id: string;
  senderId: string;
  recipientId: string;
  conversationId: string;
  messageText: string;
  attachmentUrl?: string | null;
  isRead: boolean;
  sentAt: string;
}

export interface MessageConversation {
  conversationId: string;
  participant: {
    id: string;
    fullName: string;
    userTag: UserTag;
    tradeType?: string | null;
    businessName?: string | null;
    isVerified: boolean;
    verificationStatus: VerificationStatus;
    trustBadge?: TrustBadge | null;
  };
  latestMessage: Message;
  unreadCount: number;
}

export interface AlertItem {
  id: string;
  type: "message" | "application" | "network" | "system";
  title: string;
  body: string;
  createdAt: string;
  isRead: boolean;
  actionLabel?: string | null;
}

export interface UserReview {
  id: string;
  reviewerId: string;
  reviewedUserId: string;
  rating: number;
  reviewText?: string | null;
  reviewType: string;
  relatedJobId?: string | null;
  relatedQcPostId?: string | null;
  reviewerSubmitted: boolean;
  reviewedSubmitted: boolean;
  isVisible: boolean;
  createdAt: string;
  reviewer?: {
    id: string;
    fullName: string;
    userTag: UserTag;
    tradeType?: string | null;
    businessName?: string | null;
    trustBadge?: TrustBadge | null;
  };
}

export const userTags: UserTag[] = ["employee", "employer", "customer"];
export const pipelineStages: PipelineStage[] = ["Lead", "Quoted", "Active", "Invoiced", "Completed"];

export * from "./queues";
