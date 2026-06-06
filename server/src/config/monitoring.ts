import * as Sentry from "@sentry/node";
import { env } from "./env.js";

let sentryInitialized = false;

export function initMonitoring() {
  if (!env.SENTRY_DSN || sentryInitialized) {
    return;
  }

  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.SENTRY_ENVIRONMENT,
    tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE
  });

  sentryInitialized = true;
}

export function isMonitoringEnabled() {
  return sentryInitialized;
}

export function captureServerError(
  error: Error,
  context: {
    requestId?: string | null;
    path?: string;
    method?: string;
    userId?: string | null;
  }
) {
  if (!sentryInitialized) {
    return;
  }

  Sentry.withScope((scope) => {
    if (context.requestId) {
      scope.setTag("request_id", context.requestId);
    }

    if (context.path) {
      scope.setTag("path", context.path);
    }

    if (context.method) {
      scope.setTag("method", context.method);
    }

    if (context.userId) {
      scope.setUser({ id: context.userId });
    }

    Sentry.captureException(error);
  });
}
