import { Router } from "express";
import { UserRole } from "@prisma/client";
import { requireAuth, requireRole } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { listAuditLogsController } from "./audit.controller.js";
import { listAuditLogsSchema } from "./audit.schema.js";

export const auditRouter = Router();

auditRouter.get(
  "/admin",
  requireAuth,
  requireRole([UserRole.ADMIN]),
  validate(listAuditLogsSchema),
  asyncHandler(listAuditLogsController)
);
