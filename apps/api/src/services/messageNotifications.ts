import { env } from "../config/env.js";

interface SmsNotificationInput {
  toPhone: string;
  recipientName: string;
  senderName: string;
  messageText: string;
}

function trimPreview(messageText: string) {
  return messageText.length > 100 ? `${messageText.slice(0, 97)}...` : messageText;
}

function twilioReady() {
  return Boolean(
    env.TWILIO_ACCOUNT_SID &&
    env.TWILIO_AUTH_TOKEN &&
    (env.TWILIO_MESSAGING_SERVICE_SID || env.TWILIO_FROM_NUMBER)
  );
}

export async function sendNewMessageSms(input: SmsNotificationInput) {
  const body = new URLSearchParams();
  body.set("To", input.toPhone);
  body.set(
    "Body",
    `LaborForce: New message from ${input.senderName} for ${input.recipientName}: "${trimPreview(input.messageText)}"`
  );

  if (env.TWILIO_MESSAGING_SERVICE_SID) {
    body.set("MessagingServiceSid", env.TWILIO_MESSAGING_SERVICE_SID);
  } else if (env.TWILIO_FROM_NUMBER) {
    body.set("From", env.TWILIO_FROM_NUMBER);
  }

  if (!twilioReady()) {
    console.log(
      JSON.stringify({
        service: "laborforce-api",
        notification: "sms_skipped",
        reason: "twilio_not_configured",
        toPhone: input.toPhone
      })
    );
    return { delivered: false, mode: "skipped" as const };
  }

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body
    }
  );

  if (!response.ok) {
    const details = await response.text();
    console.error(
      JSON.stringify({
        service: "laborforce-api",
        notification: "sms_failed",
        status: response.status,
        details
      })
    );
    return { delivered: false, mode: "failed" as const };
  }

  return { delivered: true, mode: "twilio" as const };
}
