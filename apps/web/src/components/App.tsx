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

interface VerificationStatusResponse {
  personaReady: boolean;
  flow: string;
  statuses: string[];
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
  certificationsRequired: string;
}

interface ProfileFormState {
  fullName: string;
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
  certificationsRequired: ""
};

const emptyProfileForm: ProfileFormState = {
  fullName: "",
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
  const [verificationFlow, setVerificationFlow] = useState<string>("");
  const [personaReady, setPersonaReady] = useState(false);
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
  const workerPriorityApplication =
    applications.find((application) => application.status === "shortlisted" || application.status === "hired") ?? applications[0] ?? null;
  const employerPriorityApplication =
    incomingApplications.find((application) => application.status === "submitted" || application.status === "viewed") ??
    incomingApplications[0] ??
    null;
  const employerNeedsFirstJob = user?.userTag === "employer" && employerJobs.length === 0;
  const workerNeedsFirstApplication = user?.userTag === "employee" && applications.length === 0;
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
    void loadVerificationStatus();
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

  async function loadVerificationStatus() {
    try {
      const response = await apiGet<VerificationStatusResponse>("/verification/status");
      setPersonaReady(response.personaReady);
      setVerificationFlow(response.flow);
    } catch {
      setPersonaReady(false);
      setVerificationFlow("");
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
      setSuccessMessage(authMode === "signup" ? "Account created." : "Signed in successfully.");
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
      const response = await apiPost<{ job: JobListing; message: string }>(`/jobs/${jobId}/publish`, {}, authState.accessToken);
      setSuccessMessage(response.message);
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
      setSuccessMessage(response.message);
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
      setSuccessMessage(response.message);
      await loadJobs();
      await loadEmployerJobs(authState.accessToken);
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
    setActiveView("auth");
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
            <div className="badge">LaborForce MVP</div>
            <h1 style={{ marginTop: 12 }}>Verified hiring for blue-collar work.</h1>
            <p className="muted" style={{ marginTop: 12 }}>
              This build is focused on the core product flow: auth, profiles, jobs, applications, and messaging.
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
            </div>
            <p className="muted" style={{ marginTop: 12 }}>
              {completedChecklistCount}/{profileChecklist.length} onboarding steps done
            </p>
          </div>
        ) : (
          <div className="card">
            <strong>Start by creating an account or logging in.</strong>
            <p className="muted" style={{ marginTop: 8 }}>
              Employee and employer flows are wired to the real LaborForce API.
            </p>
            <button className="actionButton" style={{ marginTop: 12 }} type="button" onClick={() => setActiveView("auth")}>
              Open auth
            </button>
          </div>
        )}
        {errorMessage && <div className="notice errorNotice">{errorMessage}</div>}
        {successMessage && <div className="notice successNotice">{successMessage}</div>}
      </section>

      {activeView === "overview" && (
        <section style={{ marginTop: 24 }} className="feedGrid">
          <div className="stack roomyStack">
            {!user && (
              <div className="card">
                <h2>Start here</h2>
                <p className="muted" style={{ marginTop: 12 }}>
                  Create an account, finish your profile, then move into jobs, applications, and messaging.
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
                        <button className="actionButton ghostButton" type="button" onClick={() => openConversation(employerPriorityApplication.applicant.id)}>
                          Open chat
                        </button>
                      </>
                    )}
                  </div>
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
                        ? `You were shortlisted for ${workerPriorityApplication.job?.jobTitle ?? "a job"}. Follow up in chat now.`
                        : workerPriorityApplication?.status === "hired"
                          ? `You were marked hired for ${workerPriorityApplication.job?.jobTitle ?? "a job"}. Confirm details in chat.`
                          : "Stay on top of your applications and follow up in chat when employers engage."}
                  </p>
                  <div className="pillRow" style={{ marginTop: 12 }}>
                    {workerNeedsFirstApplication && (
                      <button className="actionButton" type="button" onClick={() => setActiveView("jobs")}>
                        Browse jobs
                      </button>
                    )}
                    {!workerNeedsFirstApplication && workerPriorityApplication?.employer && (
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
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="stack sideRail">
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

            <div className="card">
              <h3>Fast links</h3>
              <div className="pillRow" style={{ marginTop: 12 }}>
                <button className="actionButton ghostButton" type="button" onClick={() => setActiveView("jobs")}>
                  Jobs
                </button>
                <button className="actionButton ghostButton" type="button" onClick={() => setActiveView("applications")}>
                  Apps
                </button>
                <button className="actionButton ghostButton" type="button" onClick={() => setActiveView("messages")}>
                  Chat
                </button>
                <button className="actionButton ghostButton" type="button" onClick={() => setActiveView("profile")}>
                  Profile
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {activeView === "auth" && (
        <section style={{ marginTop: 24 }} className="card">
          <div className="headerRow">
            <div>
              <h2>{authMode === "signup" ? "Create account" : "Sign in"}</h2>
              <p className="muted">{authMode === "signup" ? "Start as an employee or employer." : "Use your LaborForce account."}</p>
            </div>
            <button
              className="actionButton ghostButton"
              type="button"
              onClick={() => setAuthMode((current) => (current === "login" ? "signup" : "login"))}
            >
              {authMode === "login" ? "Need an account?" : "Already have an account?"}
            </button>
          </div>

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
                      </article>
                    ))
                  ) : (
                    <div className="stack">
                      <p className="muted">No jobs created yet. Start with a draft so applicants can move into your pipeline once you publish.</p>
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
                    <div className="notice successNotice" style={{ marginTop: 14 }}>
                      Applied on {formatDate(existingApplication.appliedAt)}.
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
                </div>
              </div>
            )}
          </div>

          <div className="stack sideRail">
            <div className="card">
              <h3>Employer summary</h3>
              <div className="pillRow" style={{ marginTop: 12 }}>
                <span className="pill">{employerDrafts.length} drafts</span>
                <span className="pill">{employerActiveJobs.length} active</span>
              </div>
              <p className="muted" style={{ marginTop: 12 }}>
                Employers must be business verified before publishing jobs successfully.
              </p>
              {user?.userTag === "employer" && !user.isBusinessVerified && (
                <>
                  <p className="muted" style={{ marginTop: 12 }}>
                    {personaReady
                      ? "Persona is connected. Complete verification to unlock job publishing."
                      : "Persona is not connected, so verification runs in development mode for now."}
                  </p>
                  {verificationFlow && <p className="muted" style={{ marginTop: 12 }}>{verificationFlow}</p>}
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
                    <span>County / area</span>
                    <input value={jobForm.countyLocation} onChange={(event) => setJobForm((current) => ({ ...current, countyLocation: event.target.value }))} required />
                  </label>
                </div>
                <label className="field">
                  <span>Benefits</span>
                  <input value={jobForm.benefits} onChange={(event) => setJobForm((current) => ({ ...current, benefits: event.target.value }))} />
                </label>
                <label className="field">
                  <span>Certifications required</span>
                  <input value={jobForm.certificationsRequired} onChange={(event) => setJobForm((current) => ({ ...current, certificationsRequired: event.target.value }))} placeholder="OSHA 10, EPA 608" />
                </label>
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
              {applications.length > 0 ? (
                <div className="stack" style={{ marginTop: 12 }}>
                  {applications.map((application) => (
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
                      {user?.userTag === "employee" && (
                        <div className="pillRow" style={{ marginTop: 12 }}>
                          <button className="actionButton ghostButton" type="button" onClick={() => setActiveView("jobs")}>
                            Browse jobs
                          </button>
                          {application.employer && (
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
                    </div>
                  ))}
                </div>
              ) : (
                <div className="stack" style={{ marginTop: 12 }}>
                  <p className="muted">No applications yet. Browse jobs, send a strong intro, and follow up fast when employers respond.</p>
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
            <div className="card">
              <h2>Employer review queue</h2>
              {incomingApplications.length > 0 ? (
                <div className="stack" style={{ marginTop: 12 }}>
                  {incomingApplications.map((application) => (
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
                      {application.message && <p style={{ marginTop: 10 }}>{application.message}</p>}
                      <div className="pillRow" style={{ marginTop: 12 }}>
                        <button className="actionButton ghostButton" type="button" onClick={() => openConversation(application.applicant.id)}>
                          Message applicant
                        </button>
                      </div>
                      <div className="pillRow" style={{ marginTop: 12 }}>
                        {(["viewed", "shortlisted", "rejected", "hired"] as const).map((status) => (
                          <button
                            key={status}
                            className="actionButton ghostButton"
                            type="button"
                            disabled={updatingApplicationId === application.id}
                            onClick={() =>
                              void handleApplicationStatus(application.id, status, {
                                recipientId: application.applicant.id,
                                draftMessage:
                                  status === "shortlisted"
                                    ? `Hi ${application.applicant.fullName.split(" ")[0]}, I just shortlisted you for ${application.job.jobTitle}. Are you available to chat about next steps?`
                                    : status === "hired"
                                      ? `Hi ${application.applicant.fullName.split(" ")[0]}, we’d like to move forward with you for ${application.job.jobTitle}. Let’s confirm details and next steps.`
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
          </div>
        </section>
      )}

      {activeView === "messages" && (
        <section style={{ marginTop: 24 }} className="messagesShell">
          <div className="stack messageInboxPanel">
            <div className="card">
              <h2>Inbox</h2>
              <p className="muted">Verified users can message each other after connecting through the platform.</p>
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
                  <textarea rows={3} value={messageText} placeholder="Type your message" onChange={(event) => setMessageText(event.target.value)} />
                  <button className="actionButton" type="button" disabled={isSendingMessage} onClick={() => void handleSendMessage()}>
                    {isSendingMessage ? "Sending..." : selectedConversation ? "Send reply" : "Send message"}
                  </button>
                </div>
              </>
            )}
          </div>
        </section>
      )}

      {activeView === "profile" && (
        <section style={{ marginTop: 24 }} className="profileLayout">
          <div className="card">
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
                <div className="pillRow" style={{ marginTop: 12 }}>
                  <span className="pill">{user.userTag}</span>
                  <span className="pill">{user.verificationStatus}</span>
                  {user.isBusinessVerified && <span className="pill">Business verified</span>}
                </div>
                <form className="stack" style={{ marginTop: 18 }} onSubmit={handleSaveProfile}>
                  <label className="field">
                    <span>Full name</span>
                    <input value={profileForm.fullName} onChange={(event) => setProfileForm((current) => ({ ...current, fullName: event.target.value }))} required />
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
                  <span className="pill">{personaReady ? "Persona connected" : "Dev mode"}</span>
                </div>
                <p className="muted" style={{ marginTop: 12 }}>
                  {verificationFlow || "Verification checks business documents before employers can publish jobs."}
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
                    : user.userTag === "employee" && !user.openToWork
                      ? "Turn on open to work so employers can discover you faster."
                      : "Your profile is ready enough to move into jobs, applications, and messaging."}
              </p>
              <div className="pillRow" style={{ marginTop: 12 }}>
                <button className="actionButton ghostButton" type="button" onClick={() => setActiveView("jobs")}>
                  Open jobs
                </button>
                <button className="actionButton ghostButton" type="button" onClick={() => setActiveView("messages")}>
                  Open messages
                </button>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

export default App;
