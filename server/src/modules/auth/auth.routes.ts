import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import { createRateLimitMiddleware } from "../../middlewares/rate-limit.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { env } from "../../config/env.js";
import {
  loginController,
  logoutController,
  meController,
  refreshController,
  signupController,
  updatePasswordController,
  updateProfileController,
  updateRoleController
} from "./auth.controller.js";
import {
  emptyAuthSchema,
  loginSchema,
  signupSchema,
  updatePasswordSchema,
  updateProfileSchema,
  updateRoleSchema
} from "./auth.schema.js";

export const authRouter = Router();
const authRateLimit = createRateLimitMiddleware({
  key: "auth",
  maxRequests: env.AUTH_RATE_LIMIT_MAX,
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
  getIdentifier(request) {
    return `${request.ip}:${request.headers["x-forwarded-for"] ?? ""}`;
  }
});

authRouter.post("/signup", authRateLimit, validate(signupSchema), asyncHandler(signupController));
authRouter.post("/login", authRateLimit, validate(loginSchema), asyncHandler(loginController));
authRouter.post("/refresh", authRateLimit, validate(emptyAuthSchema), asyncHandler(refreshController));
authRouter.post("/logout", validate(emptyAuthSchema), asyncHandler(logoutController));
authRouter.get("/me", requireAuth, asyncHandler(meController));
authRouter.patch(
  "/role",
  requireAuth,
  validate(updateRoleSchema),
  asyncHandler(updateRoleController)
);
authRouter.patch(
  "/profile",
  requireAuth,
  validate(updateProfileSchema),
  asyncHandler(updateProfileController)
);
authRouter.patch(
  "/password",
  requireAuth,
  validate(updatePasswordSchema),
  asyncHandler(updatePasswordController)
);
