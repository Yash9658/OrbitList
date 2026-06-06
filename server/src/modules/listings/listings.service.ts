import { ListingStatus, Prisma } from "@prisma/client";
import { env } from "../../config/env.js";
import { prisma } from "../../config/prisma.js";
import { ApiError } from "../../utils/api-error.js";
import { slugifyValue } from "../../utils/slugify.js";
import {
  ensureFeaturedListingAllowed,
  ensureListingCreationAllowed
} from "../billing/billing.service.js";
import { createAuditLog } from "../audit/audit.service.js";
import { sendEmailToUser } from "../email/email.service.js";
import { createNotificationRecord } from "../notifications/notifications.service.js";

type ListListingsInput = {
  search?: string;
  platform?: string;
  niche?: string;
  country?: string;
  sellerId?: string;
  status?: ListingStatus;
  minPrice?: number;
  maxPrice?: number;
  minFollowers?: number;
  verified?: boolean;
  monetized?: boolean;
  featured?: boolean;
  sortBy: "newest" | "price_asc" | "price_desc" | "followers_desc" | "engagement_desc";
  page: number;
  limit: number;
};

type UpsertMetricsInput = {
  followersCount?: number;
  engagementRate?: number;
  monthlyViews?: number;
  monthlyReach?: number;
  monetized?: boolean;
  verifiedBadge?: boolean;
  audienceTopCountry?: string;
};

type UpsertMediaInput = Array<{
  type: string;
  fileUrl: string;
  sortOrder: number;
}>;

type CreateListingInput = {
  platformSlug: string;
  nicheSlug?: string | null;
  title: string;
  handle?: string | null;
  description?: string | null;
  price: number;
  currency: string;
  status: ListingStatus;
  isFeatured: boolean;
  isVerified: boolean;
  primaryCountry?: string | null;
  audienceAgeRange?: string | null;
  transferNotes?: string | null;
  metrics?: UpsertMetricsInput;
  media?: UpsertMediaInput;
};

type UpdateListingInput = Omit<
  Partial<CreateListingInput>,
  "status"
>;

export const listingInclude = {
  platform: true,
  niche: true,
  metrics: true,
  media: {
    orderBy: {
      sortOrder: "asc" as const
    }
  },
  seller: {
    select: {
      id: true,
      fullName: true,
      username: true,
      avatarUrl: true,
      bio: true,
      country: true,
      isVerified: true
    }
  }
} satisfies Prisma.ListingInclude;

function buildListingOrderBy(sortBy: ListListingsInput["sortBy"]): Prisma.ListingOrderByWithRelationInput[] {
  switch (sortBy) {
    case "price_asc":
      return [{ price: "asc" }];
    case "price_desc":
      return [{ price: "desc" }];
    case "followers_desc":
      return [{ metrics: { followersCount: "desc" } }, { createdAt: "desc" }];
    case "engagement_desc":
      return [{ metrics: { engagementRate: "desc" } }, { createdAt: "desc" }];
    case "newest":
    default:
      return [{ createdAt: "desc" }];
  }
}

function buildListingWhere(input: ListListingsInput): Prisma.ListingWhereInput {
  const where: Prisma.ListingWhereInput = {};

  if (input.search) {
    where.OR = [
      { title: { contains: input.search, mode: "insensitive" } },
      { handle: { contains: input.search, mode: "insensitive" } },
      { description: { contains: input.search, mode: "insensitive" } }
    ];
  }

  if (input.platform) {
    where.platform = {
      slug: input.platform.toLowerCase()
    };
  }

  if (input.niche) {
    where.niche = {
      slug: input.niche.toLowerCase()
    };
  }

  if (input.country) {
    where.primaryCountry = {
      contains: input.country,
      mode: "insensitive"
    };
  }

  if (input.sellerId) {
    where.sellerId = input.sellerId;
  }

  if (input.status) {
    where.status = input.status;
  }

  if (typeof input.verified === "boolean") {
    where.isVerified = input.verified;
  }

  if (typeof input.featured === "boolean") {
    where.isFeatured = input.featured;
  }

  if (
    typeof input.minPrice === "number" ||
    typeof input.maxPrice === "number"
  ) {
    where.price = {};

    if (typeof input.minPrice === "number") {
      where.price.gte = input.minPrice;
    }

    if (typeof input.maxPrice === "number") {
      where.price.lte = input.maxPrice;
    }
  }

  if (
    typeof input.minFollowers === "number" ||
    typeof input.monetized === "boolean"
  ) {
    const metricsFilters: Prisma.ListingMetricWhereInput = {};

    where.metrics = {
      is: metricsFilters
    };

    if (typeof input.minFollowers === "number") {
      metricsFilters.followersCount = {
        gte: input.minFollowers
      };
    }

    if (typeof input.monetized === "boolean") {
      metricsFilters.monetized = input.monetized;
    }
  }

  return where;
}

