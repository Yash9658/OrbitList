import bcrypt from "bcryptjs";
import { ListingStatus, PrismaClient, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

async function seedPlatforms() {
  const platforms = [
    { name: "Instagram", slug: "instagram", icon: "instagram" },
    { name: "YouTube", slug: "youtube", icon: "youtube" },
    { name: "X", slug: "x", icon: "x" },
    { name: "TikTok", slug: "tiktok", icon: "tiktok" },
    { name: "Telegram", slug: "telegram", icon: "telegram" },
    { name: "Discord", slug: "discord", icon: "discord" }
  ];

  await Promise.all(
    platforms.map((platform) =>
      prisma.platform.upsert({
        where: { slug: platform.slug },
        update: platform,
        create: platform
      })
    )
  );
}

async function seedNiches() {
  const niches = [
    { name: "Travel", slug: "travel" },
    { name: "Gaming", slug: "gaming" },
    { name: "Food", slug: "food" },
    { name: "Crypto", slug: "crypto" },
    { name: "Business", slug: "business" },
    { name: "Lifestyle", slug: "lifestyle" }
  ];

  await Promise.all(
    niches.map((niche) =>
      prisma.niche.upsert({
        where: { slug: niche.slug },
        update: niche,
        create: niche
      })
    )
  );
}

async function seedPlans() {
  const plans = [
    {
      name: "Starter",
      slug: "starter",
      priceMonthly: 0,
      listingLimit: 5,
      featuredSlots: 0,
      supportLevel: "Standard email support"
    },
    {
      name: "Pro Seller",
      slug: "pro-seller",
      priceMonthly: 29,
      listingLimit: 50,
      featuredSlots: 3,
      supportLevel: "Priority review and support"
    },
    {
      name: "Studio",
      slug: "studio",
      priceMonthly: 99,
      listingLimit: 250,
      featuredSlots: 10,
      supportLevel: "Dedicated onboarding and priority marketplace support"
    }
  ];

  await Promise.all(
    plans.map((plan) =>
      prisma.plan.upsert({
        where: { slug: plan.slug },
        update: plan,
        create: plan
      })
    )
  );
}

async function seedUsers() {
  const sharedPasswordHash = await bcrypt.hash("Orbitlist123!", 10);

  const users = [
    {
      email: "admin@orbitlist.dev",
      passwordHash: sharedPasswordHash,
      fullName: "OrbitList Admin",
      username: "orbit-admin",
      role: UserRole.ADMIN,
      isVerified: true,
      country: "India"
    },
    {
      email: "seller@orbitlist.dev",
      passwordHash: sharedPasswordHash,
      fullName: "Aarav Seller",
      username: "aaravseller",
      role: UserRole.BOTH,
      isVerified: true,
      country: "India"
    },
    {
      email: "buyer@orbitlist.dev",
      passwordHash: sharedPasswordHash,
      fullName: "Mira Buyer",
      username: "mirabuyer",
      role: UserRole.BUYER,
      isVerified: false,
      country: "United Arab Emirates"
    }
  ];

  await Promise.all(
    users.map((user) =>
      prisma.user.upsert({
        where: { email: user.email },
        update: user,
        create: user
      })
    )
  );
}

async function seedListings() {
  const seller = await prisma.user.findUniqueOrThrow({
    where: {
      email: "seller@orbitlist.dev"
    }
  });

  const platformMap = new Map(
    (
      await prisma.platform.findMany({
        select: { id: true, slug: true }
      })
    ).map((platform) => [platform.slug, platform.id])
  );

  const nicheMap = new Map(
    (
      await prisma.niche.findMany({
        select: { id: true, slug: true }
      })
    ).map((niche) => [niche.slug, niche.id])
  );

  const listings = [
    {
      slug: "travel-instagram-240k",
      title: "Travel Instagram with 240k followers",
      handle: "@wander.with.aya",
      description:
        "A well-maintained travel account with a high percentage of audience in India, UAE, and Singapore. Includes strong story engagement and branded content history.",
      price: 12500,
      currency: "USD",
      status: ListingStatus.ACTIVE,
      isFeatured: true,
      isVerified: true,
      primaryCountry: "India",
      audienceAgeRange: "18-34",
      transferNotes:
        "Buyer receives account credentials, original recovery email transfer support, and a 7-day handover window.",
      platformSlug: "instagram",
      nicheSlug: "travel",
      metrics: {
        followersCount: 240000,
        engagementRate: 5.4,
        monthlyReach: 1800000,
        monthlyViews: 950000,
        monetized: true,
        verifiedBadge: false,
        audienceTopCountry: "India"
      },
      media: [
        {
          type: "screenshot",
          fileUrl: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee",
          sortOrder: 0
        }
      ]
    },
    {
      slug: "gaming-youtube-monetized",
      title: "Gaming YouTube channel with monetization",
      handle: "@rankrushgaming",
      description:
        "YouTube gaming channel focused on mobile and PC esports content with AdSense enabled and sponsorship-ready audience quality.",
      price: 18000,
      currency: "USD",
      status: ListingStatus.ACTIVE,
      isFeatured: false,
      isVerified: true,
      primaryCountry: "United States",
      audienceAgeRange: "18-24",
      transferNotes:
        "Transfer includes brand assets, thumbnail templates, and monetization setup guidance.",
      platformSlug: "youtube",
      nicheSlug: "gaming",
      metrics: {
        followersCount: 112000,
        engagementRate: 7.1,
        monthlyReach: 620000,
        monthlyViews: 1400000,
        monetized: true,
        verifiedBadge: false,
        audienceTopCountry: "United States"
      },
      media: [
        {
          type: "screenshot",
          fileUrl: "https://images.unsplash.com/photo-1542751371-adc38448a05e",
          sortOrder: 0
        }
      ]
    },
    {
      slug: "crypto-x-account-87k",
      title: "Crypto X account with niche audience",
      handle: "@alphaonchain",
      description:
        "A fast-growing X account with a highly engaged Web3 audience and consistent newsletter conversion potential.",
      price: 6400,
      currency: "USD",
      status: ListingStatus.ACTIVE,
      isFeatured: false,
      isVerified: false,
      primaryCountry: "Global",
      audienceAgeRange: "25-44",
      transferNotes:
        "Ideal for newsletter operators, analytics tools, or founders entering the crypto audience space.",
      platformSlug: "x",
      nicheSlug: "crypto",
      metrics: {
        followersCount: 87000,
        engagementRate: 4.2,
        monthlyReach: 430000,
        monthlyViews: 510000,
        monetized: false,
        verifiedBadge: false,
        audienceTopCountry: "United States"
      },
      media: [
        {
          type: "screenshot",
          fileUrl: "https://images.unsplash.com/photo-1639762681485-074b7f938ba0",
          sortOrder: 0
        }
      ]
    }
  ];

  for (const listing of listings) {
    await prisma.listing.upsert({
      where: { slug: listing.slug },
      update: {
        sellerId: seller.id,
        platformId: platformMap.get(listing.platformSlug)!,
        nicheId: nicheMap.get(listing.nicheSlug) ?? null,
        title: listing.title,
        handle: listing.handle,
        description: listing.description,
        price: listing.price,
        currency: listing.currency,
        status: listing.status,
        isFeatured: listing.isFeatured,
        isVerified: listing.isVerified,
        primaryCountry: listing.primaryCountry,
        audienceAgeRange: listing.audienceAgeRange,
        transferNotes: listing.transferNotes,
        publishedAt: new Date(),
        metrics: {
          upsert: {
            create: listing.metrics,
            update: {
              ...listing.metrics,
              lastUpdatedAt: new Date()
            }
          }
        },
        media: {
          deleteMany: {},
          create: listing.media
        }
      },
      create: {
        sellerId: seller.id,
        platformId: platformMap.get(listing.platformSlug)!,
        nicheId: nicheMap.get(listing.nicheSlug) ?? null,
        title: listing.title,
        slug: listing.slug,
        handle: listing.handle,
        description: listing.description,
        price: listing.price,
        currency: listing.currency,
        status: listing.status,
        isFeatured: listing.isFeatured,
        isVerified: listing.isVerified,
        primaryCountry: listing.primaryCountry,
        audienceAgeRange: listing.audienceAgeRange,
        transferNotes: listing.transferNotes,
        publishedAt: new Date(),
        metrics: {
          create: listing.metrics
        },
        media: {
          create: listing.media
        }
      }
    });
  }
}

async function main() {
  await seedPlatforms();
  await seedNiches();
  await seedPlans();
  await seedUsers();
  await seedListings();

  console.log("Seeded platforms, niches, plans, users, and sample listings.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
