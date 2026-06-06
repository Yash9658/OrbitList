import { Router } from "express";
import { UserRole } from "@prisma/client";
import { asyncHandler } from "../../utils/async-handler.js";
import { requireAuth, requireRole } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import {
  listMyVerificationsController,
  listPendingVerificationsController,
  reviewVerificationRequestController,
  submitVerificationRequestController
} from "./verifications.controller.js";
import {
  listMyVerificationsSchema,
  listPendingVerificationsSchema,
  reviewVerificationRequestSchema,
  submitVerificationRequestSchema
} from "./verifications.schema.js";

export const verificationsRouter = Router();

verificationsRouter.get(
  "/mine",
  requireAuth,
  validate(listMyVerificationsSchema),
  asyncHandler(listMyVerificationsController)
);
verificationsRouter.post(
  "/",
  requireAuth,
  requireRole([UserRole.SELLER, UserRole.BOTH, UserRole.ADMIN]),
  validate(submitVerificationRequestSchema),
  asyncHandler(submitVerificationRequestController)
);
verificationsRouter.get(
  "/pending",
  requireAuth,
  requireRole([UserRole.ADMIN]),
  validate(listPendingVerificationsSchema),
  asyncHandler(listPendingVerificationsController)
);
verificationsRouter.patch(
  "/:id/review",
  requireAuth,
  requireRole([UserRole.ADMIN]),
  validate(reviewVerificationRequestSchema),
  asyncHandler(reviewVerificationRequestController)
);
