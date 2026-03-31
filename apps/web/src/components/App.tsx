import { useEffect, useMemo, useState } from "react";
import { type AlertItem, type EmployerApplicationView, type JobApplication, type JobListing, type Message, type MessageConversation, type SocialPost, type User, type UserTag } from "@laborforce/shared";
import { apiGet, apiPatch, apiPost } from "../api/client";
import { demoSocial } from "../data/mock";

const AUTH_STORAGE_KEY = "laborforce-web-auth";

interface AuthResponse {
  user: User;
  credentials: {
    accessToken: string;
    refreshToken: string;
  };
}

interface JobsResponse {
  radiusMiles: number;
  items: JobListing[];
}

interface PaymentsConfigResponse {
  premium: {
    monthly: number;
    yearly: number;
  };
  fees: {
    certificationVerification: number;
    businessVerification: number;
    surgeBoost: number;
    quickCashPlatformPercent: number;
  };
  stripeReady: boolean;
}

interface ApplicationsResponse {
  items: JobApplication[];
}

interface EmployerApplicationsResponse {
  items: EmployerApplicationView[];
}

interface UsersResponse extends Array<User> {}

interface ConversationsResponse {
  items: MessageConversation[];
}

interface ThreadResponse {
  participant: User;
  conversationId: string;
  items: Message[];
}

interface SocialFeedResponse {
  audience: string;
  reactions: string[];
  items: SocialPost[];
}

interface SocialCreateResponse {
  post: SocialPost;
}

interface AlertsResponse {
  unreadCount: number;
  items: AlertItem[];
}

interface AuthFormState {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  zipCode: string;
  tradeType: string;
}

interface JobFormState {
  jobTitle: string;
  tradeCategory: string;
  description: string;
  hourlyRateMin: string;
  hourlyRateMax: string;
  jobType: string;
  benefits: string;
  countyLocation: string;
  certificationsRequired: string;
}

interface ApplyFormState {
  [jobId: string]: string;
}

interface SocialFormState {
  postText: string;
  photoUrl: string;
  videoUrl: string;
}

interface ProfileFormState {
  fullName: string;
  tradeType: string;
  businessName: string;
  bio: string;
  yearsExperience: string;
  hourlyRate: string;
  unionStatus: string;
  profilePhotoUrl: string;
  openToWork: boolean;
}

interface MockReel {
  id: string;
  trade: string;
  title: string;
  description: string;
  imageUrl: string;
  videoUrl: string;
}

interface AssistantMessage {
  id: string;
  role: "assistant" | "user";
  body: string;
}

interface SocialMediaDraft {
  photoPreviewUrl: string;
  photoName: string;
  videoPreviewUrl: string;
  videoName: string;
}

interface AiContactProfile {
  user: User;
  opener: string;
  followUpStyle: string;
  marketingAngle: string;
}

type Experience = "feed" | "network" | "jobs" | "reels" | "messages" | "notifications" | "assistant" | "profile" | "auth";
type NetworkTab = "grow" | "catchUp";
type NetworkToolView = "leads" | "groups" | "assistant" | "insights" | "marketplace";
type NotificationFilter = "all" | "message" | "application" | "network" | "system";

const aiNetworkCrew: AiContactProfile[] = [
  {
    user: {
      id: "ai-malik-northside",
      email: "malik@northside-demo.ai",
      fullName: "Malik Northside",
      phone: "+1-555-1001",
      zipCode: "10011",
      userTag: "employer",
      tradeType: "Electrical Contractor",
      isVerified: true,
      isPremium: true,
      verificationStatus: "verified",
      profilePhotoUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=900&q=80",
      bio: "Runs service trucks across the city and hires fast when a board upgrade turns into a bigger project.",
      yearsExperience: 14,
      hourlyRate: 125,
      openToWork: false,
      ratingAverage: 4.9,
      ratingCount: 128,
      trustBadge: "Gold Verified",
      unionStatus: "Open shop",
      latitude: 40.741,
      longitude: -73.989,
      isBusinessVerified: true,
      businessName: "Northside Electric"
    },
    opener: "Need a clean commercial electrician for panel upgrades and tenant buildouts.",
    followUpStyle: "direct and fast",
    marketingAngle: "Show clean installs, fast response times, and safety paperwork upfront."
  },
  {
    user: {
      id: "ai-jade-airflow",
      email: "jade@airflow-demo.ai",
      fullName: "Jade Airflow",
      phone: "+1-555-1002",
      zipCode: "11201",
      userTag: "employer",
      tradeType: "HVAC Service Manager",
      isVerified: true,
      isPremium: true,
      verificationStatus: "verified",
      profilePhotoUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=900&q=80",
      bio: "Books recurring rooftop, split-system, and emergency no-cool work around Brooklyn.",
      yearsExperience: 11,
      hourlyRate: 118,
      openToWork: false,
      ratingAverage: 4.8,
      ratingCount: 96,
      trustBadge: "Trusted",
      unionStatus: "Mixed crews",
      latitude: 40.693,
      longitude: -73.989,
      isBusinessVerified: true,
      businessName: "Airflow Ops"
    },
    opener: "Looking for HVAC techs who can post good proof-of-work and follow through on maintenance contracts.",
    followUpStyle: "organized and friendly",
    marketingAngle: "Talk about repeat service value, maintenance savings, and before-and-after airflow wins."
  },
  {
    user: {
      id: "ai-rina-pipeworks",
      email: "rina@pipeworks-demo.ai",
      fullName: "Rina Pipeworks",
      phone: "+1-555-1003",
      zipCode: "10458",
      userTag: "employee",
      tradeType: "Licensed Plumber",
      isVerified: true,
      isPremium: false,
      verificationStatus: "verified",
      profilePhotoUrl: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=900&q=80",
      bio: "Handles service calls, rough-ins, and property-manager work across the Bronx.",
      yearsExperience: 9,
      hourlyRate: 95,
      openToWork: true,
      ratingAverage: 4.7,
      ratingCount: 74,
      trustBadge: "Established",
      unionStatus: "Local 1",
      latitude: 40.862,
      longitude: -73.888,
      isBusinessVerified: false,
      businessName: null
    },
    opener: "Always down to trade referral leads and compare what captions are getting homeowners to reply.",
    followUpStyle: "helpful and practical",
    marketingAngle: "Lead with the pain point, the fix, and what makes the customer trust you inside ten seconds."
  },
  {
    user: {
      id: "ai-omar-property",
      email: "omar@property-demo.ai",
      fullName: "Omar Property Group",
      phone: "+1-555-1004",
      zipCode: "10019",
      userTag: "customer",
      tradeType: "Property Manager",
      isVerified: true,
      isPremium: true,
      verificationStatus: "verified",
      profilePhotoUrl: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=900&q=80",
      bio: "Runs multi-site maintenance and likes contractors who communicate fast and post real proof.",
      yearsExperience: 12,
      hourlyRate: null,
      openToWork: false,
      ratingAverage: 4.9,
      ratingCount: 38,
      trustBadge: "Gold Verified",
      unionStatus: null,
      latitude: 40.768,
      longitude: -73.982,
      isBusinessVerified: true,
      businessName: "Omar Property Group"
    },
    opener: "I hire based on who looks responsive, organized, and legit online. Proof posts matter.",
    followUpStyle: "professional and concise",
    marketingAngle: "Say what type of properties you handle, response time, and how you keep owners updated."
  }
];

const assistantStarterMessages: AssistantMessage[] = [
  {
    id: "assistant-welcome",
    role: "assistant",
    body: "I can tighten your captions, turn job photos into stronger marketing, suggest outreach messages, and send reminder alerts that explain why your notifications matter."
  }
];

const mockReels: MockReel[] = [
  {
    id: "reel-hvac",
    trade: "HVAC",
    title: "What HVAC Techs Actually Do",
    description: "Install systems, troubleshoot airflow, handle refrigerant, and keep homes and buildings comfortable year-round.",
    imageUrl: "https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=900&q=80",
    videoUrl: "https://samplelib.com/lib/preview/mp4/sample-5s.mp4"
  },
  {
    id: "reel-electrical",
    trade: "Electrical",
    title: "What Electricians Handle Daily",
    description: "Run wire, upgrade panels, troubleshoot outages, install fixtures, and keep power safe and code-compliant.",
    imageUrl: "https://images.unsplash.com/photo-1581092921461-eab62e97a780?auto=format&fit=crop&w=900&q=80",
    videoUrl: "https://samplelib.com/lib/preview/mp4/sample-10s.mp4"
  },
  {
    id: "reel-plumbing",
    trade: "Plumbing",
    title: "What Plumbers Really Work On",
    description: "Water lines, drain systems, fixtures, leak repairs, rough-ins, and keeping homes and businesses flowing right.",
    imageUrl: "https://images.unsplash.com/photo-1620626011761-996317b8d101?auto=format&fit=crop&w=900&q=80",
    videoUrl: "https://samplelib.com/lib/preview/mp4/sample-15s.mp4"
  },
  {
    id: "reel-carpentry",
    trade: "Carpentry",
    title: "What Carpenters Build",
    description: "Frame walls, install trim, hang doors, build structures, and turn plans into finished spaces.",
    imageUrl: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=900&q=80",
    videoUrl: "https://samplelib.com/lib/preview/mp4/sample-20s.mp4"
  },
  {
    id: "reel-welding",
    trade: "Welding",
    title: "What Welders Do On the Job",
    description: "Fabricate steel, repair equipment, join metal safely, and work across shops, plants, and field jobsites.",
    imageUrl: "https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=900&q=80",
    videoUrl: "https://samplelib.com/lib/preview/mp4/sample-5mb.mp4"
  },
  {
    id: "reel-roofing",
    trade: "Roofing",
    title: "What Roofers Handle Every Week",
    description: "Tear-offs, underlayment, flashing, shingle or membrane installs, and weatherproofing the top of the job.",
    imageUrl: "https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=900&q=80",
    videoUrl: "https://samplelib.com/lib/preview/mp4/sample-30s.mp4"
  }
];

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}

function formatStatus(status: string) {
  return status.replaceAll("_", " ");
}

function formatRelativeTime(value: string) {
  const deltaMs = Date.now() - new Date(value).getTime();
  const hours = Math.max(1, Math.floor(deltaMs / (1000 * 60 * 60)));
  if (hours < 24) {
    return `${hours}h`;
  }

  return `${Math.floor(hours / 24)}d`;
}

function getWorkerSpecialties(trade?: string | null) {
  const normalized = trade?.toLowerCase() ?? "";

  if (normalized.includes("electric")) {
    return ["Panel upgrades", "Service calls", "Troubleshooting", "Lighting installs"];
  }
  if (normalized.includes("hvac")) {
    return ["System installs", "Airflow fixes", "Service calls", "Maintenance"];
  }
  if (normalized.includes("plumb")) {
    return ["Fixture installs", "Drain repairs", "Water lines", "Leak detection"];
  }
  if (normalized.includes("carpent")) {
    return ["Framing", "Trim work", "Doors", "Finish carpentry"];
  }

  return ["Residential work", "Commercial work", "Service calls", "Project installs"];
}

