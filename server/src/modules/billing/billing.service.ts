import {
  ListingStatus,
  PaymentStatus,
  PaymentType,
  Prisma
} from "@prisma/client";
import Stripe from "stripe";
import { env } from "../../config/env.js";
import { prisma } from "../../config/prisma.js";
import { getStripeClient } from "../../config/stripe.js";
import { ApiError } from "../../utils/api-error.js";
import { sendEmailToUser } from "../email/email.service.js";

const ACTIVE_SUBSCRIPTION_STATUSES = ["ACTIVE", "TRIALING", "PAST_DUE"];
const DEFAULT_PLAN_SLUG = "starter";

const paymentInclude = {
  user: {
    select: {
      id: true,
      email: true,
      fullName: true
    }
  },
  plan: {
    select: {
      id: true,
      name: true,
      slug: true,
      priceMonthly: true
    }
  },
  listing: {
    select: {
      id: true,
      title: true,
      slug: true,
      isFeatured: true
    }
  }
} satisfies Prisma.PaymentInclude;

function mapPlan(plan: {
  id: string;
  name: string;
  slug: string;
  priceMonthly: Prisma.Decimal | number;
  listingLimit: number;
  featuredSlots: number;
  supportLevel: string | null;
  isActive: boolean;
}) {
  return {
    id: plan.id,
    name: plan.name,
    slug: plan.slug,
    priceMonthly: Number(plan.priceMonthly),
    listingLimit: plan.listingLimit,
    featuredSlots: plan.featuredSlots,
    supportLevel: plan.supportLevel,
    isActive: plan.isActive,
    isFree: Number(plan.priceMonthly) === 0
  };
}

function mapPayment(
  payment: Prisma.PaymentGetPayload<{ include: typeof paymentInclude }>
) {
  return {
    id: payment.id,
    stripeCheckoutSessionId: payment.stripeCheckoutSessionId,
    stripePaymentIntentId: payment.stripePaymentIntentId,
    amount: Number(payment.amount),
    currency: payment.currency,
    type: payment.type,
    status: payment.status,
    createdAt: payment.createdAt,
    user: payment.user,
    plan: payment.plan
      ? {
          ...payment.plan,
          priceMonthly: Number(payment.plan.priceMonthly)
        }
      : null,
    listing: payment.listing
  };
}

function toStripeAmount(value: number) {
  return Math.round(value * 100);
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

async function getDefaultPlan() {
  const starterPlan =
    (await prisma.plan.findUnique({
      where: {
        slug: DEFAULT_PLAN_SLUG
      }
    })) ??
    (await prisma.plan.findFirst({
      where: {
        isActive: true
      },
      orderBy: [{ priceMonthly: "asc" }, { name: "asc" }]
    }));

  if (!starterPlan) {
    throw new ApiError(500, "No marketplace plans are configured");
  }

  return starterPlan;
}

async function getPlanBySlug(planSlug: string) {
  const plan = await prisma.plan.findUnique({
    where: {
      slug: planSlug
    }
  });

  if (!plan || !plan.isActive) {
    throw new ApiError(404, "Plan not found");
  }

  return plan;
}

async function getManagedListingForBilling(userId: string, listingId: string) {
  const listing = await prisma.listing.findUnique({
    where: {
      id: listingId
    },
    select: {
      id: true,
      sellerId: true,
      title: true,
      slug: true,
      status: true,
      isFeatured: true
    }
  });

  if (!listing) {
    throw new ApiError(404, "Listing not found");
  }

  if (listing.sellerId !== userId) {
    throw new ApiError(403, "You can only manage billing for your own listings");
  }

  if (listing.status === ListingStatus.ARCHIVED) {
    throw new ApiError(400, "Archived listings cannot be promoted");
  }

  return listing;
}

async function getActiveSubscriptionRecord(userId: string) {
  return prisma.subscription.findFirst({
    where: {
      userId,
      status: {
        in: ACTIVE_SUBSCRIPTION_STATUSES
      },
      OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { gt: new Date() } }]
    },
    include: {
      plan: true
    },
    orderBy: [{ currentPeriodEnd: "desc" }, { createdAt: "desc" }]
  });
}

