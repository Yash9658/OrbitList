import {
  ConnectedAccountStatus,
  Prisma,
  UserRole
} from "@prisma/client";
import Stripe from "stripe";
import { env } from "../../config/env.js";
import { prisma } from "../../config/prisma.js";
import { getStripeClient } from "../../config/stripe.js";
import { ApiError } from "../../utils/api-error.js";
import { createAuditLog } from "../audit/audit.service.js";
import { createNotificationRecord } from "../notifications/notifications.service.js";

const payoutUserSelect = {
  id: true,
  email: true,
  fullName: true,
  username: true,
  country: true,
  role: true,
  stripeConnectedAccountId: true,
  stripeConnectedAccountStatus: true,
  stripeConnectedAccountStatusReason: true,
  stripeConnectedAccountOnboardedAt: true,
  stripeConnectedAccountLastSyncedAt: true,
  identityVerification: {
    select: {
      status: true
    }
  }
} satisfies Prisma.UserSelect;

type PayoutUserRecord = Prisma.UserGetPayload<{
  select: typeof payoutUserSelect;
}>;

const stripeAccountInclude = [
  "configuration.recipient",
  "requirements",
  "future_requirements"
] as const;

function isSellerCapable(role: UserRole) {
  return role === UserRole.SELLER || role === UserRole.BOTH || role === UserRole.ADMIN;
}

function getConnectRefreshUrl() {
  return env.STRIPE_CONNECT_REFRESH_URL ?? `${env.CLIENT_URL}/settings?connect=refresh`;
}

function getConnectReturnUrl() {
  return env.STRIPE_CONNECT_RETURN_URL ?? `${env.CLIENT_URL}/settings?connect=return`;
}

function getSellerDisplayName(user: PayoutUserRecord) {
  return user.fullName?.trim() || user.username?.trim() || user.email;
}

function normalizeStripeCountry(country: string | null | undefined) {
  const raw = country?.trim();

  if (!raw) {
    return env.STRIPE_DEFAULT_CONNECTED_ACCOUNT_COUNTRY;
  }

  if (/^[A-Za-z]{2}$/.test(raw)) {
    return raw.toUpperCase();
  }

  const normalized = raw.toLowerCase();
  const aliases: Record<string, string> = {
    india: "IN",
    "united states": "US",
    usa: "US",
    "united kingdom": "GB",
    uk: "GB",
    canada: "CA",
    australia: "AU",
    germany: "DE",
    france: "FR"
  };

  return aliases[normalized] ?? env.STRIPE_DEFAULT_CONNECTED_ACCOUNT_COUNTRY;
}

function buildStatusReason(
  status: ConnectedAccountStatus,
  minimumDeadlineStatus?: "currently_due" | "eventually_due" | "past_due"
) {
  if (status === ConnectedAccountStatus.ACTIVE) {
    return "Seller payout onboarding is active and ready for transfer release.";
  }

  if (status === ConnectedAccountStatus.RESTRICTED) {
    return "Stripe has past-due payout requirements for this connected account.";
  }

  if (status === ConnectedAccountStatus.ACTION_REQUIRED) {
    return "Stripe needs more payout information before transfers can be released.";
  }

  if (status === ConnectedAccountStatus.PENDING) {
    if (minimumDeadlineStatus === "eventually_due") {
      return "Stripe onboarding is active, with future payout requirements still scheduled.";
    }

    return "Seller payout onboarding has started but is not complete yet.";
  }

  return "Seller has not started Stripe payout onboarding yet.";
}

