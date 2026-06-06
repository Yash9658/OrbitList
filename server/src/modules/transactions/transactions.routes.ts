import { Router } from "express";
import { UserRole } from "@prisma/client";
import { requireAuth, requireRole } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { asyncHandler } from "../../utils/async-handler.js";
import {
  addDisputeCaseNoteController,
  addDisputeEvidenceController,
  confirmTransactionCheckoutController,
  createTransactionCheckoutController,
  getTransactionController,
  issueBuyerRefundController,
  listAdminDisputesController,
  listTransactionsController,
  openDisputeController,
  releaseSellerPayoutController,
  reviewDisputeController,
  updateTransactionStatusController
} from "./transactions.controller.js";
import {
  addDisputeCaseNoteSchema,
  addDisputeEvidenceSchema,
  confirmTransactionCheckoutSchema,
  createTransactionCheckoutSchema,
  getTransactionSchema,
  issueBuyerRefundSchema,
  listAdminDisputesSchema,
  listTransactionsSchema,
  openDisputeSchema,
  releaseSellerPayoutSchema,
  reviewDisputeSchema,
  updateTransactionStatusSchema
} from "./transactions.schema.js";

export const transactionsRouter = Router();

transactionsRouter.get("/", requireAuth, validate(listTransactionsSchema), asyncHandler(listTransactionsController));

transactionsRouter.get("/:id", requireAuth, validate(getTransactionSchema), asyncHandler(getTransactionController));

transactionsRouter.post(
  "/checkout",
  requireAuth,
  requireRole([UserRole.BUYER, UserRole.BOTH, UserRole.ADMIN]),
  validate(createTransactionCheckoutSchema),
  asyncHandler(createTransactionCheckoutController)
);

transactionsRouter.post(
  "/checkout/confirm",
  requireAuth,
  requireRole([UserRole.BUYER, UserRole.BOTH, UserRole.ADMIN]),
  validate(confirmTransactionCheckoutSchema),
  asyncHandler(confirmTransactionCheckoutController)
);

transactionsRouter.patch(
  "/:id/status",
  requireAuth,
  validate(updateTransactionStatusSchema),
  asyncHandler(updateTransactionStatusController)
);

transactionsRouter.post(
  "/:id/disputes",
  requireAuth,
  validate(openDisputeSchema),
  asyncHandler(openDisputeController)
);

transactionsRouter.post(
  "/disputes/:id/case-notes",
  requireAuth,
  validate(addDisputeCaseNoteSchema),
  asyncHandler(addDisputeCaseNoteController)
);

transactionsRouter.post(
  "/disputes/:id/evidence",
  requireAuth,
  validate(addDisputeEvidenceSchema),
  asyncHandler(addDisputeEvidenceController)
);

transactionsRouter.get(
  "/admin/disputes",
  requireAuth,
  requireRole([UserRole.ADMIN]),
  validate(listAdminDisputesSchema),
  asyncHandler(listAdminDisputesController)
);

transactionsRouter.patch(
  "/admin/disputes/:id",
  requireAuth,
  requireRole([UserRole.ADMIN]),
  validate(reviewDisputeSchema),
  asyncHandler(reviewDisputeController)
);

transactionsRouter.post(
  "/admin/:id/release",
  requireAuth,
  requireRole([UserRole.ADMIN]),
  validate(releaseSellerPayoutSchema),
  asyncHandler(releaseSellerPayoutController)
);

transactionsRouter.post(
  "/admin/:id/refund",
  requireAuth,
  requireRole([UserRole.ADMIN]),
  validate(issueBuyerRefundSchema),
  asyncHandler(issueBuyerRefundController)
);