async function getUsageCounts(userId: string) {
  const [totalListings, activeListings, featuredListings] = await prisma.$transaction([
    prisma.listing.count({
      where: {
        sellerId: userId,
        status: {
          not: ListingStatus.ARCHIVED
        }
      }
    }),
    prisma.listing.count({
      where: {
        sellerId: userId,
        status: ListingStatus.ACTIVE
      }
    }),
    prisma.listing.count({
      where: {
        sellerId: userId,
        isFeatured: true,
        status: {
          not: ListingStatus.ARCHIVED
        }
      }
    })
  ]);

  return {
    totalListings,
    activeListings,
    featuredListings
  };
}

function buildUsageSummary(
  plan: {
    listingLimit: number;
    featuredSlots: number;
  },
  counts: {
    totalListings: number;
    activeListings: number;
    featuredListings: number;
  }
) {
  const remainingListingSlots = Math.max(plan.listingLimit - counts.totalListings, 0);
  const remainingFeaturedSlots = Math.max(plan.featuredSlots - counts.featuredListings, 0);

  return {
    ...counts,
    listingLimit: plan.listingLimit,
    featuredSlots: plan.featuredSlots,
    remainingListingSlots,
    remainingFeaturedSlots,
    canCreateListing: remainingListingSlots > 0,
    canFeatureMore: remainingFeaturedSlots > 0
  };
}

async function getEffectivePlanContext(userId: string) {
  const [subscription, fallbackPlan] = await Promise.all([
    getActiveSubscriptionRecord(userId),
    getDefaultPlan()
  ]);

  const plan = subscription?.plan ?? fallbackPlan;
  const usage = buildUsageSummary(plan, await getUsageCounts(userId));

  return {
    plan,
    subscription,
    usage
  };
}

function getSuccessUrl(kind: "subscription" | "featured") {
  return `${env.CLIENT_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}&kind=${kind}`;
}

function getCancelUrl(kind: "subscription" | "featured") {
  return `${env.CLIENT_URL}/billing/cancel?kind=${kind}`;
}

async function createPendingPaymentRecord(input: {
  userId: string;
  planId?: string;
  listingId?: string;
  amount: number;
  type: PaymentType;
  stripeCheckoutSessionId: string;
  currency?: string;
}) {
  const existingPayment = await prisma.payment.findUnique({
    where: {
      stripeCheckoutSessionId: input.stripeCheckoutSessionId
    }
  });

  if (existingPayment) {
    return existingPayment;
  }

  return prisma.payment.create({
    data: {
      userId: input.userId,
      planId: input.planId,
      listingId: input.listingId,
      amount: input.amount,
      currency: (input.currency ?? "USD").toUpperCase(),
      type: input.type,
      status: PaymentStatus.PENDING,
      stripeCheckoutSessionId: input.stripeCheckoutSessionId
    }
  });
}

