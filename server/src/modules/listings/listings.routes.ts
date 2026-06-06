import { Router } from "express";
import { UserRole } from "@prisma/client";
import {
  createListing,
  getManagedListing,
  getListingBySlug,
  getListings,
  listListingOptions,
  listModerationQueue,
  listMyListings,
  reviewListing,
  updateListing,
  updateListingStatus
} from "./listings.controller.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { requireAuth, requireRole } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import {
  createListingSchema,
  getManagedListingSchema,
  getListingBySlugSchema,
  listMineSchema,
  listListingsSchema,
  moderationQueueSchema,
  reviewListingSchema,
  updateListingSchema,
  updateListingStatusSchema
} from "./listings.schema.js";

export const listingsRouter = Router();

listingsRouter.get("/", validate(listListingsSchema), asyncHandler(getListings));
listingsRouter.get("/options", asyncHandler(listListingOptions));
listingsRouter.get(
  "/mine",
  requireAuth,
  validate(listMineSchema),
  asyncHandler(listMyListings)
);
listingsRouter.get(
  "/mine/:id",
  requireAuth,
  validate(getManagedListingSchema),
  asyncHandler(getManagedListing)
);
listingsRouter.get(
  "/admin/moderation",
  requireAuth,
  requireRole([UserRole.ADMIN]),
  validate(moderationQueueSchema),
  asyncHandler(listModerationQueue)
);
listingsRouter.patch(
  "/admin/moderation/:id",
  requireAuth,
  requireRole([UserRole.ADMIN]),
  validate(reviewListingSchema),
  asyncHandler(reviewListing)
);
listingsRouter.get(
  "/:slug",
  validate(getListingBySlugSchema),
  asyncHandler(getListingBySlug)
);
listingsRouter.post(
  "/",
  requireAuth,
  requireRole([UserRole.SELLER, UserRole.BOTH, UserRole.ADMIN]),
  validate(createListingSchema),
  asyncHandler(createListing)
);
listingsRouter.patch(
  "/:id",
  requireAuth,
  requireRole([UserRole.SELLER, UserRole.BOTH, UserRole.ADMIN]),
  validate(updateListingSchema),
  asyncHandler(updateListing)
);
listingsRouter.patch(
  "/:id/status",
  requireAuth,
  requireRole([UserRole.SELLER, UserRole.BOTH, UserRole.ADMIN]),
  validate(updateListingStatusSchema),
  asyncHandler(updateListingStatus)
);
