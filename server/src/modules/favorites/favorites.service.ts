import { prisma } from "../../config/prisma.js";
import { ApiError } from "../../utils/api-error.js";
import { createNotificationRecord } from "../notifications/notifications.service.js";
import { listingInclude, mapListing } from "../listings/listings.service.js";

export async function listFavorites(userId: string) {
  const favorites = await prisma.favorite.findMany({
    where: {
      userId
    },
    include: {
      listing: {
        include: listingInclude
      }
    },
    orderBy: [
      { createdAt: "desc" }
    ]
  });

  return {
    data: favorites.map((favorite) => ({
      ...mapListing(favorite.listing),
      favoritedAt: favorite.createdAt
    })),
    meta: {
      total: favorites.length,
      listingIds: favorites.map((favorite) => favorite.listingId)
    }
  };
}

export async function addFavorite(userId: string, listingId: string) {
  const listing = await prisma.listing.findUnique({
    where: {
      id: listingId
    },
    select: {
      id: true,
      title: true,
      sellerId: true
    }
  });

  if (!listing) {
    throw new ApiError(404, "Listing not found");
  }

  const existing = await prisma.favorite.findUnique({
    where: {
      userId_listingId: {
        userId,
        listingId
      }
    }
  });

  if (existing) {
    return {
      listingId: existing.listingId,
      createdAt: existing.createdAt
    };
  }

  const favorite = await prisma.favorite.create({
    data: {
      userId,
      listingId
    }
  });

  if (listing.sellerId !== userId) {
    await createNotificationRecord({
      userId: listing.sellerId,
      type: "favorite",
      title: "Listing saved by a buyer",
      body: `Someone added '${listing.title}' to their watchlist.`
    });
  }

  return {
    listingId: favorite.listingId,
    createdAt: favorite.createdAt
  };
}

export async function removeFavorite(userId: string, listingId: string) {
  const favorite = await prisma.favorite.findUnique({
    where: {
      userId_listingId: {
        userId,
        listingId
      }
    }
  });

  if (!favorite) {
    throw new ApiError(404, "Favorite not found");
  }

  await prisma.favorite.delete({
    where: {
      userId_listingId: {
        userId,
        listingId
      }
    }
  });

  return {
    listingId
  };
}