async function finalizeDemoSubscriptionCheckout(
  payment: Prisma.PaymentGetPayload<{ include: typeof paymentInclude }>
) {
  const now = new Date();
  const currentPeriodEnd = addDays(now, 30);

  const existingSubscription = await prisma.subscription.findFirst({
    where: {
      userId: payment.userId
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  const subscription = existingSubscription
    ? await prisma.subscription.update({
        where: {
          id: existingSubscription.id
        },
        data: {
          planId: payment.planId!,
          status: "ACTIVE",
          currentPeriodStart: now,
          currentPeriodEnd
        },
        include: {
          plan: true
        }
      })
    : await prisma.subscription.create({
        data: {
          userId: payment.userId,
          planId: payment.planId!,
          status: "ACTIVE",
          currentPeriodStart: now,
          currentPeriodEnd
        },
        include: {
          plan: true
        }
      });

  const finalizedPayment = await prisma.payment.update({
    where: {
      id: payment.id
    },
    data: {
      status: PaymentStatus.SUCCEEDED
    },
    include: paymentInclude
  });

  return {
    payment: mapPayment(finalizedPayment),
    subscription: {
      id: subscription.id,
      status: subscription.status,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd
    }
  };
}

async function finalizeDemoFeaturedCheckout(
  payment: Prisma.PaymentGetPayload<{ include: typeof paymentInclude }>
) {
  if (!payment.listingId) {
    throw new ApiError(400, "Featured payment is missing a listing");
  }

  await prisma.listing.update({
    where: {
      id: payment.listingId
    },
    data: {
      isFeatured: true
    }
  });

  const finalizedPayment = await prisma.payment.update({
    where: {
      id: payment.id
    },
    data: {
      status: PaymentStatus.SUCCEEDED
    },
    include: paymentInclude
  });

  return {
    payment: mapPayment(finalizedPayment),
    listing: finalizedPayment.listing
  };
}

async function finalizeStripeSubscriptionCheckout(
  payment: Prisma.PaymentGetPayload<{ include: typeof paymentInclude }>
) {
  const stripe = getStripeClient();

  if (!stripe) {
    throw new ApiError(503, "Stripe is not configured");
  }

  const session = await stripe.checkout.sessions.retrieve(payment.stripeCheckoutSessionId!, {
    expand: ["subscription"]
  });

  if (
    session.mode !== "subscription" ||
    session.payment_status !== "paid" ||
    !session.subscription ||
    typeof session.subscription !== "object"
  ) {
    throw new ApiError(400, "Checkout session is not ready to confirm");
  }

  const subscription = session.subscription;
  const subscriptionPeriod = subscription as Stripe.Subscription & {
    current_period_start?: number;
    current_period_end?: number;
  };
  const existingSubscription = await prisma.subscription.findFirst({
    where: {
      userId: payment.userId
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  const nextSubscription = existingSubscription
    ? await prisma.subscription.update({
        where: {
          id: existingSubscription.id
        },
        data: {
          planId: payment.planId!,
          status: String(subscription.status).toUpperCase(),
          stripeCustomerId:
            typeof session.customer === "string" ? session.customer : existingSubscription.stripeCustomerId,
          stripeSubscriptionId: subscription.id,
          currentPeriodStart: subscriptionPeriod.current_period_start
            ? new Date(subscriptionPeriod.current_period_start * 1000)
            : null,
          currentPeriodEnd: subscriptionPeriod.current_period_end
            ? new Date(subscriptionPeriod.current_period_end * 1000)
            : null
        },
        include: {
          plan: true
        }
      })
    : await prisma.subscription.create({
        data: {
          userId: payment.userId,
          planId: payment.planId!,
          status: String(subscription.status).toUpperCase(),
          stripeCustomerId: typeof session.customer === "string" ? session.customer : null,
          stripeSubscriptionId: subscription.id,
          currentPeriodStart: subscriptionPeriod.current_period_start
            ? new Date(subscriptionPeriod.current_period_start * 1000)
            : null,
          currentPeriodEnd: subscriptionPeriod.current_period_end
            ? new Date(subscriptionPeriod.current_period_end * 1000)
            : null
        },
        include: {
          plan: true
        }
      });

  const finalizedPayment = await prisma.payment.update({
    where: {
      id: payment.id
    },
    data: {
      status: PaymentStatus.SUCCEEDED,
      stripePaymentIntentId:
        typeof session.payment_intent === "string" ? session.payment_intent : null
    },
    include: paymentInclude
  });

  return {
    payment: mapPayment(finalizedPayment),
    subscription: {
      id: nextSubscription.id,
      status: nextSubscription.status,
      currentPeriodStart: nextSubscription.currentPeriodStart,
      currentPeriodEnd: nextSubscription.currentPeriodEnd
    }
  };
}

async function finalizeStripeFeaturedCheckout(
  payment: Prisma.PaymentGetPayload<{ include: typeof paymentInclude }>
) {
  const stripe = getStripeClient();

  if (!stripe) {
    throw new ApiError(503, "Stripe is not configured");
  }

  const session = await stripe.checkout.sessions.retrieve(payment.stripeCheckoutSessionId!);

  if (session.mode !== "payment" || session.payment_status !== "paid") {
    throw new ApiError(400, "Checkout session is not ready to confirm");
  }

  if (!payment.listingId) {
    throw new ApiError(400, "Featured payment is missing a listing");
  }

  await prisma.listing.update({
    where: {
      id: payment.listingId
    },
    data: {
      isFeatured: true
    }
  });

  const finalizedPayment = await prisma.payment.update({
    where: {
      id: payment.id
    },
    data: {
      status: PaymentStatus.SUCCEEDED,
      stripePaymentIntentId:
        typeof session.payment_intent === "string" ? session.payment_intent : null
    },
    include: paymentInclude
  });

  return {
    payment: mapPayment(finalizedPayment),
    listing: finalizedPayment.listing
  };
}

async function findPaymentBySessionId(sessionId: string) {
  const payment = await prisma.payment.findFirst({
    where: {
      stripeCheckoutSessionId: sessionId
    },
    include: paymentInclude
  });

  if (!payment) {
    throw new ApiError(404, "Checkout session not found");
  }

  return payment;
}

async function finalizePaymentRecord(
  payment: Prisma.PaymentGetPayload<{ include: typeof paymentInclude }>
) {
  if (payment.status === PaymentStatus.SUCCEEDED) {
    return {
      message: "Checkout already confirmed",
      payment: mapPayment(payment),
      userId: payment.userId
    };
  }

  const isDemoSession = payment.stripeCheckoutSessionId?.startsWith("demo_") ?? false;

  const finalized =
    payment.type === PaymentType.SUBSCRIPTION
      ? isDemoSession
        ? await finalizeDemoSubscriptionCheckout(payment)
        : await finalizeStripeSubscriptionCheckout(payment)
      : isDemoSession
        ? await finalizeDemoFeaturedCheckout(payment)
        : await finalizeStripeFeaturedCheckout(payment);

  await sendEmailToUser({
    userId: payment.userId,
    category: "billing",
    subject:
      payment.type === PaymentType.SUBSCRIPTION
        ? `Plan upgrade confirmed: ${payment.plan?.name ?? "Orbitlist plan"}`
        : `Featured listing activated: ${payment.listing?.title ?? "Your listing"}`,
    heading:
      payment.type === PaymentType.SUBSCRIPTION
        ? "Your billing update is confirmed"
        : "Your featured placement is now active",
    bodyLines:
      payment.type === PaymentType.SUBSCRIPTION
        ? [
            `Your ${payment.plan?.name ?? "selected"} plan payment was successful.`,
            "Your updated limits and billing details are now available inside the dashboard."
          ]
        : [
            "Your payment for featured placement was successful.",
            `The listing '${payment.listing?.title ?? "selected listing"}' is now marked as featured.`
          ],
    ctaLabel: "Open billing",
    ctaUrl: `${env.CLIENT_URL}/billing`
  });

  return {
    message:
      payment.type === PaymentType.SUBSCRIPTION
        ? "Plan upgrade confirmed"
        : "Featured listing purchase confirmed",
    userId: payment.userId,
    ...finalized
  };
}

function isStripeConfigured() {
  return Boolean(getStripeClient());
}

export async function listActivePlans() {
  const plans = await prisma.plan.findMany({
    where: {
      isActive: true
    },
    orderBy: [{ priceMonthly: "asc" }, { name: "asc" }]
  });

  return plans.map(mapPlan);
}

export async function getBillingSummary(userId: string) {
  const context = await getEffectivePlanContext(userId);

  return {
    currentPlan: mapPlan(context.plan),
    subscription: context.subscription
      ? {
          id: context.subscription.id,
          status: context.subscription.status,
          currentPeriodStart: context.subscription.currentPeriodStart,
          currentPeriodEnd: context.subscription.currentPeriodEnd
        }
      : null,
    usage: context.usage,
    stripeConfigured: isStripeConfigured(),
    featuredListingPriceUsd: env.STRIPE_FEATURED_LISTING_PRICE_USD
  };
}

export async function getBillingHistory(userId: string) {
  const [summary, payments] = await Promise.all([
    getBillingSummary(userId),
    prisma.payment.findMany({
      where: {
        userId
      },
      include: paymentInclude,
      orderBy: {
        createdAt: "desc"
      }
    })
  ]);

  return {
    summary,
    payments: payments.map(mapPayment)
  };
}

export async function getAdminPayments(limit: number) {
  const payments = await prisma.payment.findMany({
    include: paymentInclude,
    orderBy: {
      createdAt: "desc"
    },
    take: limit
  });

  return {
    items: payments.map(mapPayment),
    meta: {
      total: payments.length,
      totalRevenue: payments
        .filter((payment) => payment.status === PaymentStatus.SUCCEEDED)
        .reduce((sum, payment) => sum + Number(payment.amount), 0)
    }
  };
}

export async function createSubscriptionCheckoutSession(userId: string, planSlug: string) {
  const [user, plan, currentContext] = await Promise.all([
    prisma.user.findUnique({
      where: {
        id: userId
      },
      select: {
        id: true,
        email: true
      }
    }),
    getPlanBySlug(planSlug),
    getEffectivePlanContext(userId)
  ]);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (Number(plan.priceMonthly) <= 0) {
    throw new ApiError(400, "Free plans do not require checkout");
  }

  if (currentContext.plan.slug === plan.slug && currentContext.subscription) {
    throw new ApiError(400, "You are already on this plan");
  }

  const stripe = getStripeClient();

  if (!stripe) {
    const sessionId = `demo_subscription_${Date.now()}`;
    await createPendingPaymentRecord({
      userId,
      planId: plan.id,
      amount: Number(plan.priceMonthly),
      type: PaymentType.SUBSCRIPTION,
      stripeCheckoutSessionId: sessionId,
      currency: env.STRIPE_CURRENCY
    });

    return {
      sessionId,
      url: `${env.CLIENT_URL}/billing/success?session_id=${sessionId}&kind=subscription`,
      mode: "demo" as const
    };
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    success_url: getSuccessUrl("subscription"),
    cancel_url: getCancelUrl("subscription"),
    customer_email: user.email,
    allow_promotion_codes: true,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: env.STRIPE_CURRENCY.toLowerCase(),
          unit_amount: toStripeAmount(Number(plan.priceMonthly)),
          recurring: {
            interval: "month"
          },
          product_data: {
            name: `${plan.name} plan`,
            description:
              plan.supportLevel ?? `${plan.listingLimit} listing slots and ${plan.featuredSlots} featured placements`
          }
        }
      }
    ],
    metadata: {
      userId,
      planId: plan.id,
      kind: "subscription"
    }
  });

  await createPendingPaymentRecord({
    userId,
    planId: plan.id,
    amount: Number(plan.priceMonthly),
    type: PaymentType.SUBSCRIPTION,
    stripeCheckoutSessionId: session.id,
    currency: env.STRIPE_CURRENCY
  });

  return {
    sessionId: session.id,
    url: session.url!,
    mode: "live" as const
  };
}

export async function createFeaturedCheckoutSession(userId: string, listingId: string) {
  const [listing, summary] = await Promise.all([
    getManagedListingForBilling(userId, listingId),
    getBillingSummary(userId)
  ]);

  if (listing.isFeatured) {
    throw new ApiError(400, "This listing is already featured");
  }

  const stripe = getStripeClient();

  if (!stripe) {
    const sessionId = `demo_featured_${Date.now()}`;
    await createPendingPaymentRecord({
      userId,
      listingId: listing.id,
      amount: env.STRIPE_FEATURED_LISTING_PRICE_USD,
      type: PaymentType.FEATURED_LISTING,
      stripeCheckoutSessionId: sessionId,
      currency: env.STRIPE_CURRENCY
    });

    return {
      sessionId,
      url: `${env.CLIENT_URL}/billing/success?session_id=${sessionId}&kind=featured`,
      mode: "demo" as const,
      summary
    };
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    success_url: getSuccessUrl("featured"),
    cancel_url: getCancelUrl("featured"),
    customer_email: (
      await prisma.user.findUnique({
        where: {
          id: userId
        },
        select: {
          email: true
        }
      })
    )?.email,
    allow_promotion_codes: true,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: env.STRIPE_CURRENCY.toLowerCase(),
          unit_amount: toStripeAmount(env.STRIPE_FEATURED_LISTING_PRICE_USD),
          product_data: {
            name: `Featured placement for ${listing.title}`,
            description: "Boost one listing into featured marketplace inventory."
          }
        }
      }
    ],
    metadata: {
      userId,
      listingId: listing.id,
      kind: "featured"
    }
  });

  await createPendingPaymentRecord({
    userId,
    listingId: listing.id,
    amount: env.STRIPE_FEATURED_LISTING_PRICE_USD,
    type: PaymentType.FEATURED_LISTING,
    stripeCheckoutSessionId: session.id,
    currency: env.STRIPE_CURRENCY
  });

  return {
    sessionId: session.id,
    url: session.url!,
    mode: "live" as const,
    summary
  };
}

