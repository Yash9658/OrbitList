import { apiRequest } from "../lib/api-client";
import { FavoritesResponse } from "../types/favorite";

export function getFavorites() {
  return apiRequest<FavoritesResponse>("/favorites");
}

export function addFavoriteRequest(listingId: string) {
  return apiRequest<{ listingId: string; createdAt: string }>(`/favorites/${listingId}`, {
    method: "POST"
  });
}

export function removeFavoriteRequest(listingId: string) {
  return apiRequest<{ listingId: string }>(`/favorites/${listingId}`, {
    method: "DELETE"
  });
}
