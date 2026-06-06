import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import { createRateLimitMiddleware } from "../../middlewares/rate-limit.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { env } from "../../config/env.js";
import {
  createConversationController,
  getConversationController,
  listConversationsController,
  markConversationReadController,
  sendMessageController
} from "./conversations.controller.js";
import {
  createConversationSchema,
  getConversationSchema,
  listConversationsSchema,
  markConversationReadSchema,
  sendMessageSchema
} from "./conversations.schema.js";

export const conversationsRouter = Router();
const messageRateLimit = createRateLimitMiddleware({
  key: "messages",
  maxRequests: env.MESSAGE_RATE_LIMIT_MAX,
  windowMs: env.MESSAGE_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
  getIdentifier(request) {
    return request.authUser?.id ?? request.ip ?? "unknown";
  }
});

conversationsRouter.get(
  "/",
  requireAuth,
  validate(listConversationsSchema),
  asyncHandler(listConversationsController)
);

conversationsRouter.get(
  "/:id",
  requireAuth,
  validate(getConversationSchema),
  asyncHandler(getConversationController)
);

conversationsRouter.post(
  "/",
  requireAuth,
  messageRateLimit,
  validate(createConversationSchema),
  asyncHandler(createConversationController)
);

conversationsRouter.post(
  "/:id/messages",
  requireAuth,
  messageRateLimit,
  validate(sendMessageSchema),
  asyncHandler(sendMessageController)
);

conversationsRouter.patch(
  "/:id/read",
  requireAuth,
  validate(markConversationReadSchema),
  asyncHandler(markConversationReadController)
);
