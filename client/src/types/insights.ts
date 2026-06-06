import { IdentityVerificationStatus } from "./identity";

export interface SellerInsightsRecord {
  sellerId: string;
  reputationScore: number;
  sellerTier: string;
  identityStatus: IdentityVerificationStatus;
  protectedTransferReady: boolean;
  identityReviewedAt: string | null;
  memberSince: string;
  marketplaceTenureDays: number;
  totalListings: number;
  liveListings: number;
  featuredListings: number;
  archivedListings: number;
  verifiedListings: number;
  favoritesCount: number;
  averageFavoritesPerListing: number;
  totalTransactions: number;
  completedDeals: number;
  completedDealsLast30Days: number;
  firstCompletedDealAt: string | null;
  lastCompletedDealAt: string | null;
  completionRate: number;
  disputedTransactions: number;
  disputeRate: number;
  activeTransactions: number;
  fundedTransactions: number;
  handoffSubmittedTransactions: number;
  totalTransactionVolume: number;
  completedVolumeLast30Days: number;
  averageListingPrice: number;
  averageDealSize: number;
  totalListingValue: number;
}