function createLocalId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getAiContactById(userId: string) {
  return aiNetworkCrew.find((contact) => contact.user.id === userId);
}

function buildAiReply(contact: AiContactProfile, input: string, currentUser: User | null) {
  const normalized = input.toLowerCase();
  const name = currentUser?.fullName?.split(" ")[0] ?? "there";
  const businessLabel = currentUser?.businessName ?? currentUser?.tradeType ?? "your business";

  if (normalized.includes("price") || normalized.includes("quote") || normalized.includes("bid")) {
    return `${name}, lead with your range, what is included, and your response time. Buyers around ${contact.user.businessName ?? contact.user.fullName} want clear scope before they hop on a call.`;
  }

  if (normalized.includes("available") || normalized.includes("schedule") || normalized.includes("tomorrow")) {
    return `I can work with that. ${contact.user.fullName} usually moves fastest when you send a short availability window, job type, and one proof photo from ${businessLabel}.`;
  }

  if (normalized.includes("post") || normalized.includes("caption") || normalized.includes("marketing")) {
    return `${contact.marketingAngle} If you want, send me your draft and I will punch it up into something tighter and easier to trust.`;
  }

  return `Sounds good. I’m ${contact.followUpStyle}, so the best next step is a short message with the job type, service area, and one strong proof point from ${businessLabel}.`;
}

function buildNotificationsSummary(alerts: AlertItem[], unreadMessagesCount: number) {
  const importantAlerts = alerts.filter((alert) => !alert.isRead);
  const messageCount = unreadMessagesCount + importantAlerts.filter((alert) => alert.type === "message").length;
  const applicationCount = importantAlerts.filter((alert) => alert.type === "application").length;
  const networkCount = importantAlerts.filter((alert) => alert.type === "network").length;

  const parts = [
    messageCount > 0 ? `${messageCount} message update${messageCount === 1 ? "" : "s"} need fast replies` : "",
    applicationCount > 0 ? `${applicationCount} hiring update${applicationCount === 1 ? "" : "s"} can change revenue` : "",
    networkCount > 0 ? `${networkCount} network signal${networkCount === 1 ? "" : "s"} could turn into work` : ""
  ].filter(Boolean);

  if (parts.length === 0) {
    return "You’re clear right now. No urgent notifications are stacking up, so this is a good moment to post or do outreach.";
  }

  return `${parts.join(", ")}. Clearing these first keeps leads warm and stops money-moving conversations from cooling off.`;
}

function buildAssistantReply(
  input: string,
  context: {
    user: User | null;
    notificationsSummary: string;
    socialPosts: SocialPost[];
    unreadMessagesCount: number;
  }
) {
  const normalized = input.toLowerCase();
  const businessLabel = context.user?.businessName ?? context.user?.tradeType ?? "your trade business";

  if (normalized.includes("notification") || normalized.includes("remind")) {
    return context.notificationsSummary;
  }

  if (normalized.includes("post") || normalized.includes("caption") || normalized.includes("rewrite")) {
    return `Try this structure for ${businessLabel}: problem, fix, proof, and call to action. Example: "Emergency service call, bad disconnect swapped, system tested, same-day turnaround. DM if you need fast reliable help this week."`;
  }

  if (normalized.includes("market") || normalized.includes("lead") || normalized.includes("promote")) {
    return `For ${businessLabel}, post one proof piece, one customer outcome, and one clear availability update every week. The fastest trust builder is clean proof plus a direct line about where you work and how fast you respond.`;
  }

  if (normalized.includes("network") || normalized.includes("message")) {
    return `Keep outreach short: who you help, where you work, and one reason to trust you. Then move them into a reply with availability, timing, or a next-step question.`;
  }

  return `I’m tuned for ${businessLabel}. I can rewrite a post, sharpen a sales message, plan outreach, or turn your notifications into a priority list.`;
}

function createLocalSocialPost(args: {
  user: User | null;
  selectedTag: UserTag;
  postText: string;
  photoUrls: string[];
  videoUrl: string | null;
}) {
  return {
    id: createLocalId("social"),
    authorId: args.user?.id ?? "local-demo-user",
    postText: args.postText,
    photoUrls: args.photoUrls,
    videoUrl: args.videoUrl,
    isProofWall: true,
    tradeTag: args.user?.tradeType ?? args.user?.businessName ?? args.user?.userTag ?? args.selectedTag,
    locationDisplay: args.user?.zipCode ?? "Local demo",
    latitude: null,
    longitude: null,
    respectsCount: 0,
    impressedCount: 0,
    helpfulCount: 0,
    commentsCount: 0,
    createdAt: new Date().toISOString()
  } satisfies SocialPost;
}