export async function confirmCheckoutSession(userId: string, sessionId: string) {
  const payment = await prisma.payment.findFirst({
    where: {
      userId,
      stripeCheckoutSessionId: sessionId
    },
    include: paymentInclude
  });

  if (!payment) {
    throw new ApiError(404, "Checkout session not found");
  }

  const finalized = await finalizePaymentRecord(payment);
  const { message, ...finalizedData } = finalized;

  return {
    message,
    summary: await getBillingSummary(userId),
    ...finalizedData
  };
}

export async function confirmCheckoutSessionBySessionId(sessionId: string) {
  const payment = await findPaymentBySessionId(sessionId);
  const finalized = await finalizePaymentRecord(payment);
  const { message, ...finalizedData } = finalized;

  return {
    message,
    summary: await getBillingSummary(finalized.userId),
    ...finalizedData
  };
}

export async function markCheckoutSessionFailed(sessionId: string, status: PaymentStatus) {
  const payment = await prisma.payment.findFirst({
    where: {
      stripeCheckoutSessionId: sessionId
    },
    select: {
      id: true,
      status: true
    }
  });

  if (!payment || payment.status === PaymentStatus.SUCCEEDED) {
    return null;
  }

  return prisma.payment.update({
    where: {
      id: payment.id
    },
    data: {
      status
    }
  });
}

