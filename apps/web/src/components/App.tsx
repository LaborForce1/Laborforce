import { useEffect, useMemo, useState } from "react";
import type { EmployerApplicationView, JobApplication, JobListing, Message, MessageConversation, User, UserTag } from "@laborforce/shared";
import { apiGet, apiPatch, apiPost } from "../api/client";

const AUTH_STORAGE_KEY = "laborforce-web-auth";

type View = "overview" | "auth" | "jobs" | "applications" | "messages" | "profile";
type AuthMode = "login" | "signup";

interface AuthCredentials {
  accessToken: string;
  refreshToken: string;
}

interface AuthResponse {
  user: User;
  credentials: AuthCredentials;
}

interface JobsResponse {
  radiusMiles: number;
  items: JobListing[];
}

interface EmployerJobsResponse {
  items: JobListing[];
}

interface ApplicationsResponse {
  items: JobApplication[];
}

interface EmployerApplicationsResponse {
  items: EmployerApplicationView[];
}

interface ConversationsResponse {
  items: MessageConversation[];
}

interface ThreadResponse {
  participant: User;
  conversationId: string;
  items: Message[];
}

interface ProfileUpdateResponse {
  user: User;
  message: string;
}

interface BusinessVerificationResponse {
  user: User;
  personaReady: boolean;
  mode: "persona_connected" | "development_simulation";
  message: string;
}

interface AuthFormState {
  fullName: string;
  businessName: string;
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
  locationZip: string;
  certificationsRequired: string;
}

interface ProfileFormState {
  fullName: string;
  zipCode: string;
  tradeType: string;
  businessName: string;
  bio: string;
  yearsExperience: string;
  hourlyRate: string;
  unionStatus: string;
  openToWork: boolean;
}

const emptyAuthForm: AuthFormState = {
  fullName: "",
  businessName: "",
  email: "",
  phone: "",
  password: "",
  zipCode: "",
  tradeType: ""
};

const emptyJobForm: JobFormState = {
  jobTitle: "",
  tradeCategory: "",
  description: "",
  hourlyRateMin: "",
  hourlyRateMax: "",
  jobType: "full_time",
  benefits: "",
  countyLocation: "",
  locationZip: "",
  certificationsRequired: ""
};

const emptyProfileForm: ProfileFormState = {
  fullName: "",
  zipCode: "",
  tradeType: "",
  businessName: "",
  bio: "",
  yearsExperience: "",
  hourlyRate: "",
  unionStatus: "",
  openToWork: false
};

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

function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}

function buildInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function buildProfileChecklist(user: User | null) {
  if (!user) {
    return [];
  }

  const items = [
    {
      label: "Add your full name",
      complete: Boolean(user.fullName?.trim())
    },
    {
      label: user.userTag === "employer" ? "Add your business name" : "Add your trade",
      complete: user.userTag === "employer" ? Boolean(user.businessName?.trim()) : Boolean(user.tradeType?.trim())
    },
    {
      label: "Write a short bio",
      complete: Boolean(user.bio?.trim())
    }
  ];

  if (user.userTag === "employee") {
    items.push({
      label: "Turn on open to work if you want employers to find you",
      complete: user.openToWork
    });
  }

  if (user.userTag === "employer") {
    items.push({
      label: "Complete business verification before posting jobs",
      complete: user.isBusinessVerified
    });
  }

  return items;
}

function buildWorkerHeadline(user: User) {
  if (user.userTag !== "employee") {
    return user.businessName?.trim() || "Complete your profile to unlock the hiring flow.";
  }

  const parts = [
    user.tradeType?.trim() || "Skilled worker",
    user.yearsExperience ? `${user.yearsExperience}+ years experience` : null,
    user.openToWork ? "Open to work now" : "Not marked open to work yet"
  ].filter(Boolean);

  return parts.join(" • ");
}

function buildWorkerStrengths(user: User | null) {
  if (!user || user.userTag !== "employee") {
    return [];
  }

  return [
    {
      label: "Availability",
      value: user.openToWork ? "Ready for new work" : "Needs open-to-work turned on",
      hint: user.openToWork ? "Employers can discover you right now." : "Turn it on to show up faster in employer flows."
    },
    {
      label: "Trade focus",
      value: user.tradeType?.trim() || "Add your main trade",
      hint: user.tradeType?.trim() ? "This is the first thing employers use to scan fit." : "Be specific: electrician, HVAC, drywall, plumbing."
    },
    {
      label: "Trust signal",
      value: user.trustBadge || (user.isVerified ? "Verified worker" : "Verification pending"),
      hint: user.isVerified ? "Your account already looks more trustworthy." : "A stronger profile helps the verification flow feel legitimate."
    }
  ];
}

function buildWorkerApplicationNextStep(application: JobApplication, user: User | null) {
  if (user?.userTag !== "employee") {
    return null;
  }

  if (application.status === "submitted") {
    return "Your application is in. Keep your intro strong and watch for employer activity.";
  }

  if (application.status === "viewed") {
    return "The employer has seen your application. Stay ready to reply fast if they move you forward.";
  }

  if (application.status === "shortlisted") {
    if (user.isVerified && application.employer?.verificationStatus === "verified") {
      return "You have real momentum here. Follow up in chat now while the job is warm.";
    }

    return "You were shortlisted. Verification still needs to catch up before messaging unlocks.";
  }

  if (application.status === "hired") {
    if (user.isVerified && application.employer?.verificationStatus === "verified") {
      return "You were marked hired. Confirm start details and next steps in chat.";
    }

    return "You were marked hired. Watch this application and stay ready while messaging unlocks.";
  }

  if (application.status === "rejected") {
    return "This one closed out. Keep applying to other good-fit jobs.";
  }

  return null;
}

function getApplicationSortRank(status: JobApplication["status"]) {
  switch (status) {
    case "hired":
      return 0;
    case "shortlisted":
      return 1;
    case "viewed":
      return 2;
    case "submitted":
      return 3;
    case "rejected":
      return 4;
    default:
      return 5;
  }
}

function buildWorkerBlockers(user: User | null) {
  if (!user || user.userTag !== "employee") {
    return [];
  }

  return [
    !user.tradeType?.trim() ? "Add your trade" : null,
    !user.bio?.trim() ? "Write your bio" : null,
    !user.openToWork ? "Turn on open to work" : null,
    !user.isVerified ? "Finish account verification" : null
  ].filter(Boolean) as string[];
}

function buildEmployerBlockers(user: User | null) {
  if (!user || user.userTag !== "employer") {
    return [];
  }

  return [
    !user.businessName?.trim() ? "Add business name" : null,
    !user.bio?.trim() ? "Write business bio" : null,
    !user.isBusinessVerified ? "Finish business verification" : null
  ].filter(Boolean) as string[];
}

function getEmployerApplicationSortRank(status: EmployerApplicationView["status"]) {
  switch (status) {
    case "submitted":
      return 0;
    case "viewed":
      return 1;
    case "shortlisted":
      return 2;
    case "hired":
      return 3;
    case "rejected":
      return 4;
    default:
      return 5;
  }
}

