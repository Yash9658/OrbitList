import { ListingStatus } from "@prisma/client";
import { z } from "zod";

const booleanFromQuery = z
  .union([z.literal("true"), z.literal("false")])
  .transform((value) => value === "true");

const metricsSchema = z.object({
  followersCount: z.number().int().nonnegative().optional(),
  engagementRate: z.number().nonnegative().optional(),
  monthlyViews: z.number().int().nonnegative().optional(),
  monthlyReach: z.number().int().nonnegative().optional(),
  monetized: z.boolean().optional(),
  verifiedBadge: z.boolean().optional(),
  audienceTopCountry: z.string().trim().min(2).max(60).optional()
});

const mediaSchema = z.object({
  type: z.string().trim().min(2).max(30),
  fileUrl: z.string().trim().url(),
  sortOrder: z.number().int().min(0).default(0)
});

export const listListingsSchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({}).optional().default({}),
  query: z.object({
    search: z.string().trim().optional(),
    platform: z.string().trim().optional(),
    niche: z.string().trim().optional(),
    country: z.string().trim().optional(),
    sellerId: z.string().trim().optional(),
    status: z.nativeEnum(ListingStatus).optional(),
    minPrice: z.coerce.number().nonnegative().optional(),
    maxPrice: z.coerce.number().nonnegative().optional(),
    minFollowers: z.coerce.number().int().nonnegative().optional(),
    verified: booleanFromQuery.optional(),
    monetized: booleanFromQuery.optional(),
    featured: booleanFromQuery.optional(),
    sortBy: z
      .enum([
        "newest",
        "price_asc",
        "price_desc",
        "followers_desc",
        "engagement_desc"
      ])
      .default("newest"),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(50).default(12)
  })
});

export const getListingBySlugSchema = z.object({
  body: z.object({}).optional().default({}),
  query: z.object({}).optional().default({}),
  params: z.object({
    slug: z.string().trim().min(2)
  })
});

export const createListingSchema = z.object({
  query: z.object({}).optional().default({}),
  params: z.object({}).optional().default({}),
  body: z.object({
    platformSlug: z.string().trim().min(2),
    nicheSlug: z.string().trim().min(2).optional().nullable(),
    title: z.string().trim().min(5).max(120),
    handle: z.string().trim().min(2).max(60).optional().nullable(),
    description: z.string().trim().min(10).max(2000).optional().nullable(),
    price: z.number().positive(),
    currency: z.string().trim().length(3).default("USD"),
    status: z.nativeEnum(ListingStatus).default(ListingStatus.DRAFT),
    isFeatured: z.boolean().default(false),
    isVerified: z.boolean().default(false),
    primaryCountry: z.string().trim().min(2).max(60).optional().nullable(),
    audienceAgeRange: z.string().trim().min(2).max(40).optional().nullable(),
    transferNotes: z.string().trim().min(5).max(1000).optional().nullable(),
    metrics: metricsSchema.optional(),
    media: z.array(mediaSchema).max(10).optional()
  })
});

export const updateListingSchema = z.object({
  query: z.object({}).optional().default({}),
  params: z.object({
    id: z.string().trim().min(1)
  }),
  body: z.object({
    platformSlug: z.string().trim().min(2).optional(),
    nicheSlug: z.string().trim().min(2).optional().nullable(),
    title: z.string().trim().min(5).max(120).optional(),
    handle: z.string().trim().min(2).max(60).optional().nullable(),
    description: z.string().trim().min(10).max(2000).optional().nullable(),
    price: z.number().positive().optional(),
    currency: z.string().trim().length(3).optional(),
    isFeatured: z.boolean().optional(),
    isVerified: z.boolean().optional(),
    primaryCountry: z.string().trim().min(2).max(60).optional().nullable(),
    audienceAgeRange: z.string().trim().min(2).max(40).optional().nullable(),
    transferNotes: z.string().trim().min(5).max(1000).optional().nullable(),
    metrics: metricsSchema.optional(),
    media: z.array(mediaSchema).max(10).optional()
  })
});

export const updateListingStatusSchema = z.object({
  query: z.object({}).optional().default({}),
  params: z.object({
    id: z.string().trim().min(1)
  }),
  body: z.object({
    status: z.nativeEnum(ListingStatus)
  })
});

export const listMineSchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({}).optional().default({}),
  query: z.object({
    status: z.nativeEnum(ListingStatus).optional()
  })
});

export const getManagedListingSchema = z.object({
  body: z.object({}).optional().default({}),
  query: z.object({}).optional().default({}),
  params: z.object({
    id: z.string().trim().min(1)
  })
});

export const moderationQueueSchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({}).optional().default({}),
  query: z.object({}).optional().default({})
});

export const reviewListingSchema = z.object({
  query: z.object({}).optional().default({}),
  params: z.object({
    id: z.string().trim().min(1)
  }),
  body: z.object({
    status: z.enum([ListingStatus.ACTIVE, ListingStatus.REJECTED]),
    notes: z.string().trim().max(500).optional()
  })
});
