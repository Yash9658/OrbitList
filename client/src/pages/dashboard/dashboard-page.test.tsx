import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DashboardPage } from "./dashboard-page";
import { renderWithProviders } from "../../test/test-utils";

const {
  getMyListings,
  getBillingHistory,
  getMyIdentityVerification,
  getMySellerInsights
} = vi.hoisted(() => ({
  getMyListings: vi.fn().mockResolvedValue({
    data: [],
    meta: {
      total: 4,
      activeCount: 2,
      draftCount: 1,
      pendingReviewCount: 1,
      rejectedCount: 0,
      totalValue: 8200
    }
  }),
  getBillingHistory: vi.fn().mockResolvedValue({
    summary: {
      currentPlan: { name: "Studio" },
      usage: {
        totalListings: 4,
        listingLimit: 15,
        remainingFeaturedSlots: 2,
        canFeatureMore: true
      },
      stripeConfigured: false,
      featuredListingPriceUsd: 19
    },
    payments: []
  }),
  getMyIdentityVerification: vi.fn().mockResolvedValue({
    id: "identity-1",
    userId: "seller-1",
    status: "APPROVED"
  }),
  getMySellerInsights: vi.fn().mockResolvedValue({
    sellerId: "seller-1",
    reputationScore: 91,
    sellerTier: "Elite",
    identityStatus: "APPROVED",
    protectedTransferReady: true,
    identityReviewedAt: new Date().toISOString(),
    memberSince: new Date("2025-01-01").toISOString(),
    marketplaceTenureDays: 120,
    totalListings: 4,
    liveListings: 2,
    featuredListings: 1,
    archivedListings: 0,
    verifiedListings: 2,
    favoritesCount: 18,
    averageFavoritesPerListing: 4.5,
    totalTransactions: 6,
    completedDeals: 5,
    completedDealsLast30Days: 2,
    firstCompletedDealAt: new Date("2025-02-10").toISOString(),
    lastCompletedDealAt: new Date("2026-03-10").toISOString(),
    completionRate: 83.3,
    disputedTransactions: 1,
    disputeRate: 16.7,
    activeTransactions: 1,
    fundedTransactions: 1,
    handoffSubmittedTransactions: 0,
    totalTransactionVolume: 12000,
    completedVolumeLast30Days: 3000,
    averageListingPrice: 2050,
    averageDealSize: 2400,
    totalListingValue: 8200
  })
}));

vi.mock("../../app/providers/auth-provider", () => ({
  useAuth: () => ({
    user: {
      id: "seller-1",
      email: "seller@orbitlist.dev",
      fullName: "Orbit Seller",
      username: "orbitseller",
      avatarUrl: null,
      bio: "Long enough seller bio to pass onboarding checks for the test suite.",
      role: "SELLER",
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
  getMyListings,
  updateListingRequest: vi.fn(),
  updateListingStatusRequest: vi.fn()
}));

vi.mock("../../services/billing.service", () => ({
  getBillingHistory,
  createFeaturedCheckoutRequest: vi.fn()
}));

vi.mock("../../services/identity.service", () => ({
  getMyIdentityVerification
}));

vi.mock("../../services/insights.service", () => ({
  getMySellerInsights
}));

describe("DashboardPage", () => {
  it("renders seller analytics and protected transfer readiness", async () => {
    renderWithProviders(<DashboardPage />, {
      route: "/dashboard"
    });

    expect(await screen.findByText("Seller readiness")).toBeInTheDocument();
    expect(screen.getByText("Completion")).toBeInTheDocument();
    expect(await screen.findByText("83.3%")).toBeInTheDocument();
    expect(await screen.findByText("$12,000 protected volume")).toBeInTheDocument();
  });
});
