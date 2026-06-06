import { Router } from "express";
import { UserRole } from "@prisma/client";
import { requireAuth, requireRole } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { asyncHandler } from "../../utils/async-handler.js";
import {
  adminPaymentsController,
  billingHistoryController,
  billingSummaryController,
  confirmCheckoutController,
  createFeaturedCheckoutController,
  createSubscriptionCheckoutController,
  listPlansController
} from "./billing.controller.js";
import {
  adminPaymentsSchema,
  billingHistorySchema,
  billingSummarySchema,
  confirmCheckoutSchema,
  createFeaturedCheckoutSchema,
  createSubscriptionCheckoutSchema,
  listPlansSchema
} from "./billing.schema.js";

export const billingRouter = Router();

billingRouter.get("/plans", validate(listPlansSchema), asyncHandler(listPlansController));

billingRouter.get(
  "/summary",
  requireAuth,
  validate(billingSummarySchema),
  asyncHandler(billingSummaryController)
);

billingRouter.get(
  "/history",
  requireAuth,
  validate(billingHistorySchema),
  asyncHandler(billingHistoryController)
);

billingRouter.post(
  "/checkout/subscription",
  requireAuth,
  requireRole([UserRole.SELLER, UserRole.BOTH, UserRole.ADMIN]),
  validate(createSubscriptionCheckoutSchema),
  asyncHandler(createSubscriptionCheckoutController)
);

billingRouter.post(
  "/checkout/featured",
  requireAuth,
  requireRole([UserRole.SELLER, UserRole.BOTH, UserRole.ADMIN]),
  validate(createFeaturedCheckoutSchema),
  asyncHandler(createFeaturedCheckoutController)
);

billingRouter.post(
  "/checkout/confirm",
  requireAuth,
  validate(confirmCheckoutSchema),
  asyncHandler(confirmCheckoutController)
);

billingRouter.get(
  "/admin/payments",
  requireAuth,
  requireRole([UserRole.ADMIN]),
  validate(adminPaymentsSchema),
  asyncHandler(adminPaymentsController)
);