export function App() {
  const [activeView, setActiveView] = useState<View>("overview");
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [selectedTag, setSelectedTag] = useState<UserTag>("employee");
  const [authState, setAuthState] = useState<AuthCredentials | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [jobs, setJobs] = useState<JobListing[]>([]);
  const [employerJobs, setEmployerJobs] = useState<JobListing[]>([]);
  const [jobsRadius, setJobsRadius] = useState(50);
  const [driveRadius, setDriveRadius] = useState(50);
  const [jobSearch, setJobSearch] = useState("");
  const [jobTradeFilter, setJobTradeFilter] = useState("all");
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [incomingApplications, setIncomingApplications] = useState<EmployerApplicationView[]>([]);
  const [directoryUsers, setDirectoryUsers] = useState<User[]>([]);
  const [conversations, setConversations] = useState<MessageConversation[]>([]);
  const [threadMessages, setThreadMessages] = useState<Message[]>([]);
  const [selectedRecipientId, setSelectedRecipientId] = useState("");
  const [messageText, setMessageText] = useState("");
  const [authForm, setAuthForm] = useState<AuthFormState>(emptyAuthForm);
  const [jobForm, setJobForm] = useState<JobFormState>(emptyJobForm);
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [profileForm, setProfileForm] = useState<ProfileFormState>(emptyProfileForm);
  const [applyForms, setApplyForms] = useState<Record<string, string>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isBooting, setIsBooting] = useState(true);
  const [isLoadingJobs, setIsLoadingJobs] = useState(false);
  const [isLoadingThread, setIsLoadingThread] = useState(false);
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);
  const [isPostingJob, setIsPostingJob] = useState(false);
  const [isApplyingJobId, setIsApplyingJobId] = useState<string | null>(null);
  const [publishingJobId, setPublishingJobId] = useState<string | null>(null);
  const [updatingJobId, setUpdatingJobId] = useState<string | null>(null);
  const [updatingApplicationId, setUpdatingApplicationId] = useState<string | null>(null);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isCompletingVerification, setIsCompletingVerification] = useState(false);

  const applicationMap = useMemo(
    () => new Map(applications.map((application) => [application.jobListingId, application])),
    [applications]
  );

  const employerDrafts = useMemo(() => employerJobs.filter((job) => job.status === "draft"), [employerJobs]);

  const employerActiveJobs = useMemo(() => employerJobs.filter((job) => job.status === "active"), [employerJobs]);

  const availableMessageUsers = useMemo(
    () => directoryUsers.filter((candidate) => candidate.id !== user?.id && candidate.isVerified),
    [directoryUsers, user?.id]
  );

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.participant.id === selectedRecipientId) ?? null,
    [conversations, selectedRecipientId]
  );

  const selectedMessageUser = useMemo(
    () => availableMessageUsers.find((candidate) => candidate.id === selectedRecipientId) ?? null,
    [availableMessageUsers, selectedRecipientId]
  );

  const needsBusinessVerification = user?.userTag === "employer" && !user.isBusinessVerified;
  const workerActiveApplications = applications.filter((application) => application.status === "submitted" || application.status === "viewed");
  const sortedWorkerApplications = useMemo(
    () =>
      [...applications].sort((left, right) => {
        const statusRank = getApplicationSortRank(left.status) - getApplicationSortRank(right.status);
        if (statusRank !== 0) {
          return statusRank;
        }

        return new Date(right.appliedAt).getTime() - new Date(left.appliedAt).getTime();
      }),
    [applications]
  );
  const workerPriorityApplication =
    sortedWorkerApplications.find((application) => application.status === "shortlisted" || application.status === "hired") ??
    sortedWorkerApplications[0] ??
    null;
  const employerPriorityApplication =
    incomingApplications.find((application) => application.status === "submitted" || application.status === "viewed") ??
    incomingApplications[0] ??
    null;
  const sortedEmployerApplications = useMemo(
    () =>
      [...incomingApplications].sort((left, right) => {
        const statusRank = getEmployerApplicationSortRank(left.status) - getEmployerApplicationSortRank(right.status);
        if (statusRank !== 0) {
          return statusRank;
        }

        return new Date(right.appliedAt).getTime() - new Date(left.appliedAt).getTime();
      }),
    [incomingApplications]
  );
  const employerApplicationStatusCounts = useMemo(
    () => ({
      submitted: incomingApplications.filter((application) => application.status === "submitted").length,
      viewed: incomingApplications.filter((application) => application.status === "viewed").length,
      shortlisted: incomingApplications.filter((application) => application.status === "shortlisted").length,
      hired: incomingApplications.filter((application) => application.status === "hired").length
    }),
    [incomingApplications]
  );
  const employerNeedsFirstJob = user?.userTag === "employer" && employerJobs.length === 0;
  const workerNeedsFirstApplication = user?.userTag === "employee" && applications.length === 0;
  const messagingLocked = Boolean(user && !user.isVerified);
  const employerPriorityApplicantVerified = employerPriorityApplication?.applicant.verificationStatus === "verified";
  const workerPriorityEmployerVerified = workerPriorityApplication?.employer?.verificationStatus === "verified";
  const workerApplicationStatusCounts = useMemo(
    () => ({
      submitted: applications.filter((application) => application.status === "submitted").length,
      viewed: applications.filter((application) => application.status === "viewed").length,
      shortlisted: applications.filter((application) => application.status === "shortlisted").length,
      hired: applications.filter((application) => application.status === "hired").length
    }),
    [applications]
  );
  const availableTradeFilters = useMemo(
    () => Array.from(new Set(jobs.map((job) => job.tradeCategory))).sort((a, b) => a.localeCompare(b)),
    [jobs]
  );
  const filteredJobs = useMemo(() => {
    const normalizedSearch = jobSearch.trim().toLowerCase();

    return jobs.filter((job) => {
      const matchesTrade = jobTradeFilter === "all" || job.tradeCategory === jobTradeFilter;
      const matchesSearch =
        normalizedSearch.length === 0 ||
        job.jobTitle.toLowerCase().includes(normalizedSearch) ||
        job.tradeCategory.toLowerCase().includes(normalizedSearch) ||
        job.countyLocation.toLowerCase().includes(normalizedSearch) ||
        job.description.toLowerCase().includes(normalizedSearch);

      return matchesTrade && matchesSearch;
    });
  }, [jobs, jobSearch, jobTradeFilter]);

  const profileChecklist = useMemo(() => buildProfileChecklist(user), [user]);
  const completedChecklistCount = profileChecklist.filter((item) => item.complete).length;
  const workerStrengths = useMemo(() => buildWorkerStrengths(user), [user]);
  const workerReadinessSummary =
    user?.userTag === "employee"
      ? !user.tradeType?.trim()
        ? "Add your trade so employers know what kind of work to send you."
        : !user.openToWork
          ? "Turn on open to work so you show up as available."
          : !user.bio?.trim()
            ? "Add a short bio so employers know what you do best."
            : "Your worker profile is ready to support real hiring conversations."
      : null;
  const workerBlockers = useMemo(() => buildWorkerBlockers(user), [user]);
  const employerBlockers = useMemo(() => buildEmployerBlockers(user), [user]);

  useEffect(() => {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) {
      setIsBooting(false);
      return;
    }

    try {
      setAuthState(JSON.parse(raw) as AuthCredentials);
    } catch {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
    } finally {
      setIsBooting(false);
    }
  }, []);

  useEffect(() => {
    void loadJobs();
  }, [driveRadius, authState?.accessToken]);

  useEffect(() => {
    if (!authState?.accessToken) {
      setUser(null);
      setApplications([]);
      setIncomingApplications([]);
      setEmployerJobs([]);
      setDirectoryUsers([]);
      setConversations([]);
      setThreadMessages([]);
      setSelectedRecipientId("");
      return;
    }

    void loadCurrentUser(authState.accessToken);
  }, [authState]);

  useEffect(() => {
    if (!authState?.accessToken || !user) {
      return;
    }

    void loadDirectoryUsers(authState.accessToken);
    void loadConversations(authState.accessToken);

    if (user.userTag === "employee") {
      void loadApplications(authState.accessToken);
    }

    if (user.userTag === "employer") {
      void loadEmployerApplications(authState.accessToken);
      void loadEmployerJobs(authState.accessToken);
    }
  }, [authState, user]);

  useEffect(() => {
    if (!user) {
      setProfileForm(emptyProfileForm);
      return;
    }

    setProfileForm({
      fullName: user.fullName ?? "",
      zipCode: user.zipCode ?? "",
      tradeType: user.tradeType ?? "",
      businessName: user.businessName ?? "",
      bio: user.bio ?? "",
      yearsExperience: user.yearsExperience?.toString() ?? "",
      hourlyRate: user.hourlyRate?.toString() ?? "",
      unionStatus: user.unionStatus ?? "",
      openToWork: user.openToWork
    });
  }, [user]);

  useEffect(() => {
    if (!authState?.accessToken || !selectedRecipientId) {
      setThreadMessages([]);
      return;
    }

    void loadThread(authState.accessToken, selectedRecipientId);
  }, [authState, selectedRecipientId]);

  async function loadJobs() {
    setIsLoadingJobs(true);

    try {
      const response = await apiGet<JobsResponse>(`/jobs?radiusMiles=${driveRadius}`, authState?.accessToken);
      setJobs(response.items);
      setJobsRadius(response.radiusMiles);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load jobs.");
    } finally {
      setIsLoadingJobs(false);
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

  async function loadEmployerJobs(token: string) {
    try {
      const response = await apiGet<EmployerJobsResponse>("/jobs/mine", token);
      setEmployerJobs(response.items);
    } catch {
      setEmployerJobs([]);
    }
  }

  async function loadDirectoryUsers(token: string) {
    try {
      const response = await apiGet<User[]>("/users", token);
      setDirectoryUsers(response);
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

  async function handleAuthSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmittingAuth(true);

    try {
      const endpoint = authMode === "signup" ? "/auth/signup" : "/auth/login";
      const payload =
        authMode === "signup"
          ? {
              ...authForm,
              userTag: selectedTag,
              tradeType: selectedTag === "employee" ? authForm.tradeType : undefined,
              businessName: selectedTag === "employer" ? authForm.businessName : undefined
            }
          : {
              email: authForm.email,
              password: authForm.password
            };

      const response = await apiPost<AuthResponse>(endpoint, payload);
      setAuthState(response.credentials);
      setUser(response.user);
      window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(response.credentials));
      if (authMode === "signup" && response.user.userTag === "employee") {
        setSuccessMessage("Account created. Next step: finish your worker profile, turn on open to work, then start applying.");
      } else if (authMode === "signup" && response.user.userTag === "employer") {
        setSuccessMessage("Account created. Next step: finish your business profile and complete verification.");
      } else {
        setSuccessMessage("Signed in successfully.");
      }
      setAuthForm(emptyAuthForm);
      setActiveView("profile");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to authenticate.");
    } finally {
      setIsSubmittingAuth(false);
    }
  }

  async function handleCreateJob(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!authState?.accessToken) {
      setErrorMessage("Sign in before posting a job.");
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsPostingJob(true);

    try {
      const payload = {
        jobTitle: jobForm.jobTitle,
        tradeCategory: jobForm.tradeCategory,
        description: jobForm.description,
        hourlyRateMin: Number(jobForm.hourlyRateMin),
        hourlyRateMax: Number(jobForm.hourlyRateMax),
        jobType: jobForm.jobType,
        benefits: jobForm.benefits,
        countyLocation: jobForm.countyLocation,
        locationZip: jobForm.locationZip,
        certificationsRequired: jobForm.certificationsRequired
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean)
      };

      const response = editingJobId
        ? await apiPatch<{ message: string }>(`/jobs/${editingJobId}`, payload, authState.accessToken)
        : await apiPost<{ nextStep: string }>("/jobs", payload, authState.accessToken);

      setJobForm(emptyJobForm);
      setEditingJobId(null);
      setSuccessMessage("nextStep" in response ? response.nextStep : response.message);
      await loadJobs();
      await loadEmployerJobs(authState.accessToken);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to create job.");
    } finally {
      setIsPostingJob(false);
    }
  }

  async function handleUpdateJobStatus(jobId: string, status: "filled" | "closed") {
    if (!authState?.accessToken) {
      return;
    }

    setUpdatingJobId(jobId);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await apiPatch<{ message: string }>(
        `/jobs/${jobId}/status`,
        { status },
        authState.accessToken
      );

      setSuccessMessage(response.message);
      await loadJobs();
      await loadEmployerJobs(authState.accessToken);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update job status.");
    } finally {
      setUpdatingJobId(null);
    }
  }

  function startEditingJob(job: JobListing) {
    setEditingJobId(job.id);
    setJobForm({
      jobTitle: job.jobTitle,
      tradeCategory: job.tradeCategory,
      description: job.description,
      hourlyRateMin: job.hourlyRateMin.toString(),
      hourlyRateMax: job.hourlyRateMax.toString(),
      jobType: job.jobType,
      benefits: job.benefits ?? "",
      countyLocation: job.countyLocation,
      locationZip: job.locationZip,
      certificationsRequired: job.certificationsRequired.join(", ")
    });
  }

  function cancelEditingJob() {
    setEditingJobId(null);
    setJobForm(emptyJobForm);
  }

  async function handlePublishJob(jobId: string) {
    if (!authState?.accessToken) {
      return;
    }

    setPublishingJobId(jobId);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await apiPost<{ job: JobListing; message: string }>(`/jobs/${jobId}/publish`, {}, authState.accessToken);
      setSuccessMessage("Job is live. Applicants can see it now.");
      await loadJobs();
      await loadEmployerJobs(authState.accessToken);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to publish job.");
    } finally {
      setPublishingJobId(null);
    }
  }

  async function handleApply(jobId: string) {
    if (!authState?.accessToken) {
      setErrorMessage("Sign in before applying.");
      return;
    }

    setIsApplyingJobId(jobId);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await apiPost<{ message: string }>(
        `/jobs/${jobId}/apply`,
        { message: applyForms[jobId]?.trim() || undefined },
        authState.accessToken
      );

      setSuccessMessage(response.message);
      setApplyForms((current) => ({ ...current, [jobId]: "" }));
      await loadApplications(authState.accessToken);
      await loadJobs();
      setActiveView("applications");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to apply.");
    } finally {
      setIsApplyingJobId(null);
    }
  }

  async function handleApplicationStatus(
    applicationId: string,
    status: "viewed" | "shortlisted" | "rejected" | "hired",
    options?: {
      recipientId?: string;
      draftMessage?: string;
      postActionNote?: string;
    }
  ) {
    if (!authState?.accessToken) {
      return;
    }

    setUpdatingApplicationId(applicationId);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await apiPatch<{ message: string }>(
        `/applications/${applicationId}/status`,
        { status },
        authState.accessToken
      );
      setSuccessMessage(
        options?.postActionNote ? `${response.message} ${options.postActionNote}` : response.message
      );
      await loadEmployerApplications(authState.accessToken);
      if (options?.recipientId && options.draftMessage && (status === "shortlisted" || status === "hired")) {
        await loadConversations(authState.accessToken);
        openConversation(options.recipientId, options.draftMessage);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update application.");
    } finally {
      setUpdatingApplicationId(null);
    }
  }

  async function handleSendMessage() {
    if (!authState?.accessToken || !selectedRecipientId || !messageText.trim()) {
      return;
    }

    setIsSendingMessage(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await apiPost(
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
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to send message.");
    } finally {
      setIsSendingMessage(false);
    }
  }

  async function handleSaveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!authState?.accessToken) {
      return;
    }

    setIsSavingProfile(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await apiPatch<ProfileUpdateResponse>(
        "/users/me",
        {
          fullName: profileForm.fullName,
          zipCode: profileForm.zipCode,
          tradeType: profileForm.tradeType || null,
          businessName: profileForm.businessName || null,
          bio: profileForm.bio || null,
          yearsExperience: profileForm.yearsExperience ? Number(profileForm.yearsExperience) : null,
          hourlyRate: profileForm.hourlyRate ? Number(profileForm.hourlyRate) : null,
          unionStatus: profileForm.unionStatus || null,
          openToWork: profileForm.openToWork
        },
        authState.accessToken
      );

      setUser(response.user);
      await loadJobs();
      if (response.user.userTag === "employer") {
        await loadEmployerJobs(authState.accessToken);
      }
      if (response.user.userTag === "employer" && !response.user.isBusinessVerified) {
        setSuccessMessage("Profile updated. Next step: complete business verification so you can publish jobs.");
      } else if (response.user.userTag === "employee") {
        setSuccessMessage("Profile updated. Next step: browse jobs and apply.");
      } else {
        setSuccessMessage(response.message);
      }

      if (response.user.userTag === "employer") {
        setActiveView("profile");
      } else {
        setActiveView("jobs");
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update profile.");
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handleCompleteBusinessVerification() {
    if (!authState?.accessToken || !user) {
      return;
    }

    setIsCompletingVerification(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await apiPost<BusinessVerificationResponse>(
        "/verification/business/complete",
        {
          businessName: profileForm.businessName || user.businessName || null
        },
        authState.accessToken
      );

      setUser(response.user);
      setSuccessMessage("Business verification complete. You can publish jobs now.");
      await loadJobs();
      await loadEmployerJobs(authState.accessToken);
      setActiveView("jobs");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to complete business verification.");
    } finally {
      setIsCompletingVerification(false);
    }
  }

  function openConversation(recipientId: string, draftMessage?: string) {
    setSelectedRecipientId(recipientId);
    if (draftMessage) {
      setMessageText(draftMessage);
    }
    setActiveView("messages");
  }

  function signOut() {
    setAuthState(null);
    setUser(null);
    setSelectedRecipientId("");
    setMessageText("");
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    setSuccessMessage("Signed out.");
    setActiveView("overview");
  }

  if (isBooting) {
    return (
      <div className="shell">
        <div className="card">Loading LaborForce...</div>
      </div>
    );
  }

  return (
    <div className="shell">
      <nav className="appTopNav">
        {[
          { key: "overview", label: "Home" },
          { key: "jobs", label: "Jobs" },
          { key: "applications", label: "Apps" },
          { key: "messages", label: "Chat" },
          { key: "profile", label: "Profile" },
          { key: "auth", label: user ? "Account" : "Login" }
        ].map((item) => (
          <button
            key={item.key}
            className={`appTopNavButton ${activeView === item.key ? "appTopNavActive" : ""}`}
            onClick={() => setActiveView(item.key as View)}
            type="button"
          >
            <span className="appTopNavIcon">{item.label}</span>
          </button>
        ))}
      </nav>

      <section className="hero">
        <div className="headerRow">
          <div>
            <div className="badge">LaborForce</div>
            <h1 style={{ marginTop: 12 }}>Hire skilled workers and move from application to chat faster.</h1>
            <p className="muted" style={{ marginTop: 12 }}>
              LaborForce keeps profiles, jobs, applications, and messaging connected so both sides always know the next step.
            </p>
          </div>
          <div className="pillRow">
            <span className="pill">{jobs.length} jobs</span>
            <span className="pill">{applications.length} applications</span>
            <span className="pill">{conversations.length} conversations</span>
          </div>
        </div>
        {user ? (
          <div className="card">
            <div className="headerRow">
              <div>
                <strong>{user.fullName}</strong>
                <div className="muted">{user.email}</div>
              </div>
              <button className="actionButton ghostButton" type="button" onClick={signOut}>
                Sign out
              </button>
            </div>
            <div className="pillRow" style={{ marginTop: 12 }}>
              <span className="pill">{user.userTag}</span>
              <span className="pill">{user.verificationStatus}</span>
              {user.tradeType && <span className="pill">{user.tradeType}</span>}
              {user.businessName && <span className="pill">{user.businessName}</span>}
              {user.userTag === "employee" && <span className="pill">{user.openToWork ? "Open to work" : "Availability off"}</span>}
            </div>
            <p className="muted" style={{ marginTop: 12 }}>
              {completedChecklistCount}/{profileChecklist.length} onboarding steps done
            </p>
            {workerReadinessSummary && <p className="muted" style={{ marginTop: 8 }}>{workerReadinessSummary}</p>}
            {user.userTag === "employer" && employerBlockers.length > 0 && (
              <div className="pillRow" style={{ marginTop: 12 }}>
                {employerBlockers.map((blocker) => (
                  <span key={blocker} className="pill">
                    {blocker}
                  </span>
                ))}
              </div>
            )}
            {user.userTag === "employee" && (
              <>
                {workerBlockers.length > 0 && (
                  <div className="pillRow" style={{ marginTop: 12 }}>
                    {workerBlockers.map((blocker) => (
                      <span key={blocker} className="pill">
                        {blocker}
                      </span>
                    ))}
                  </div>
                )}
                <div className="pillRow" style={{ marginTop: 12 }}>
                  <button className="actionButton ghostButton" type="button" onClick={() => setActiveView("profile")}>
                    Finish profile
                  </button>
                  <button className="actionButton ghostButton" type="button" onClick={() => setActiveView("jobs")}>
                    Browse jobs
                  </button>
                  <button className="actionButton ghostButton" type="button" onClick={() => setActiveView("applications")}>
                    Open apps
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="card">
            <strong>Create an account to start hiring or applying.</strong>
            <p className="muted" style={{ marginTop: 8 }}>
              Choose employer or worker, finish your profile, and LaborForce will guide you into the next real step.
            </p>
            <button className="actionButton" style={{ marginTop: 12 }} type="button" onClick={() => setActiveView("auth")}>
              Get started
            </button>
          </div>
        )}
        {errorMessage && <div className="notice errorNotice">{errorMessage}</div>}
        {successMessage && <div className="notice successNotice">{successMessage}</div>}
      </section>

      {activeView === "overview" && (
        <section style={{ marginTop: 24 }} className="feedPageLayout">
          <div className="stack roomyStack">
            {!user && (
              <div className="card">
                <h2>Get started</h2>
                <p className="muted" style={{ marginTop: 12 }}>
                  Create your account, finish your profile, and move into jobs, applications, and messaging without losing your place.
                </p>
                <div className="pillRow" style={{ marginTop: 12 }}>
                  <button className="actionButton" type="button" onClick={() => setActiveView("auth")}>
                    Open login
                  </button>
                </div>
              </div>
            )}

            {user?.userTag === "employer" && (
              <>
                <div className="card">
                  <div className="headerRow">
                    <div>
                      <h2>Employer dashboard</h2>
                      <p className="muted" style={{ marginTop: 8 }}>
                        Keep hiring moving by verifying your business, publishing jobs, and replying to applicants fast.
                      </p>
                    </div>
                    <div className="pillRow">
                      <span className="pill">{employerDrafts.length} drafts</span>
                      <span className="pill">{incomingApplications.length} applicants</span>
                      <span className="pill">{conversations.length} chats</span>
                    </div>
                  </div>
                </div>

                <div className="card">
                  <h3>Next action</h3>
                  <p className="muted" style={{ marginTop: 12 }}>
                    {needsBusinessVerification
                      ? "Complete business verification so you can publish jobs."
                      : employerNeedsFirstJob
                        ? "Create your first job draft to start building your hiring pipeline."
                        : employerPriorityApplication
                          ? `Review ${employerPriorityApplication.applicant.fullName} for ${employerPriorityApplication.job.jobTitle} and move them forward.`
                          : "Check your jobs and inbox to keep your hiring flow active."}
                  </p>
                  <div className="pillRow" style={{ marginTop: 12 }}>
                    {needsBusinessVerification && (
                      <button className="actionButton" type="button" onClick={() => setActiveView("profile")}>
                        Finish verification
                      </button>
                    )}
                    {!needsBusinessVerification && employerNeedsFirstJob && (
                      <button className="actionButton" type="button" onClick={() => setActiveView("jobs")}>
                        Create a job
                      </button>
                    )}
                    {!needsBusinessVerification && employerPriorityApplication && (
                      <>
                        <button className="actionButton" type="button" onClick={() => setActiveView("applications")}>
                          Review applicants
                        </button>
                        {employerPriorityApplicantVerified && (
                          <button className="actionButton ghostButton" type="button" onClick={() => openConversation(employerPriorityApplication.applicant.id)}>
                            Open chat
                          </button>
                        )}
                      </>
                    )}
                  </div>
                  {employerBlockers.length > 0 && (
                    <div className="pillRow" style={{ marginTop: 12 }}>
                      {employerBlockers.map((blocker) => (
                        <span key={blocker} className="pill">
                          {blocker}
                        </span>
                      ))}
                    </div>
                  )}
                  {!needsBusinessVerification && employerPriorityApplication && !employerPriorityApplicantVerified && (
                    <p className="muted" style={{ marginTop: 12 }}>
                      Review the applicant first. Messaging unlocks after the worker is verified.
                    </p>
                  )}
                </div>
              </>
            )}

            {user?.userTag === "employee" && (
              <>
                <div className="card">
                  <div className="headerRow">
                    <div>
                      <h2>Worker dashboard</h2>
                      <p className="muted" style={{ marginTop: 8 }}>
                        Keep your profile current, apply to good-fit jobs, and follow up fast when employers respond.
                      </p>
                    </div>
                    <div className="pillRow">
                      <span className="pill">{workerActiveApplications.length} active applications</span>
                      <span className="pill">{workerApplicationStatusCounts.shortlisted + workerApplicationStatusCounts.hired} priority updates</span>
                      <span className="pill">{conversations.length} chats</span>
                      <span className="pill">{jobs.length} jobs nearby</span>
                    </div>
                  </div>
                </div>

                <div className="card">
                  <h3>Next action</h3>
                  <p className="muted" style={{ marginTop: 12 }}>
                    {workerNeedsFirstApplication
                      ? "Browse jobs and send your first application."
                      : workerPriorityApplication?.status === "shortlisted"
                        ? workerPriorityEmployerVerified && user?.isVerified
                          ? `You were shortlisted for ${workerPriorityApplication.job?.jobTitle ?? "a job"}. Follow up in chat now.`
                          : `You were shortlisted for ${workerPriorityApplication.job?.jobTitle ?? "a job"}. Stay ready while verification catches up.`
                        : workerPriorityApplication?.status === "hired"
                          ? workerPriorityEmployerVerified && user?.isVerified
                            ? `You were marked hired for ${workerPriorityApplication.job?.jobTitle ?? "a job"}. Confirm details in chat.`
                            : `You were marked hired for ${workerPriorityApplication.job?.jobTitle ?? "a job"}. Watch Apps for updates while messaging stays locked.`
                          : "Stay on top of your applications and follow up in chat when employers engage."}
                  </p>
                  <div className="pillRow" style={{ marginTop: 12 }}>
                    {workerNeedsFirstApplication && (
                      <button className="actionButton" type="button" onClick={() => setActiveView("jobs")}>
                        Browse jobs
                      </button>
                    )}
                    {!workerNeedsFirstApplication && workerPriorityApplication?.employer && user?.isVerified && workerPriorityEmployerVerified && (
                      <button
                        className="actionButton"
                        type="button"
                        onClick={() =>
                          openConversation(
                            workerPriorityApplication.employer!.id,
                            `Hi ${workerPriorityApplication.employer!.fullName.split(" ")[0]}, I wanted to follow up on ${workerPriorityApplication.job?.jobTitle ?? "my application"}.`
                          )
                        }
                      >
                        Message employer
                      </button>
                    )}
                    <button className="actionButton ghostButton" type="button" onClick={() => setActiveView("applications")}>
                      Open applications
                    </button>
                    <button className="actionButton ghostButton" type="button" onClick={() => setActiveView("profile")}>
                      Update profile
                    </button>
                  </div>
                  {!workerNeedsFirstApplication && workerPriorityApplication?.employer && (!user?.isVerified || !workerPriorityEmployerVerified) && (
                    <p className="muted" style={{ marginTop: 12 }}>
                      Messaging unlocks after both sides are verified. Keep the application moving in Apps for now.
                    </p>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="stack sideRail">
            {user?.userTag === "employee" ? (
              <div className="card">
                <h3>Worker next moves</h3>
                <div className="stack" style={{ marginTop: 12 }}>
                  <div className="betaItem">
                    <strong>Get discovered</strong>
                    <p className="muted" style={{ marginTop: 8 }}>
                      {user.openToWork ? "You are marked open to work. Keep your trade and bio sharp." : "Turn on open to work so employers know you are available."}
                    </p>
                  </div>
                  <div className="betaItem">
                    <strong>Find the right jobs</strong>
                    <p className="muted" style={{ marginTop: 8 }}>
                      Search by trade, county, or job description, then apply with a strong intro.
                    </p>
                  </div>
                  <div className="betaItem">
                    <strong>Keep conversations moving</strong>
                    <p className="muted" style={{ marginTop: 8 }}>
                      Follow up fast when an employer shortlists or hires you so the job stays warm.
                    </p>
                  </div>
                  {workerBlockers.length > 0 && (
                    <div className="betaItem">
                      <strong>Current blockers</strong>
                      <div className="pillRow" style={{ marginTop: 8 }}>
                        {workerBlockers.map((blocker) => (
                          <span key={blocker} className="pill">
                            {blocker}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="card">
                <h3>Employer next moves</h3>
                <div className="stack" style={{ marginTop: 12 }}>
                  <div className="betaItem">
                    <strong>Finish the foundation</strong>
                    <p className="muted" style={{ marginTop: 8 }}>
                      {user?.isBusinessVerified
                        ? "Your verification is done. Keep your hiring pipeline full with clear job postings."
                        : "Complete business verification so job publishing and hiring can move without friction."}
                    </p>
                  </div>
                  <div className="betaItem">
                    <strong>Publish strong jobs</strong>
                    <p className="muted" style={{ marginTop: 8 }}>Use specific titles, pay ranges, and job details so better applicants come in faster.</p>
                  </div>
                  <div className="betaItem">
                    <strong>Reply quickly</strong>
                    <p className="muted" style={{ marginTop: 8 }}>When applicants come in, review and move them forward while the lead is still warm.</p>
                  </div>
                  {employerBlockers.length > 0 && (
                    <div className="betaItem">
                      <strong>Current blockers</strong>
                      <div className="pillRow" style={{ marginTop: 8 }}>
                        {employerBlockers.map((blocker) => (
                          <span key={blocker} className="pill">
                            {blocker}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            <div className="card">
              <h3>Snapshot</h3>
              <div className="stack" style={{ marginTop: 12 }}>
                <div className="headerRow">
                  <span className="muted">Profile progress</span>
                  <strong>{completedChecklistCount}/{profileChecklist.length}</strong>
                </div>
                <div className="headerRow">
                  <span className="muted">Jobs</span>
                  <strong>{jobs.length}</strong>
                </div>
                <div className="headerRow">
                  <span className="muted">Applications</span>
                  <strong>{applications.length + incomingApplications.length}</strong>
                </div>
                <div className="headerRow">
                  <span className="muted">Conversations</span>
                  <strong>{conversations.length}</strong>
                </div>
              </div>
            </div>

<<<<<<< HEAD
            <div className="card">
              <h3>How LaborForce works</h3>
              <div className="pillRow" style={{ marginTop: 12 }}>
                <span className="pill">Create profile</span>
                <span className="pill">Post or apply</span>
                <span className="pill">Review updates</span>
                <span className="pill">Chat</span>
              </div>
              <p className="muted" style={{ marginTop: 12 }}>
                Finish your profile, post or apply to the right jobs, review updates fast, and move into chat when both sides are ready.
              </p>
            </div>
=======
            {user?.userTag === "employee" ? (
              <div className="card">
                <h3>Hiring readiness</h3>
                <div className="stack" style={{ marginTop: 12 }}>
                  <div className="headerRow">
                    <span className="muted">Trade</span>
                    <strong>{user.tradeType?.trim() || "Missing"}</strong>
                  </div>
                  <div className="headerRow">
                    <span className="muted">Bio</span>
                    <strong>{user.bio?.trim() ? "Added" : "Missing"}</strong>
                  </div>
                  <div className="headerRow">
                    <span className="muted">Availability</span>
                    <strong>{user.openToWork ? "On" : "Off"}</strong>
                  </div>
                </div>
                <p className="muted" style={{ marginTop: 12 }}>
                  Employers respond faster when your trade, work status, and bio all feel complete.
                </p>
              </div>
            ) : (
              <div className="card">
                <h3>Hiring readiness</h3>
                <div className="stack" style={{ marginTop: 12 }}>
                  <div className="headerRow">
                    <span className="muted">Business name</span>
                    <strong>{user?.businessName?.trim() || "Missing"}</strong>
                  </div>
                  <div className="headerRow">
                    <span className="muted">Bio</span>
                    <strong>{user?.bio?.trim() ? "Added" : "Missing"}</strong>
                  </div>
                  <div className="headerRow">
                    <span className="muted">Verification</span>
                    <strong>{user?.isBusinessVerified ? "Complete" : "Pending"}</strong>
                  </div>
                </div>
                <p className="muted" style={{ marginTop: 12 }}>
                  Employers move faster when the business profile is complete and verification is out of the way before posting jobs.
                </p>
              </div>
            )}
>>>>>>> origin/main

            <div className="card">
              <h3>Quick access</h3>
              <div className="pillRow" style={{ marginTop: 12 }}>
                {user?.userTag === "employee" ? (
                  <>
                    <button className="actionButton ghostButton" type="button" onClick={() => setActiveView("jobs")}>
                      Best fit jobs
                    </button>
                    <button className="actionButton ghostButton" type="button" onClick={() => setActiveView("applications")}>
                      My pipeline
                    </button>
                    <button className="actionButton ghostButton" type="button" onClick={() => setActiveView(user.isVerified ? "messages" : "profile")}>
                      {user.isVerified ? "Priority chat" : "Finish profile"}
                    </button>
                    <button className="actionButton ghostButton" type="button" onClick={() => setActiveView("profile")}>
                      Profile
                    </button>
                  </>
                ) : (
                  <>
                    <button className="actionButton ghostButton" type="button" onClick={() => setActiveView("jobs")}>
                      Hiring jobs
                    </button>
                    <button className="actionButton ghostButton" type="button" onClick={() => setActiveView("applications")}>
                      Applicants
                    </button>
                    <button className="actionButton ghostButton" type="button" onClick={() => setActiveView(needsBusinessVerification ? "profile" : "messages")}>
                      {needsBusinessVerification ? "Finish verification" : "Chat"}
                    </button>
                    <button className="actionButton ghostButton" type="button" onClick={() => setActiveView("profile")}>
                      Profile
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {activeView === "auth" && (
        <section style={{ marginTop: 24 }} className="card">
          {user ? (
            <div className="stack">
              <div className="headerRow">
                <div>
                  <h2>Account</h2>
                  <p className="muted">You’re signed in and ready to keep moving through LaborForce.</p>
                </div>
                <button className="actionButton ghostButton" type="button" onClick={signOut}>
                  Sign out
                </button>
              </div>

              <div className="card">
                <div className="headerRow">
                  <div>
                    <strong>{user.fullName}</strong>
                    <div className="muted">{user.email}</div>
                  </div>
                  <div className="pillRow">
                    <span className="pill">{user.userTag}</span>
                    <span className="pill">{user.verificationStatus}</span>
                  </div>
                </div>
                <p className="muted" style={{ marginTop: 12 }}>
                  {user.userTag === "employer"
                    ? user.isBusinessVerified
                      ? "Your business profile is verified. You can publish jobs, review applicants, and move into chat."
                      : "Finish business verification to publish jobs and move hiring forward."
                    : user.isVerified
                      ? "Your account is ready for applications and messaging."
                      : "Your account is ready for jobs and applications. Messaging will unlock after verification is complete."}
                </p>
                <div className="pillRow" style={{ marginTop: 12 }}>
                  <button className="actionButton" type="button" onClick={() => setActiveView("profile")}>
                    Open profile
                  </button>
                  <button className="actionButton ghostButton" type="button" onClick={() => setActiveView("jobs")}>
                    Open jobs
                  </button>
                  <button className="actionButton ghostButton" type="button" onClick={() => setActiveView("applications")}>
                    Open applications
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="headerRow">
                <div>
                  <h2>{authMode === "signup" ? "Create account" : "Sign in"}</h2>
                  <p className="muted">{authMode === "signup" ? "Start as an employee or employer." : "Use your LaborForce account."}</p>
                </div>
<<<<<<< HEAD
                <button
                  className="actionButton ghostButton"
                  type="button"
                  onClick={() => setAuthMode((current) => (current === "login" ? "signup" : "login"))}
                >
                  {authMode === "login" ? "Need an account?" : "Already have an account?"}
                </button>
              </div>
=======
                <div className="splitFields">
                  <label className="field">
                    <span>Full name</span>
                    <input value={authForm.fullName} onChange={(event) => setAuthForm((current) => ({ ...current, fullName: event.target.value }))} required />
                  </label>
                  <label className="field">
                    <span>Phone</span>
                    <input value={authForm.phone} onChange={(event) => setAuthForm((current) => ({ ...current, phone: event.target.value }))} required />
                  </label>
                </div>
                <div className="splitFields">
                  <label className="field">
                    <span>ZIP code</span>
                    <input value={authForm.zipCode} onChange={(event) => setAuthForm((current) => ({ ...current, zipCode: event.target.value }))} required />
                  </label>
                  {selectedTag === "employer" && (
                    <label className="field">
                      <span>Business name</span>
                      <input value={authForm.businessName} onChange={(event) => setAuthForm((current) => ({ ...current, businessName: event.target.value }))} required />
                    </label>
                  )}
                  {selectedTag === "employee" && (
                    <label className="field">
                      <span>Trade</span>
                      <input value={authForm.tradeType} onChange={(event) => setAuthForm((current) => ({ ...current, tradeType: event.target.value }))} />
                    </label>
                  )}
                </div>
                {selectedTag === "employee" && (
                  <div className="notice successNotice">
                    Worker setup goes fastest when you finish your profile, turn on open to work, then apply to the best-fit jobs first.
                  </div>
                )}
                {selectedTag === "employer" && (
                  <div className="notice successNotice">
                    Employer setup goes fastest when you finish your business profile first, then complete verification before posting jobs.
                  </div>
                )}
              </>
            )}
>>>>>>> origin/main

              <form className="stack" style={{ marginTop: 18 }} onSubmit={handleAuthSubmit}>
                {authMode === "signup" && (
                  <>
                    <div className="feedMiniNav">
                      <button
                        className={`miniNavButton ${selectedTag === "employee" ? "miniNavActive" : ""}`}
                        type="button"
                        onClick={() => setSelectedTag("employee")}
                      >
                        Employee
                      </button>
                      <button
                        className={`miniNavButton ${selectedTag === "employer" ? "miniNavActive" : ""}`}
                        type="button"
                        onClick={() => setSelectedTag("employer")}
                      >
                        Employer
                      </button>
                    </div>
                    <div className="splitFields">
                      <label className="field">
                        <span>Full name</span>
                        <input value={authForm.fullName} onChange={(event) => setAuthForm((current) => ({ ...current, fullName: event.target.value }))} required />
                      </label>
                      <label className="field">
                        <span>Phone</span>
                        <input value={authForm.phone} onChange={(event) => setAuthForm((current) => ({ ...current, phone: event.target.value }))} required />
                      </label>
                    </div>
                    <div className="splitFields">
                      <label className="field">
                        <span>ZIP code</span>
                        <input value={authForm.zipCode} onChange={(event) => setAuthForm((current) => ({ ...current, zipCode: event.target.value }))} required />
                      </label>
                      {selectedTag === "employer" && (
                        <label className="field">
                          <span>Business name</span>
                          <input value={authForm.businessName} onChange={(event) => setAuthForm((current) => ({ ...current, businessName: event.target.value }))} required />
                        </label>
                      )}
                      {selectedTag === "employee" && (
                        <label className="field">
                          <span>Trade</span>
                          <input value={authForm.tradeType} onChange={(event) => setAuthForm((current) => ({ ...current, tradeType: event.target.value }))} />
                        </label>
                      )}
                    </div>
                  </>
                )}

<<<<<<< HEAD
                <label className="field">
                  <span>Email</span>
                  <input type="email" value={authForm.email} onChange={(event) => setAuthForm((current) => ({ ...current, email: event.target.value }))} required />
                </label>
                <label className="field">
                  <span>Password</span>
                  <input type="password" value={authForm.password} onChange={(event) => setAuthForm((current) => ({ ...current, password: event.target.value }))} required />
                </label>

                <button className="actionButton" disabled={isSubmittingAuth} type="submit">
                  {isSubmittingAuth ? "Saving..." : authMode === "signup" ? "Create account" : "Sign in"}
                </button>
              </form>
            </>
=======
            <button className="actionButton" disabled={isSubmittingAuth} type="submit">
              {isSubmittingAuth ? "Saving..." : authMode === "signup" ? "Create account" : "Sign in"}
            </button>
          </form>

          {authMode === "signup" && selectedTag === "employee" && (
            <div className="card" style={{ marginTop: 18 }}>
              <h3>Worker first steps</h3>
              <div className="stack" style={{ marginTop: 12 }}>
                <div className="checkItem">
                  <div className="checkDot pendingDot" />
                  <div>Finish your profile so employers can quickly understand your trade, experience, and rate.</div>
                </div>
                <div className="checkItem">
                  <div className="checkDot pendingDot" />
                  <div>Turn on open to work so you show up as available.</div>
                </div>
                <div className="checkItem">
                  <div className="checkDot pendingDot" />
                  <div>Apply to the strongest-fit jobs first, then use Apps to track movement and follow up.</div>
                </div>
              </div>
            </div>
          )}

          {authMode === "signup" && selectedTag === "employer" && (
            <div className="card" style={{ marginTop: 18 }}>
              <h3>Employer first steps</h3>
              <div className="stack" style={{ marginTop: 12 }}>
                <div className="checkItem">
                  <div className="checkDot pendingDot" />
                  <div>Finish your business profile so workers understand who is hiring and what kind of company you are.</div>
                </div>
                <div className="checkItem">
                  <div className="checkDot pendingDot" />
                  <div>Complete business verification before trying to publish jobs.</div>
                </div>
                <div className="checkItem">
                  <div className="checkDot pendingDot" />
                  <div>Create one clear draft job first, then publish it and review applicants quickly.</div>
                </div>
              </div>
            </div>
>>>>>>> origin/main
          )}
        </section>
      )}

      {activeView === "jobs" && (
        <section style={{ marginTop: 24 }} className="jobsPageLayout">
          <div className="stack roomyStack">
            <div className="card">
              <div className="headerRow">
                <h2>Live jobs</h2>
                <div className="badge">{jobsRadius} mile radius</div>
              </div>
              <label className="field" style={{ marginTop: 12 }}>
                <span>Drive radius</span>
                <select value={driveRadius} onChange={(event) => setDriveRadius(Number(event.target.value))}>
                  <option value={30}>30 miles</option>
                  <option value={50}>50 miles</option>
                  <option value={75}>75 miles</option>
                  <option value={100}>100 miles</option>
                </select>
              </label>
              <div className="splitFields" style={{ marginTop: 12 }}>
                <label className="field">
                  <span>Search jobs</span>
                  <input
                    value={jobSearch}
                    placeholder="Electrician, HVAC, Bronx, service..."
                    onChange={(event) => setJobSearch(event.target.value)}
                  />
                </label>
                <label className="field">
                  <span>Trade filter</span>
                  <select value={jobTradeFilter} onChange={(event) => setJobTradeFilter(event.target.value)}>
                    <option value="all">All trades</option>
                    {availableTradeFilters.map((trade) => (
                      <option key={trade} value={trade}>
                        {trade}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <p className="muted" style={{ marginTop: 12 }}>
                {isLoadingJobs ? "Loading jobs..." : `${filteredJobs.length} matching public jobs`}
              </p>
            </div>

            {user?.userTag === "employer" && (
              <div className="card">
                <div className="headerRow">
                  <h2>My jobs</h2>
                  <div className="pillRow">
                    <span className="pill">{employerDrafts.length} drafts</span>
                    <span className="pill">{employerActiveJobs.length} active</span>
                  </div>
                </div>
                <div className="stack" style={{ marginTop: 12 }}>
                  {employerJobs.length > 0 ? (
                    employerJobs.map((job) => (
                      <article key={job.id} className="applicationItem">
                        <div className="headerRow">
                          <div>
                            <strong>{job.jobTitle}</strong>
                            <div className="muted">{job.tradeCategory} • {job.countyLocation}</div>
                          </div>
                          <span className="pill">{formatStatus(job.status)}</span>
                        </div>
                        <div className="pillRow" style={{ marginTop: 12 }}>
                          <span className="pill">{formatMoney(job.hourlyRateMin)} - {formatMoney(job.hourlyRateMax)}</span>
                          <span className="pill">{job.applicationsCount} applicants</span>
                        </div>
                        <div className="pillRow" style={{ marginTop: 12 }}>
                          <button className="actionButton ghostButton" type="button" onClick={() => startEditingJob(job)}>
                            Edit job
                          </button>
                          {job.status === "active" && (
                            <>
                              <button
                                className="actionButton ghostButton"
                                type="button"
                                disabled={updatingJobId === job.id}
                                onClick={() => void handleUpdateJobStatus(job.id, "filled")}
                              >
                                {updatingJobId === job.id ? "Updating..." : "Mark filled"}
                              </button>
                              <button
                                className="actionButton ghostButton"
                                type="button"
                                disabled={updatingJobId === job.id}
                                onClick={() => void handleUpdateJobStatus(job.id, "closed")}
                              >
                                {updatingJobId === job.id ? "Updating..." : "Close job"}
                              </button>
                            </>
                          )}
                        </div>
                        {job.status === "draft" && (
                          <>
                            {!user.isBusinessVerified && (
                              <div className="notice errorNotice" style={{ marginTop: 12 }}>
                                Complete business verification before publishing this draft.
                              </div>
                            )}
                            <p className="muted" style={{ marginTop: 12 }}>
                              Drafts stay private until you publish them. Tighten the title, pay, and description before sending them live.
                            </p>
                            <button
                              className="actionButton"
                              style={{ marginTop: 12 }}
                              type="button"
                              disabled={publishingJobId === job.id || !user.isBusinessVerified}
                              onClick={() => void handlePublishJob(job.id)}
                            >
                              {publishingJobId === job.id ? "Publishing..." : "Publish draft"}
                            </button>
                          </>
                        )}
                        {job.status === "active" && (
                          <p className="muted" style={{ marginTop: 12 }}>
                            This job is live right now. Keep an eye on applicants and move quickly on strong leads.
                          </p>
                        )}
                        {job.status === "filled" && (
                          <p className="muted" style={{ marginTop: 12 }}>
                            This role is marked filled. Keep it for reference or close it when hiring is fully wrapped.
                          </p>
                        )}
                        {job.status === "closed" && (
                          <p className="muted" style={{ marginTop: 12 }}>
                            This role is closed. You can still review what happened here, but it is no longer live to applicants.
                          </p>
                        )}
                      </article>
                    ))
                  ) : (
                    <div className="stack">
                      <p className="muted">No jobs created yet. Start with a draft so applicants can move into your pipeline once you publish.</p>
                      <div className="betaItem">
                        <strong>Best first job</strong>
                        <p className="muted" style={{ marginTop: 8 }}>
                          Start with one clear role, one county, and a realistic pay range so your first pipeline is easy to manage.
                        </p>
                      </div>
                      <button className="actionButton ghostButton" type="button" onClick={() => setActiveView("jobs")}>
                        Create first job
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {filteredJobs.length > 0 ? filteredJobs.map((job) => {
              const existingApplication = applicationMap.get(job.id);
              return (
                <article key={job.id} className="card">
                  <div className="headerRow">
                    <div>
                      <strong>{job.jobTitle}</strong>
                      <div className="muted">
                        {job.tradeCategory} • {job.countyLocation}
                        {typeof job.distanceMiles === "number" ? ` • ${job.distanceMiles} mi away` : ""}
                      </div>
                    </div>
                    <span className="pill">{formatStatus(job.status)}</span>
                  </div>
                  <p style={{ marginTop: 10 }}>{job.description}</p>
                  <div className="pillRow" style={{ marginTop: 12 }}>
                    <span className="pill">{formatMoney(job.hourlyRateMin)} - {formatMoney(job.hourlyRateMax)}</span>
                    <span className="pill">{formatStatus(job.jobType)}</span>
                    <span className="pill">{job.applicationsCount} applicants</span>
                  </div>

                  {user?.userTag === "employee" && job.status === "active" && !existingApplication && (
                    <div className="stack" style={{ marginTop: 14 }}>
                      <textarea
                        rows={3}
                        placeholder="Write a short intro to the employer"
                        value={applyForms[job.id] ?? ""}
                        onChange={(event) => setApplyForms((current) => ({ ...current, [job.id]: event.target.value }))}
                      />
                      <button className="actionButton" type="button" disabled={isApplyingJobId === job.id} onClick={() => void handleApply(job.id)}>
                        {isApplyingJobId === job.id ? "Applying..." : "Apply"}
                      </button>
                    </div>
                  )}

                  {user?.userTag === "employee" && existingApplication && (
                    <div className="stack" style={{ marginTop: 14 }}>
                      <div className="notice successNotice">
                        Applied on {formatDate(existingApplication.appliedAt)}.
                      </div>
                      <div className="pillRow">
                        <span className="pill">{formatStatus(existingApplication.status)}</span>
                        <span className="pill">{existingApplication.employerViewed ? "Employer has viewed it" : "Waiting on employer review"}</span>
                      </div>
                      {buildWorkerApplicationNextStep(existingApplication, user) && (
                        <p className="muted">{buildWorkerApplicationNextStep(existingApplication, user)}</p>
                      )}
                      <div className="pillRow">
                        <button className="actionButton ghostButton" type="button" onClick={() => setActiveView("applications")}>
                          Open application
                        </button>
                        {existingApplication.employer && user.isVerified && existingApplication.employer.verificationStatus === "verified" && (
                          <button
                            className="actionButton ghostButton"
                            type="button"
                            onClick={() =>
                              openConversation(
                                existingApplication.employer!.id,
                                `Hi ${existingApplication.employer!.fullName.split(" ")[0]}, I wanted to follow up on ${job.jobTitle}.`
                              )
                            }
                          >
                            Message employer
                          </button>
                        )}
                      </div>
                      {existingApplication.status === "rejected" && (
                        <button className="actionButton ghostButton" type="button" onClick={() => setActiveView("jobs")}>
                          Find another job
                        </button>
                      )}
                    </div>
                  )}
                </article>
              );
            }) : (
              <div className="card">
                <h3>No matching jobs</h3>
                <p className="muted" style={{ marginTop: 12 }}>
                  Try widening your search, clearing the trade filter, or increasing your drive radius.
                </p>
                {user?.userTag === "employee" && (
                  <div className="stack" style={{ marginTop: 12 }}>
                    <div className="betaItem">
                      <strong>Improve your match quality</strong>
                      <p className="muted" style={{ marginTop: 8 }}>
                        {user.tradeType?.trim()
                          ? user.openToWork
                            ? "Your profile is positioned well. Reset filters and keep checking for better-fit jobs."
                            : "Turn on open to work so your profile is ready when the right jobs appear."
                          : "Add your trade in Profile so LaborForce can steer you toward better-fit work."}
                      </p>
                    </div>
                  </div>
                )}
                <div className="pillRow" style={{ marginTop: 12 }}>
                  <button
                    className="actionButton ghostButton"
                    type="button"
                    onClick={() => {
                      setJobSearch("");
                      setJobTradeFilter("all");
                      setDriveRadius(100);
                    }}
                  >
                    Reset filters
                  </button>
                  {user?.userTag === "employee" && (
                    <button className="actionButton ghostButton" type="button" onClick={() => setActiveView("profile")}>
                      Update profile
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="stack sideRail">
            {user?.userTag === "employee" ? (
              <div className="card">
                <h3>Worker job search</h3>
                <div className="stack" style={{ marginTop: 12 }}>
                  <div className="headerRow">
                    <span className="muted">Open to work</span>
                    <strong>{user.openToWork ? "On" : "Off"}</strong>
                  </div>
                  <div className="headerRow">
                    <span className="muted">Trade</span>
                    <strong>{user.tradeType?.trim() || "Missing"}</strong>
                  </div>
                  <div className="headerRow">
                    <span className="muted">Applications</span>
                    <strong>{applications.length}</strong>
                  </div>
                </div>
                <p className="muted" style={{ marginTop: 12 }}>
                  Apply to the strongest-fit jobs first, then follow up quickly when an employer views or shortlists you.
                </p>
                <div className="pillRow" style={{ marginTop: 12 }}>
                  <button className="actionButton ghostButton" type="button" onClick={() => setActiveView("profile")}>
                    Update profile
                  </button>
                  <button className="actionButton ghostButton" type="button" onClick={() => setActiveView("applications")}>
                    Open apps
                  </button>
                </div>
              </div>
            ) : (
              <div className="card">
                <h3>Employer summary</h3>
                <div className="pillRow" style={{ marginTop: 12 }}>
                  <span className="pill">{employerDrafts.length} drafts</span>
                  <span className="pill">{employerActiveJobs.length} active</span>
                </div>
                <p className="muted" style={{ marginTop: 12 }}>
                  Employers must complete business verification before public job publishing unlocks.
                </p>
                <div className="stack" style={{ marginTop: 12 }}>
                  <div className="headerRow">
                    <span className="muted">Drafts</span>
                    <strong>{employerDrafts.length}</strong>
                  </div>
                  <div className="headerRow">
                    <span className="muted">Active jobs</span>
                    <strong>{employerActiveJobs.length}</strong>
                  </div>
                  <div className="headerRow">
                    <span className="muted">Applicants</span>
                    <strong>{incomingApplications.length}</strong>
                  </div>
                </div>
                {user?.userTag === "employer" && !user.isBusinessVerified && (
                  <>
                    <p className="muted" style={{ marginTop: 12 }}>
                      Finish verification, then publish your draft and start reviewing applicants from one place.
                    </p>
                    <button
                      className="actionButton"
                      style={{ marginTop: 12 }}
                      type="button"
                      disabled={isCompletingVerification}
                      onClick={() => void handleCompleteBusinessVerification()}
                    >
                      {isCompletingVerification ? "Verifying..." : "Complete business verification"}
                    </button>
                  </>
                )}
              </div>
            )}

            {user?.userTag === "employer" && (
              <form className="card stack" onSubmit={handleCreateJob}>
                <div className="headerRow">
                  <h3>{editingJobId ? "Edit job" : "Create job"}</h3>
                  {editingJobId && (
                    <button className="actionButton ghostButton" type="button" onClick={cancelEditingJob}>
                      Cancel
                    </button>
                  )}
                </div>
                <label className="field">
                  <span>Job title</span>
                  <input value={jobForm.jobTitle} onChange={(event) => setJobForm((current) => ({ ...current, jobTitle: event.target.value }))} required />
                </label>
                <label className="field">
                  <span>Trade category</span>
                  <input value={jobForm.tradeCategory} onChange={(event) => setJobForm((current) => ({ ...current, tradeCategory: event.target.value }))} required />
                </label>
                <label className="field">
                  <span>Description</span>
                  <textarea rows={4} value={jobForm.description} onChange={(event) => setJobForm((current) => ({ ...current, description: event.target.value }))} required />
                </label>
                <div className="splitFields">
                  <label className="field">
                    <span>Min rate</span>
                    <input type="number" value={jobForm.hourlyRateMin} onChange={(event) => setJobForm((current) => ({ ...current, hourlyRateMin: event.target.value }))} required />
                  </label>
                  <label className="field">
                    <span>Max rate</span>
                    <input type="number" value={jobForm.hourlyRateMax} onChange={(event) => setJobForm((current) => ({ ...current, hourlyRateMax: event.target.value }))} required />
                  </label>
                </div>
                <div className="splitFields">
                  <label className="field">
                    <span>Job type</span>
                    <select value={jobForm.jobType} onChange={(event) => setJobForm((current) => ({ ...current, jobType: event.target.value }))}>
                      <option value="full_time">Full time</option>
                      <option value="part_time">Part time</option>
                      <option value="contract">Contract</option>
                      <option value="temporary">Temporary</option>
                      <option value="same_day">Same day</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>ZIP code</span>
                    <input value={jobForm.locationZip} onChange={(event) => setJobForm((current) => ({ ...current, locationZip: event.target.value }))} required />
                  </label>
                </div>
                <label className="field">
                  <span>County / area</span>
                  <input value={jobForm.countyLocation} onChange={(event) => setJobForm((current) => ({ ...current, countyLocation: event.target.value }))} required />
                </label>
                <label className="field">
                  <span>Benefits</span>
                  <input value={jobForm.benefits} onChange={(event) => setJobForm((current) => ({ ...current, benefits: event.target.value }))} />
                </label>
                <label className="field">
                  <span>Certifications required</span>
                  <input value={jobForm.certificationsRequired} onChange={(event) => setJobForm((current) => ({ ...current, certificationsRequired: event.target.value }))} placeholder="OSHA 10, EPA 608" />
                </label>
                <p className="muted">
<<<<<<< HEAD
                  ZIP drives the actual map coordinates and distance match. County / area is the label workers see in the listing.
=======
                  {editingJobId
                    ? "Update the details that affect applicant quality most: title, pay, county, and the description."
                    : "Create the draft first, then review it in My jobs before publishing it live."}
>>>>>>> origin/main
                </p>
                <button className="actionButton" disabled={isPostingJob} type="submit">
                  {isPostingJob ? "Saving..." : editingJobId ? "Save changes" : "Create draft job"}
                </button>
              </form>
            )}
          </div>
        </section>
      )}

      {activeView === "applications" && (
        <section style={{ marginTop: 24 }} className="feedGrid">
          <div className="stack roomyStack">
            <div className="card">
              <h2>Your applications</h2>
              {user?.userTag === "employee" && applications.length > 0 && (
                <div className="pillRow" style={{ marginTop: 12 }}>
                  <span className="pill">{workerApplicationStatusCounts.submitted} submitted</span>
                  <span className="pill">{workerApplicationStatusCounts.viewed} viewed</span>
                  <span className="pill">{workerApplicationStatusCounts.shortlisted} shortlisted</span>
                  <span className="pill">{workerApplicationStatusCounts.hired} hired</span>
                </div>
              )}
              {applications.length > 0 ? (
                <div className="stack" style={{ marginTop: 12 }}>
                  {sortedWorkerApplications.map((application) => (
                    <div key={application.id} className="applicationItem">
                      <div className="headerRow">
                        <div>
                          <strong>{application.job?.jobTitle ?? application.jobListingId}</strong>
                          <div className="muted">
                            {application.job?.tradeCategory ?? "Trade not set"}
                            {" • "}
                            {application.job?.countyLocation ?? "Location not set"}
                          </div>
                        </div>
                        <span className="pill">{formatStatus(application.status)}</span>
                      </div>
                      {application.job && (
                        <div className="pillRow" style={{ marginTop: 12 }}>
                          <span className="pill">
                            {formatMoney(application.job.hourlyRateMin)} - {formatMoney(application.job.hourlyRateMax)}
                          </span>
                          <span className="pill">{formatStatus(application.job.status)}</span>
                          <span className="pill">{application.employerViewed ? "Viewed" : "Waiting on employer"}</span>
                        </div>
                      )}
                      <div className="muted" style={{ marginTop: 10 }}>
                        Applied {formatDate(application.appliedAt)}
                      </div>
                      {application.message && <p style={{ marginTop: 8 }}>{application.message}</p>}
                      {buildWorkerApplicationNextStep(application, user) && (
                        <p className="muted" style={{ marginTop: 12 }}>
                          {buildWorkerApplicationNextStep(application, user)}
                        </p>
                      )}
                      {application.status === "shortlisted" && (
                        <div className="notice successNotice" style={{ marginTop: 12 }}>
                          You are in a strong spot here. Reply quickly if chat is open.
                        </div>
                      )}
                      {application.status === "hired" && (
                        <div className="notice successNotice" style={{ marginTop: 12 }}>
                          This employer has moved forward with you. Confirm details and timing as soon as possible.
                        </div>
                      )}
                      {user?.userTag === "employee" && (
                        <div className="pillRow" style={{ marginTop: 12 }}>
                          <button className="actionButton ghostButton" type="button" onClick={() => setActiveView("jobs")}>
                            Browse jobs
                          </button>
                          {application.employer && user?.isVerified && application.employer.verificationStatus === "verified" && (
                            <button
                              className="actionButton ghostButton"
                              type="button"
                              onClick={() =>
                                openConversation(
                                  application.employer!.id,
                                  `Hi ${application.employer!.fullName.split(" ")[0]}, I applied for ${application.job?.jobTitle ?? "the role"} and wanted to follow up on next steps.`
                                )
                              }
                            >
                              Message employer
                            </button>
                          )}
                        </div>
                      )}
                      {user?.userTag === "employee" && application.employer && (!user.isVerified || application.employer.verificationStatus !== "verified") && (
                        <p className="muted" style={{ marginTop: 12 }}>
                          Messaging unlocks after both sides are verified. Use your application message to introduce yourself for now.
                        </p>
                      )}
                      {application.status === "rejected" && (
                        <div className="pillRow" style={{ marginTop: 12 }}>
                          <button className="actionButton ghostButton" type="button" onClick={() => setActiveView("jobs")}>
                            Find another job
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="stack" style={{ marginTop: 12 }}>
                  <p className="muted">No applications yet. Browse jobs, send a strong intro, and follow up fast when employers respond.</p>
                  <div className="betaItem">
                    <strong>Best next move</strong>
                    <p className="muted" style={{ marginTop: 8 }}>
                      Start with jobs that clearly match your trade, then keep your profile current so employers have a reason to reply.
                    </p>
                  </div>
                  <div className="pillRow">
                    <button className="actionButton" type="button" onClick={() => setActiveView("jobs")}>
                      Browse jobs
                    </button>
                    <button className="actionButton ghostButton" type="button" onClick={() => setActiveView("profile")}>
                      Finish profile
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="stack" style={{ gridColumn: "span 2" }}>
            {user?.userTag === "employee" ? (
              <>
                <div className="card">
                  <h2>Worker pipeline guide</h2>
                  <div className="stack" style={{ marginTop: 12 }}>
                    <div className="betaItem">
                      <strong>Submitted</strong>
                      <p className="muted" style={{ marginTop: 8 }}>
                        Your application is in. Keep applying to good-fit jobs while you wait for movement.
                      </p>
                    </div>
                    <div className="betaItem">
                      <strong>Viewed / shortlisted</strong>
                      <p className="muted" style={{ marginTop: 8 }}>
                        These are your warmest leads. Follow up fast when messaging is available.
                      </p>
                    </div>
                    <div className="betaItem">
                      <strong>Hired</strong>
                      <p className="muted" style={{ marginTop: 8 }}>
                        Confirm timing, details, and next steps as quickly as possible.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="card">
                  <h3>Your strongest lead</h3>
                  {workerPriorityApplication ? (
                    <div className="stack" style={{ marginTop: 12 }}>
                      <strong>{workerPriorityApplication.job?.jobTitle ?? "Application"}</strong>
                      <div className="muted">
                        {workerPriorityApplication.job?.countyLocation ?? "Location not set"}
                        {workerPriorityApplication.employer?.fullName ? ` • ${workerPriorityApplication.employer.fullName}` : ""}
                      </div>
                      <div className="pillRow">
                        <span className="pill">{formatStatus(workerPriorityApplication.status)}</span>
                        <span className="pill">{workerPriorityApplication.employerViewed ? "Employer engaged" : "Waiting on employer"}</span>
                      </div>
                      {buildWorkerApplicationNextStep(workerPriorityApplication, user) && (
                        <p className="muted">{buildWorkerApplicationNextStep(workerPriorityApplication, user)}</p>
                      )}
                      <div className="pillRow">
                        <button className="actionButton ghostButton" type="button" onClick={() => setActiveView("jobs")}>
                          Browse jobs
                        </button>
                        {workerPriorityApplication.employer && user.isVerified && workerPriorityApplication.employer.verificationStatus === "verified" && (
                          <button
                            className="actionButton ghostButton"
                            type="button"
                            onClick={() =>
                              openConversation(
                                workerPriorityApplication.employer!.id,
                                `Hi ${workerPriorityApplication.employer!.fullName.split(" ")[0]}, I wanted to follow up on ${workerPriorityApplication.job?.jobTitle ?? "my application"}.`
                              )
                            }
                          >
                            Open chat
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="stack" style={{ marginTop: 12 }}>
                      <p className="muted">You do not have a lead yet. Start applying to the best-fit jobs first.</p>
                      <button className="actionButton" type="button" onClick={() => setActiveView("jobs")}>
                        Find jobs
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="card">
                <h2>Employer review queue</h2>
                {incomingApplications.length > 0 && (
                  <div className="pillRow" style={{ marginTop: 12 }}>
                    <span className="pill">{employerApplicationStatusCounts.submitted} new</span>
                    <span className="pill">{employerApplicationStatusCounts.viewed} viewed</span>
                    <span className="pill">{employerApplicationStatusCounts.shortlisted} shortlisted</span>
                    <span className="pill">{employerApplicationStatusCounts.hired} hired</span>
                  </div>
                )}
                {incomingApplications.length > 0 ? (
                  <div className="stack" style={{ marginTop: 12 }}>
                    {sortedEmployerApplications.map((application) => (
                      <div key={application.id} className="applicationItem">
                        <div className="headerRow">
                          <div>
                            <strong>{application.applicant.fullName}</strong>
                            <div className="muted">
                              {application.job.jobTitle} • {application.job.countyLocation}
                            </div>
                          </div>
                          <span className="pill">{formatStatus(application.status)}</span>
                        </div>
                        <div className="pillRow" style={{ marginTop: 12 }}>
                          {application.applicant.tradeType && <span className="pill">{application.applicant.tradeType}</span>}
                          <span className="pill">{application.applicant.verificationStatus}</span>
                          <span className="pill">{application.applicant.ratingCount} ratings</span>
                          <span className="pill">{application.employerViewed ? "Viewed" : "New applicant"}</span>
                        </div>
                        {application.status === "submitted" && (
                          <div className="notice successNotice" style={{ marginTop: 12 }}>
                            Fresh lead. Review this applicant quickly while they are still engaged.
                          </div>
                        )}
                        {application.status === "shortlisted" && (
                          <div className="notice successNotice" style={{ marginTop: 12 }}>
                            This candidate is already warm. Move to chat or make the next decision while momentum is high.
                          </div>
                        )}
                        {application.status === "hired" && (
                          <div className="notice successNotice" style={{ marginTop: 12 }}>
                            Hiring is moving forward here. Confirm details and keep communication tight.
                          </div>
                        )}
                        {application.message && <p style={{ marginTop: 10 }}>{application.message}</p>}
                        {application.applicant.verificationStatus === "verified" ? (
                          <div className="pillRow" style={{ marginTop: 12 }}>
                            <button className="actionButton ghostButton" type="button" onClick={() => openConversation(application.applicant.id)}>
                              Message applicant
                            </button>
                          </div>
                        ) : (
                          <p className="muted" style={{ marginTop: 12 }}>
                            Messaging unlocks after the worker is verified. You can still review and move the application forward now.
                          </p>
                        )}
                        <div className="pillRow" style={{ marginTop: 12 }}>
                          {(["viewed", "shortlisted", "rejected", "hired"] as const).map((status) => (
                            <button
                              key={status}
                              className="actionButton ghostButton"
                              type="button"
                              disabled={updatingApplicationId === application.id}
                              onClick={() =>
                                void handleApplicationStatus(application.id, status, {
                                  recipientId:
                                    application.applicant.verificationStatus === "verified"
                                      ? application.applicant.id
                                      : undefined,
                                  draftMessage:
                                    application.applicant.verificationStatus === "verified"
                                      ? status === "shortlisted"
                                        ? `Hi ${application.applicant.fullName.split(" ")[0]}, I just shortlisted you for ${application.job.jobTitle}. Are you available to chat about next steps?`
                                        : status === "hired"
                                          ? `Hi ${application.applicant.fullName.split(" ")[0]}, we’d like to move forward with you for ${application.job.jobTitle}. Let’s confirm details and next steps.`
                                          : undefined
                                      : undefined,
                                  postActionNote:
                                    application.applicant.verificationStatus !== "verified" &&
                                    (status === "shortlisted" || status === "hired")
                                      ? "Messaging will unlock after the worker is verified."
                                      : undefined
                                })
                              }
                            >
                              {formatStatus(status)}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="stack" style={{ marginTop: 12 }}>
                    <p className="muted">No employer-side applications yet. Publish a job and qualified workers will start appearing here.</p>
                    <div className="betaItem">
                      <strong>Best next move</strong>
                      <p className="muted" style={{ marginTop: 8 }}>
                        Finish verification, tighten your draft, then publish one clear role so applicants have something real to respond to.
                      </p>
                    </div>
                    <div className="pillRow">
                      <button className="actionButton" type="button" onClick={() => setActiveView("jobs")}>
                        Open jobs
                      </button>
                      {!user?.isBusinessVerified && user?.userTag === "employer" && (
                        <button className="actionButton ghostButton" type="button" onClick={() => setActiveView("profile")}>
                          Finish verification
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {activeView === "messages" && (
        <section style={{ marginTop: 24 }} className="messagesShell">
          {!user ? (
            <div className="card">
              <h2>Messages</h2>
              <p className="muted" style={{ marginTop: 12 }}>
                Sign in first, then use applications and hiring decisions to move into chat.
              </p>
              <button className="actionButton" style={{ marginTop: 12 }} type="button" onClick={() => setActiveView("auth")}>
                Open login
              </button>
            </div>
          ) : messagingLocked ? (
            <div className="card">
              <h2>Messages locked</h2>
              <p className="muted" style={{ marginTop: 12 }}>
                {user.userTag === "employer"
                  ? "Messaging unlocks after your account is verified. Finish business verification first, then keep hiring moving through jobs and applications."
                  : "Messaging unlocks after your account is verified. For now, keep applying, keep your profile strong, and watch Apps for status changes."}
              </p>
              {user.userTag === "employer" && (
                <div className="stack" style={{ marginTop: 12 }}>
                  <div className="betaItem">
                    <strong>Best thing to do right now</strong>
                    <p className="muted" style={{ marginTop: 8 }}>
                      {employerPriorityApplication
                        ? `Review ${employerPriorityApplication.applicant.fullName} for ${employerPriorityApplication.job.jobTitle}, then move the application forward.`
                        : "Finish verification, publish a strong job, and bring in your first applicants."}
                    </p>
                  </div>
                  <div className="betaItem">
                    <strong>What unlocks chat</strong>
                    <p className="muted" style={{ marginTop: 8 }}>
                      Your employer account needs verification first, and the applicant also needs to be verified before chat opens.
                    </p>
                  </div>
                </div>
              )}
              {user.userTag === "employee" && (
                <div className="stack" style={{ marginTop: 12 }}>
                  <div className="betaItem">
                    <strong>Best thing to do right now</strong>
                    <p className="muted" style={{ marginTop: 8 }}>
                      {workerPriorityApplication
                        ? `Stay close to ${workerPriorityApplication.job?.jobTitle ?? "your strongest application"} and watch Apps for movement.`
                        : "Finish your profile and apply to the strongest-fit jobs first."}
                    </p>
                  </div>
                  <div className="betaItem">
                    <strong>What unlocks chat</strong>
                    <p className="muted" style={{ marginTop: 8 }}>
                      Your account needs to be verified, and the employer side needs to be verified too.
                    </p>
                  </div>
                </div>
              )}
              <div className="pillRow" style={{ marginTop: 12 }}>
                {user.userTag === "employer" && (
                  <button className="actionButton" type="button" onClick={() => setActiveView("profile")}>
                    Open profile
                  </button>
                )}
                {user.userTag === "employee" && (
                  <button className="actionButton" type="button" onClick={() => setActiveView("jobs")}>
                    Open jobs
                  </button>
                )}
                <button className="actionButton ghostButton" type="button" onClick={() => setActiveView("applications")}>
                  Open applications
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="stack messageInboxPanel">
                <div className="card">
                  <h2>Inbox</h2>
                  <p className="muted">Verified users can message each other after connecting through the platform.</p>
                  {user.userTag === "employer" && employerPriorityApplication?.applicant.verificationStatus === "verified" && (
                    <div className="pillRow" style={{ marginTop: 12 }}>
                      <button
                        className="actionButton ghostButton"
                        type="button"
                        onClick={() =>
                          openConversation(
                            employerPriorityApplication.applicant.id,
                            `Hi ${employerPriorityApplication.applicant.fullName.split(" ")[0]}, I wanted to follow up on ${employerPriorityApplication.job.jobTitle}. Are you available to talk through next steps?`
                          )
                        }
                      >
                        Resume best applicant
                      </button>
                    </div>
                  )}
                  {user.userTag === "employee" && workerPriorityApplication?.employer && workerPriorityEmployerVerified && (
                    <div className="pillRow" style={{ marginTop: 12 }}>
                      <button
                        className="actionButton ghostButton"
                        type="button"
                        onClick={() =>
                          openConversation(
                            workerPriorityApplication.employer!.id,
                            `Hi ${workerPriorityApplication.employer!.fullName.split(" ")[0]}, I wanted to follow up on ${workerPriorityApplication.job?.jobTitle ?? "my application"}.`
                          )
                        }
                      >
                        Resume best lead
                      </button>
                    </div>
                  )}
                  {user.userTag === "employee" && workerPriorityApplication && (
                    <p className="muted" style={{ marginTop: 12 }}>
                      Current best lead: {workerPriorityApplication.job?.jobTitle ?? "Application"} with {workerPriorityApplication.employer?.fullName ?? "the employer"}.
                    </p>
                  )}
                  {user.userTag === "employer" && employerPriorityApplication && (
                    <p className="muted" style={{ marginTop: 12 }}>
                      Current best applicant: {employerPriorityApplication.applicant.fullName} for {employerPriorityApplication.job.jobTitle}.
                    </p>
                  )}
                </div>
                {conversations.length > 0 ? (
                  conversations.map((conversation) => (
                    <button
                      key={conversation.conversationId}
                      className="conversationButton"
                      type="button"
                      onClick={() => setSelectedRecipientId(conversation.participant.id)}
                    >
                      <div className="headerRow">
                        <strong>{conversation.participant.fullName}</strong>
                        <span className="pill">{conversation.unreadCount} unread</span>
                      </div>
                      <div className="muted">{conversation.participant.tradeType ?? conversation.participant.businessName ?? conversation.participant.userTag}</div>
                      <div>{conversation.latestMessage.messageText}</div>
                    </button>
                  ))
                ) : (
                  <div className="card">
                    <p className="muted">No conversations yet. Conversations start after applications and hiring decisions, or when you choose a verified contact on the right.</p>
                  </div>
                )}
              </div>

              <div className="stack messageComposerPanel">
                <div className="card">
                  <h3>Start or open a conversation</h3>
                  <p className="muted" style={{ marginBottom: 12 }}>
                    Pick a verified person to open the message thread. Existing conversations will load automatically.
                  </p>
                  <select value={selectedRecipientId} onChange={(event) => setSelectedRecipientId(event.target.value)}>
                    <option value="">Choose a verified person</option>
                    {availableMessageUsers.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.fullName} - {candidate.tradeType ?? candidate.businessName ?? candidate.userTag}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedRecipientId && (
                  <>
                    <div className="card">
                      <div className="headerRow">
                        <div>
                          <h3>{selectedMessageUser?.fullName ?? "Conversation"}</h3>
                          <div className="muted">
                            {selectedMessageUser?.tradeType ?? selectedMessageUser?.businessName ?? selectedMessageUser?.userTag ?? "Verified contact"}
                          </div>
                        </div>
                        <div className="pillRow">
                          <span className="pill">{selectedMessageUser?.verificationStatus ?? "verified"}</span>
                          <span className="pill">{selectedConversation ? "Existing thread" : "New thread"}</span>
                        </div>
                      </div>
                      {user.userTag === "employee" && workerPriorityApplication?.employer?.id === selectedRecipientId && (
                        <div className="pillRow" style={{ marginTop: 12 }}>
                          <span className="pill">Priority lead</span>
                          <span className="pill">{workerPriorityApplication.job?.jobTitle ?? "Application follow-up"}</span>
                        </div>
                      )}
                      {user.userTag === "employer" && employerPriorityApplication?.applicant.id === selectedRecipientId && (
                        <div className="pillRow" style={{ marginTop: 12 }}>
                          <span className="pill">Best applicant</span>
                          <span className="pill">{employerPriorityApplication.job.jobTitle}</span>
                        </div>
                      )}
                      <p className="muted" style={{ marginTop: 12 }}>
                        {selectedConversation
                          ? "This conversation is already active. Keep replies short, specific, and job-focused."
                          : "This will start a new conversation once you send the first message."}
                      </p>
                    </div>
                    <div className="messageThread card">
                      {isLoadingThread ? (
                        <div className="muted">Loading conversation...</div>
                      ) : threadMessages.length > 0 ? (
                        threadMessages.map((message) => (
                          <article key={message.id} className={`messageBubble ${message.senderId === user?.id ? "sentBubble" : "receivedBubble"}`}>
                            <strong>{message.senderId === user?.id ? "You" : "Them"}</strong>
                            <div>{message.messageText}</div>
                            <div className="muted">{new Date(message.sentAt).toLocaleString()}</div>
                          </article>
                        ))
                      ) : (
                        <div className="muted">No messages yet. Start the conversation.</div>
                      )}
                    </div>
                    <div className="card stack">
                      <h3>{selectedConversation ? "Reply" : "New message"}</h3>
                      <p className="muted">
                        Keep messages specific to the job, timeline, and next action so the handoff from applications stays clear.
                      </p>
                      {user.userTag === "employee" && workerPriorityApplication?.employer?.id === selectedRecipientId && (
                        <div className="notice successNotice">
                          This is tied to your strongest live lead. Confirm timing, next steps, and job details while the conversation is active.
                        </div>
                      )}
                      {user.userTag === "employer" && employerPriorityApplication?.applicant.id === selectedRecipientId && (
                        <div className="notice successNotice">
                          This is tied to your strongest current applicant. Confirm availability, next steps, and decision timing while they are engaged.
                        </div>
                      )}
                      <textarea rows={3} value={messageText} placeholder="Type your message" onChange={(event) => setMessageText(event.target.value)} />
                      <button className="actionButton" type="button" disabled={isSendingMessage} onClick={() => void handleSendMessage()}>
                        {isSendingMessage ? "Sending..." : selectedConversation ? "Send reply" : "Send message"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </section>
      )}

      {activeView === "profile" && (
        <section style={{ marginTop: 24 }} className="profileLayout">
          <div className={user?.userTag === "employee" ? "profileHeroCard" : "card"}>
            <h2>Profile</h2>
            {!user ? (
              <div className="stack" style={{ marginTop: 12 }}>
                <p className="muted">Sign in to edit your profile and unlock the full hiring flow.</p>
                <button className="actionButton" type="button" onClick={() => setActiveView("auth")}>
                  Open login
                </button>
              </div>
            ) : (
              <>
                {user.userTag === "employee" && (
                  <>
                    <div className="profileBanner" />
                    <div className="profileHeroTop">
                      <div className="profileAvatar">
                        {user.profilePhotoUrl ? (
                          <img alt={user.fullName} src={user.profilePhotoUrl} className="profileAvatarImage" />
                        ) : (
                          buildInitials(user.fullName || user.email)
                        )}
                      </div>
                      <div className="stack" style={{ gap: 10 }}>
                        <div>
                          <h3>{user.fullName || "Your worker profile"}</h3>
                          <div className="profileHandle">
                            @{(user.fullName || user.email).toLowerCase().replaceAll(" ", ".")}
                          </div>
                        </div>
                        <p className="profileHeadline">{buildWorkerHeadline(user)}</p>
                        <div className="profileMiniBadges">
                          <span className="profileMiniBadge">{user.openToWork ? "Open to work" : "Profile in progress"}</span>
                          <span className="profileMiniBadge">{user.tradeType?.trim() || "Trade missing"}</span>
                          <span className="profileMiniBadge">{user.verificationStatus}</span>
                          {user.trustBadge && <span className="profileMiniBadge">{user.trustBadge}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="profileStats">
                      <div className="profileStat">
                        <span className="muted">Experience</span>
                        <strong>{user.yearsExperience ? `${user.yearsExperience} yrs` : "Add it"}</strong>
                      </div>
                      <div className="profileStat">
                        <span className="muted">Rate</span>
                        <strong>{user.hourlyRate ? `${formatMoney(user.hourlyRate)}/hr` : "Set rate"}</strong>
                      </div>
                      <div className="profileStat">
                        <span className="muted">Reviews</span>
                        <strong>{user.ratingCount > 0 ? `${user.ratingAverage.toFixed(1)} (${user.ratingCount})` : "No reviews yet"}</strong>
                      </div>
                      <div className="profileStat">
                        <span className="muted">Profile progress</span>
                        <strong>
                          {completedChecklistCount}/{profileChecklist.length}
                        </strong>
                      </div>
                    </div>
                    <div className="profileSectionLabel">What employers see first</div>
                    <div className="profileFeatureGrid">
                      {workerStrengths.map((item) => (
                        <div key={item.label} className="profileFeatureCard">
                          <span className="muted">{item.label}</span>
                          <strong>{item.value}</strong>
                          <p className="muted">{item.hint}</p>
                        </div>
                      ))}
                    </div>
                    <div className="profileSectionLabel">Bio preview</div>
                    <p className="profileBio">
                      {user.bio?.trim() || "Add a short bio that tells employers what kind of jobs you want and what you do best."}
                    </p>
                  </>
                )}
                {user.userTag === "employer" && (
                  <>
                    <div className="pillRow" style={{ marginTop: 12 }}>
                      <span className="pill">{user.businessName?.trim() || "Business name missing"}</span>
                      <span className="pill">{user.isBusinessVerified ? "Business verified" : "Verification pending"}</span>
                    </div>
                    <div className="stack" style={{ marginTop: 18 }}>
                      <div className="betaItem">
                        <strong>What workers need to trust</strong>
                        <p className="muted" style={{ marginTop: 8 }}>
                          A clear business name, a short company bio, and finished verification all make applicants more likely to take your job seriously.
                        </p>
                      </div>
                      {employerBlockers.length > 0 && (
                        <div className="betaItem">
                          <strong>Current setup blockers</strong>
                          <div className="pillRow" style={{ marginTop: 8 }}>
                            {employerBlockers.map((blocker) => (
                              <span key={blocker} className="pill">
                                {blocker}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
                <div className="pillRow" style={{ marginTop: 12 }}>
                  <span className="pill">{user.userTag}</span>
                  <span className="pill">{user.verificationStatus}</span>
                  {user.isBusinessVerified && <span className="pill">Business verified</span>}
                  {user.userTag === "employee" && <span className="pill">{user.openToWork ? "Available now" : "Not open to work"}</span>}
                </div>
                <form className="stack" style={{ marginTop: 18 }} onSubmit={handleSaveProfile}>
                  <label className="field">
                    <span>Full name</span>
                    <input value={profileForm.fullName} onChange={(event) => setProfileForm((current) => ({ ...current, fullName: event.target.value }))} required />
                  </label>
                  <label className="field">
                    <span>ZIP code</span>
                    <input value={profileForm.zipCode} onChange={(event) => setProfileForm((current) => ({ ...current, zipCode: event.target.value }))} required />
                  </label>
                  <div className="splitFields">
                    <label className="field">
                      <span>Trade type</span>
                      <input value={profileForm.tradeType} onChange={(event) => setProfileForm((current) => ({ ...current, tradeType: event.target.value }))} />
                    </label>
                    <label className="field">
                      <span>Business name</span>
                      <input value={profileForm.businessName} onChange={(event) => setProfileForm((current) => ({ ...current, businessName: event.target.value }))} />
                    </label>
                  </div>
                  <label className="field">
                    <span>Bio</span>
                    <textarea rows={4} value={profileForm.bio} onChange={(event) => setProfileForm((current) => ({ ...current, bio: event.target.value }))} />
                  </label>
                  <div className="splitFields">
                    <label className="field">
                      <span>Years of experience</span>
                      <input type="number" value={profileForm.yearsExperience} onChange={(event) => setProfileForm((current) => ({ ...current, yearsExperience: event.target.value }))} />
                    </label>
                    <label className="field">
                      <span>Hourly rate</span>
                      <input type="number" value={profileForm.hourlyRate} onChange={(event) => setProfileForm((current) => ({ ...current, hourlyRate: event.target.value }))} />
                    </label>
                  </div>
                  <div className="splitFields">
                    <label className="field">
                      <span>Union status</span>
                      <input value={profileForm.unionStatus} onChange={(event) => setProfileForm((current) => ({ ...current, unionStatus: event.target.value }))} />
                    </label>
                  </div>
                  <label className="profileToggle">
                    <input type="checkbox" checked={profileForm.openToWork} onChange={(event) => setProfileForm((current) => ({ ...current, openToWork: event.target.checked }))} />
                    Open to work
                  </label>
                  <button className="actionButton" disabled={isSavingProfile} type="submit">
                    {isSavingProfile ? "Saving..." : "Save profile"}
                  </button>
                </form>
              </>
            )}
          </div>

          <div className="stack">
            <div className="card">
              <h3>Profile checklist</h3>
              <div className="stack" style={{ marginTop: 12 }}>
                {profileChecklist.map((item) => (
                  <div key={item.label} className="checkItem">
                    <div className={item.complete ? "checkDot" : "checkDot pendingDot"} />
                    <div>{item.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {user?.userTag === "employer" && (
              <div className="card">
                <h3>Business verification</h3>
                <div className="pillRow" style={{ marginTop: 12 }}>
                  <span className="pill">{user.isBusinessVerified ? "Business verified" : "Verification pending"}</span>
                </div>
                <p className="muted" style={{ marginTop: 12 }}>
                  Verification checks your business details before job publishing unlocks.
                </p>
                {!user.isBusinessVerified && (
                  <button
                    className="actionButton"
                    style={{ marginTop: 12 }}
                    type="button"
                    disabled={isCompletingVerification}
                    onClick={() => void handleCompleteBusinessVerification()}
                  >
                    {isCompletingVerification ? "Verifying..." : "Complete business verification"}
                  </button>
                )}
              </div>
            )}

            <div className="card">
              <h3>Next best step</h3>
              <p className="muted" style={{ marginTop: 12 }}>
                {!user
                  ? "Create an account first."
                  : user.userTag === "employer" && !user.isBusinessVerified
                    ? "Finish your business profile, then complete verification so you can post jobs."
                    : user.userTag === "employer" && !user.businessName?.trim()
                      ? "Add your business name so workers know who is hiring."
                      : user.userTag === "employer" && !user.bio?.trim()
                        ? "Add a short company bio so applicants understand the kind of work and team behind the job."
                    : user.userTag === "employee" && !user.isVerified
                      ? "Your profile is ready to apply for jobs. Messaging will unlock after account verification is complete."
                      : user.userTag === "employee" && !user.tradeType?.trim()
                        ? "Add your trade so employers instantly understand what kind of work you do."
                        : user.userTag === "employee" && !user.bio?.trim()
                          ? "Add a short bio so employers know your strengths and the kind of jobs you want."
                    : user.userTag === "employee" && !user.openToWork
                      ? "Turn on open to work so employers can discover you faster."
                      : "Your profile is ready enough to move into jobs, applications, and messaging."}
              </p>
              <div className="pillRow" style={{ marginTop: 12 }}>
                <button className="actionButton ghostButton" type="button" onClick={() => setActiveView("jobs")}>
                  Open jobs
                </button>
                {user?.isVerified && (
                  <button className="actionButton ghostButton" type="button" onClick={() => setActiveView("messages")}>
                    Open messages
                  </button>
                )}
                {!user?.isVerified && user?.userTag === "employee" && (
                  <button className="actionButton ghostButton" type="button" onClick={() => setActiveView("applications")}>
                    Open applications
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

export default App;
