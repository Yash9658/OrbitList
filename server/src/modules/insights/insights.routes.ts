import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { asyncHandler } from "../../utils/async-handler.js";
import {
  getMySellerInsightsController,
  getSellerInsightsController
} from "./insights.controller.js";
import {
  getMySellerInsightsSchema,
  getSellerInsightsSchema
} from "./insights.schema.js";

export const insightsRouter = Router();

insightsRouter.get(
  "/me",
  requireAuth,
  validate(getMySellerInsightsSchema),
  asyncHandler(getMySellerInsightsController)
);

insightsRouter.get(
  "/seller/:sellerId",
  validate(getSellerInsightsSchema),
  asyncHandler(getSellerInsightsController)
);