export async function ensureListingCreationAllowed(userId: string) {
  const { usage } = await getEffectivePlanContext(userId);

  if (!usage.canCreateListing) {
    throw new ApiError(
      403,
      "You have reached your listing limit for the current plan. Upgrade to create more inventory."
    );
  }
}

export async function ensureFeaturedListingAllowed(userId: string, listingId?: string) {
  const { usage, plan } = await getEffectivePlanContext(userId);

  if (usage.canFeatureMore) {
    return;
  }

  if (!listingId) {
    throw new ApiError(
      403,
      "Your current plan has no featured slots remaining. Purchase featured placement or upgrade your plan."
    );
  }

  const currentListing = await prisma.listing.findUnique({
    where: {
      id: listingId
    },
    select: {
      sellerId: true,
      isFeatured: true,
      status: true
    }
  });

  if (
    currentListing &&
    currentListing.sellerId === userId &&
    currentListing.isFeatured &&
    currentListing.status !== ListingStatus.ARCHIVED
  ) {
    const featuredCountExcludingCurrent = Math.max(usage.featuredListings - 1, 0);

    if (featuredCountExcludingCurrent < plan.featuredSlots) {
      return;
    }
  }

  const successfulFeaturedPayment = await prisma.payment.findFirst({
    where: {
      userId,
      listingId,
      type: PaymentType.FEATURED_LISTING,
      status: PaymentStatus.SUCCEEDED
    },
    select: {
      id: true
    }
  });

  if (!successfulFeaturedPayment) {
    throw new ApiError(
      403,
      "Your current plan has no featured slots remaining. Purchase featured placement or upgrade your plan."
    );
  }
}
