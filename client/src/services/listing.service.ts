import { apiRequest } from "../lib/api-client";
import {
  ListingFilters,
  ListingStatus,
  ListingOptionsResponse,
  ListingRecord,
  ListingsResponse,
  ModerationQueueResponse,
  MyListingsResponse
} from "../types/listing";

export function getMyListings() {
  return apiRequest<MyListingsResponse>("/listings/mine");
}

export function getManagedListing(id: string) {
  return apiRequest<ListingRecord>(`/listings/mine/${id}`);
}

export function getListings(filters: ListingFilters = {}) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }

    searchParams.set(key, String(value));
  }

  const query = searchParams.toString();
  return apiRequest<ListingsResponse>(`/listings${query ? `?${query}` : ""}`);
}

export function getListingOptions() {
  return apiRequest<ListingOptionsResponse>("/listings/options");
}

export function getListingBySlug(slug: string) {
  return apiRequest<ListingRecord>(`/listings/${slug}`);
}

export function createListingRequest(input: {
  platformSlug: string;
  nicheSlug?: string | null;
  title: string;
  handle?: string | null;
  description?: string | null;
  price: number;
  currency: string;
  status: "DRAFT" | "ACTIVE";
  isFeatured: boolean;
  isVerified: boolean;
  primaryCountry?: string | null;
  audienceAgeRange?: string | null;
  transferNotes?: string | null;
  metrics?: {
    followersCount?: number;
    engagementRate?: number;
    monthlyViews?: number;
    monthlyReach?: number;
    monetized?: boolean;
    verifiedBadge?: boolean;
    audienceTopCountry?: string;
  };
  media?: Array<{
    type: string;
    fileUrl: string;
    sortOrder: number;
  }>;
}) {
  return apiRequest<ListingRecord>("/listings", {
    method: "POST",
    body: input
  });
}

export function updateListingRequest(
  id: string,
  input: {
    platformSlug?: string;
    nicheSlug?: string | null;
    title?: string;
    handle?: string | null;
    description?: string | null;
    price?: number;
    currency?: string;
    isFeatured?: boolean;
    isVerified?: boolean;
    primaryCountry?: string | null;
    audienceAgeRange?: string | null;
    transferNotes?: string | null;
    metrics?: {
      followersCount?: number;
      engagementRate?: number;
      monthlyViews?: number;
      monthlyReach?: number;
      monetized?: boolean;
      verifiedBadge?: boolean;
      audienceTopCountry?: string;
    };
    media?: Array<{
      type: string;
      fileUrl: string;
      sortOrder: number;
    }>;
  }
) {
  return apiRequest<ListingRecord>(`/listings/${id}`, {
    method: "PATCH",
    body: input
  });
}

export function updateListingStatusRequest(
  id: string,
  status: Extract<ListingStatus, "DRAFT" | "ACTIVE" | "ARCHIVED">
) {
  return apiRequest<ListingRecord>(`/listings/${id}/status`, {
    method: "PATCH",
    body: { status }
  });
}

export function getModerationQueueRequest() {
  return apiRequest<ModerationQueueResponse>("/listings/admin/moderation");
}

export function reviewListingModerationRequest(input: {
  id: string;
  status: Extract<ListingStatus, "ACTIVE" | "REJECTED">;
  notes?: string;
}) {
  return apiRequest<ListingRecord>(`/listings/admin/moderation/${input.id}`, {
    method: "PATCH",
    body: {
      status: input.status,
      notes: input.notes
    }
  });
}
