export type ListingStatus =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "ACTIVE"
  | "SOLD"
  | "REJECTED"
  | "ARCHIVED";

export interface ListingOption {
  id: string;
  name: string;
  slug: string;
}

export interface ListingRecord {
  id: string;
  title: string;
  slug: string;
  handle: string | null;
  description: string | null;
  price: number;
  currency: string;
  status: ListingStatus;
  isFeatured: boolean;
  isVerified: boolean;
  primaryCountry: string | null;
  audienceAgeRange: string | null;
  transferNotes: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  media: Array<{
    id: string;
    type: string;
    fileUrl: string;
    sortOrder: number;
    createdAt: string;
  }>;
  platform: {
    id: string;
    name: string;
    slug: string;
    icon?: string | null;
  };
  niche: {
    id: string;
    name: string;
    slug: string;
  } | null;
  seller: {
    id: string;
    fullName: string | null;
    username: string | null;
    avatarUrl: string | null;
    bio: string | null;
    country: string | null;
    isVerified: boolean;
  };
  metrics: {
    followersCount: number | null;
    engagementRate: number | null;
    monthlyViews: number | null;
    monthlyReach: number | null;
    monetized: boolean;
    verifiedBadge: boolean;
    audienceTopCountry: string | null;
  } | null;
}

export interface MyListingsResponse {
  data: ListingRecord[];
  meta: {
    total: number;
    activeCount: number;
    draftCount: number;
    pendingReviewCount: number;
    rejectedCount: number;
    totalValue: number;
  };
}

export interface ListingOptionsResponse {
  platforms: ListingOption[];
  niches: ListingOption[];
}

export interface ListingsResponse {
  data: ListingRecord[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ListingFilters {
  search?: string;
  platform?: string;
  niche?: string;
  country?: string;
  status?: ListingStatus;
  minPrice?: number;
  maxPrice?: number;
  minFollowers?: number;
  verified?: boolean;
  monetized?: boolean;
  featured?: boolean;
  sortBy?: "newest" | "price_asc" | "price_desc" | "followers_desc" | "engagement_desc";
  page?: number;
  limit?: number;
}

export interface ModerationQueueResponse {
  data: ListingRecord[];
  meta: {
    total: number;
    pendingCount: number;
    rejectedCount: number;
  };
}