export function App() {
  const [activeExperience, setActiveExperience] = useState<"feed" | "network" | "jobs" | "reels" | "messages" | "notifications" | "profile" | "auth">("feed");
  const [activeNetworkTab, setActiveNetworkTab] = useState<NetworkTab>("grow");
  const [selectedTag, setSelectedTag] = useState<UserTag>("employee");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [authState, setAuthState] = useState<AuthResponse["credentials"] | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [jobs, setJobs] = useState<JobListing[]>([]);
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [incomingApplications, setIncomingApplications] = useState<EmployerApplicationView[]>([]);
  const [directoryUsers, setDirectoryUsers] = useState<User[]>([]);
  const [conversations, setConversations] = useState<MessageConversation[]>([]);
  const [threadMessages, setThreadMessages] = useState<Message[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [socialPosts, setSocialPosts] = useState<SocialPost[]>([]);
  const [selectedRecipientId, setSelectedRecipientId] = useState<string>("");
  const [jobsRadius, setJobsRadius] = useState(50);
  const [driveRadius, setDriveRadius] = useState(50);
  const [isBooting, setIsBooting] = useState(true);
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);
  const [isLoadingJobs, setIsLoadingJobs] = useState(false);
  const [isPostingJob, setIsPostingJob] = useState(false);
  const [publishingJobId, setPublishingJobId] = useState<string | null>(null);
  const [stripeReady, setStripeReady] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isApplyingJobId, setIsApplyingJobId] = useState<string | null>(null);
  const [updatingApplicationId, setUpdatingApplicationId] = useState<string | null>(null);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isLoadingThread, setIsLoadingThread] = useState(false);
  const [isLoadingAlerts, setIsLoadingAlerts] = useState(false);
  const [applyForms, setApplyForms] = useState<ApplyFormState>({});
  const [messageText, setMessageText] = useState("");
  const [isPostingSocial, setIsPostingSocial] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [authForm, setAuthForm] = useState<AuthFormState>({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    zipCode: "",
    tradeType: ""
  });
  const [jobForm, setJobForm] = useState<JobFormState>({
    jobTitle: "",
    tradeCategory: "",
    description: "",
    hourlyRateMin: "",
    hourlyRateMax: "",
    jobType: "full_time",
    benefits: "",
    countyLocation: "",
    certificationsRequired: ""
  });
  const [socialForm, setSocialForm] = useState<SocialFormState>({
    postText: "",
    photoUrl: "",
    videoUrl: ""
  });
  const [profileForm, setProfileForm] = useState<ProfileFormState>({
    fullName: "",
    tradeType: "",
    businessName: "",
    bio: "",
    yearsExperience: "",
    hourlyRate: "",
    unionStatus: "",
    profilePhotoUrl: "",
    openToWork: false
  });

  useEffect(() => {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);

    if (!raw) {
      setIsBooting(false);
      return;
    }

    try {
      const parsed = JSON.parse(raw) as AuthResponse["credentials"];
      setAuthState(parsed);
    } catch {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
    } finally {
      setIsBooting(false);
    }
  }, []);

  useEffect(() => {
    void loadJobs();
    void loadPaymentsConfig();
    void loadSocialFeed();
  }, []);

  useEffect(() => {
    void loadJobs();
  }, [driveRadius, authState?.accessToken]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const view = params.get("view");
    if (view === "feed" || view === "network" || view === "jobs" || view === "reels" || view === "messages" || view === "notifications" || view === "profile" || view === "auth") {
      setActiveExperience(view);
    }
  }, []);

  useEffect(() => {
    if (!authState?.accessToken) {
      setUser(null);
      setApplications([]);
      setIncomingApplications([]);
      setDirectoryUsers([]);
      setConversations([]);
      setAlerts([]);
      setThreadMessages([]);
      setSelectedRecipientId("");
      return;
    }

    void loadCurrentUser(authState.accessToken);
  }, [authState]);

  useEffect(() => {
    if (!authState?.accessToken || user?.userTag !== "employee") {
      return;
    }

    void loadApplications(authState.accessToken);
  }, [authState, user?.userTag]);

  useEffect(() => {
    if (!authState?.accessToken || user?.userTag !== "employer") {
      return;
    }

    void loadEmployerApplications(authState.accessToken);
  }, [authState, user?.userTag]);

  useEffect(() => {
    if (!authState?.accessToken || !user) {
      return;
    }

    void loadDirectoryUsers(authState.accessToken, user.id);
    void loadConversations(authState.accessToken);
    void loadAlerts(authState.accessToken);
  }, [authState, user?.id]);

  useEffect(() => {
    if (!user) {
      return;
    }

    setProfileForm({
      fullName: user.fullName ?? "",
      tradeType: user.tradeType ?? "",
      businessName: user.businessName ?? "",
      bio: user.bio ?? "",
      yearsExperience: user.yearsExperience?.toString() ?? "",
      hourlyRate: user.hourlyRate?.toString() ?? "",
      unionStatus: user.unionStatus ?? "",
      profilePhotoUrl: user.profilePhotoUrl ?? "",
      openToWork: user.openToWork
    });
  }, [user]);

  useEffect(() => {
    if (!authState?.accessToken || !selectedRecipientId) {
      return;
    }

    void loadThread(authState.accessToken, selectedRecipientId);
  }, [authState, selectedRecipientId]);

  useEffect(() => {
    if (!authState?.accessToken) {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const jobId = params.get("jobId");
    const sessionId = params.get("session_id");
    const depositState = params.get("deposit");

    if (depositState === "success" && jobId) {
      void completeDeposit(jobId, sessionId ?? undefined);
      params.delete("deposit");
      params.delete("jobId");
      params.delete("session_id");
      const next = params.toString();
      window.history.replaceState({}, "", next ? `/?${next}` : "/");
    }

    if (depositState === "cancelled") {
      setErrorMessage("Deposit checkout was cancelled before payment completed.");
      params.delete("deposit");
      params.delete("jobId");
      const next = params.toString();
      window.history.replaceState({}, "", next ? `/?${next}` : "/");
    }
  }, [authState]);

  const roleCopy = useMemo(() => {
    switch (selectedTag) {
      case "employee":
        return {
          headline: "Verified work, local first",
          summary: "Browse nearby jobs, showcase your Proof Wall, toggle Open to Work, and bid on Quick Cash without stale listings."
        };
      case "employer":
        return {
          headline: "Verified crews, faster hiring",
          summary: "Post jobs, search trade-specific portfolios, and manage your pipeline from lead to completed."
        };
      default:
        return {
          headline: "Trusted help for urgent jobs",
          summary: "Post fast-turnaround tasks, compare bids side by side, and release escrow only when the work is complete."
        };
    }
  }, [selectedTag]);

  const employerDrafts = jobs.filter((job) => user?.userTag === "employer" && job.employerId === user.id && job.status === "draft");
  const employerActive = jobs.filter((job) => user?.userTag === "employer" && job.employerId === user.id && job.status === "active");
  const applicationMap = new Map(applications.map((application) => [application.jobListingId, application]));
  const unreadMessagesCount = conversations.reduce((total, conversation) => total + conversation.unreadCount, 0);
  const unreadAlertsCount = alerts.filter((alert) => !alert.isRead).length;
  const reelPosts = socialPosts;
  const profilePosts = socialPosts.filter((post) => post.authorId === user?.id);
  const pinnedProfilePosts = profilePosts.slice(0, 3);
  const workerSpecialties = getWorkerSpecialties(user?.tradeType);
  const connectedUserIds = new Set(conversations.map((conversation) => conversation.participant.id));
  const connectionSuggestions = directoryUsers.filter((candidate) => !connectedUserIds.has(candidate.id)).slice(0, 8);
  const existingConnections = directoryUsers.filter((candidate) => connectedUserIds.has(candidate.id)).slice(0, 8);
  const catchUpConversations = conversations.slice(0, 4);
  const catchUpConnections = existingConnections.slice(0, 4);
  const networkAlerts = alerts
    .filter((alert) => alert.type === "network" || alert.type === "message")
    .slice(0, 4);

  async function loadJobs() {
    setIsLoadingJobs(true);

    try {
      const response = await apiGet<JobsResponse>(`/jobs?radiusMiles=${driveRadius}`, authState?.accessToken ?? undefined);
      setJobs(response.items);
      setJobsRadius(response.radiusMiles);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load jobs.");
    } finally {
      setIsLoadingJobs(false);
    }
  }

  async function loadPaymentsConfig() {
    try {
      const response = await apiGet<PaymentsConfigResponse>("/payments/config");
      setStripeReady(response.stripeReady);
    } catch {
      setStripeReady(false);
    }
  }

  async function loadSocialFeed() {
    try {
      const response = await apiGet<SocialFeedResponse>("/social/feed");
      setSocialPosts(response.items);
    } catch {
      setSocialPosts([]);
    }
  }

  async function loadApplications(token: string) {
    try {
      const response = await apiGet<ApplicationsResponse>("/applications/mine", token);
      setApplications(response.items);
    } catch {
      setApplications([]);
    }
  }

  async function loadEmployerApplications(token: string) {
    try {
      const response = await apiGet<EmployerApplicationsResponse>("/applications/employer", token);
      setIncomingApplications(response.items);
    } catch {
      setIncomingApplications([]);
    }
  }

  async function loadDirectoryUsers(token: string, currentUserId: string) {
    try {
      const response = await apiGet<UsersResponse>("/users", token);
      setDirectoryUsers(response.filter((candidate) => candidate.id !== currentUserId && candidate.isVerified));
    } catch {
      setDirectoryUsers([]);
    }
  }

  async function loadConversations(token: string) {
    try {
      const response = await apiGet<ConversationsResponse>("/messages", token);
      setConversations(response.items);
    } catch {
      setConversations([]);
    }
  }

  async function loadAlerts(token: string) {
    setIsLoadingAlerts(true);

    try {
      const response = await apiGet<AlertsResponse>("/alerts", token);
      setAlerts(response.items);
    } catch {
      setAlerts([]);
    } finally {
      setIsLoadingAlerts(false);
    }
  }

  async function loadThread(token: string, recipientId: string) {
    setIsLoadingThread(true);

    try {
      const response = await apiGet<ThreadResponse>(`/messages/conversation/${recipientId}`, token);
      setThreadMessages(response.items);
    } catch (error) {
      setThreadMessages([]);
      setErrorMessage(error instanceof Error ? error.message : "Unable to load conversation.");
    } finally {
      setIsLoadingThread(false);
    }
  }

  async function loadCurrentUser(token: string) {
    try {
      const nextUser = await apiGet<User>("/users/me", token);
      setUser(nextUser);
      setSelectedTag(nextUser.userTag);
    } catch (error) {
      setUser(null);
      setAuthState(null);
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
      setErrorMessage(error instanceof Error ? error.message : "Session expired.");
    }
  }

  async function handleAuthSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmittingAuth(true);

    try {
      const endpoint = mode === "signup" ? "/auth/signup" : "/auth/login";
      const payload =
        mode === "signup"
          ? {
              ...authForm,
              userTag: selectedTag,
              tradeType: selectedTag === "employee" ? authForm.tradeType : undefined
            }
          : {
              email: authForm.email,
              password: authForm.password
            };

      const response = await apiPost<AuthResponse>(endpoint, payload);
      setAuthState(response.credentials);
      setUser(response.user);
      setSelectedTag(response.user.userTag);
      window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(response.credentials));
      setSuccessMessage(
        mode === "signup"
          ? "Account created. Verification is pending until Persona is connected."
          : "Signed in successfully."
      );
      switchExperience("profile");
      setAuthForm((current) => ({ ...current, password: "" }));
      await loadJobs();
      if (response.user.userTag === "employee") {
        await loadApplications(response.credentials.accessToken);
      }
      if (response.user.userTag === "employer") {
        await loadEmployerApplications(response.credentials.accessToken);
      }
      await loadDirectoryUsers(response.credentials.accessToken, response.user.id);
      await loadConversations(response.credentials.accessToken);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to sign in.");
    } finally {
      setIsSubmittingAuth(false);
    }
  }

  async function handleCreateJob(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!authState?.accessToken) {
      setErrorMessage("Sign in as an employer before posting a job.");
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsPostingJob(true);

    try {
      const response = await apiPost<{ job: JobListing; nextStep: string }>(
        "/jobs",
        {
          jobTitle: jobForm.jobTitle,
          tradeCategory: jobForm.tradeCategory,
          description: jobForm.description,
          hourlyRateMin: Number(jobForm.hourlyRateMin),
          hourlyRateMax: Number(jobForm.hourlyRateMax),
          jobType: jobForm.jobType,
          benefits: jobForm.benefits,
          countyLocation: jobForm.countyLocation,
          certificationsRequired: jobForm.certificationsRequired
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean)
        },
        authState.accessToken
      );

      setSuccessMessage(response.nextStep);
      setJobForm({
        jobTitle: "",
        tradeCategory: "",
        description: "",
        hourlyRateMin: "",
        hourlyRateMax: "",
        jobType: "full_time",
        benefits: "",
        countyLocation: "",
        certificationsRequired: ""
      });
      await loadJobs();
      await loadEmployerApplications(authState.accessToken);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to create job.");
    } finally {
      setIsPostingJob(false);
    }
  }

  async function completeDeposit(jobId: string, sessionId?: string) {
    if (!authState?.accessToken) {
      return;
    }

    setPublishingJobId(jobId);

    try {
      const response = await apiPost<{ job: JobListing; message: string }>(
        "/payments/job-deposits/complete",
        {
          jobId,
          sessionId
        },
        authState.accessToken
      );

      setSuccessMessage(response.message);
      await loadJobs();
      await loadEmployerApplications(authState.accessToken);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to complete deposit.");
    } finally {
      setPublishingJobId(null);
    }
  }

  async function handlePublishJob(jobId: string) {
    if (!authState?.accessToken) {
      setErrorMessage("Sign in as an employer before publishing a job.");
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setPublishingJobId(jobId);

    try {
      const response = await apiPost<{
        mode: "stripe_checkout" | "development_simulation";
        checkoutUrl?: string;
        message?: string;
      }>(
        `/payments/job-deposits/${jobId}/checkout`,
        {},
        authState.accessToken
      );

      if (response.mode === "stripe_checkout" && response.checkoutUrl) {
        window.location.href = response.checkoutUrl;
        return;
      }

      await completeDeposit(jobId);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to publish job.");
    } finally {
      if (!stripeReady) {
        setPublishingJobId(null);
      }
    }
  }

  async function handleApply(jobId: string) {
    if (!authState?.accessToken) {
      setErrorMessage("Sign in as an employee before applying.");
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsApplyingJobId(jobId);

    try {
      const response = await apiPost<{ message: string }>(
        `/jobs/${jobId}/apply`,
        {
          message: applyForms[jobId] ?? ""
        },
        authState.accessToken
      );

      setSuccessMessage(response.message);
      setApplyForms((current) => ({ ...current, [jobId]: "" }));
      await loadJobs();
      if (authState?.accessToken) {
        await loadApplications(authState.accessToken);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to apply.");
    } finally {
      setIsApplyingJobId(null);
    }
  }

  async function handleEmployerApplicationStatus(
    applicationId: string,
    status: "viewed" | "shortlisted" | "rejected" | "hired"
  ) {
    if (!authState?.accessToken) {
      setErrorMessage("Sign in as an employer before managing applicants.");
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setUpdatingApplicationId(applicationId);

    try {
      const response = await apiPatch<{ message: string }>(
        `/applications/${applicationId}/status`,
        { status },
        authState.accessToken
      );

      setSuccessMessage(response.message);
      await loadEmployerApplications(authState.accessToken);
      await loadJobs();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update applicant.");
    } finally {
      setUpdatingApplicationId(null);
    }
  }

  async function handleSendMessage() {
    if (!authState?.accessToken || !selectedRecipientId) {
      setErrorMessage("Pick a verified person before sending a message.");
      return;
    }

    if (!messageText.trim()) {
      setErrorMessage("Type a message first.");
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSendingMessage(true);

    try {
      await apiPost<{ message: Message; conversationId: string }>(
        "/messages",
        {
          recipientId: selectedRecipientId,
          messageText: messageText.trim()
        },
        authState.accessToken
      );

      setMessageText("");
      await loadConversations(authState.accessToken);
      await loadThread(authState.accessToken, selectedRecipientId);
      setSuccessMessage("Message sent.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to send message.");
    } finally {
      setIsSendingMessage(false);
    }
  }

  async function handleCreateSocialPost(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!authState?.accessToken) {
      setErrorMessage("Login before posting to the feed.");
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsPostingSocial(true);

    try {
      const response = await apiPost<SocialCreateResponse>(
        "/social/feed",
        {
          postText: socialForm.postText.trim(),
          photoUrls: socialForm.photoUrl.trim() ? [socialForm.photoUrl.trim()] : [],
          videoUrl: socialForm.videoUrl.trim() ? socialForm.videoUrl.trim() : null,
          isProofWall: true,
          tradeTag: user?.tradeType ?? user?.businessName ?? user?.userTag ?? selectedTag,
          locationDisplay: user?.zipCode ?? "Local"
        },
        authState.accessToken
      );

      setSocialPosts((current) => [response.post, ...current]);
      setSocialForm({
        postText: "",
        photoUrl: "",
        videoUrl: ""
      });
      setSuccessMessage("Post published to the feed.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to publish post.");
    } finally {
      setIsPostingSocial(false);
    }
  }

  async function handleSaveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!authState?.accessToken || !user) {
      setErrorMessage("Log in before editing your profile.");
      return;
    }

    setIsSavingProfile(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await apiPatch<{ user: User; message: string }>(
        "/users/me",
        {
          fullName: profileForm.fullName.trim(),
          tradeType: profileForm.tradeType.trim() || null,
          businessName: profileForm.businessName.trim() || null,
          bio: profileForm.bio.trim() || null,
          yearsExperience: profileForm.yearsExperience ? Number(profileForm.yearsExperience) : null,
          hourlyRate: profileForm.hourlyRate ? Number(profileForm.hourlyRate) : null,
          unionStatus: profileForm.unionStatus.trim() || null,
          profilePhotoUrl: profileForm.profilePhotoUrl.trim() || null,
          openToWork: profileForm.openToWork
        },
        authState.accessToken
      );

      setUser(response.user);
      setSuccessMessage(response.message);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update profile.");
    } finally {
      setIsSavingProfile(false);
    }
  }

  function switchExperience(view: "feed" | "network" | "jobs" | "reels" | "messages" | "notifications" | "profile" | "auth") {
    setActiveExperience(view);
    const params = new URLSearchParams(window.location.search);
    params.set("view", view);
    const next = params.toString();
    window.history.replaceState({}, "", next ? `/?${next}` : "/");
  }

  function handleAlertAction(type: AlertItem["type"]) {
    if (type === "message") {
      switchExperience("messages");
      return;
    }

    if (type === "application") {
      switchExperience("jobs");
      return;
    }

    if (type === "network") {
      switchExperience("profile");
      return;
    }

    switchExperience("notifications");
  }

  function signOut() {
    setAuthState(null);
    setUser(null);
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    setSuccessMessage("Signed out.");
  }

  return (
    <div className="shell">
      <nav className="appTopNav">
        <button
          className={`appTopNavButton ${activeExperience === "feed" ? "appTopNavActive" : ""}`}
          onClick={() => switchExperience("feed")}
        >
          <span className="appTopNavIcon">Home</span>
          <span>Feed</span>
        </button>
        <button
          className={`appTopNavButton ${activeExperience === "network" ? "appTopNavActive" : ""}`}
          onClick={() => switchExperience("network")}
        >
          <span className="appTopNavIcon">Crew</span>
          <span>Network</span>
        </button>
        <button
          className={`appTopNavButton ${activeExperience === "jobs" ? "appTopNavActive" : ""}`}
          onClick={() => switchExperience("jobs")}
        >
          <span className="appTopNavIcon">Work</span>
          <span>Jobs</span>
        </button>
        <button
          className={`appTopNavButton ${activeExperience === "reels" ? "appTopNavActive" : ""}`}
          onClick={() => switchExperience("reels")}
        >
          <span className="appTopNavIcon">Play</span>
          <span>Reels</span>
        </button>
        <button
          className={`appTopNavButton ${activeExperience === "messages" ? "appTopNavActive" : ""}`}
          onClick={() => switchExperience("messages")}
        >
          <span className="appTopNavIcon">Chat</span>
          <span>Messages</span>
        </button>
        <button
          className={`appTopNavButton ${activeExperience === "notifications" ? "appTopNavActive" : ""}`}
          onClick={() => switchExperience("notifications")}
        >
          <span className="appTopNavIcon">Bell</span>
          <span>Alerts</span>
        </button>
        <button
          className={`appTopNavButton ${activeExperience === "auth" ? "appTopNavActive" : ""}`}
          onClick={() => switchExperience("auth")}
        >
          <span className="appTopNavIcon">{user ? "Acct" : "Login"}</span>
          <span>{user ? "Account" : "Login"}</span>
        </button>
        <button
          className={`appTopNavButton ${activeExperience === "profile" ? "appTopNavActive" : ""}`}
          onClick={() => switchExperience("profile")}
        >
          <span className="appTopNavIcon">You</span>
          <span>Profile</span>
        </button>
      </nav>

      {activeExperience === "auth" && (
        <>
          <section className="jobsHero">
            <div className="headerRow">
              <div>
                <div className="badge">Login</div>
                <h2 style={{ marginTop: 10 }}>{user ? "Your account" : "Login or create your account"}</h2>
                <p className="muted" style={{ marginTop: 8 }}>
                  Sign in here first, then jump straight into your profile, messages, jobs, and network.
                </p>
              </div>
              <div className="pillRow">
                {user && <span className="pill">{user.fullName}</span>}
                {user && <span className="pill">{user.userTag}</span>}
                {user && <span className="pill">{user.verificationStatus}</span>}
              </div>
            </div>
          </section>

          <section style={{ marginTop: 28 }} className="feedPageLayout">
            <div className="stack roomyStack">
              <div className="card">
                <div className="headerRow">
                  <h2>{user ? "Signed in" : "Welcome back"}</h2>
                  {!user && (
                    <div className="pillRow">
                      <button className={`actionButton ${mode === "login" ? "" : "ghostButton"}`} onClick={() => setMode("login")}>
                        Login
                      </button>
                      <button className={`actionButton ${mode === "signup" ? "" : "ghostButton"}`} onClick={() => setMode("signup")}>
                        Signup
                      </button>
                    </div>
                  )}
                </div>

                {errorMessage && <div className="notice errorNotice">{errorMessage}</div>}
                {successMessage && <div className="notice successNotice">{successMessage}</div>}

                {user ? (
                  <div className="stack">
                    <div className="badge">Authenticated</div>
                    <strong>{user.fullName}</strong>
                    <div className="muted">{user.email}</div>
                    <div className="pillRow">
                      <span className="pill">{user.userTag}</span>
                      <span className="pill">{user.verificationStatus}</span>
                      {user.tradeType && <span className="pill">{user.tradeType}</span>}
                      {user.businessName && <span className="pill">{user.businessName}</span>}
                    </div>
                    <div className="pillRow">
                      <button className="actionButton" onClick={() => switchExperience("profile")}>
                        Open profile
                      </button>
                      <button className="actionButton ghostButton" onClick={() => switchExperience("messages")}>
                        Open messages
                      </button>
                      <button className="actionButton ghostButton" onClick={signOut}>
                        Sign out
                      </button>
                    </div>
                  </div>
                ) : (
                  <form className="stack" onSubmit={handleAuthSubmit}>
                    {mode === "signup" && (
                      <label className="field">
                        <span>Full name</span>
                        <input
                          value={authForm.fullName}
                          onChange={(event) => setAuthForm({ ...authForm, fullName: event.target.value })}
                          required
                        />
                      </label>
                    )}
                    <label className="field">
                      <span>Email</span>
                      <input
                        type="email"
                        value={authForm.email}
                        onChange={(event) => setAuthForm({ ...authForm, email: event.target.value })}
                        required
                      />
                    </label>
                    {mode === "signup" && (
                      <>
                        <label className="field">
                          <span>Phone</span>
                          <input
                            value={authForm.phone}
                            onChange={(event) => setAuthForm({ ...authForm, phone: event.target.value })}
                            required
                          />
                        </label>
                        <label className="field">
                          <span>ZIP code</span>
                          <input
                            value={authForm.zipCode}
                            onChange={(event) => setAuthForm({ ...authForm, zipCode: event.target.value })}
                            required
                          />
                        </label>
                        {selectedTag === "employee" && (
                          <label className="field">
                            <span>Trade type</span>
                            <input
                              value={authForm.tradeType}
                              onChange={(event) => setAuthForm({ ...authForm, tradeType: event.target.value })}
                              placeholder="Electrician, HVAC, Plumbing"
                            />
                          </label>
                        )}
                      </>
                    )}
                    <label className="field">
                      <span>Password</span>
                      <input
                        type="password"
                        value={authForm.password}
                        onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })}
                        required
                      />
                    </label>
                    <button className="actionButton" disabled={isSubmittingAuth || isBooting} type="submit">
                      {isSubmittingAuth ? "Submitting..." : mode === "signup" ? "Create account" : "Login"}
                    </button>
                  </form>
                )}
              </div>
            </div>

            <div className="stack sideRail">
              <div className="card">
                <h3>Demo login</h3>
                <div className="stack" style={{ marginTop: 12 }}>
                  <div className="muted">Employer</div>
                  <div className="pill">dispatch@northsidehvac.com</div>
                  <div className="muted">Worker</div>
                  <div className="pill">maria@laborforce.app</div>
                  <div className="pill">Password: LaborForce123!</div>
                </div>
              </div>
              <div className="card">
                <h3>What you unlock</h3>
                <p className="muted">
                  Your profile, reels, messages, job applications, notifications, and network all open up after login.
                </p>
              </div>
            </div>
          </section>
        </>
      )}

      {activeExperience === "feed" && (
        <>
          <section className="feedHero">
            <div className="feedHeroRow">
              <div>
                <div className="badge">LaborForce Feed</div>
                <h1 style={{ marginBottom: 10 }}>See the work. Meet the people behind it.</h1>
              </div>
              <div className="feedProfileCard">
                {user ? (
                  <>
                    <strong>{user.fullName}</strong>
                    <div className="muted">{user.tradeType ?? user.businessName ?? user.userTag}</div>
                    <div className="pillRow" style={{ marginTop: 10 }}>
                      <span className="pill">{user.trustBadge ?? user.verificationStatus}</span>
                      <span className="pill">{user.userTag}</span>
                    </div>
                    <button className="actionButton ghostButton" style={{ marginTop: 14 }} onClick={signOut}>
                      Sign out
                    </button>
                  </>
                ) : (
                  <>
                    <strong>Live beta account</strong>
                    <div className="muted">Login and post straight into the feed.</div>
                    <div className="pillRow" style={{ marginTop: 10 }}>
                      <span className="pill">dispatch@northsidehvac.com</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="feedMiniNav">
              <button className={`miniNavButton ${selectedTag === "employee" ? "miniNavActive" : ""}`} onClick={() => setSelectedTag("employee")}>
                Workers
              </button>
              <button className={`miniNavButton ${selectedTag === "employer" ? "miniNavActive" : ""}`} onClick={() => setSelectedTag("employer")}>
                Employers
              </button>
              <button className={`miniNavButton ${selectedTag === "customer" ? "miniNavActive" : ""}`} onClick={() => setSelectedTag("customer")}>
                Customers
              </button>
              <span className="muted feedMiniCopy">{roleCopy.summary}</span>
            </div>
          </section>

          <section style={{ marginTop: 24 }} className="socialShell">
            <div className="feedPageLayout">
              <div className="stack roomyStack">
              <div className="composerCard">
                <div className="headerRow">
                  <strong>Share a work win</strong>
                  <span className="pill">Proof Wall style</span>
                </div>
                {user ? (
                  <form className="stack" onSubmit={handleCreateSocialPost}>
                    <p className="muted">
                      Before-and-after photos, certifications earned, pricing tips, finished installs, and business updates should live here first.
                    </p>
                    <textarea
                      rows={4}
                      placeholder="Post a work update, lesson, proof wall photo, or business tip"
                      value={socialForm.postText}
                      onChange={(event) => setSocialForm((current) => ({ ...current, postText: event.target.value }))}
                      required
                    />
                    <input
                      placeholder="Photo URL"
                      value={socialForm.photoUrl}
                      onChange={(event) => setSocialForm((current) => ({ ...current, photoUrl: event.target.value }))}
                    />
                    <input
                      placeholder="Short video URL"
                      value={socialForm.videoUrl}
                      onChange={(event) => setSocialForm((current) => ({ ...current, videoUrl: event.target.value }))}
                    />
                    <button className="actionButton" disabled={isPostingSocial} type="submit">
                      {isPostingSocial ? "Posting..." : "Post to feed"}
                    </button>
                  </form>
                ) : (
                  <p className="muted">
                    Sign in first, then post before-and-after photos, certifications earned, pricing tips, finished installs, and business updates.
                  </p>
                )}
              </div>
              {socialPosts.map((post) => (
                <article key={post.id} className="socialPostCard">
                  <div className="headerRow">
                    <div>
                      <strong>{post.tradeTag} creator</strong>
                      <div className="muted">{post.locationDisplay} • {formatRelativeTime(post.createdAt)}</div>
                    </div>
                    <span className="pill">{post.isProofWall ? "Proof Wall" : "Trade post"}</span>
                  </div>
                  <p>{post.postText}</p>
                  {post.photoUrls[0] && (
                    <img className="socialImage" src={post.photoUrls[0]} alt={post.tradeTag} />
                  )}
                  <div className="pillRow">
                    <span className="pill">Respect {post.respectsCount}</span>
                    <span className="pill">Impressed {post.impressedCount}</span>
                    <span className="pill">Helpful {post.helpfulCount}</span>
                    <span className="pill">{post.commentsCount} comments</span>
                  </div>
                </article>
              ))}
              </div>
              <div className="stack sideRail">
              <div className="card">
                <h3>Quick jump</h3>
                <div className="stack" style={{ marginTop: 12 }}>
                  <button className="actionButton ghostButton" onClick={() => switchExperience("jobs")}>
                    Open jobs page
                  </button>
                  <button className="actionButton ghostButton" onClick={() => switchExperience("reels")}>
                    Open reels page
                  </button>
                  <button className="actionButton ghostButton" onClick={() => switchExperience("messages")}>
                    Open messages
                  </button>
                </div>
              </div>
              <div className="card">
                <h3>Trending jobs</h3>
                <div className="stack" style={{ marginTop: 12 }}>
                  {jobs.slice(0, 3).map((job) => (
                    <div key={job.id} className="trendItem">
                      <strong>{job.jobTitle}</strong>
                      <div className="muted">
                        {job.countyLocation}
                        {typeof job.distanceMiles === "number" ? ` • ${job.distanceMiles} mi away` : ""}
                        {" • "}
                        {formatMoney(job.hourlyRateMin)} - {formatMoney(job.hourlyRateMax)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="card">
                <h3>Why this works</h3>
                <p className="muted">People open apps for people. Jobs, hiring, and money move better when the home page feels alive.</p>
              </div>
              </div>
            </div>
          </section>

        </>
      )}

      {activeExperience === "jobs" && (
        <>
      <section className="jobsHero">
        <div className="headerRow">
          <div>
            <div className="badge">Jobs page</div>
            <h2 style={{ marginTop: 10 }}>Hiring and job tools</h2>
            <p className="muted" style={{ marginTop: 8 }}>
              Sign in, browse live jobs, post openings, and review applicants here.
            </p>
          </div>
          <div className="pillRow">
            <span className="pill">{jobs.length} live jobs</span>
            <span className="pill">{incomingApplications.length} applicants</span>
            <span className="pill">{unreadMessagesCount} unread</span>
          </div>
        </div>
      </section>

      <section style={{ marginTop: 28 }} className="jobsPageLayout">
        <div className="stack roomyStack">
        <div className="card">
          <div className="headerRow">
            <h2>{user ? "Account" : "Sign in or create account"}</h2>
            <div className="pillRow">
              {!user && (
                <button className="actionButton" onClick={() => switchExperience("auth")}>
                  Open login tab
                </button>
              )}
              {user && (
                <button className="actionButton ghostButton" onClick={() => switchExperience("profile")}>
                  Open profile
                </button>
              )}
              {user && (
                <button className="actionButton ghostButton" onClick={signOut}>
                  Sign out
                </button>
              )}
              {!user && (
                <button className="actionButton ghostButton" onClick={() => setMode("signup")}>
                  Setup for signup
                </button>
              )}
            </div>
          </div>

          {errorMessage && <div className="notice errorNotice">{errorMessage}</div>}
          {successMessage && <div className="notice successNotice">{successMessage}</div>}

          {user ? (
            <div className="stack">
              <div className="badge">Authenticated</div>
              <strong>{user.fullName}</strong>
              <div className="muted">{user.email}</div>
              <div className="pillRow">
                <span className="pill">{user.userTag}</span>
                <span className="pill">{user.verificationStatus}</span>
                {user.tradeType && <span className="pill">{user.tradeType}</span>}
                {user.businessName && <span className="pill">{user.businessName}</span>}
              </div>
              <div className="muted">
                {user.userTag === "employer" && !user.isBusinessVerified
                  ? "Business verification is still required before posting jobs."
                  : stripeReady
                    ? "This dashboard is using the live LaborForce API and Stripe checkout flow."
                    : "This dashboard is using the live LaborForce API. Stripe is not configured yet, so publishing uses a local fallback."}
              </div>
              {user.userTag === "employer" && (
                <div className="pillRow">
                  <span className="pill">{employerDrafts.length} draft jobs</span>
                  <span className="pill">{employerActive.length} active jobs</span>
                  <span className="pill">{incomingApplications.length} applicants</span>
                  <span className="pill">{conversations.length} conversations</span>
                  <span className="pill">{unreadMessagesCount} unread messages</span>
                </div>
              )}
              {user.userTag !== "employer" && (
                <div className="pillRow">
                  <span className="pill">{conversations.length} conversations</span>
                  <span className="pill">{unreadMessagesCount} unread messages</span>
                </div>
              )}
            </div>
          ) : (
            <div className="stack">
              <div className="muted">Login lives in its own tab now so it is easier to find.</div>
              <button className="actionButton" onClick={() => switchExperience("auth")}>
                Go to login tab
              </button>
              <div className="muted">Demo employer: dispatch@northsidehvac.com / LaborForce123!</div>
            </div>
          )}
        </div>

        <div className="card">
          <div className="headerRow">
            <h2>Live Jobs</h2>
            <div className="badge">{jobsRadius} mile radius</div>
          </div>
          <div className="stack" style={{ marginTop: 12 }}>
            <label className="field">
              <span>How far are you willing to drive?</span>
              <select value={driveRadius} onChange={(event) => setDriveRadius(Number(event.target.value))}>
                <option value={30}>30 miles</option>
                <option value={50}>50 miles</option>
                <option value={75}>75 miles</option>
                <option value={100}>100 miles</option>
              </select>
            </label>
          </div>
          <div className="muted">
            {isLoadingJobs ? "Loading live listings..." : `${jobs.length} listing${jobs.length === 1 ? "" : "s"} from PostgreSQL`}
          </div>
          <div className="stack" style={{ marginTop: 12 }}>
            {jobs.map((job) => (
              <article key={job.id} className="card">
                {(() => {
                  const existingApplication = applicationMap.get(job.id);
                  return (
                    <>
                <div className="headerRow">
                  <div>
                    <strong>{job.jobTitle}</strong>
                    <div className="muted">
                      {job.tradeCategory} • {job.countyLocation}
                      {typeof job.distanceMiles === "number" ? ` • ${job.distanceMiles} miles away` : ""}
                    </div>
                  </div>
                  {job.isSurge && <div className="headerRow"><div className="surgeDot" /> <span>Surge</span></div>}
                </div>
                <p className="muted">{job.description}</p>
                <div className="pillRow">
                  <span className="pill">{formatMoney(job.hourlyRateMin)} - {formatMoney(job.hourlyRateMax)}</span>
                  <span className="pill">{formatStatus(job.jobType)}</span>
                  <span className="pill">{formatStatus(job.status)}</span>
                  {existingApplication && <span className="pill">Applied</span>}
                </div>
                {user?.userTag === "employer" && job.employerId === user.id && job.status === "draft" && (
                  <button
                    className="actionButton"
                    style={{ marginTop: 12 }}
                    disabled={publishingJobId === job.id}
                    onClick={() => void handlePublishJob(job.id)}
                  >
                    {publishingJobId === job.id ? "Publishing..." : "Publish job"}
                  </button>
                )}
                {user?.userTag === "employee" && job.status === "active" && !existingApplication && (
                  <div className="stack" style={{ marginTop: 12 }}>
                    <textarea
                      rows={3}
                      placeholder="Add a short intro for the employer"
                      value={applyForms[job.id] ?? ""}
                      onChange={(event) => setApplyForms((current) => ({ ...current, [job.id]: event.target.value }))}
                    />
                    <button
                      className="actionButton"
                      disabled={isApplyingJobId === job.id}
                      onClick={() => void handleApply(job.id)}
                    >
                      {isApplyingJobId === job.id ? "Applying..." : "Apply now"}
                    </button>
                  </div>
                )}
                {user?.userTag === "employee" && existingApplication && (
                  <div className="notice successNotice" style={{ marginTop: 12 }}>
                    Applied on {new Date(existingApplication.appliedAt).toLocaleDateString()}.
                  </div>
                )}
                    </>
                  );
                })()}
              </article>
            ))}
          </div>
        </div>
        </div>

        <div className="stack roomyStack">
        <div className="card">
          <div className="headerRow">
            <h2>Employer Job Post</h2>
            <div className="badge">Live API</div>
          </div>
          {user?.userTag === "employer" ? (
            <form className="stack" onSubmit={handleCreateJob}>
              <label className="field">
                <span>Job title</span>
                <input value={jobForm.jobTitle} onChange={(event) => setJobForm({ ...jobForm, jobTitle: event.target.value })} required />
              </label>
              <label className="field">
                <span>Trade category</span>
                <input value={jobForm.tradeCategory} onChange={(event) => setJobForm({ ...jobForm, tradeCategory: event.target.value })} required />
              </label>
              <label className="field">
                <span>Description</span>
                <textarea value={jobForm.description} onChange={(event) => setJobForm({ ...jobForm, description: event.target.value })} required rows={4} />
              </label>
              <div className="splitFields">
                <label className="field">
                  <span>Min hourly rate</span>
                  <input value={jobForm.hourlyRateMin} onChange={(event) => setJobForm({ ...jobForm, hourlyRateMin: event.target.value })} required type="number" />
                </label>
                <label className="field">
                  <span>Max hourly rate</span>
                  <input value={jobForm.hourlyRateMax} onChange={(event) => setJobForm({ ...jobForm, hourlyRateMax: event.target.value })} required type="number" />
                </label>
              </div>
              <div className="splitFields">
                <label className="field">
                  <span>Job type</span>
                  <select value={jobForm.jobType} onChange={(event) => setJobForm({ ...jobForm, jobType: event.target.value })}>
                    <option value="full_time">Full time</option>
                    <option value="part_time">Part time</option>
                    <option value="contract">Contract</option>
                    <option value="temporary">Temporary</option>
                    <option value="same_day">Same day</option>
                  </select>
                </label>
                <label className="field">
                  <span>County location</span>
                  <input
                    value={jobForm.countyLocation}
                    onChange={(event) => setJobForm({ ...jobForm, countyLocation: event.target.value })}
                    placeholder="Wake County, NC"
                    required
                  />
                </label>
              </div>
              <label className="field">
                <span>Benefits</span>
                <input value={jobForm.benefits} onChange={(event) => setJobForm({ ...jobForm, benefits: event.target.value })} />
              </label>
              <label className="field">
                <span>Required certifications</span>
                <input
                  value={jobForm.certificationsRequired}
                  onChange={(event) => setJobForm({ ...jobForm, certificationsRequired: event.target.value })}
                  placeholder="EPA 608, OSHA 10"
                />
              </label>
              <button className="actionButton" disabled={isPostingJob} type="submit">
                {isPostingJob ? "Posting..." : "Create draft job"}
              </button>
            </form>
          ) : (
            <div className="stack">
              <div className="muted">Sign in as a verified employer to create a live job draft.</div>
              <div className="pillRow">
                <span className="pill">dispatch@northsidehvac.com</span>
                <span className="pill">LaborForce123!</span>
              </div>
            </div>
          )}
        </div>

        <div className="card">
          <div className="headerRow">
            <h2>Applicant Inbox</h2>
            <div className="badge">{incomingApplications.length} total</div>
          </div>
          {user?.userTag === "employer" ? (
            incomingApplications.length > 0 ? (
              <div className="stack" style={{ marginTop: 12 }}>
                {incomingApplications.map((application) => (
                  <article key={application.id} className="applicationItem">
                    <div className="headerRow">
                      <div>
                        <strong>{application.applicant.fullName}</strong>
                        <div className="muted">
                          {application.applicant.tradeType ?? "Trade not set"} • {application.job.jobTitle}
                        </div>
                      </div>
                      <div className="pillRow">
                        <span className="pill">{application.job.countyLocation}</span>
                        <span className="pill">{formatStatus(application.status)}</span>
                      </div>
                    </div>
                    <div className="metaRow">
                      <span>{application.applicant.verificationStatus}</span>
                      <span>{application.applicant.trustBadge ?? "No trust badge yet"}</span>
                      <span>{application.applicant.ratingAverage.toFixed(1)} stars</span>
                      <span>{application.applicant.ratingCount} ratings</span>
                    </div>
                    <p className="muted">
                      {application.message?.trim() || "This applicant did not include a message yet."}
                    </p>
                    <div className="pillRow">
                      <button
                        className="actionButton ghostButton"
                        disabled={updatingApplicationId === application.id}
                        onClick={() => void handleEmployerApplicationStatus(application.id, "viewed")}
                      >
                        {updatingApplicationId === application.id ? "Saving..." : "Mark viewed"}
                      </button>
                      <button
                        className="actionButton"
                        disabled={updatingApplicationId === application.id}
                        onClick={() => void handleEmployerApplicationStatus(application.id, "shortlisted")}
                      >
                        {updatingApplicationId === application.id ? "Saving..." : "Shortlist"}
                      </button>
                      <button
                        className="actionButton ghostButton"
                        disabled={updatingApplicationId === application.id}
                        onClick={() => void handleEmployerApplicationStatus(application.id, "rejected")}
                      >
                        {updatingApplicationId === application.id ? "Saving..." : "Reject"}
                      </button>
                      <button
                        className="actionButton"
                        disabled={updatingApplicationId === application.id}
                        onClick={() => void handleEmployerApplicationStatus(application.id, "hired")}
                      >
                        {updatingApplicationId === application.id ? "Saving..." : "Hire"}
                      </button>
                    </div>
                    <div className="muted">
                      Applied on {new Date(application.appliedAt).toLocaleDateString()} for a {formatStatus(application.job.status)} listing.
                      {application.employerViewed ? " Employer has reviewed this application." : ""}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="stack" style={{ marginTop: 12 }}>
                <div className="muted">No workers have applied yet. Publish an active job and worker applications will show up here.</div>
                <div className="pillRow">
                  <span className="pill">{employerActive.length} active jobs</span>
                  <span className="pill">{employerDrafts.length} drafts waiting on publish</span>
                </div>
              </div>
            )
          ) : (
            <div className="stack" style={{ marginTop: 12 }}>
              <div className="muted">Sign in as an employer to review incoming applicants for your jobs.</div>
              <div className="pillRow">
                <span className="pill">dispatch@northsidehvac.com</span>
                <span className="pill">LaborForce123!</span>
              </div>
            </div>
          )}
        </div>
        </div>
      </section>
        </>
      )}

      {activeExperience === "reels" && (
        <section className="socialShell">
          <div className="headerRow">
            <div>
              <div className="badge">Reels page</div>
              <h2 style={{ marginTop: 10 }}>Short-form work videos and trade tips</h2>
              <p className="muted" style={{ marginTop: 8 }}>
                Quick work proof, before-and-after clips, safety tips, and trade education live here.
              </p>
            </div>
            <div className="pillRow">
              <span className="pill">{reelPosts.length} reels</span>
              <span className="pill">Work proof</span>
            </div>
          </div>
          <div className="reelsShell" style={{ marginTop: 18 }}>
            <div className="stack">
              <div className="card">
                <h3>What belongs here</h3>
                <div className="pillRow" style={{ marginTop: 12 }}>
                  <span className="pill">Install clips</span>
                  <span className="pill">Tool tips</span>
                  <span className="pill">Jobsite updates</span>
                  <span className="pill">Trade education</span>
                </div>
              </div>
              <div className="card">
                <h3>Best performing content</h3>
                <p className="muted">
                  Short, vertical, useful, and local. Show what you built, how you did it, and what someone can learn in under 30 seconds.
                </p>
              </div>
            </div>
            <div className="reelsGrid">
            {mockReels.map((reel, index) => (
              <article key={reel.id} className="reelCard">
                <video
                  className="reelVideo"
                  src={reel.videoUrl}
                  poster={reel.imageUrl}
                  controls
                  muted
                  playsInline
                  preload="metadata"
                />
                <div className="reelOverlay">
                  <div className="badge">Reel #{index + 1}</div>
                  <h3>{reel.title}</h3>
                  <p>{reel.description}</p>
                  <div className="pillRow">
                    <span className="pill">{reel.trade}</span>
                    <span className="pill">Trade explainer</span>
                    <span className="pill">Sample video</span>
                  </div>
                  <div className="reelPlayButton">Press play</div>
                </div>
              </article>
            ))}
            </div>
          </div>
        </section>
      )}

      {activeExperience === "network" && (
        <section className="socialShell">
          <div className="headerRow">
            <div>
              <div className="badge">Network</div>
              <h2 style={{ marginTop: 10 }}>Grow your LaborForce network</h2>
              <p className="muted" style={{ marginTop: 8 }}>
                Find verified workers, employers, and customers nearby and connect fast.
              </p>
            </div>
          </div>
          <div className="networkShell" style={{ marginTop: 18 }}>
            <aside className="networkSidebar">
              <div className="card">
                <h3>Manage my network</h3>
                <div className="networkMenu" style={{ marginTop: 14 }}>
                  <div className="networkMenuItem">
                    <span>Connections</span>
                    <strong>{existingConnections.length}</strong>
                  </div>
                  <div className="networkMenuItem">
                    <span>Following</span>
                    <strong>{directoryUsers.length}</strong>
                  </div>
                  <div className="networkMenuItem">
                    <span>Messages</span>
                    <strong>{conversations.length}</strong>
                  </div>
                  <div className="networkMenuItem">
                    <span>Verified people</span>
                    <strong>{directoryUsers.length}</strong>
                  </div>
                </div>
              </div>
            </aside>
            <div className="stack">
              <div className="card">
                <div className="networkTabs" role="tablist" aria-label="Network views">
                  <button
                    id="network-grow-tab"
                    className={`networkTab ${activeNetworkTab === "grow" ? "networkTabActive" : ""}`}
                    type="button"
                    role="tab"
                    aria-selected={activeNetworkTab === "grow"}
                    aria-controls="network-grow-panel"
                    onClick={() => setActiveNetworkTab("grow")}
                  >
                    Grow
                  </button>
                  <button
                    id="network-catch-up-tab"
                    className={`networkTab ${activeNetworkTab === "catchUp" ? "networkTabActive" : ""}`}
                    type="button"
                    role="tab"
                    aria-selected={activeNetworkTab === "catchUp"}
                    aria-controls="network-catch-up-panel"
                    onClick={() => setActiveNetworkTab("catchUp")}
                  >
                    Catch up
                  </button>
                </div>

                {activeNetworkTab === "grow" ? (
                  <div
                    id="network-grow-panel"
                    className="networkTabPanel"
                    role="tabpanel"
                    aria-labelledby="network-grow-tab"
                  >
                    <div className="networkSectionHeader">
                      <h3>People you may know in the trades</h3>
                      <button
                        className="actionButton ghostButton"
                        type="button"
                        onClick={() => switchExperience("messages")}
                      >
                        Browse all
                      </button>
                    </div>
                    <div className="networkCards">
                      {connectionSuggestions.length > 0 ? (
                        connectionSuggestions.map((candidate) => (
                          <article key={candidate.id} className="networkCard">
                            <div className="networkCardBanner" />
                            <div className="networkAvatar">
                              {candidate.profilePhotoUrl ? (
                                <img className="profileAvatarImage" src={candidate.profilePhotoUrl} alt={candidate.fullName} />
                              ) : (
                                <span>{candidate.fullName.slice(0, 1)}</span>
                              )}
                            </div>
                            <div className="networkCardBody">
                              <strong>{candidate.fullName}</strong>
                              <div className="muted">{candidate.tradeType ?? candidate.businessName ?? candidate.userTag}</div>
                              <div className="muted">{candidate.trustBadge ?? candidate.verificationStatus}</div>
                              <button
                                className="actionButton ghostButton"
                                type="button"
                                onClick={() => {
                                  setSelectedRecipientId(candidate.id);
                                  setSuccessMessage(`Ready to connect with ${candidate.fullName}.`);
                                  switchExperience("messages");
                                }}
                              >
                                Connect
                              </button>
                            </div>
                          </article>
                        ))
                      ) : (
                        <p className="muted">As more verified people join, connection suggestions will show here.</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div
                    id="network-catch-up-panel"
                    className="networkTabPanel"
                    role="tabpanel"
                    aria-labelledby="network-catch-up-tab"
                  >
                    <div className="networkSectionHeader">
                      <h3>Stay on top of your network</h3>
                      <button
                        className="actionButton ghostButton"
                        type="button"
                        onClick={() => switchExperience("messages")}
                      >
                        Open inbox
                      </button>
                    </div>

                    <div className="networkCatchUpGrid">
                      <div className="networkCatchUpCard">
                        <div className="networkSectionHeader">
                          <h3>Recent conversations</h3>
                          <div className="badge">{conversations.length}</div>
                        </div>
                        <div className="networkCatchUpList">
                          {catchUpConversations.length > 0 ? (
                            catchUpConversations.map((conversation) => (
                              <button
                                key={conversation.conversationId}
                                className="conversationButton"
                                type="button"
                                onClick={() => {
                                  setSelectedRecipientId(conversation.participant.id);
                                  switchExperience("messages");
                                }}
                              >
                                <div className="headerRow">
                                  <strong>{conversation.participant.fullName}</strong>
                                  <span className="pill">{conversation.unreadCount} unread</span>
                                </div>
                                <div className="muted">
                                  {conversation.participant.tradeType ?? conversation.participant.businessName ?? conversation.participant.userTag}
                                </div>
                                <div>{conversation.latestMessage.messageText}</div>
                                <div className="muted">{formatRelativeTime(conversation.latestMessage.sentAt)} ago</div>
                              </button>
                            ))
                          ) : (
                            <p className="muted">Messages with your verified network will show here as soon as conversations start.</p>
                          )}
                        </div>
                      </div>

                      <div className="networkCatchUpCard">
                        <div className="networkSectionHeader">
                          <h3>Network updates</h3>
                          <div className="badge">{networkAlerts.filter((alert) => !alert.isRead).length} new</div>
                        </div>
                        <div className="networkCatchUpList">
                          {networkAlerts.length > 0 ? (
                            networkAlerts.map((alert) => (
                              <article key={alert.id} className="networkCatchUpItem">
                                <div className="headerRow">
                                  <div className="pillRow">
                                    <span className="pill">{alert.type}</span>
                                    {!alert.isRead && <span className="badge">New</span>}
                                  </div>
                                  <div className="muted">{formatRelativeTime(alert.createdAt)}</div>
                                </div>
                                <strong>{alert.title}</strong>
                                <p className="muted">{alert.body}</p>
                                {alert.actionLabel && (
                                  <div className="notificationActionRow">
                                    <button
                                      className="actionButton ghostButton"
                                      type="button"
                                      onClick={() => handleAlertAction(alert.type)}
                                    >
                                      {alert.actionLabel}
                                    </button>
                                  </div>
                                )}
                              </article>
                            ))
                          ) : (
                            <p className="muted">Replies, profile activity, and new connection updates will show up here.</p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="networkCatchUpCard">
                      <div className="networkSectionHeader">
                        <h3>People to check in with</h3>
                        <button
                          className="actionButton ghostButton"
                          type="button"
                          onClick={() => switchExperience("messages")}
                        >
                          Message someone
                        </button>
                      </div>
                      <div className="stack">
                        {catchUpConnections.length > 0 ? (
                          catchUpConnections.map((candidate) => (
                            <div key={candidate.id} className="networkConnectionRow">
                              <div>
                                <strong>{candidate.fullName}</strong>
                                <div className="muted">{candidate.tradeType ?? candidate.businessName ?? candidate.userTag}</div>
                                <div className="muted">{getWorkerSpecialties(candidate.tradeType).slice(0, 2).join(" • ")}</div>
                              </div>
                              <button
                                className="actionButton ghostButton"
                                type="button"
                                onClick={() => {
                                  setSelectedRecipientId(candidate.id);
                                  switchExperience("messages");
                                }}
                              >
                                Message
                              </button>
                            </div>
                          ))
                        ) : (
                          <p className="muted">As you build connections, your quickest follow-ups will show here.</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="card">
                <div className="networkSectionHeader">
                  <h3>Your connections</h3>
                  <div className="badge">{existingConnections.length}</div>
                </div>
                <div className="stack" style={{ marginTop: 14 }}>
                  {existingConnections.length > 0 ? (
                    existingConnections.map((candidate) => (
                      <div key={candidate.id} className="networkConnectionRow">
                        <div>
                          <strong>{candidate.fullName}</strong>
                          <div className="muted">{candidate.tradeType ?? candidate.businessName ?? candidate.userTag}</div>
                        </div>
                        <button
                          className="actionButton ghostButton"
                          type="button"
                          onClick={() => {
                            setSelectedRecipientId(candidate.id);
                            switchExperience("messages");
                          }}
                        >
                          Message
                        </button>
                      </div>
                    ))
                  ) : (
                    <p className="muted">Start connecting with verified people and they’ll show up here.</p>
                  )}
                </div>
              </div>

              <div className="networkToolsPanel">
                <div className="networkToolsSidebar">
                  <div className="networkToolsGroup">
                    <div className="networkToolsLabel">Talent</div>
                    <button className="networkToolsNavItem networkToolsNavActive">Find leads</button>
                    <button className="networkToolsNavItem">Groups</button>
                  </div>
                  <div className="networkToolsGroup">
                    <div className="networkToolsLabel">Hiring</div>
                    <button className="networkToolsNavItem">Hire with AI</button>
                    <button className="networkToolsNavItem">Talent insights</button>
                  </div>
                  <div className="networkToolsGroup">
                    <div className="networkToolsLabel">Sales</div>
                    <button className="networkToolsNavItem">Services marketplace</button>
                  </div>
                </div>
                <div className="networkToolsContent">
                  <div className="networkToolsItem">
                    <strong>Hire on LaborForce</strong>
                    <span className="muted">Find, attract, and recruit verified trade talent.</span>
                  </div>
                  <div className="networkToolsItem">
                    <strong>Sell with LaborForce</strong>
                    <span className="muted">Build relationships with homeowners, property managers, and trade buyers.</span>
                  </div>
                  <div className="networkToolsItem">
                    <strong>Post a job</strong>
                    <span className="muted">Create openings, publish them, and collect real applicants.</span>
                  </div>
                  <div className="networkToolsItem">
                    <strong>Advertise your business</strong>
                    <span className="muted">Use your feed, reels, and proof wall to grow your trade business.</span>
                  </div>
                  <div className="networkToolsItem">
                    <strong>Get started with Premium</strong>
                    <span className="muted">Unlock CRM, AI tools, unlimited proof wall uploads, and extra visibility.</span>
                  </div>
                  <div className="networkToolsItem">
                    <strong>Learn with LaborForce</strong>
                    <span className="muted">Trade explainers, work tips, and training-style reels for your crew.</span>
                  </div>
                  <div className="networkToolsItem">
                    <strong>Admin center</strong>
                    <span className="muted">Manage billing, profile controls, and company account details.</span>
                  </div>
                  <div className="networkToolsItem">
                    <strong>Create a company page</strong>
                    <span className="muted">Give your business a public profile with jobs, proof wall, and trusted badges.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {activeExperience === "messages" && (
        <section className="socialShell">
          <div className="headerRow">
            <div>
              <div className="badge">Messages page</div>
              <h2 style={{ marginTop: 10 }}>Verified-only conversations</h2>
              <p className="muted" style={{ marginTop: 8 }}>
                Real DMs between verified people. New messages can trigger SMS alerts when Twilio is connected.
              </p>
            </div>
            <div className="badge">{unreadMessagesCount} unread</div>
          </div>
          <div className="messagesShell" style={{ marginTop: 18 }}>
            <div className="stack messageInboxPanel">
              <div className="card">
                <h3>Inbox</h3>
                <p className="muted">Talk only with verified workers, employers, and customers.</p>
              </div>
              {conversations.length > 0 ? (
                conversations.map((conversation) => (
                  <button
                    key={conversation.conversationId}
                    className="conversationButton"
                    onClick={() => setSelectedRecipientId(conversation.participant.id)}
                  >
                    <div className="headerRow">
                      <strong>{conversation.participant.fullName}</strong>
                      <span className="pill">{conversation.unreadCount} unread</span>
                    </div>
                    <div className="muted">
                      {conversation.participant.tradeType ?? conversation.participant.businessName ?? conversation.participant.userTag}
                    </div>
                    <div>{conversation.latestMessage.messageText}</div>
                  </button>
                ))
              ) : (
                <div className="card">
                  <p className="muted">No conversations yet. Start by choosing a verified person on the right.</p>
                </div>
              )}
            </div>
            <div className="stack messageComposerPanel">
              <div className="card">
                <h3>Pick a verified person</h3>
                <select
                  value={selectedRecipientId}
                  onChange={(event) => setSelectedRecipientId(event.target.value)}
                >
                  <option value="">Choose someone</option>
                  {directoryUsers.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.fullName} - {candidate.tradeType ?? candidate.businessName ?? candidate.userTag}
                    </option>
                  ))}
                </select>
              </div>
              {selectedRecipientId && (
                <>
                  <div className="messageThread card">
                    {isLoadingThread ? (
                      <div className="muted">Loading conversation...</div>
                    ) : threadMessages.length > 0 ? (
                      threadMessages.map((message) => (
                        <article
                          key={message.id}
                          className={`messageBubble ${message.senderId === user?.id ? "sentBubble" : "receivedBubble"}`}
                        >
                          <strong>{message.senderId === user?.id ? "You" : "Them"}</strong>
                          <div>{message.messageText}</div>
                          <div className="muted">{new Date(message.sentAt).toLocaleString()}</div>
                        </article>
                      ))
                    ) : (
                      <div className="muted">No messages yet. Start the conversation.</div>
                    )}
                  </div>
                  <div className="stack card">
                    <h3>New message</h3>
                    <textarea
                      rows={3}
                      placeholder="Type your message"
                      value={messageText}
                      onChange={(event) => setMessageText(event.target.value)}
                    />
                    <button
                      className="actionButton"
                      disabled={isSendingMessage}
                      onClick={() => void handleSendMessage()}
                    >
                      {isSendingMessage ? "Sending..." : "Send message"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </section>
      )}

      {activeExperience === "notifications" && (
        <section className="socialShell">
          <div className="headerRow">
            <div>
              <div className="badge">Notifications</div>
              <h2 style={{ marginTop: 10 }}>Your updates</h2>
              <p className="muted" style={{ marginTop: 8 }}>
                Messages, applicant activity, and account updates all show up here.
              </p>
            </div>
            <div className="badge">{unreadAlertsCount} unread</div>
          </div>
          <div className="notificationsShell" style={{ marginTop: 18 }}>
            <div className="notificationsRail">
              <button className="notificationFilterButton notificationFilterActive">All</button>
              <button className="notificationFilterButton">Messages</button>
              <button className="notificationFilterButton">Applications</button>
              <button className="notificationFilterButton">Network</button>
            </div>
            <div className="stack">
              {isLoadingAlerts ? (
                <div className="card"><p className="muted">Loading notifications...</p></div>
              ) : alerts.length > 0 ? (
                alerts.map((alert) => (
                  <article key={alert.id} className={`notificationCard ${alert.isRead ? "" : "notificationUnread"}`}>
                    <div className="headerRow">
                      <div className="pillRow">
                        <span className="pill">{alert.type}</span>
                        {!alert.isRead && <span className="badge">New</span>}
                      </div>
                      <div className="muted">{formatRelativeTime(alert.createdAt)}</div>
                    </div>
                    <h3>{alert.title}</h3>
                    <p className="muted">{alert.body}</p>
                    {alert.actionLabel && (
                      <div className="notificationActionRow">
                        <button
                          className="actionButton ghostButton"
                          type="button"
                          onClick={() => handleAlertAction(alert.type)}
                        >
                          {alert.actionLabel}
                        </button>
                      </div>
                    )}
                  </article>
                ))
              ) : (
                <div className="card">
                  <p className="muted">No notifications yet. As people message you and interact with your jobs, updates will show up here.</p>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {activeExperience === "profile" && (
        <section className="socialShell">
          <div className="headerRow">
            <div>
              <div className="badge">Profile page</div>
              <h2 style={{ marginTop: 10 }}>Your profile</h2>
              <p className="muted" style={{ marginTop: 8 }}>
                Show people what you do, what kind of work you take on, and the proof behind it.
              </p>
            </div>
          </div>
          {user ? (
            <div className="profileLayout" style={{ marginTop: 18 }}>
              <div className="stack">
                <div className="profileHeroCard">
                  <div className="profileBanner" />
                  <div className="profileHeroTop">
                    <div className="profileAvatar">
                      {user.profilePhotoUrl ? (
                        <img className="profileAvatarImage" src={user.profilePhotoUrl} alt={user.fullName} />
                      ) : (
                        <span>{user.fullName.slice(0, 1)}</span>
                      )}
                    </div>
                    <div className="stack" style={{ gap: 8 }}>
                      <h2>{user.fullName}</h2>
                      <div className="profileHandle">@{user.fullName.toLowerCase().replaceAll(" ", "")}</div>
                      <div className="muted">
                        {user.tradeType ?? user.businessName ?? user.userTag}
                      </div>
                      <div className="profileHeadline">
                        {user.userTag === "employee"
                          ? "Verified tradesperson building a public proof wall and real work reputation."
                          : "Verified business profile showing active work, hiring needs, and public credibility."}
                      </div>
                      <div className="pillRow">
                        <span className="pill">{user.trustBadge ?? user.verificationStatus}</span>
                        <span className="pill">{user.userTag}</span>
                        {user.openToWork && <span className="pill">Open to work</span>}
                        {user.unionStatus && <span className="pill">{user.unionStatus}</span>}
                      </div>
                      <div className="profileActionRow">
                        <button className="actionButton" type="button" onClick={() => switchExperience("messages")}>
                          Message
                        </button>
                        <button className="actionButton ghostButton" type="button" onClick={() => switchExperience("feed")}>
                          View posts
                        </button>
                      </div>
                      {user.userTag === "employee" && (
                        <div className="profileMiniBadges">
                          <span className="profileMiniBadge">Verified worker</span>
                          <span className="profileMiniBadge">Proof wall active</span>
                          <span className="profileMiniBadge">Rated publicly</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="profileBio">
                    {user.bio?.trim() || "Add a bio so people know what kind of work you do and what makes you different."}
                  </p>
                  <div className="profileStats">
                    <div className="profileStat">
                      <strong>{profilePosts.length}</strong>
                      <span>Posts</span>
                    </div>
                    <div className="profileStat">
                      <strong>{user.ratingAverage.toFixed(1)}</strong>
                      <span>Rating</span>
                    </div>
                    <div className="profileStat">
                      <strong>{user.yearsExperience ?? 0}</strong>
                      <span>Years</span>
                    </div>
                    <div className="profileStat">
                      <strong>{user.hourlyRate ? formatMoney(user.hourlyRate) : "-"}</strong>
                      <span>Rate</span>
                    </div>
                  </div>
                  {user.userTag === "employee" && (
                    <>
                      <div className="profileSectionLabel">Specialties</div>
                      <div className="pillRow" style={{ marginTop: 10 }}>
                        {workerSpecialties.map((specialty) => (
                          <span key={specialty} className="pill">{specialty}</span>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                <div className="card">
                  <div className="headerRow">
                    <h3>Featured</h3>
                    <div className="badge">Profile highlights</div>
                  </div>
                  <div className="profileFeatureGrid" style={{ marginTop: 14 }}>
                    <div className="profileFeatureCard">
                      <strong>About the work</strong>
                      <p className="muted">
                        {user.tradeType ?? "Trade"} professional with {user.yearsExperience ?? 0}+ years of field experience and a public body of work.
                      </p>
                    </div>
                    <div className="profileFeatureCard">
                      <strong>Proof wall style</strong>
                      <p className="muted">
                        Finished jobs, work wins, certifications, and short clips all build trust faster than resumes alone.
                      </p>
                    </div>
                    <div className="profileFeatureCard">
                      <strong>Hiring signal</strong>
                      <p className="muted">
                        Employers can review ratings, visible work, and profile details before reaching out or sending an offer.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="card">
                  <div className="headerRow">
                    <h3>Pinned work</h3>
                    <div className="badge">Top 3</div>
                  </div>
                  {pinnedProfilePosts.length > 0 ? (
                    <div className="pinnedGrid" style={{ marginTop: 14 }}>
                      {pinnedProfilePosts.map((post) => (
                        <article key={post.id} className="pinnedCard">
                          {post.photoUrls[0] ? (
                            <img className="pinnedImage" src={post.photoUrls[0]} alt={post.tradeTag} />
                          ) : (
                            <div className="proofPlaceholder">{post.tradeTag}</div>
                          )}
                          <div className="pinnedCopy">
                            <strong>{post.tradeTag}</strong>
                            <div className="muted">{post.locationDisplay}</div>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="muted" style={{ marginTop: 12 }}>
                      Your best proof wall posts will show here first.
                    </p>
                  )}
                </div>

                {user.userTag === "employee" && (
                  <div className="card">
                    <div className="headerRow">
                      <h3>Worker snapshot</h3>
                      <div className="badge">Mock profile view</div>
                    </div>
                    <div className="profileFeatureGrid" style={{ marginTop: 14 }}>
                      <div className="profileFeatureCard">
                        <strong>Availability</strong>
                        <p className="muted">
                          {user.openToWork ? "Open to the right opportunity and visible to employers." : "Not actively looking right now."}
                        </p>
                      </div>
                      <div className="profileFeatureCard">
                        <strong>Best fit</strong>
                        <p className="muted">
                          {user.tradeType ?? "Trade"} work, service calls, installs, and dependable field work.
                        </p>
                      </div>
                      <div className="profileFeatureCard">
                        <strong>Trust</strong>
                        <p className="muted">
                          Verified profile, public rating, and visible proof wall posts for hiring managers to review fast.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="card">
                  <div className="headerRow">
                    <h3>Proof Wall</h3>
                    <div className="badge">{profilePosts.length} posts</div>
                  </div>
                  {profilePosts.length > 0 ? (
                    <div className="proofGrid" style={{ marginTop: 14 }}>
                      {profilePosts.map((post) => (
                        <article key={post.id} className="proofCard">
                          {post.photoUrls[0] ? (
                            <img className="proofImage" src={post.photoUrls[0]} alt={post.tradeTag} />
                          ) : (
                            <div className="proofPlaceholder">{post.tradeTag}</div>
                          )}
                          <div className="proofCopy">
                            <strong>{post.tradeTag}</strong>
                            <div className="muted">{formatRelativeTime(post.createdAt)} • {post.locationDisplay}</div>
                            <p>{post.postText}</p>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="muted" style={{ marginTop: 12 }}>
                      Your feed posts will also build out your proof wall here.
                    </p>
                  )}
                </div>
              </div>

              <div className="stack">
                <form className="card" onSubmit={handleSaveProfile}>
                  <div className="headerRow">
                    <h3>Edit profile</h3>
                    <div className="badge">Live profile</div>
                  </div>
                  <div className="stack" style={{ marginTop: 12 }}>
                    <label className="field">
                      <span>Full name</span>
                      <input value={profileForm.fullName} onChange={(event) => setProfileForm((current) => ({ ...current, fullName: event.target.value }))} required />
                    </label>
                    <label className="field">
                      <span>Trade</span>
                      <input value={profileForm.tradeType} onChange={(event) => setProfileForm((current) => ({ ...current, tradeType: event.target.value }))} placeholder="Electrician, HVAC, Plumbing" />
                    </label>
                    <label className="field">
                      <span>Business name</span>
                      <input value={profileForm.businessName} onChange={(event) => setProfileForm((current) => ({ ...current, businessName: event.target.value }))} placeholder="Company or crew name" />
                    </label>
                    <label className="field">
                      <span>Profile photo URL</span>
                      <input value={profileForm.profilePhotoUrl} onChange={(event) => setProfileForm((current) => ({ ...current, profilePhotoUrl: event.target.value }))} placeholder="https://..." />
                    </label>
                    <label className="field">
                      <span>Bio</span>
                      <textarea rows={4} value={profileForm.bio} onChange={(event) => setProfileForm((current) => ({ ...current, bio: event.target.value }))} placeholder="Tell people what you do, who you work with, and what kind of jobs you take on." />
                    </label>
                    <div className="splitFields">
                      <label className="field">
                        <span>Years experience</span>
                        <input type="number" value={profileForm.yearsExperience} onChange={(event) => setProfileForm((current) => ({ ...current, yearsExperience: event.target.value }))} />
                      </label>
                      <label className="field">
                        <span>Hourly rate</span>
                        <input type="number" value={profileForm.hourlyRate} onChange={(event) => setProfileForm((current) => ({ ...current, hourlyRate: event.target.value }))} />
                      </label>
                    </div>
                    <label className="field">
                      <span>Union or affiliation</span>
                      <input value={profileForm.unionStatus} onChange={(event) => setProfileForm((current) => ({ ...current, unionStatus: event.target.value }))} placeholder="IBEW, UA, non-union, etc." />
                    </label>
                    <label className="profileToggle">
                      <input
                        type="checkbox"
                        checked={profileForm.openToWork}
                        onChange={(event) => setProfileForm((current) => ({ ...current, openToWork: event.target.checked }))}
                      />
                      <span>Open to work</span>
                    </label>
                    <button className="actionButton" type="submit" disabled={isSavingProfile}>
                      {isSavingProfile ? "Saving..." : "Save profile"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          ) : (
            <div className="card" style={{ marginTop: 18 }}>
              <p className="muted">Log in first to build out your profile.</p>
            </div>
          )}
        </section>
      )}

    </div>
  );
}
