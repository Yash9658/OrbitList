import { Router } from "express";
import { getPhase1Readiness } from "../../config/phase1-readiness.js";
import { isMonitoringEnabled } from "../../config/monitoring.js";

export const healthRouter = Router();

healthRouter.get("/", (request, response) => {
  const phase1Readiness = getPhase1Readiness();

  response.json({
    success: true,
    message: "Marketplace API is running",
    data: {
      status: "ok",
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      requestId: request.requestId ?? null,
      environment: process.env.NODE_ENV ?? "development",
      monitoring: {
        sentryEnabled: isMonitoringEnabled()
      },
      phase1Readiness
    }
  });
});

healthRouter.get("/readiness/phase-1", (_request, response) => {
  const readiness = getPhase1Readiness();
  const statusCode = readiness.status === "blocked" ? 503 : 200;

  response.status(statusCode).json({
    success: readiness.status !== "blocked",
    message: readiness.summary,
    data: readiness
  });
});
