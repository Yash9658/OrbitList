import { Router } from "express";
import { UserRole } from "@prisma/client";
import { requireAuth, requireRole } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { asyncHandler } from "../../utils/async-handler.js";
import {
  createReportController,
  listAdminReportsController,
  listMyReportsController,
  reviewReportController
} from "./reports.controller.js";
import {
  createReportSchema,
  listAdminReportsSchema,
  listMyReportsSchema,
  reviewReportSchema
} from "./reports.schema.js";

export const reportsRouter = Router();

reportsRouter.post("/", requireAuth, validate(createReportSchema), asyncHandler(createReportController));

reportsRouter.get("/mine", requireAuth, validate(listMyReportsSchema), asyncHandler(listMyReportsController));

reportsRouter.get(
  "/admin",
  requireAuth,
  requireRole([UserRole.ADMIN]),
  validate(listAdminReportsSchema),
  asyncHandler(listAdminReportsController)
);

reportsRouter.patch(
  "/admin/:id",
  requireAuth,
  requireRole([UserRole.ADMIN]),
  validate(reviewReportSchema),
  asyncHandler(reviewReportController)
);
