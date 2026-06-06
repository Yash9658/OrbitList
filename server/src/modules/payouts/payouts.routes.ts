import { Router } from "express";
import { UserRole } from "@prisma/client";
import { requireAuth, requireRole } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { asyncHandler } from "../../utils/async-handler.js";
import {
  createPayoutOnboardingLinkController,
  getMyPayoutAccountController
} from "./payouts.controller.js";
import {
  createPayoutOnboardingLinkSchema,
  getMyPayoutAccountSchema
} from "./payouts.schema.js";

export const payoutsRouter = Router();

payoutsRouter.get(
  "/me",
  requireAuth,
  requireRole([UserRole.SELLER, UserRole.BOTH, UserRole.ADMIN]),
  validate(getMyPayoutAccountSchema),
  asyncHandler(getMyPayoutAccountController)
);

payoutsRouter.post(
  "/onboarding-link",
  requireAuth,
  requireRole([UserRole.SELLER, UserRole.BOTH, UserRole.ADMIN]),
  validate(createPayoutOnboardingLinkSchema),
  asyncHandler(createPayoutOnboardingLinkController)
);
