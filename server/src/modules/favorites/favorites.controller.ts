import { Request, Response } from "express";
import {
  addFavorite as addFavoriteRecord,
  listFavorites as listFavoritesRecords,
  removeFavorite as removeFavoriteRecord
} from "./favorites.service.js";

export async function listFavoritesController(
  request: Request,
  response: Response
) {
  const data = await listFavoritesRecords(request.authUser!.id);

  response.json({
    success: true,
    ...data
  });
}

export async function addFavoriteController(
  request: Request,
  response: Response
) {
  const data = await addFavoriteRecord(
    request.authUser!.id,
    String(response.locals.validated.params.listingId)
  );

  response.status(201).json({
    success: true,
    data
  });
}

export async function removeFavoriteController(
  request: Request,
  response: Response
) {
  const data = await removeFavoriteRecord(
    request.authUser!.id,
    String(response.locals.validated.params.listingId)
  );

  response.json({
    success: true,
    data
  });
}
