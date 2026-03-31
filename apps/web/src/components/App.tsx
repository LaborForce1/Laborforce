import { useEffect, useMemo, useState } from "react";
import { type EmployerApplicationView, type JobApplication, type JobListing, type Message, type MessageConversation, type SocialPost, type User, type UserTag } from "@laborforce/shared";
import { apiGet, apiPatch, apiPost } from "../api/client";

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

export function App() {
  const [activeExperience, setActiveExperience] = useState<"feed" | "jobs" | "reels" | "messages">("feed");
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
  const [applyForms, setApplyForms] = useState<ApplyFormState>({});
  const [messageText, setMessageText] = useState("");
  const [isPostingSocial, setIsPostingSocial] = useState(false);
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
    if (view === "feed" || view === "jobs" || view === "reels" || view === "messages") {
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
  }, [authState, user?.id]);

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
  const reelPosts = socialPosts;

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

  function switchExperience(view: "feed" | "jobs" | "reels" | "messages") {
    setActiveExperience(view);
    const params = new URLSearchParams(window.location.search);
    params.set("view", view);
    const next = params.toString();
    window.history.replaceState({}, "", next ? `/?${next}` : "/");
  }

  function signOut() {
    setAuthState(null);
    setUser(null);
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    setSuccessMessage("Signed out.");
  }

  return (
    <div className="shell">
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
              <button className={`actionButton ${mode === "login" ? "" : "ghostButton"}`} onClick={() => setMode("login")}>
                Login
              </button>
              <button className={`actionButton ${mode === "signup" ? "" : "ghostButton"}`} onClick={() => setMode("signup")}>
                Signup
              </button>
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
              <div className="muted">
                Demo employer login: `dispatch@northsidehvac.com` / `LaborForce123!`
              </div>
            </form>
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
            {reelPosts.map((post, index) => (
              <article key={post.id} className="reelCard">
                {post.photoUrls[0] && <img className="reelImage" src={post.photoUrls[0]} alt={post.tradeTag} />}
                <div className="reelOverlay">
                  <div className="badge">Reel #{index + 1}</div>
                  <h3>{post.tradeTag} Reel</h3>
                  <p>{post.postText}</p>
                  <div className="pillRow">
                    <span className="pill">How-to</span>
                    <span className="pill">Work proof</span>
                    <span className="pill">Career tips</span>
                  </div>
                </div>
              </article>
            ))}
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

      <nav className="bottomNav">
        <button
          className={`bottomNavButton ${activeExperience === "feed" ? "bottomNavActive" : ""}`}
          onClick={() => switchExperience("feed")}
        >
          <span className="bottomNavIcon">Home</span>
          <span>Feed</span>
        </button>
        <button
          className={`bottomNavButton ${activeExperience === "jobs" ? "bottomNavActive" : ""}`}
          onClick={() => switchExperience("jobs")}
        >
          <span className="bottomNavIcon">Work</span>
          <span>Jobs</span>
        </button>
        <button
          className={`bottomNavButton ${activeExperience === "reels" ? "bottomNavActive" : ""}`}
          onClick={() => switchExperience("reels")}
        >
          <span className="bottomNavIcon">Play</span>
          <span>Reels</span>
        </button>
        <button
          className={`bottomNavButton ${activeExperience === "messages" ? "bottomNavActive" : ""}`}
          onClick={() => switchExperience("messages")}
        >
          <span className="bottomNavIcon">Chat</span>
          <span>Messages</span>
        </button>
      </nav>
    </div>
  );
}
