import { ListingRecord } from "./listing";

export interface FavoriteListingRecord extends ListingRecord {
  favoritedAt: string;
}

export interface FavoritesResponse {
  data: FavoriteListingRecord[];
  meta: {
    total: number;
    listingIds: string[];
  };
}