async function ensureUniqueSlug(baseValue: string, listingId?: string) {
  const baseSlug = slugifyValue(baseValue);

  if (!baseSlug) {
    throw new ApiError(400, "Unable to generate a valid slug for this listing");
  }

  let candidate = baseSlug;
  let counter = 1;

  while (true) {
    const existing = await prisma.listing.findUnique({
      where: {
        slug: candidate
      },
      select: {
        id: true
      }
    });

    if (!existing || existing.id === listingId) {
      return candidate;
    }

    counter += 1;
    candidate = `${baseSlug}-${counter}`;
  }
}

async function resolvePlatformId(platformSlug: string) {
  const platform = await prisma.platform.findUnique({
    where: {
      slug: platformSlug.toLowerCase()
    },
    select: {
      id: true
    }
  });

  if (!platform) {
    throw new ApiError(400, `Platform '${platformSlug}' was not found`);
  }

  return platform.id;
}

async function resolveNicheId(nicheSlug?: string | null) {
  if (!nicheSlug) {
    return null;
  }

  const niche = await prisma.niche.findUnique({
    where: {
      slug: nicheSlug.toLowerCase()
    },
    select: {
      id: true
    }
  });

  if (!niche) {
    throw new ApiError(400, `Niche '${nicheSlug}' was not found`);
  }

  return niche.id;
}

function buildMetricsUpsert(metrics?: UpsertMetricsInput) {
  if (!metrics) {
    return undefined;
  }

  return {
    upsert: {
      create: metrics,
      update: {
        ...metrics,
        lastUpdatedAt: new Date()
      }
    }
  };
}

function buildMetricsCreate(metrics?: UpsertMetricsInput) {
  if (!metrics) {
    return undefined;
  }

  return {
    create: metrics
  };
}

export function mapListing(listing: Prisma.ListingGetPayload<{ include: typeof listingInclude }>) {
  return {
    id: listing.id,
    title: listing.title,
    slug: listing.slug,
    handle: listing.handle,
    description: listing.description,
    price: Number(listing.price),
    currency: listing.currency,
    status: listing.status,
    isFeatured: listing.isFeatured,
    isVerified: listing.isVerified,
    primaryCountry: listing.primaryCountry,
    audienceAgeRange: listing.audienceAgeRange,
    transferNotes: listing.transferNotes,
    publishedAt: listing.publishedAt,
    createdAt: listing.createdAt,
    updatedAt: listing.updatedAt,
    platform: listing.platform,
    niche: listing.niche,
    seller: listing.seller,
    metrics: listing.metrics,
    media: listing.media
  };
}

export async function listListings(input: ListListingsInput) {
  const where = buildListingWhere(input);
  const skip = (input.page - 1) * input.limit;

  const [items, total] = await Promise.all([
    prisma.listing.findMany({
      where,
      include: listingInclude,
      orderBy: buildListingOrderBy(input.sortBy),
      skip,
      take: input.limit
    }),
    prisma.listing.count({ where })
  ]);

  return {
    data: items.map(mapListing),
    meta: {
      page: input.page,
      limit: input.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / input.limit))
    }
  };
}

export async function getListingBySlug(slug: string) {
  const listing = await prisma.listing.findUnique({
    where: { slug },
    include: listingInclude
  });

  if (!listing) {
    throw new ApiError(404, "Listing not found");
  }

  return mapListing(listing);
}

export async function getManagedListingById(
  id: string,
  actor: { userId: string; isAdmin: boolean }
) {
  const listing = await prisma.listing.findUnique({
    where: { id },
    include: listingInclude
  });

  if (!listing) {
    throw new ApiError(404, "Listing not found");
  }

  if (!actor.isAdmin && listing.sellerId !== actor.userId) {
    throw new ApiError(403, "You can only access your own listings");
  }

  return mapListing(listing);
}

