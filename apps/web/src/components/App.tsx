import { useEffect, useMemo, useState } from "react";
import { pipelineStages, type JobListing, type PipelineStage, type User, type UserTag } from "@laborforce/shared";
import { apiGet, apiPost } from "../api/client";
import { demoCRM, demoQuickCash, demoSocial, userOptions } from "../data/mock";

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

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}

export function App() {
  const [selectedTag, setSelectedTag] = useState<UserTag>("employee");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [authState, setAuthState] = useState<AuthResponse["credentials"] | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [jobs, setJobs] = useState<JobListing[]>([]);
  const [jobsRadius, setJobsRadius] = useState(50);
  const [isBooting, setIsBooting] = useState(true);
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);
  const [isLoadingJobs, setIsLoadingJobs] = useState(false);
  const [isPostingJob, setIsPostingJob] = useState(false);
  const [publishingJobId, setPublishingJobId] = useState<string | null>(null);
  const [stripeReady, setStripeReady] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
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
  }, []);

  useEffect(() => {
    if (!authState?.accessToken) {
      setUser(null);
      return;
    }

    void loadCurrentUser(authState.accessToken);
  }, [authState]);

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
          summary: "Post deposit-backed jobs, search trade-specific portfolios, and manage your pipeline from lead to completed."
        };
      default:
        return {
          headline: "Trusted help for urgent jobs",
          summary: "Post fast-turnaround tasks, compare bids side by side, and release escrow only when the work is complete."
        };
    }
  }, [selectedTag]);

  async function loadJobs() {
    setIsLoadingJobs(true);

    try {
      const response = await apiGet<JobsResponse>("/jobs");
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

  function signOut() {
    setAuthState(null);
    setUser(null);
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    setSuccessMessage("Signed out.");
  }

  return (
    <div className="shell">
      <section className="hero">
        <div className="headerRow">
          <div>
            <div className="badge">LaborForce Verified Workforce Platform</div>
            <h1>{roleCopy.headline}</h1>
            <p className="muted" style={{ maxWidth: 820 }}>
              {roleCopy.summary}
            </p>
          </div>
          <div className="card">
            {user ? (
              <>
                <strong>{user.fullName}</strong>
                <div className="muted">{user.tradeType ?? user.businessName ?? user.userTag}</div>
                <div style={{ marginTop: 10 }}>{user.trustBadge ?? user.verificationStatus}</div>
                <button className="actionButton ghostButton" style={{ marginTop: 14 }} onClick={signOut}>
                  Sign out
                </button>
              </>
            ) : (
              <>
                <strong>Live auth ready</strong>
                <div className="muted">Use the seeded employer to test job posting.</div>
                <div style={{ marginTop: 10 }}>dispatch@northsidehvac.com</div>
              </>
            )}
          </div>
        </div>

        <div className="tileGrid">
          {userOptions.map((option) => (
            <button className="tile" key={option.tag} onClick={() => setSelectedTag(option.tag)}>
              <div className="badge">{option.tag === selectedTag ? "Selected role" : "Choose role"}</div>
              <h3>{option.title}</h3>
              <p className="muted">{option.description}</p>
            </button>
          ))}
        </div>
      </section>

      <section style={{ marginTop: 24 }} className="feedGrid authGrid">
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
                    : "This dashboard is using the live LaborForce API. Stripe is not configured yet, so deposit checkout falls back locally."}
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
          <div className="muted">
            {isLoadingJobs ? "Loading live listings..." : `${jobs.length} listing${jobs.length === 1 ? "" : "s"} from PostgreSQL`}
          </div>
          <div className="stack" style={{ marginTop: 12 }}>
            {jobs.map((job) => (
              <article key={job.id} className="card">
                <div className="headerRow">
                  <div>
                    <strong>{job.jobTitle}</strong>
                    <div className="muted">{job.tradeCategory} • {job.countyLocation}</div>
                  </div>
                  {job.isSurge && <div className="headerRow"><div className="surgeDot" /> <span>Surge</span></div>}
                </div>
                <p className="muted">{job.description}</p>
                <div className="pillRow">
                  <span className="pill">{formatMoney(job.hourlyRateMin)} - {formatMoney(job.hourlyRateMax)}</span>
                  <span className="pill">{job.jobType.replace("_", " ")}</span>
                  <span className="pill">{job.status}</span>
                  <span className="pill">Deposit {formatMoney(job.depositAmount)}</span>
                </div>
                {user?.userTag === "employer" && job.employerId === user.id && job.status === "draft" && (
                  <button
                    className="actionButton"
                    style={{ marginTop: 12 }}
                    disabled={publishingJobId === job.id}
                    onClick={() => void handlePublishJob(job.id)}
                  >
                    {publishingJobId === job.id
                      ? "Processing deposit..."
                      : stripeReady
                        ? "Pay deposit and publish"
                        : "Publish with local fallback"}
                  </button>
                )}
              </article>
            ))}
          </div>
        </div>

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
      </section>

      <section style={{ marginTop: 24 }} className="statsGrid">
        <div className="card">
          <div className="muted">Radius</div>
          <h3>{jobsRadius} miles</h3>
          <div>Local-first jobs, Quick Cash, and social posts</div>
        </div>
        <div className="card">
          <div className="muted">Premium</div>
          <h3>$19.99/mo</h3>
          <div>CRM, AI assistant, HD uploads, calendar, client portal</div>
        </div>
        <div className="card">
          <div className="muted">Ghost job prevention</div>
          <h3>$20 deposit</h3>
          <div>Refunded when closed correctly, forfeited on expiry</div>
        </div>
        <div className="card">
          <div className="muted">Quick Cash fee</div>
          <h3>4%</h3>
          <div>Escrow held until customer marks completion</div>
        </div>
      </section>

      <section style={{ marginTop: 24 }} className="feedGrid">
        <div className="card">
          <div className="headerRow">
            <h2>Quick Cash</h2>
            <div className="pillRow">
              <span className="pill">Escrow</span>
              <span className="pill">Surge</span>
            </div>
          </div>
          {demoQuickCash.map((post) => (
            <article key={post.id} className="card" style={{ marginTop: 12 }}>
              <strong>{post.taskTitle}</strong>
              <p className="muted">{post.description}</p>
              <div className="pillRow">
                <span className="pill">{formatMoney(post.budgetMin)} - {formatMoney(post.budgetMax)}</span>
                <span className="pill">{post.estimatedHours} hrs</span>
                <span className="pill">Escrow {formatMoney(post.escrowAmount)}</span>
              </div>
            </article>
          ))}
        </div>

        <div className="card">
          <div className="headerRow">
            <h2>Proof Wall</h2>
            <div className="badge">Verified only</div>
          </div>
          {demoSocial.map((post) => (
            <article key={post.id} className="card" style={{ marginTop: 12 }}>
              <img
                src={post.photoUrls[0]}
                alt={post.tradeTag}
                style={{ width: "100%", borderRadius: 14, aspectRatio: "16 / 10", objectFit: "cover" }}
              />
              <p>{post.postText}</p>
              <div className="pillRow">
                <span className="pill">Respect {post.respectsCount}</span>
                <span className="pill">Impressed {post.impressedCount}</span>
                <span className="pill">Helpful {post.helpfulCount}</span>
              </div>
            </article>
          ))}
        </div>

        <div className="card">
          <div className="headerRow">
            <h2>What Is Real Now</h2>
            <div className="badge">Current slice</div>
          </div>
          <div className="stack">
            <div className="pillRow">
              <span className="pill">Live signup/login</span>
              <span className="pill">JWT stored locally</span>
              <span className="pill">/users/me</span>
              <span className="pill">/jobs</span>
              <span className="pill">Deposit flow</span>
            </div>
            <p className="muted">
              Quick Cash, Proof Wall feed, and CRM remain scaffolded while the core hiring flow is being connected
              end to end.
            </p>
          </div>
        </div>
      </section>

      <section style={{ marginTop: 24 }}>
        <div className="headerRow">
          <h2>CRM Pipeline</h2>
          <div className="badge">Premium employers</div>
        </div>
        <div className="crmGrid">
          {pipelineStages.map((stage: PipelineStage) => (
            <div className="column" key={stage}>
              <div className="headerRow">
                <strong>{stage}</strong>
                <span className="muted">{demoCRM.filter((contact) => contact.pipelineStage === stage).length}</span>
              </div>
              {demoCRM
                .filter((contact) => contact.pipelineStage === stage)
                .map((contact) => (
                  <div key={contact.id} className="card" style={{ marginTop: 12 }}>
                    <strong>{contact.contactName}</strong>
                    <div className="muted">{contact.contactEmail}</div>
                    <div style={{ marginTop: 8 }}>{formatMoney(contact.projectValue ?? 0)}</div>
                    <div style={{ marginTop: 8, color: "var(--danger)" }}>
                      Follow-up overdue
                    </div>
                  </div>
                ))}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
