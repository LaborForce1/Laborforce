import { env } from "../config/env.js";

const configured = (value?: string) => Boolean(value && value.trim().length > 0);

export const integrations = {
  stripe: {
    ready: configured(env.STRIPE_SECRET_KEY),
    describeDepositFlow() {
      return "Hold $20 job deposits before publishing, refund on filled/closed, forfeit on expiry.";
    }
  },
  persona: {
    ready: configured(env.PERSONA_API_KEY),
    describeVerificationFlow() {
      return "Government ID scan, expiry checks, selfie liveness, and business document verification.";
    }
  },
  twilio: {
    ready: configured(env.TWILIO_ACCOUNT_SID) && configured(env.TWILIO_AUTH_TOKEN),
    channel: "sms"
  },
  sendgrid: {
    ready: configured(env.SENDGRID_API_KEY)
  },
  oneSignal: {
    ready: configured(env.ONESIGNAL_APP_ID) && configured(env.ONESIGNAL_API_KEY)
  },
  googleMaps: {
    ready: configured(env.GOOGLE_MAPS_API_KEY)
  },
  uploadcare: {
    ready: configured(env.UPLOADCARE_PUBLIC_KEY) && configured(env.UPLOADCARE_SECRET_KEY)
  },
  ai: {
    openaiReady: configured(env.OPENAI_API_KEY),
    anthropicReady: configured(env.ANTHROPIC_API_KEY)
  }
};

