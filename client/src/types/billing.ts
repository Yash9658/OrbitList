export interface BillingPlan {
  id: string;
  name: string;
  slug: string;
  priceMonthly: number;
  listingLimit: number;
  featuredSlots: number;
  supportLevel: string | null;
  isActive: boolean;
  isFree: boolean;
}

export interface BillingSummary {
  currentPlan: BillingPlan;
  subscription: {
    id: string;
    status: string;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
  } | null;
  usage: {
    totalListings: number;
    activeListings: number;
    featuredListings: number;
    listingLimit: number;
    featuredSlots: number;
    remainingListingSlots: number;
    remainingFeaturedSlots: number;
    canCreateListing: boolean;
    canFeatureMore: boolean;
  };
  stripeConfigured: boolean;
  featuredListingPriceUsd: number;
}

export interface BillingPaymentRecord {
  id: string;
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
  amount: number;
  currency: string;
  type: "SUBSCRIPTION" | "FEATURED_LISTING" | "ESCROW";
  status: "PENDING" | "SUCCEEDED" | "FAILED" | "REFUNDED";
  createdAt: string;
  user: {
    id: string;
    email: string;
    fullName: string | null;
  };
  plan: {
    id: string;
    name: string;
    slug: string;
    priceMonthly: number;
  } | null;
  listing: {
    id: string;
    title: string;
    slug: string;
    isFeatured: boolean;
  } | null;
}

export interface BillingHistoryResponse {
  summary: BillingSummary;
  payments: BillingPaymentRecord[];
}

export interface CheckoutSessionResponse {
  sessionId: string;
  url: string;
  mode: "live" | "demo";
}

export interface CheckoutConfirmationResponse {
  message: string;
  summary: BillingSummary;
  payment: BillingPaymentRecord;
  subscription?: {
    id: string;
    status: string;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
  };
  listing?: {
    id: string;
    title: string;
    slug: string;
    isFeatured: boolean;
  } | null;
}

export interface AdminPaymentsResponse {
  items: BillingPaymentRecord[];
  meta: {
    total: number;
    totalRevenue: number;
  };
}