function deriveConnectedAccountSnapshot(account: Stripe.V2.Core.Account) {
  const recipientApplied = account.configuration?.recipient?.applied === true;
  const minimumDeadlineStatus =
    account.requirements?.summary?.minimum_deadline?.status ??
    account.future_requirements?.summary?.minimum_deadline?.status;

  let status: ConnectedAccountStatus = ConnectedAccountStatus.NOT_CONNECTED;

  if (minimumDeadlineStatus === "past_due") {
    status = ConnectedAccountStatus.RESTRICTED;
  } else if (minimumDeadlineStatus === "currently_due") {
    status = ConnectedAccountStatus.ACTION_REQUIRED;
  } else if (recipientApplied) {
    status =
      minimumDeadlineStatus === "eventually_due"
        ? ConnectedAccountStatus.PENDING
        : ConnectedAccountStatus.ACTIVE;
  } else {
    status = ConnectedAccountStatus.PENDING;
  }

  return {
    connectedAccountId: account.id,
    status,
    statusReason: buildStatusReason(status, minimumDeadlineStatus),
    onboardedAt: recipientApplied ? new Date() : null,
    lastSyncedAt: new Date()
  };
}

function mapPayoutAccount(user: PayoutUserRecord) {
  return {
    stripeConfigured: Boolean(getStripeClient()),
    connectedAccountId: user.stripeConnectedAccountId,
    status: user.stripeConnectedAccountStatus,
    statusReason: user.stripeConnectedAccountStatusReason,
    onboardedAt: user.stripeConnectedAccountOnboardedAt,
    lastSyncedAt: user.stripeConnectedAccountLastSyncedAt,
    payoutsReady: user.stripeConnectedAccountStatus === ConnectedAccountStatus.ACTIVE,
    identityStatus: user.identityVerification?.status ?? "NOT_STARTED",
    protectedDealEligible: user.identityVerification?.status === "APPROVED",
    requiresAction:
      user.stripeConnectedAccountStatus === ConnectedAccountStatus.ACTION_REQUIRED ||
      user.stripeConnectedAccountStatus === ConnectedAccountStatus.RESTRICTED,
    canStartOnboarding: isSellerCapable(user.role)
  };
}

async function getPayoutUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: {
      id: userId
    },
    select: payoutUserSelect
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  return user;
}

async function updatePayoutSnapshot(
  userId: string,
  snapshot: {
    connectedAccountId?: string | null;
    status: ConnectedAccountStatus;
    statusReason: string | null;
    onboardedAt?: Date | null;
    lastSyncedAt: Date;
  }
) {
  return prisma.user.update({
    where: {
      id: userId
    },
    data: {
      stripeConnectedAccountId: snapshot.connectedAccountId,
      stripeConnectedAccountStatus: snapshot.status,
      stripeConnectedAccountStatusReason: snapshot.statusReason,
      stripeConnectedAccountOnboardedAt:
        snapshot.onboardedAt ?? undefined,
      stripeConnectedAccountLastSyncedAt: snapshot.lastSyncedAt
    },
    select: payoutUserSelect
  });
}

async function syncFromStripe(user: PayoutUserRecord) {
  const stripe = getStripeClient();

  if (!stripe || !user.stripeConnectedAccountId) {
    return user;
  }

  const account = await stripe.v2.core.accounts.retrieve(user.stripeConnectedAccountId, {
    include: [...stripeAccountInclude]
  });

  const snapshot = deriveConnectedAccountSnapshot(account);

  return updatePayoutSnapshot(user.id, {
    connectedAccountId: snapshot.connectedAccountId,
    status: snapshot.status,
    statusReason: snapshot.statusReason,
    onboardedAt:
      user.stripeConnectedAccountOnboardedAt ??
      snapshot.onboardedAt ??
      undefined,
    lastSyncedAt: snapshot.lastSyncedAt
  });
}

