import path from "node:path";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "../config/env.js";
import { stripeWebhookController } from "../modules/billing/billing.controller.js";
import { errorMiddleware } from "../middlewares/error.middleware.js";
import { requestContextMiddleware } from "../middlewares/request-context.middleware.js";
import { asyncHandler } from "../utils/async-handler.js";
import { apiRouter } from "./routes.js";

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);
  const allowedOrigins = env.ALLOWED_CORS_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.use(
    helmet({
      crossOriginResourcePolicy: false,
      contentSecurityPolicy: false
    })
  );

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }

        callback(new Error("Origin is not allowed by CORS"));
      },
      credentials: true
    })
  );
  app.use(requestContextMiddleware);
  app.post(
    "/api/billing/webhooks/stripe",
    express.raw({ type: "application/json" }),
    asyncHandler(stripeWebhookController)
  );
  app.use(express.json({ limit: `${env.JSON_BODY_LIMIT_MB}mb` }));
  app.use("/uploads", express.static(path.resolve(process.cwd(), "server", "uploads")));

  app.get("/", (_request, response) => {
    response.json({
      success: true,
      message: "Social Profile Marketplace server is live"
    });
  });

  app.use("/api", apiRouter);
  app.use(errorMiddleware);

  return app;
}
