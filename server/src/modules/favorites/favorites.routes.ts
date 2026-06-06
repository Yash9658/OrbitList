import { Router } from "express";
import { asyncHandler } from "../../utils/async-handler.js";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import {
  addFavoriteController,
  listFavoritesController,
  removeFavoriteController
} from "./favorites.controller.js";
import { listFavoritesSchema, mutateFavoriteSchema } from "./favorites.schema.js";

export const favoritesRouter = Router();

favoritesRouter.get(
  "/",
  requireAuth,
  validate(listFavoritesSchema),
  asyncHandler(listFavoritesController)
);
favoritesRouter.post(
  "/:listingId",
  requireAuth,
  validate(mutateFavoriteSchema),
  asyncHandler(addFavoriteController)
);
favoritesRouter.delete(
  "/:listingId",
  requireAuth,
  validate(mutateFavoriteSchema),
  asyncHandler(removeFavoriteController)
);
