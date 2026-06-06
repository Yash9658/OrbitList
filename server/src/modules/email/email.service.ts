import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "../../config/env.js";
import { prisma } from "../../config/prisma.js";

type EmailTemplateInput = {
  userId: string;
  subject: string;
  heading: string;
  bodyLines: string[];
  ctaLabel?: string;
  ctaUrl?: string;
  category?: "messages" | "marketplace" | "transactions" | "trust" | "billing";
};

type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

type EmailOutboxRecord = {
  mode: "demo" | "pending_retry" | "delivered_retry" | "failed_retry";
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  createdAt: string;
  attemptCount?: number;
  lastAttemptAt?: string;
  lastError?: string;
  deliveredAt?: string;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildEmailHtml(input: {
  recipientName: string;
  heading: string;
  bodyLines: string[];
  ctaLabel?: string;
  ctaUrl?: string;
}) {
  const paragraphs = input.bodyLines
    .map(
      (line) =>
        `<p style="margin:0 0 14px;color:#314155;font-size:15px;line-height:1.7;">${escapeHtml(line)}</p>`
    )
    .join("");

  const cta =
    input.ctaLabel && input.ctaUrl
      ? `<a href="${input.ctaUrl}" style="display:inline-block;margin-top:10px;padding:12px 18px;border-radius:999px;background:#e96824;color:#fff7ef;text-decoration:none;font-weight:700;">${escapeHtml(input.ctaLabel)}</a>`
      : "";

  return `
    <div style="margin:0;padding:32px;background:#f3efe8;font-family:Georgia,'Times New Roman',serif;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:24px;padding:36px;border:1px solid #eadfce;">
        <p style="margin:0 0 10px;color:#e96824;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;">Orbitlist</p>
        <h1 style="margin:0 0 18px;color:#0f1724;font-size:30px;line-height:1.2;">${escapeHtml(input.heading)}</h1>
        <p style="margin:0 0 18px;color:#314155;font-size:15px;line-height:1.7;">Hi ${escapeHtml(input.recipientName)},</p>
        ${paragraphs}
        ${cta}
      </div>
    </div>
  `;
}

function buildEmailText(input: {
  recipientName: string;
  heading: string;
  bodyLines: string[];
  ctaLabel?: string;
  ctaUrl?: string;
}) {
  return [
    "Orbitlist",
    "",
    input.heading,
    "",
    `Hi ${input.recipientName},`,
    "",
    ...input.bodyLines,
    ...(input.ctaLabel && input.ctaUrl ? ["", `${input.ctaLabel}: ${input.ctaUrl}`] : [])
  ].join("\n");
}

function getOutboxDir() {
  return path.resolve(process.cwd(), env.EMAIL_OUTBOX_DIR);
}

function buildOutboxFileName(recipient: string) {
  const safeRecipient = recipient.replace(/[^a-z0-9@._-]/gi, "_");
  return `${Date.now()}-${safeRecipient}.json`;
}

async function writeOutboxRecord(
  record: EmailOutboxRecord,
  customFileName = buildOutboxFileName(record.to)
) {
  const outboxDir = getOutboxDir();
  await mkdir(outboxDir, { recursive: true });

  const filePath = path.join(outboxDir, customFileName);
  await writeFile(filePath, JSON.stringify(record, null, 2), "utf8");

  return filePath;
}

async function writeToDemoOutbox(input: SendEmailInput) {
  await writeOutboxRecord({
    mode: "demo",
    from: env.EMAIL_FROM_ADDRESS,
    ...input,
    createdAt: new Date().toISOString()
  });
}

async function queueRetryEmail(input: SendEmailInput, errorMessage: string, attemptCount = 1) {
  await writeOutboxRecord({
    mode: attemptCount >= env.EMAIL_RETRY_MAX_ATTEMPTS ? "failed_retry" : "pending_retry",
    from: env.EMAIL_FROM_ADDRESS,
    ...input,
    createdAt: new Date().toISOString(),
    attemptCount,
    lastAttemptAt: new Date().toISOString(),
    lastError: errorMessage
  });
}

async function sendViaResend(input: SendEmailInput) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM_ADDRESS,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text
    })
  });

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(`Email delivery failed with status ${response.status}: ${payload}`);
  }
}

