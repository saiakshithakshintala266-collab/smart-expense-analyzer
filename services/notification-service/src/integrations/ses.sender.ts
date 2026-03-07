// File: services/notification-service/src/integrations/ses.sender.ts
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { createLogger } from "@shared/logger";

const log = createLogger({ serviceName: "notification-service" });

export function createSesClient(): SESClient {
  const endpoint = process.env.AWS_ENDPOINT_URL;
  return new SESClient({
    region: process.env.AWS_REGION ?? "us-east-1",
    ...(endpoint ? { endpoint } : {})
  });
}

export type EmailInput = {
  to: string;
  subject: string;
  bodyText: string;
  bodyHtml: string;
};

export async function sendEmail(ses: SESClient, input: EmailInput): Promise<void> {
  const fromAddress = mustGetEnv("SES_FROM_ADDRESS");

  // ── LocalStack mock ───────────────────────────────────────────────────────
  if (process.env.AWS_ENDPOINT_URL) {
    log.warn(
      { to: input.to, subject: input.subject },
      "LocalStack detected — logging email instead of sending via SES"
    );
    log.info({
      MOCK_EMAIL: {
        from: fromAddress,
        to: input.to,
        subject: input.subject,
        body: input.bodyText
      }
    }, "📧 [MOCK EMAIL]");
    return;
  }

  // ── Real SES ──────────────────────────────────────────────────────────────
  await ses.send(
    new SendEmailCommand({
      Source: fromAddress,
      Destination: { ToAddresses: [input.to] },
      Message: {
        Subject: { Data: input.subject, Charset: "UTF-8" },
        Body: {
          Text: { Data: input.bodyText, Charset: "UTF-8" },
          Html: { Data: input.bodyHtml, Charset: "UTF-8" }
        }
      }
    })
  );
}

function mustGetEnv(name: string): string {
  const v = process.env[name];
  if (!v || v.trim().length === 0) throw new Error(`Missing required env var: ${name}`);
  return v.trim();
}