export async function createListing(sellerId: string, input: CreateListingInput) {
  await ensureListingCreationAllowed(sellerId);

  const [platformId, nicheId] = await Promise.all([
    resolvePlatformId(input.platformSlug),
    resolveNicheId(input.nicheSlug)
  ]);

  const seller = await prisma.user.findUnique({
    where: {
      id: sellerId
    },
    select: {
      id: true
    }
  });

  if (!seller) {
    throw new ApiError(400, "Seller was not found");
  }

  if (input.isFeatured) {
    await ensureFeaturedListingAllowed(sellerId);
  }

  const normalizedStatus =
    input.status === ListingStatus.ACTIVE ? ListingStatus.PENDING_REVIEW : input.status;

  const slug = await ensureUniqueSlug(input.title);

  const listing = await prisma.listing.create({
    data: {
      sellerId,
      platformId,
      nicheId,
      title: input.title,
      slug,
      handle: input.handle ?? null,
      description: input.description ?? null,
      price: input.price,
      currency: input.currency.toUpperCase(),
      status: normalizedStatus,
      isFeatured: input.isFeatured,
      isVerified: input.isVerified,
      primaryCountry: input.primaryCountry ?? null,
      audienceAgeRange: input.audienceAgeRange ?? null,
      transferNotes: input.transferNotes ?? null,
      publishedAt: null,
      metrics: buildMetricsCreate(input.metrics),
      media: input.media?.length
        ? {
            create: input.media
          }
        : undefined
    },
    include: listingInclude
  });

  if (normalizedStatus === ListingStatus.PENDING_REVIEW) {
    await Promise.all([
      notifyAdminsOfModerationSubmission(listing.title),
      createNotificationRecord({
        userId: sellerId,
        type: "listing_submitted",
        title: "Listing submitted for review",
        body: `Your listing '${listing.title}' is now waiting for admin approval.`
      })
    ]);
  }

  return mapListing(listing);
}

export async function updateListing(
  id: string,
  input: UpdateListingInput,
  actor?: { userId: string; isAdmin: boolean }
) {
  const existing = await prisma.listing.findUnique({
    where: { id },
    select: { id: true, title: true, sellerId: true }
  });

  if (!existing) {
    throw new ApiError(404, "Listing not found");
  }

  if (actor && !actor.isAdmin && existing.sellerId !== actor.userId) {
    throw new ApiError(403, "You can only edit your own listings");
  }

  if (input.isFeatured === true) {
    await ensureFeaturedListingAllowed(existing.sellerId, existing.id);
  }

  const platformId = input.platformSlug
    ? await resolvePlatformId(input.platformSlug)
    : undefined;
  const nicheId =
    input.nicheSlug !== undefined
      ? await resolveNicheId(input.nicheSlug)
      : undefined;

  const nextTitle = input.title ?? existing.title;
  const slug = input.title
    ? await ensureUniqueSlug(nextTitle, existing.id)
    : undefined;

  const listing = await prisma.listing.update({
    where: { id },
    data: {
      title: input.title,
      slug,
      platformId,
      nicheId,
      handle: input.handle,
      description: input.description,
      price: input.price,
      currency: input.currency?.toUpperCase(),
      isFeatured: input.isFeatured,
      isVerified: input.isVerified,
      primaryCountry: input.primaryCountry,
      audienceAgeRange: input.audienceAgeRange,
      transferNotes: input.transferNotes,
      metrics: buildMetricsUpsert(input.metrics),
      media:
        input.media !== undefined
          ? {
              deleteMany: {},
              create: input.media
            }
          : undefined
    },
    include: listingInclude
  });

  return mapListing(listing);
}

export async function updateListingStatus(
  id: string,
  status: ListingStatus,
  actor?: { userId: string; isAdmin: boolean }
) {
  const existing = await prisma.listing.findUnique({
    where: { id },
    select: {
      id: true,
      sellerId: true,
      status: true,
      isFeatured: true
    }
  });

  if (!existing) {
    throw new ApiError(404, "Listing not found");
  }

  if (actor && !actor.isAdmin && existing.sellerId !== actor.userId) {
    throw new ApiError(403, "You can only update your own listings");
  }

  try {
    let nextStatus = status;

    if (
      existing.status === ListingStatus.ARCHIVED &&
      status !== ListingStatus.ARCHIVED
    ) {
      await ensureListingCreationAllowed(existing.sellerId);
    }

    if (existing.isFeatured && status !== ListingStatus.ARCHIVED) {
      await ensureFeaturedListingAllowed(existing.sellerId, existing.id);
    }

    if (!actor?.isAdmin && status === ListingStatus.ACTIVE) {
      nextStatus = ListingStatus.PENDING_REVIEW;
    }

    const listing = await prisma.listing.update({
      where: { id },
      data: {
        status: nextStatus,
        publishedAt: nextStatus === ListingStatus.ACTIVE ? new Date() : null
      },
      include: listingInclude
    });

    if (!actor?.isAdmin && nextStatus === ListingStatus.PENDING_REVIEW) {
      await Promise.all([
        notifyAdminsOfModerationSubmission(listing.title),
        createNotificationRecord({
          userId: listing.seller.id,
          type: "listing_submitted",
          title: "Listing submitted for review",
          body: `Your listing '${listing.title}' is now waiting for admin approval.`
        })
      ]);
    }

    return mapListing(listing);
  } catch {
    throw new ApiError(404, "Listing not found");
  }
}

export async function listListingsForModeration() {
  const items = await prisma.listing.findMany({
    where: {
      status: {
        in: [ListingStatus.PENDING_REVIEW, ListingStatus.REJECTED]
      }
    },
    include: listingInclude,
    orderBy: [{ updatedAt: "desc" }]
  });

  return {
    data: items.map(mapListing),
    meta: {
      total: items.length,
      pendingCount: items.filter((item) => item.status === ListingStatus.PENDING_REVIEW).length,
      rejectedCount: items.filter((item) => item.status === ListingStatus.REJECTED).length
    }
  };
}

