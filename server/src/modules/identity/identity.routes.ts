import { Router } from "express";
import { UserRole } from "@prisma/client";
import { requireAuth, requireRole } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { asyncHandler } from "../../utils/async-handler.js";
import {
  getMyIdentityVerificationController,
  listPendingIdentityVerificationsController,
  reviewIdentityVerificationController,
  submitIdentityVerificationController
} from "./identity.controller.js";
import {
  getMyIdentityVerificationSchema,
  listPendingIdentityVerificationsSchema,
  reviewIdentityVerificationSchema,
  submitIdentityVerificationSchema
} from "./identity.schema.js";

export const identityRouter = Router();

identityRouter.get(
  "/me",
  requireAuth,
  validate(getMyIdentityVerificationSchema),
  asyncHandler(getMyIdentityVerificationController)
);

identityRouter.post(
  "/me",
  requireAuth,
  validate(submitIdentityVerificationSchema),
  asyncHandler(submitIdentityVerificationController)
);

identityRouter.get(
  "/admin",
  requireAuth,
  requireRole([UserRole.ADMIN]),
  validate(listPendingIdentityVerificationsSchema),
  asyncHandler(listPendingIdentityVerificationsController)
);

identityRouter.patch(
  "/admin/:id",
  requireAuth,
  requireRole([UserRole.ADMIN]),
  validate(reviewIdentityVerificationSchema),
  asyncHandler(reviewIdentityVerificationController)
);