async function deliverEmail(input: SendEmailInput) {
  if (!env.RESEND_API_KEY) {
    await writeToDemoOutbox(input);
    return { mode: "demo" as const };
  }

  try {
    await sendViaResend(input);
    return { mode: "resend" as const };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown email delivery error";
    await queueRetryEmail(input, errorMessage);

    return {
      mode: "queued_retry" as const,
      errorMessage
    };
  }
}

function isEmailPreferenceEnabled(
  category: NonNullable<EmailTemplateInput["category"]> | undefined,
  user: {
    prefEmailMessages: boolean;
    prefEmailMarketplace: boolean;
    prefEmailTransactions: boolean;
    prefEmailTrust: boolean;
    prefEmailBilling: boolean;
  }
) {
  switch (category) {
    case "messages":
      return user.prefEmailMessages;
    case "marketplace":
      return user.prefEmailMarketplace;
    case "transactions":
      return user.prefEmailTransactions;
    case "trust":
      return user.prefEmailTrust;
    case "billing":
      return user.prefEmailBilling;
    default:
      return true;
  }
}

export async function retryPendingEmailDeliveries() {
  if (!env.RESEND_API_KEY) {
    return {
      attempted: 0,
      delivered: 0,
      stillPending: 0,
      failed: 0,
      skipped: true
    };
  }

  const outboxDir = getOutboxDir();

  await mkdir(outboxDir, { recursive: true });
  const fileNames = (await readdir(outboxDir)).filter((fileName) => fileName.endsWith(".json"));

  let attempted = 0;
  let delivered = 0;
  let stillPending = 0;
  let failed = 0;

  for (const fileName of fileNames) {
    const filePath = path.join(outboxDir, fileName);
    const fileContents = await readFile(filePath, "utf8");
    const record = JSON.parse(fileContents) as EmailOutboxRecord;

    if (record.mode !== "pending_retry" && record.mode !== "failed_retry") {
      continue;
    }

    attempted += 1;
    const nextAttemptCount = (record.attemptCount ?? 0) + 1;

    try {
      await sendViaResend({
        to: record.to,
        subject: record.subject,
        html: record.html,
        text: record.text
      });

      delivered += 1;
      await writeOutboxRecord(
        {
          ...record,
          mode: "delivered_retry",
          attemptCount: nextAttemptCount,
          lastAttemptAt: new Date().toISOString(),
          deliveredAt: new Date().toISOString(),
          lastError: undefined
        },
        fileName
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown email delivery error";
      const nextMode =
        nextAttemptCount >= env.EMAIL_RETRY_MAX_ATTEMPTS ? "failed_retry" : "pending_retry";

      if (nextMode === "failed_retry") {
        failed += 1;
      } else {
        stillPending += 1;
      }

      await writeOutboxRecord(
        {
          ...record,
          mode: nextMode,
          attemptCount: nextAttemptCount,
          lastAttemptAt: new Date().toISOString(),
          lastError: errorMessage
        },
        fileName
      );
    }
  }

  return {
    attempted,
    delivered,
    stillPending,
    failed,
    skipped: false
  };
}

export async function sendEmailToUser(input: EmailTemplateInput) {
  const user = await prisma.user.findUnique({
    where: {
      id: input.userId
    },
    select: {
      email: true,
      fullName: true,
      username: true,
      prefEmailMessages: true,
      prefEmailMarketplace: true,
      prefEmailTransactions: true,
      prefEmailTrust: true,
      prefEmailBilling: true
    }
  });

  if (!user?.email) {
    return { skipped: true as const, reason: "User email not found" };
  }

  if (!isEmailPreferenceEnabled(input.category, user)) {
    return { skipped: true as const, reason: "Email category disabled by user preference" };
  }

  const recipientName = user.fullName ?? user.username ?? user.email;
  const html = buildEmailHtml({
    recipientName,
    heading: input.heading,
    bodyLines: input.bodyLines,
    ctaLabel: input.ctaLabel,
    ctaUrl: input.ctaUrl
  });
  const text = buildEmailText({
    recipientName,
    heading: input.heading,
    bodyLines: input.bodyLines,
    ctaLabel: input.ctaLabel,
    ctaUrl: input.ctaUrl
  });

  return deliverEmail({
    to: user.email,
    subject: input.subject,
    html,
    text
  });
}
