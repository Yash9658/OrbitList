import { env } from "./env.js";
import { isMonitoringEnabled } from "./monitoring.js";

type ReadinessStatus = "ready" | "warning" | "blocked";

function buildItem(
  key: string,
  status: ReadinessStatus,
  message: string,
  meta?: Record<string, unknown>
) {
  return {
    key,
    status,
    message,
    ...(meta ? { meta } : {})
  };
}

export function getPhase1Readiness() {
  const isProduction = env.NODE_ENV === "production";
  const usingCloudUploads = Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
  const usingLiveEmail = Boolean(env.RESEND_API_KEY);
  const sentryEnabled = isMonitoringEnabled();

  const items = [
    buildItem(
      "auth_cookies",
      !isProduction || env.AUTH_COOKIE_SECURE ? "ready" : "blocked",
      !isProduction || env.AUTH_COOKIE_SECURE
        ? "HTTP-only cookie auth is configured with secure production settings."
        : "AUTH_COOKIE_SECURE must be enabled in production.",
      {
        secure: env.AUTH_COOKIE_SECURE,
        sameSite: env.AUTH_COOKIE_SAME_SITE
      }
    ),
    buildItem(
      "cors",
      env.ALLOWED_CORS_ORIGINS.trim() ? "ready" : "blocked",
      env.ALLOWED_CORS_ORIGINS.trim()
        ? "Allowed frontend origins are configured."
        : "ALLOWED_CORS_ORIGINS is empty."
    ),
    buildItem(
      "uploads",
      usingCloudUploads ? "ready" : isProduction ? "blocked" : "warning",
      usingCloudUploads
        ? "Cloud upload storage is configured through Supabase Storage."
        : isProduction
          ? "Production still lacks Supabase cloud upload credentials."
          : "Local uploads are active for development. Production should use cloud storage.",
      {
        provider: usingCloudUploads ? "supabase" : "local"
      }
    ),
    buildItem(
      "email_delivery",
      usingLiveEmail ? "ready" : isProduction ? "blocked" : "warning",
      usingLiveEmail
        ? "Live email delivery is configured through Resend."
        : isProduction
          ? "Production still lacks RESEND_API_KEY for live email delivery."
          : "Demo outbox mode is active for development. Production should use live email delivery.",
      {
        provider: usingLiveEmail ? "resend" : "demo_outbox"
      }
    ),
    buildItem(
      "monitoring",
      sentryEnabled ? "ready" : "warning",
      sentryEnabled
        ? "Error monitoring is configured."
        : "Sentry is not configured yet. Production monitoring is still recommended."
    ),
    buildItem(
      "env_separation",
      "ready",
      "Dedicated development, staging, and production environment templates are present."
    )
  ];

  const blocked = items.filter((item) => item.status === "blocked").length;
  const warnings = items.filter((item) => item.status === "warning").length;
  const overallStatus: ReadinessStatus =
    blocked > 0 ? "blocked" : warnings > 0 ? "warning" : "ready";

  return {
    phase: "Phase 1: Launch Safety",
    status: overallStatus,
    summary:
      overallStatus === "ready"
        ? "Launch safety requirements are configured for production."
        : overallStatus === "warning"
          ? "Launch safety is code-complete, but some optional production services are still not configured."
          : "Launch safety is not production-ready yet because required services are missing.",
    items
  };
}