async function ensureConnectedAccount(user: PayoutUserRecord) {
  const stripe = getStripeClient();

  if (!stripe) {
    return null;
  }

  if (user.stripeConnectedAccountId) {
    return user.stripeConnectedAccountId;
  }

  const account = await stripe.v2.core.accounts.create({
    contact_email: user.email,
    display_name: getSellerDisplayName(user),
    dashboard: "express",
    identity: {
      country: normalizeStripeCountry(user.country),
      entity_type: "individual"
    },
    configuration: {
      recipient: {
        capabilities: {
          stripe_balance: {
            stripe_transfers: {
              requested: true
            }
          }
        }
      }
    },
    include: [...stripeAccountInclude],
    metadata: {
      userId: user.id,
      role: user.role
    }
  });

  const snapshot = deriveConnectedAccountSnapshot(account);

  const updatedUser = await updatePayoutSnapshot(user.id, {
    connectedAccountId: snapshot.connectedAccountId,
    status: snapshot.status,
    statusReason: snapshot.statusReason,
    onboardedAt: snapshot.onboardedAt ?? undefined,
    lastSyncedAt: snapshot.lastSyncedAt
  });

  await createAuditLog({
    actorUserId: user.id,
    action: "payout.account_created",
    entityType: "user",
    entityId: user.id,
    metadata: {
      connectedAccountId: account.id
    }
  });

  return updatedUser.stripeConnectedAccountId;
}

function assertSellerReadyForConnect(user: PayoutUserRecord) {
  if (!isSellerCapable(user.role)) {
    throw new ApiError(403, "Only seller-capable accounts can start payout onboarding");
  }

  if (user.identityVerification?.status !== "APPROVED") {
    throw new ApiError(
      400,
      "Complete identity verification in Settings before starting Stripe payout onboarding"
    );
  }
}

export async function syncSellerPayoutAccount(userId: string) {
  const user = await getPayoutUser(userId);
  return syncFromStripe(user);
}

export async function getMyPayoutAccount(userId: string) {
  const user = await syncSellerPayoutAccount(userId);
  return mapPayoutAccount(user);
}

export async function createPayoutOnboardingLink(input: {
  userId: string;
  mode?: "onboarding" | "update";
}) {
  const user = await getPayoutUser(input.userId);

  assertSellerReadyForConnect(user);

  const stripe = getStripeClient();

  if (!stripe) {
    return {
      ...mapPayoutAccount(user),
      url: `${env.CLIENT_URL}/settings?connect=demo`,
      mode: "demo" as const
    };
  }

  const connectedAccountId = await ensureConnectedAccount(user);

  if (!connectedAccountId) {
    throw new ApiError(503, "Stripe is not configured");
  }

  const syncedUser = await syncSellerPayoutAccount(user.id);
  const useCaseType =
    input.mode === "update"
      ? "account_update"
      : syncedUser.stripeConnectedAccountOnboardedAt ||
          syncedUser.stripeConnectedAccountStatus === ConnectedAccountStatus.ACTIVE
        ? "account_update"
        : "account_onboarding";

  const link = await stripe.v2.core.accountLinks.create({
    account: connectedAccountId,
    use_case:
      useCaseType === "account_update"
        ? {
            type: "account_update",
            account_update: {
              configurations: ["recipient"],
              refresh_url: getConnectRefreshUrl(),
              return_url: getConnectReturnUrl(),
              collection_options: {
                fields: "eventually_due",
                future_requirements: "include"
              }
            }
          }
        : {
            type: "account_onboarding",
            account_onboarding: {
              configurations: ["recipient"],
              refresh_url: getConnectRefreshUrl(),
              return_url: getConnectReturnUrl(),
              collection_options: {
                fields: "eventually_due",
                future_requirements: "include"
              }
            }
          }
  });

  await Promise.all([
    createNotificationRecord({
      userId: user.id,
      type: "payout_onboarding",
      title: "Stripe payout onboarding started",
      body: "Complete the hosted payout onboarding flow to unlock real seller transfer releases."
    }),
    createAuditLog({
      actorUserId: user.id,
      action: "payout.onboarding_link_created",
      entityType: "user",
      entityId: user.id,
      metadata: {
        connectedAccountId,
        useCaseType
      }
    })
  ]);

  return {
    ...mapPayoutAccount(await syncSellerPayoutAccount(user.id)),
    url: link.url,
    mode: "live" as const
  };
}
