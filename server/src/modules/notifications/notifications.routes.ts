import { Router } from "express";
import { asyncHandler } from "../../utils/async-handler.js";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import {
  listNotificationsController,
  markAllNotificationsAsReadController,
  markNotificationAsReadController
} from "./notifications.controller.js";
import {
  listNotificationsSchema,
  markAllNotificationsAsReadSchema,
  markNotificationAsReadSchema
} from "./notifications.schema.js";

export const notificationsRouter = Router();

notificationsRouter.get(
  "/",
  requireAuth,
  validate(listNotificationsSchema),
  asyncHandler(listNotificationsController)
);
notificationsRouter.patch(
  "/read-all",
  requireAuth,
  validate(markAllNotificationsAsReadSchema),
  asyncHandler(markAllNotificationsAsReadController)
);
notificationsRouter.patch(
  "/:id/read",
  requireAuth,
  validate(markNotificationAsReadSchema),
  asyncHandler(markNotificationAsReadController)
);
