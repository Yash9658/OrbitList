import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import { createRateLimitMiddleware } from "../../middlewares/rate-limit.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { uploadFileController } from "./uploads.controller.js";
import { uploadFileSchema } from "./uploads.schema.js";
import { env } from "../../config/env.js";

export const uploadsRouter = Router();
const uploadRateLimit = createRateLimitMiddleware({
  key: "uploads",
  maxRequests: env.UPLOAD_RATE_LIMIT_MAX,
  windowMs: env.UPLOAD_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
  getIdentifier(request) {
    return request.authUser?.id ?? request.ip ?? "unknown";
  }
});

uploadsRouter.post(
  "/",
  requireAuth,
  uploadRateLimit,
  validate(uploadFileSchema),
  asyncHandler(uploadFileController)
);