export async function reviewListingForModeration(input: {
  listingId: string;
  reviewerId: string;
  status: Extract<ListingStatus, "ACTIVE" | "REJECTED">;
  notes?: string;
}) {
  const listing = await prisma.listing.findUnique({
    where: {
      id: input.listingId
    },
    include: listingInclude
  });

  if (!listing) {
    throw new ApiError(404, "Listing not found");
  }

  if (
    listing.status !== ListingStatus.PENDING_REVIEW &&
    listing.status !== ListingStatus.REJECTED
  ) {
    throw new ApiError(400, "This listing is not currently in the moderation queue");
  }

  const updatedListing = await prisma.listing.update({
    where: {
      id: input.listingId
    },
    data: {
      status: input.status,
      publishedAt: input.status === ListingStatus.ACTIVE ? new Date() : null
    },
    include: listingInclude
  });

  await createNotificationRecord({
    userId: listing.seller.id,
    type: input.status === ListingStatus.ACTIVE ? "listing_approved" : "listing_rejected",
    title:
      input.status === ListingStatus.ACTIVE
        ? "Listing approved"
        : "Listing needs revision",
    body:
      input.status === ListingStatus.ACTIVE
        ? `Your listing '${listing.title}' is now live in the marketplace.`
        : `Your listing '${listing.title}' was rejected for now.${input.notes ? ` Reviewer note: ${input.notes}` : ""}`
  });

  await sendEmailToUser({
    userId: listing.seller.id,
    category: "marketplace",
    subject:
      input.status === ListingStatus.ACTIVE
        ? `Listing approved: ${listing.title}`
        : `Listing revision needed: ${listing.title}`,
    heading:
      input.status === ListingStatus.ACTIVE
        ? "Your listing is now live"
        : "Your listing needs another revision",
    bodyLines:
      input.status === ListingStatus.ACTIVE
        ? [
            `Your listing '${listing.title}' passed review and is now visible in the marketplace.`,
            "You can monitor buyer activity from your seller dashboard."
          ]
        : [
            `Your listing '${listing.title}' was reviewed but is not live yet.`,
            input.notes
              ? `Reviewer note: ${input.notes}`
              : "Update the listing details and proof media, then resubmit it for review."
          ],
    ctaLabel:
      input.status === ListingStatus.ACTIVE ? "View live listing" : "Open seller dashboard",
    ctaUrl:
      input.status === ListingStatus.ACTIVE
        ? `${env.CLIENT_URL}/listing/${updatedListing.slug}`
        : `${env.CLIENT_URL}/dashboard`
  });

  await createAuditLog({
    actorUserId: input.reviewerId,
    action: "listing.moderated",
    entityType: "listing",
    entityId: updatedListing.id,
    metadata: {
      status: input.status,
      notes: input.notes ?? null
    }
  });

  return mapListing(updatedListing);
}

export async function getListingOptions() {
  const [platforms, niches] = await Promise.all([
    prisma.platform.findMany({
      where: {
        isActive: true
      },
      orderBy: {
        name: "asc"
      }
    }),
    prisma.niche.findMany({
      orderBy: {
        name: "asc"
      }
    })
  ]);

  return { platforms, niches };
}

export async function listMyListings(
  sellerId: string,
  status?: ListingStatus
) {
  const items = await prisma.listing.findMany({
    where: {
      sellerId,
      ...(status ? { status } : {})
    },
    include: listingInclude,
    orderBy: [
      { createdAt: "desc" }
    ]
  });

  const activeCount = items.filter((item) => item.status === ListingStatus.ACTIVE).length;
  const totalValue = items.reduce((sum, item) => sum + Number(item.price), 0);

  return {
    data: items.map(mapListing),
    meta: {
      total: items.length,
      activeCount,
      draftCount: items.filter((item) => item.status === ListingStatus.DRAFT).length,
      pendingReviewCount: items.filter((item) => item.status === ListingStatus.PENDING_REVIEW).length,
      rejectedCount: items.filter((item) => item.status === ListingStatus.REJECTED).length,
      totalValue
    }
  };
}

async function notifyAdminsOfModerationSubmission(listingTitle: string) {
  const admins = await prisma.user.findMany({
    where: {
      role: "ADMIN"
    },
    select: {
      id: true
    }
  });

  await Promise.all(
    admins.map((admin) =>
      createNotificationRecord({
        userId: admin.id,
        type: "listing_review",
        title: "Listing review requested",
        body: `A seller submitted '${listingTitle}' for marketplace review.`
      })
    )
  );
}
