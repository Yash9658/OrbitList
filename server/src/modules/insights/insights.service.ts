import { ListingStatus } from "@prisma/client";
import { prisma } from "../../config/prisma.js";

export async function getSellerInsights(sellerId: string) {
  const [
    seller,
    listings,
    favoritesCount,
    totalTransactions,
    completedTransactions,
    disputedTransactions,
    activeTransactions,
    fundedTransactions,
    handoffSubmittedTransactions,
    identityVerification
  ] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: {
        id: sellerId
      },
      select: {
        createdAt: true
      }
    }),
    prisma.listing.findMany({
      where: {
        sellerId
      },
      select: {
        id: true,
        status: true,
        isFeatured: true,
        isVerified: true,
        price: true
      }
    }),
    prisma.favorite.count({
      where: {
        listing: {
          sellerId
        }
      }
    }),
    prisma.transaction.count({
      where: {
        sellerId
      }
    }),
    prisma.transaction.findMany({
      where: {
        sellerId,
        status: "COMPLETED"
      },
      select: {
        agreedPrice: true,
        completedAt: true
      }
    }),
    prisma.transaction.count({
      where: {
        sellerId,
        status: "DISPUTED"
      }
    }),
    prisma.transaction.count({
      where: {
        sellerId,
        status: {
          in: ["FUNDS_SECURED", "HANDOFF_SUBMITTED", "BUYER_REVIEW"]
        }
      }
    }),
    prisma.transaction.count({
      where: {
        sellerId,
        status: "FUNDS_SECURED"
      }
    }),
    prisma.transaction.count({
      where: {
        sellerId,
        status: "HANDOFF_SUBMITTED"
      }
    }),
    prisma.identityVerification.findUnique({
      where: {
        userId: sellerId
      },
      select: {
        status: true,
        reviewedAt: true
      }
    })
  ]);

  const totalListings = listings.length;
  const liveListings = listings.filter((item) => item.status === ListingStatus.ACTIVE).length;
  const featuredListings = listings.filter((item) => item.isFeatured).length;
  const verifiedListings = listings.filter((item) => item.isVerified).length;
  const completedDeals = completedTransactions.length;
  const archivedListings = listings.filter((item) => item.status === ListingStatus.ARCHIVED).length;
  const totalTransactionVolume = completedTransactions.reduce(
    (sum, item) => sum + Number(item.agreedPrice),
    0
  );
  const totalListingValue = listings.reduce((sum, item) => sum + Number(item.price), 0);
  const averageListingPrice =
    totalListings > 0
      ? totalListingValue / totalListings
      : 0;
  const completedDealsLast30Days = completedTransactions.filter((item) => {
    if (!item.completedAt) {
      return false;
    }

    return item.completedAt.getTime() >= Date.now() - 30 * 24 * 60 * 60 * 1000;
  }).length;
  const completedVolumeLast30Days = completedTransactions.reduce((sum, item) => {
    if (!item.completedAt) {
      return sum;
    }

    return item.completedAt.getTime() >= Date.now() - 30 * 24 * 60 * 60 * 1000
      ? sum + Number(item.agreedPrice)
      : sum;
  }, 0);
  const completionRate =
    totalTransactions > 0 ? Number(((completedDeals / totalTransactions) * 100).toFixed(1)) : 0;
  const disputeRate =
    totalTransactions > 0
      ? Number(((disputedTransactions / totalTransactions) * 100).toFixed(1))
      : 0;
  const averageDealSize =
    completedDeals > 0 ? totalTransactionVolume / completedDeals : 0;
  const averageFavoritesPerListing =
    totalListings > 0 ? Number((favoritesCount / totalListings).toFixed(1)) : 0;
  const reputationScore = Math.max(
    0,
    Math.min(
      100,
      40 +
        verifiedListings * 8 +
        completedDeals * 10 +
        Math.min(favoritesCount, 50) -
        disputedTransactions * 12
    )
  );
  const sellerTier =
    reputationScore >= 85
      ? "Elite"
      : reputationScore >= 70
        ? "Trusted"
        : reputationScore >= 55
          ? "Established"
          : "Emerging";
  const marketplaceTenureDays = Math.max(
    1,
    Math.floor((Date.now() - seller.createdAt.getTime()) / (24 * 60 * 60 * 1000))
  );
  const firstCompletedDealAt =
    completedTransactions.length > 0
      ? [...completedTransactions]
          .map((item) => item.completedAt)
          .filter(Boolean)
          .sort((left, right) => left!.getTime() - right!.getTime())[0] ?? null
      : null;
  const lastCompletedDealAt =
    completedTransactions.length > 0
      ? [...completedTransactions]
          .map((item) => item.completedAt)
          .filter(Boolean)
          .sort((left, right) => right!.getTime() - left!.getTime())[0] ?? null
      : null;
  const identityStatus = identityVerification?.status ?? "NOT_STARTED";
  const protectedTransferReady = identityStatus === "APPROVED";

  return {
    sellerId,
    reputationScore,
    sellerTier,
    identityStatus,
    protectedTransferReady,
    identityReviewedAt: identityVerification?.reviewedAt ?? null,
    memberSince: seller.createdAt,
    marketplaceTenureDays,
    totalListings,
    liveListings,
    featuredListings,
    archivedListings,
    verifiedListings,
    favoritesCount,
    averageFavoritesPerListing,
    totalTransactions,
    completedDeals,
    completedDealsLast30Days,
    firstCompletedDealAt,
    lastCompletedDealAt,
    completionRate,
    disputedTransactions,
    disputeRate,
    activeTransactions,
    fundedTransactions,
    handoffSubmittedTransactions,
    totalTransactionVolume,
    completedVolumeLast30Days,
    averageListingPrice,
    averageDealSize,
    totalListingValue
  };
}
