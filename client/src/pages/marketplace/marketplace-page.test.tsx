import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MarketplacePage } from "./marketplace-page";
import { renderWithProviders } from "../../test/test-utils";

const { getListings, getListingOptions, getFavorites } = vi.hoisted(() => ({
  getListings: vi.fn().mockResolvedValue({
    data: [
      {
        id: "listing-1",
        title: "Creator Asset",
        slug: "creator-asset",
        handle: "@creator",
        description: "Prepared listing.",
        price: 1200,
        currency: "USD",
        status: "ACTIVE",
        isFeatured: false,
        isVerified: true,
        primaryCountry: "United States",
        audienceAgeRange: "18-24",
        transferNotes: null,
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
          bio: null,
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
      }
    ],
    meta: {
      total: 1,
      page: 1,
      limit: 24,
      totalPages: 1
    }
  }),
  getListingOptions: vi.fn().mockResolvedValue({
    platforms: [
      {
        id: "platform-1",
        name: "Instagram",
        slug: "instagram"
      }
    ],
    niches: [
      {
        id: "niche-1",
        name: "Lifestyle",
        slug: "lifestyle"
      }
    ]
  }),
  getFavorites: vi.fn().mockResolvedValue({
    data: []
  })
}));

vi.mock("../../app/providers/auth-provider", () => ({
  useAuth: () => ({
    isAuthenticated: true
  })
}));

vi.mock("../../services/listing.service", () => ({
  getListings,
  getListingOptions
}));

vi.mock("../../services/favorites.service", () => ({
  getFavorites,
  addFavoriteRequest: vi.fn(),
  removeFavoriteRequest: vi.fn()
}));

describe("MarketplacePage", () => {
  it("renders without crashing when favorites metadata is missing", async () => {
    renderWithProviders(<MarketplacePage />, {
      route: "/marketplace"
    });

    expect(
      await screen.findByText("Browse social assets with enough context to make fast decisions.")
    ).toBeInTheDocument();
    expect(await screen.findByText("1 listings match your current view.")).toBeInTheDocument();
    expect(await screen.findByText("Creator Asset")).toBeInTheDocument();
  });
});
