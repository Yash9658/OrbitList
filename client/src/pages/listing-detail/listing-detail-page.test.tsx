import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ListingDetailPage } from "./listing-detail-page";
import { renderWithProviders } from "../../test/test-utils";

const {
  mockNavigate,
  getListingBySlug,
  getFavorites,
  getMyIdentityVerification,
  getSellerInsightsBySellerId
} = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  getListingBySlug: vi.fn().mockResolvedValue({
    id: "listing-1",
    title: "Creator Page",
    slug: "creator-page",
    handle: "@creator",
    description: "Growth-ready creator asset.",
    price: 1200,
    currency: "USD",
    status: "ACTIVE",
    isFeatured: false,
    isVerified: true,
    primaryCountry: "United States",
    audienceAgeRange: "18-24",
    transferNotes: "Warm handoff included.",
    publishedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    media: [],
    platform: {
      id: "platform-1",
      name: "Instagram",
      slug: "instagram"
    },
    niche: {
      id: "niche-1",
      name: "Lifestyle",
      slug: "lifestyle"
    },
    seller: {
      id: "seller-1",
      fullName: "Trusted Seller",
      username: "trustedseller",
      avatarUrl: null,
      bio: "Built several audience-first digital assets and supports clean handoffs.",
      country: "United States",
      isVerified: true
    },
    metrics: {
      followersCount: 42000,
      engagementRate: 3.2,
      monthlyViews: 120000,
      monthlyReach: 250000,
      monetized: true,
      verifiedBadge: false,
      audienceTopCountry: "United States"
    }
  }),
  getFavorites: vi.fn().mockResolvedValue({
    data: [],
    meta: {
      total: 0,
      listingIds: []
    }
  }),
  getMyIdentityVerification: vi.fn().mockResolvedValue({
    id: "identity-1",
    userId: "buyer-1",
    status: "APPROVED"
  }),
  getSellerInsightsBySellerId: vi.fn().mockResolvedValue({
    sellerId: "seller-1",
    reputationScore: 85,
    sellerTier: "Trusted",
    identityStatus: "PENDING",
    protectedTransferReady: false,
    identityReviewedAt: null,
    memberSince: new Date("2025-03-01").toISOString(),
    marketplaceTenureDays: 90,
    totalListings: 3,
    liveListings: 2,
    featuredListings: 1,
    archivedListings: 0,
    verifiedListings: 2,
    favoritesCount: 18,
    averageFavoritesPerListing: 6,
    totalTransactions: 4,
    completedDeals: 3,
    completedDealsLast30Days: 1,
    firstCompletedDealAt: new Date("2025-04-15").toISOString(),
    lastCompletedDealAt: new Date("2026-03-22").toISOString(),
    completionRate: 75,
    disputedTransactions: 1,
    disputeRate: 25,
    activeTransactions: 1,
    fundedTransactions: 1,
    handoffSubmittedTransactions: 0,
    totalTransactionVolume: 5200,
    completedVolumeLast30Days: 1800,
    averageListingPrice: 1400,
    averageDealSize: 1733,
    totalListingValue: 4200
  })
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useParams: () => ({ slug: "creator-page" }),
    useNavigate: () => mockNavigate
  };
});

vi.mock("../../app/providers/auth-provider", () => ({
  useAuth: () => ({
    isAuthenticated: true,
    user: {
      id: "buyer-1",
      email: "buyer@orbitlist.dev",
      fullName: "Orbit Buyer",
      username: "orbitbuyer",
      avatarUrl: null,
      bio: null,
      role: "BUYER",
      country: "India",
      isVerified: true,
      notificationPreferences: {
        inAppMessages: true,
        inAppMarketplace: true,
        inAppTransactions: true,
        inAppTrust: true,
        emailMessages: true,
        emailMarketplace: true,
        emailTransactions: true,
        emailTrust: true,
        emailBilling: true
      },
      createdAt: new Date().toISOString()
    }
  })
}));

vi.mock("../../services/listing.service", () => ({
  getListingBySlug
}));
vi.mock("../../services/favorites.service", () => ({
  getFavorites,
  addFavoriteRequest: vi.fn(),
  removeFavoriteRequest: vi.fn()
}));
vi.mock("../../services/identity.service", () => ({
  getMyIdentityVerification
}));
vi.mock("../../services/insights.service", () => ({
  getSellerInsightsBySellerId
}));
vi.mock("../../services/conversation.service", () => ({
  createConversationRequest: vi.fn()
}));
vi.mock("../../services/transaction.service", () => ({
  createProtectedTransactionCheckout: vi.fn()
}));
vi.mock("../../services/reports.service", () => ({
  createReportRequest: vi.fn()
}));

describe("ListingDetailPage", () => {
  it("shows seller trust metrics and blocks protected deal when seller is not payout ready", async () => {
    renderWithProviders(<ListingDetailPage />, {
      route: "/listing/creator-page"
    });

    expect(await screen.findByText("Creator Page")).toBeInTheDocument();
    expect(await screen.findByText("85/100")).toBeInTheDocument();
    expect(
      screen.getByText("The seller is not yet approved for protected money-movement workflows.")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start protected deal" })).toBeDisabled();
  });
});
