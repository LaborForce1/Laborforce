const API_URL = process.env.API_URL ?? "http://127.0.0.1:4000/api";
const ADMIN_API_KEY = process.env.ADMIN_API_KEY ?? "";

const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.admin ? { "x-admin-api-key": ADMIN_API_KEY } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(`${options.method ?? "GET"} ${path} failed: ${payload?.error ?? response.status}`);
  }

  return payload;
}

function log(step) {
  console.log(`ok - ${step}`);
}

async function approveUser(user, token) {
  if (ADMIN_API_KEY) {
    const response = await request(`/verification/admin/users/${user.id}/approve`, {
      method: "POST",
      token,
      admin: true,
      body: {}
    });
    return response.user;
  }

  if (user.userTag === "employer") {
    const response = await request("/verification/business/complete", {
      method: "POST",
      token,
      body: { businessName: user.businessName }
    });
    return response.user;
  }

  throw new Error("Worker verification needs ADMIN_API_KEY. Set it to run the full messaging smoke test.");
}

async function main() {
  await request("/health");
  log("API health");

  const employerSignup = await request("/auth/signup", {
    method: "POST",
    body: {
      email: `beta.employer.${suffix}@laborforce.test`,
      password: "LaborForce123!",
      fullName: "Beta Employer",
      phone: "5551112222",
      zipCode: "10001",
      userTag: "employer",
      businessName: "Beta HVAC Co"
    }
  });
  log("employer signup");

  const workerSignup = await request("/auth/signup", {
    method: "POST",
    body: {
      email: `beta.worker.${suffix}@laborforce.test`,
      password: "LaborForce123!",
      fullName: "Beta Worker",
      phone: "5553334444",
      zipCode: "10001",
      userTag: "employee",
      tradeType: "HVAC"
    }
  });
  log("worker signup");

  const employer = await approveUser(employerSignup.user, employerSignup.credentials.accessToken);
  log("employer verification");

  const worker = await approveUser(workerSignup.user, workerSignup.credentials.accessToken);
  log("worker verification");

  const profile = await request("/users/me", {
    method: "PATCH",
    token: workerSignup.credentials.accessToken,
    body: {
      fullName: worker.fullName,
      zipCode: worker.zipCode,
      tradeType: "HVAC",
      businessName: null,
      bio: "Reliable HVAC worker available for service and install jobs.",
      yearsExperience: 5,
      hourlyRate: 45,
      unionStatus: "Open",
      openToWork: true,
      profilePhotoUrl: null
    }
  });
  log(`worker profile update (${profile.user.fullName})`);

  const draft = await request("/jobs", {
    method: "POST",
    token: employerSignup.credentials.accessToken,
    body: {
      jobTitle: "HVAC Installer",
      tradeCategory: "HVAC",
      description: "Install and service residential HVAC systems for a beta hiring smoke test.",
      hourlyRateMin: 35,
      hourlyRateMax: 55,
      jobType: "full_time",
      benefits: "Weekly pay",
      countyLocation: "New York County",
      locationZip: "10001",
      certificationsRequired: ["EPA 608"]
    }
  });
  log("job draft created");

  const employerJobs = await request("/jobs/mine", {
    token: employerSignup.credentials.accessToken
  });
  const job = employerJobs.items.find((item) => item.jobTitle === "HVAC Installer");
  if (!job) {
    throw new Error("Created job was not returned in employer job list.");
  }

  const checkout = await request(`/payments/job-deposits/${job.id}/checkout`, {
    method: "POST",
    token: employerSignup.credentials.accessToken,
    body: {}
  });

  if (checkout.mode === "stripe_checkout") {
    console.log(`manual - complete Stripe checkout: ${checkout.checkoutUrl}`);
    console.log("manual - rerun worker apply/message checks after checkout succeeds");
    return;
  }

  await request("/payments/job-deposits/complete", {
    method: "POST",
    token: employerSignup.credentials.accessToken,
    body: { jobId: job.id }
  });
  log("local deposit simulation published job");

  const jobs = await request("/jobs", {
    token: workerSignup.credentials.accessToken
  });
  const activeJob = jobs.items.find((item) => item.id === job.id);
  if (!activeJob) {
    throw new Error("Published job was not visible to the worker.");
  }
  log("worker can browse published job");

  await request(`/jobs/${job.id}/apply`, {
    method: "POST",
    token: workerSignup.credentials.accessToken,
    body: { message: "I am available and interested in this HVAC role." }
  });
  log("worker applied");

  const applications = await request("/applications/employer", {
    token: employerSignup.credentials.accessToken
  });
  const application = applications.items.find((item) => item.job.id === job.id);
  if (!application) {
    throw new Error("Employer could not see the worker application.");
  }
  log("employer can review applicant");

  await request(`/applications/${application.id}/status`, {
    method: "PATCH",
    token: employerSignup.credentials.accessToken,
    body: { status: "shortlisted" }
  });
  log("employer shortlisted applicant");

  await request("/messages", {
    method: "POST",
    token: employerSignup.credentials.accessToken,
    body: {
      recipientId: worker.id,
      messageText: "Thanks for applying. Are you available to talk through next steps?"
    }
  });
  log("employer messaged worker");

  const conversations = await request("/messages", {
    token: workerSignup.credentials.accessToken
  });
  if (!conversations.items.some((item) => item.participant.id === employer.id)) {
    throw new Error("Worker inbox did not show employer message.");
  }
  log("worker inbox shows message");

  console.log("beta smoke test passed");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
