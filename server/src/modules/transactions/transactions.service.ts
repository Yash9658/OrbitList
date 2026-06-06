import {
  ListingStatus,
  Prisma,
  UserRole
} from "@prisma/client";
import type { DisputeStatus, TransactionStatus } from "@prisma/client";
import Stripe from "stripe";
import { env } from "../../config/env.js";
import { prisma } from "../../config/prisma.js";
import { getStripeClient } from "../../config/stripe.js";
import { ApiError } from "../../utils/api-error.js";
import { createAuditLog } from "../audit/audit.service.js";
import { sendEmailToUser } from "../email/email.service.js";
import { createNotificationRecord } from "../notifications/notifications.service.js";
import { syncSellerPayoutAccount } from "../payouts/payouts.service.js";

const transactionInclude = {
  listing: {
    select: {
      id: true,
      slug: true,
      title: true,
      status: true,
      platform: {
        select: {
          name: true,
          slug: true
        }
      }
    }
  },
  buyer: {
    select: {
      id: true,
      email: true,
      fullName: true,
      username: true,
      identityVerification: {
        select: {
          status: true
        }
      }
    }
  },
  seller: {
    select: {
      id: true,
      email: true,
      fullName: true,
      username: true,
      stripeConnectedAccountId: true,
      stripeConnectedAccountStatus: true,
      stripeConnectedAccountStatusReason: true,
      identityVerification: {
        select: {
          status: true
        }
      }
    }
  },
  disputes: {
    orderBy: {
      createdAt: "desc" as const
    },
    include: {
      openedBy: {
        select: {
          id: true,
          email: true,
          fullName: true
        }
      },
      resolvedBy: {
        select: {
          id: true,
          email: true,
          fullName: true
        }
      },
      evidence: {
        orderBy: {
          createdAt: "asc" as const
        },
        include: {
          submittedBy: {
            select: {
              id: true,
              email: true,
              fullName: true
            }
          }
        }
      },
      caseEvents: {
        orderBy: {
          createdAt: "asc" as const
        },
        include: {
          actor: {
            select: {
              id: true,
              email: true,
              fullName: true
            }
          }
        }
      }
    }
  }
} satisfies Prisma.TransactionInclude;

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function getPayoutFailureReason(error: unknown) {
  if (error instanceof Stripe.errors.StripeError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Stripe transfer release failed. Review the payout account and retry.";
}

function mapDisputeEvidence(
  evidence: Prisma.DisputeEvidenceGetPayload<{
    include: typeof transactionInclude.disputes.include.evidence.include;
  }>
) {
  return {
    id: evidence.id,
    visibility: evidence.visibility,
    kind: evidence.kind,
    fileUrl: evidence.fileUrl,
    note: evidence.note,
    createdAt: evidence.createdAt,
    submittedBy: evidence.submittedBy
  };
}

function mapDisputeCaseEvent(
  event: Prisma.DisputeCaseEventGetPayload<{
    include: typeof transactionInclude.disputes.include.caseEvents.include;
  }>
) {
  return {
    id: event.id,
    type: event.type,
    visibility: event.visibility,
    message: event.message,
    metadata: event.metadata,
    createdAt: event.createdAt,
    actor: event.actor
  };
}

function mapDispute(
  dispute: Prisma.DisputeGetPayload<{
    include: typeof transactionInclude.disputes.include;
  }>,
  viewerRole: UserRole
) {
  return {
    id: dispute.id,
    status: dispute.status,
    reason: dispute.reason,
    details: dispute.details,
    resolutionNotes: dispute.resolutionNotes,
    adminInternalNotes: viewerRole === UserRole.ADMIN ? dispute.adminInternalNotes : null,
    priority: dispute.priority,
    createdAt: dispute.createdAt,
    updatedAt: dispute.updatedAt,
    resolvedAt: dispute.resolvedAt,
    openedBy: dispute.openedBy,
    resolvedBy: dispute.resolvedBy,
    evidence: dispute.evidence
      .filter((item) => viewerRole === UserRole.ADMIN || item.visibility !== "admin_only")
      .map(mapDisputeEvidence),
    caseEvents: dispute.caseEvents
      .filter((item) => viewerRole === UserRole.ADMIN || item.visibility !== "admin_only")
      .map(mapDisputeCaseEvent)
  };
}

function mapTransaction(
  transaction: Prisma.TransactionGetPayload<{ include: typeof transactionInclude }>,
  viewerRole: UserRole
) {
  return {
    id: transaction.id,
    agreedPrice: Number(transaction.agreedPrice),
    currency: transaction.currency,
    status: transaction.status,
    buyerNotes: transaction.buyerNotes,
    sellerNotes: transaction.sellerNotes,
    handoffNotes: transaction.handoffNotes,
    reviewDeadlineAt: transaction.reviewDeadlineAt,
    completedAt: transaction.completedAt,
    sellerPayoutStatus: transaction.sellerPayoutStatus,
    sellerPayoutLastAttemptAt: transaction.sellerPayoutLastAttemptAt,
    sellerPayoutReleasedAt: transaction.sellerPayoutReleasedAt,
    sellerPayoutReference: transaction.sellerPayoutReference,
    sellerPayoutFailureReason: transaction.sellerPayoutFailureReason,
    refundIssuedAt: transaction.refundIssuedAt,
    refundReference: transaction.refundReference,
    stripeCheckoutSessionId: transaction.stripeCheckoutSessionId,
    stripePaymentIntentId: transaction.stripePaymentIntentId,
    createdAt: transaction.createdAt,
    updatedAt: transaction.updatedAt,
    listing: transaction.listing,
    buyer: transaction.buyer,
    seller: transaction.seller,
    compliance: {
      buyerIdentityStatus:
        transaction.buyer.identityVerification?.status ?? "NOT_STARTED",
      sellerIdentityStatus:
        transaction.seller.identityVerification?.status ?? "NOT_STARTED",
      buyerIdentityReady: transaction.buyer.identityVerification?.status === "APPROVED",
      sellerIdentityReady: transaction.seller.identityVerification?.status === "APPROVED",
      sellerPayoutAccountStatus: transaction.seller.stripeConnectedAccountStatus,
      sellerPayoutAccountReady:
        transaction.seller.stripeConnectedAccountStatus === "ACTIVE"
    },
    disputes: transaction.disputes.map((dispute) => mapDispute(dispute, viewerRole))
  };
}

function ensureParticipantOrAdmin(
  transaction: { buyerId: string; sellerId: string },
  actor: { id: string; role: UserRole }
) {
  if (
    actor.role !== UserRole.ADMIN &&
    transaction.buyerId !== actor.id &&
    transaction.sellerId !== actor.id
  ) {
    throw new ApiError(403, "You do not have access to this transaction");
  }
}

async function createDisputeCaseEventRecord(
  client: Prisma.TransactionClient | typeof prisma,
  input: {
    disputeId: string;
    actorUserId?: string | null;
    type: string;
    visibility?: "participants" | "admin_only";
    message: string;
    metadata?: Prisma.InputJsonValue;
  }
) {
  await client.disputeCaseEvent.create({
    data: {
      disputeId: input.disputeId,
      actorUserId: input.actorUserId ?? null,
      type: input.type,
      visibility: input.visibility ?? "participants",
      message: input.message,
      metadata: input.metadata
    }
  });
}

function getTransactionsSuccessUrl() {
  return `${env.CLIENT_URL}/transactions/success?session_id={CHECKOUT_SESSION_ID}`;
}

function getTransactionsCancelUrl() {
  return `${env.CLIENT_URL}/transactions/cancel`;
}

async function getPurchasableListing(listingId: string, buyerId: string) {
  const listing = await prisma.listing.findUnique({
    where: {
      id: listingId
    },
    select: {
      id: true,
      sellerId: true,
      title: true,
      slug: true,
      price: true,
      currency: true,
      status: true
    }
  });

  if (!listing) {
    throw new ApiError(404, "Listing not found");
  }

  if (listing.sellerId === buyerId) {
    throw new ApiError(400, "You cannot open a protected deal on your own listing");
  }

  if (listing.status !== ListingStatus.ACTIVE) {
    throw new ApiError(400, "Only live listings can start a protected transaction");
  }

  return listing;
}

function getPendingReleaseStatus(
  transaction: {
    seller: {
      identityVerification?: {
        status: string;
      } | null;
    };
  }
) {
  return transaction.seller.identityVerification?.status === "APPROVED"
    ? "PENDING_RELEASE"
    : "BLOCKED";
}

async function assertIdentityApproved(userId: string, roleLabel: "buyer" | "seller") {
  const verification = await prisma.identityVerification.findUnique({
    where: {
      userId
    },
    select: {
      status: true
    }
  });

  if (verification?.status !== "APPROVED") {
    if (roleLabel === "buyer") {
      throw new ApiError(
        400,
        "Complete identity verification in Settings before starting a protected deal"
      );
    }

    throw new ApiError(
      400,
      "This seller is not yet approved for protected money-movement workflows"
    );
  }
}

async function getTransactionForActor(
  id: string,
  actor: { id: string; role: UserRole }
) {
  const transaction = await prisma.transaction.findUnique({
    where: {
      id
    },
    include: transactionInclude
  });

  if (!transaction) {
    throw new ApiError(404, "Transaction not found");
  }

  ensureParticipantOrAdmin(transaction, actor);
  return transaction;
}

async function getDisputeForActor(
  id: string,
  actor: { id: string; role: UserRole }
) {
  const dispute = await prisma.dispute.findUnique({
    where: {
      id
    },
    include: {
      ...transactionInclude.disputes.include,
      transaction: {
        include: transactionInclude
      }
    }
  });

  if (!dispute) {
    throw new ApiError(404, "Dispute not found");
  }

  ensureParticipantOrAdmin(dispute.transaction, actor);

  return dispute;
}

async function getTransactionBySessionForBuyer(sessionId: string, buyerId: string) {
  const transaction = await prisma.transaction.findFirst({
    where: {
      buyerId,
      stripeCheckoutSessionId: sessionId
    },
    include: transactionInclude
  });

  if (!transaction) {
    throw new ApiError(404, "Transaction checkout session not found");
  }

  return transaction;
}

async function markFundsSecured(
  transaction: Prisma.TransactionGetPayload<{ include: typeof transactionInclude }>,
  stripePaymentIntentId?: string | null
) {
  if (transaction.status !== "PENDING_PAYMENT") {
    return mapTransaction(transaction, UserRole.BUYER);
  }

  const updated = await prisma.transaction.update({
    where: {
      id: transaction.id
    },
    data: {
      status: "FUNDS_SECURED",
      stripePaymentIntentId: stripePaymentIntentId ?? transaction.stripePaymentIntentId,
      reviewDeadlineAt: addDays(new Date(), env.TRANSACTION_REVIEW_WINDOW_DAYS)
    },
    include: transactionInclude
  });

  await Promise.all([
    createNotificationRecord({
      userId: updated.seller.id,
      type: "transaction_funded",
      title: "Protected deal funded",
      body: `Funds are secured for '${updated.listing.title}'. You can prepare the handoff now.`
    }),
    createNotificationRecord({
      userId: updated.buyer.id,
      type: "transaction_funded",
      title: "Funds secured",
      body: `Your protected deal for '${updated.listing.title}' is now funded.`
    }),
    sendEmailToUser({
      userId: updated.seller.id,
      category: "transactions",
      subject: `Protected deal funded for ${updated.listing.title}`,
      heading: "Funds are secured for a new deal",
      bodyLines: [
        `A buyer funded the protected transaction for '${updated.listing.title}'.`,
        "Prepare the handoff and submit transfer notes once the account package is ready."
      ],
      ctaLabel: "Open transaction",
      ctaUrl: `${env.CLIENT_URL}/transactions/${updated.id}`
    }),
    createAuditLog({
      actorUserId: updated.buyer.id,
      action: "transaction.funded",
      entityType: "transaction",
      entityId: updated.id,
      metadata: {
        listingId: updated.listing.id,
        paymentIntentId: stripePaymentIntentId ?? null
      }
    })
  ]);

  return mapTransaction(updated, UserRole.BUYER);
}

function isStripeConfigured() {
  return Boolean(getStripeClient());
}

export async function createProtectedTransactionCheckout(input: {
  buyerId: string;
  listingId: string;
  buyerNotes?: string | null;
}) {
  const listing = await getPurchasableListing(input.listingId, input.buyerId);
  await Promise.all([
    assertIdentityApproved(input.buyerId, "buyer"),
    assertIdentityApproved(listing.sellerId, "seller")
  ]);

  const existingOpenTransaction = await prisma.transaction.findFirst({
    where: {
      listingId: listing.id,
      buyerId: input.buyerId,
      status: {
        in: [
          "PENDING_PAYMENT",
          "FUNDS_SECURED",
          "HANDOFF_SUBMITTED",
          "BUYER_REVIEW",
          "DISPUTED"
        ]
      }
    },
    include: transactionInclude
  });

  if (existingOpenTransaction) {
    throw new ApiError(400, "You already have an active protected deal for this listing");
  }

  const stripe = getStripeClient();

  if (!stripe) {
    const sessionId = `demo_transaction_${Date.now()}`;
    const transaction = await prisma.transaction.create({
      data: {
        listingId: listing.id,
        buyerId: input.buyerId,
        sellerId: listing.sellerId,
        agreedPrice: listing.price,
        currency: listing.currency,
        buyerNotes: input.buyerNotes ?? null,
        stripeCheckoutSessionId: sessionId
      },
      include: transactionInclude
    });

    await createAuditLog({
      actorUserId: input.buyerId,
      action: "transaction.created",
      entityType: "transaction",
      entityId: transaction.id,
      metadata: {
        listingId: listing.id,
        mode: "demo"
      }
    });

    return {
      transaction: mapTransaction(transaction, UserRole.BUYER),
      sessionId,
      url: `${env.CLIENT_URL}/transactions/success?session_id=${sessionId}`,
      mode: "demo" as const
    };
  }

  const transaction = await prisma.transaction.create({
    data: {
      listingId: listing.id,
      buyerId: input.buyerId,
      sellerId: listing.sellerId,
      agreedPrice: listing.price,
      currency: listing.currency,
      buyerNotes: input.buyerNotes ?? null
    },
    include: transactionInclude
  });

  const buyer = await prisma.user.findUnique({
    where: {
      id: input.buyerId
    },
    select: {
      email: true
    }
  });

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    success_url: getTransactionsSuccessUrl(),
    cancel_url: getTransactionsCancelUrl(),
    customer_email: buyer?.email ?? undefined,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: listing.currency.toLowerCase(),
          unit_amount: Math.round(Number(listing.price) * 100),
          product_data: {
            name: `Protected transfer for ${listing.title}`,
            description:
              "Funds are secured first, then the seller submits handoff details through the marketplace workflow."
          }
        }
      }
    ],
    metadata: {
      transactionId: transaction.id,
      listingId: listing.id,
      buyerId: input.buyerId,
      sellerId: listing.sellerId,
      kind: "protected_transaction"
    }
  });

  const updated = await prisma.transaction.update({
    where: {
      id: transaction.id
    },
    data: {
      stripeCheckoutSessionId: session.id
    },
    include: transactionInclude
  });

  await createAuditLog({
    actorUserId: input.buyerId,
    action: "transaction.created",
    entityType: "transaction",
    entityId: updated.id,
    metadata: {
      listingId: listing.id,
      mode: "live",
      stripeCheckoutSessionId: session.id
    }
  });

  return {
    transaction: mapTransaction(updated, UserRole.BUYER),
    sessionId: session.id,
    url: session.url!,
    mode: "live" as const
  };
}

export async function confirmProtectedTransactionCheckout(
  buyerId: string,
  sessionId: string
) {
  const transaction = await getTransactionBySessionForBuyer(sessionId, buyerId);

  if ((transaction.stripeCheckoutSessionId?.startsWith("demo_") ?? false) === true) {
    return {
      transaction: await markFundsSecured(transaction),
      mode: "demo" as const
    };
  }

  const stripe = getStripeClient();

  if (!stripe) {
    throw new ApiError(503, "Stripe is not configured");
  }

  const session = await stripe.checkout.sessions.retrieve(sessionId);

  if (session.mode !== "payment" || session.payment_status !== "paid") {
    throw new ApiError(400, "Checkout session is not ready to confirm");
  }

  return {
    transaction: await markFundsSecured(
      transaction,
      typeof session.payment_intent === "string" ? session.payment_intent : null
    ),
    mode: "live" as const
  };
}

export async function listTransactionsForActor(actor: { id: string; role: UserRole }) {
  const transactions = await prisma.transaction.findMany({
    where:
      actor.role === UserRole.ADMIN
        ? undefined
        : {
            OR: [{ buyerId: actor.id }, { sellerId: actor.id }]
          },
    include: transactionInclude,
    orderBy: [{ updatedAt: "desc" }]
  });

  return {
    data: transactions.map((transaction) => mapTransaction(transaction, actor.role)),
    meta: {
      total: transactions.length,
      activeCount: transactions.filter((item) =>
        [
          "PENDING_PAYMENT",
          "FUNDS_SECURED",
          "HANDOFF_SUBMITTED",
          "BUYER_REVIEW",
          "DISPUTED"
        ].includes(item.status)
      ).length
    }
  };
}

export async function getTransactionDetail(id: string, actor: { id: string; role: UserRole }) {
  const transaction = await getTransactionForActor(id, actor);
  return mapTransaction(transaction, actor.role);
}

export async function updateTransactionStatus(input: {
  transactionId: string;
  actor: { id: string; role: UserRole };
  status:
    | "HANDOFF_SUBMITTED"
    | "BUYER_REVIEW"
    | "COMPLETED"
    | "CANCELLED";
  notes?: string | null;
}) {
  const transaction = await getTransactionForActor(input.transactionId, input.actor);

  if (transaction.status === "DISPUTED") {
    throw new ApiError(400, "Resolve the dispute before changing transaction status");
  }

  const isBuyer = transaction.buyerId === input.actor.id;
  const isSeller = transaction.sellerId === input.actor.id;

  if (input.status === "CANCELLED") {
    if (!isBuyer || transaction.status !== "PENDING_PAYMENT") {
      throw new ApiError(400, "Only the buyer can cancel before payment is secured");
    }
  }

  if (input.status === "HANDOFF_SUBMITTED") {
    if (!isSeller || transaction.status !== "FUNDS_SECURED") {
      throw new ApiError(400, "Only the seller can submit the protected handoff after funding");
    }
  }

  if (input.status === "BUYER_REVIEW") {
    if (!isBuyer || transaction.status !== "HANDOFF_SUBMITTED") {
      throw new ApiError(400, "Only the buyer can move the deal into review after handoff");
    }
  }

  if (input.status === "COMPLETED") {
    if (
      !isBuyer ||
      (transaction.status !== "HANDOFF_SUBMITTED" && transaction.status !== "BUYER_REVIEW")
    ) {
      throw new ApiError(400, "Only the buyer can complete the transaction after handoff");
    }
  }

  const updated = await prisma.transaction.update({
    where: {
      id: transaction.id
    },
    data: {
      status: input.status,
      sellerPayoutStatus:
        input.status === "COMPLETED"
          ? getPendingReleaseStatus(transaction)
          : transaction.sellerPayoutStatus,
      sellerNotes: isSeller ? input.notes ?? transaction.sellerNotes : transaction.sellerNotes,
      handoffNotes:
        input.status === "HANDOFF_SUBMITTED"
          ? input.notes ?? transaction.handoffNotes
          : transaction.handoffNotes,
      buyerNotes:
        input.status === "BUYER_REVIEW" || input.status === "COMPLETED"
          ? input.notes ?? transaction.buyerNotes
          : transaction.buyerNotes,
      completedAt:
        input.status === "COMPLETED" ? new Date() : transaction.completedAt,
      sellerPayoutLastAttemptAt: null,
      sellerPayoutReleasedAt: null,
      sellerPayoutReference: null,
      sellerPayoutFailureReason: null
    },
    include: transactionInclude
  });

  const recipientUserId = isBuyer ? updated.seller.id : updated.buyer.id;
  const actorLabel = isBuyer ? "Buyer" : "Seller";

  await Promise.all([
    createNotificationRecord({
      userId: recipientUserId,
      type: "transaction_update",
      title: "Protected transaction updated",
      body: `${actorLabel} updated the transaction for '${updated.listing.title}' to ${updated.status.replace(/_/g, " ").toLowerCase()}.`
    }),
    createAuditLog({
      actorUserId: input.actor.id,
      action: "transaction.status_updated",
      entityType: "transaction",
      entityId: updated.id,
      metadata: {
        status: updated.status,
        notes: input.notes ?? null
      }
    })
  ]);

  return mapTransaction(updated, input.actor.role);
}

export async function openTransactionDispute(input: {
  transactionId: string;
  actor: { id: string; role: UserRole };
  reason: string;
  details?: string | null;
}) {
  const transaction = await getTransactionForActor(input.transactionId, input.actor);

  if (
    transaction.status === "CANCELLED" ||
    transaction.status === "REFUNDED" ||
    transaction.status === "PENDING_PAYMENT"
  ) {
    throw new ApiError(400, "This transaction is not eligible for a dispute yet");
  }

  const existingOpenDispute = transaction.disputes.find((item) =>
    item.status === "OPEN" || item.status === "UNDER_REVIEW"
  );

  if (existingOpenDispute) {
    throw new ApiError(400, "This transaction already has an active dispute");
  }

  const created = await prisma.$transaction(async (trx) => {
    const dispute = await trx.dispute.create({
      data: {
        transactionId: transaction.id,
        openedById: input.actor.id,
        reason: input.reason,
        details: input.details ?? null
      },
      include: {
        openedBy: {
          select: {
            id: true,
            email: true,
            fullName: true
          }
        },
        resolvedBy: {
          select: {
            id: true,
            email: true,
            fullName: true
          }
        }
      }
    });

    await trx.transaction.update({
      where: {
        id: transaction.id
      },
      data: {
        status: "DISPUTED",
        sellerPayoutStatus: "BLOCKED"
      }
    });

    await createDisputeCaseEventRecord(trx, {
      disputeId: dispute.id,
      actorUserId: input.actor.id,
      type: "dispute_opened",
      message: `${input.actor.role === UserRole.ADMIN ? "Admin" : "Participant"} opened a dispute.`,
      metadata: {
        reason: input.reason
      }
    });

    return dispute;
  });

  const admins = await prisma.user.findMany({
    where: {
      role: UserRole.ADMIN
    },
    select: {
      id: true
    }
  });

  await Promise.all([
    ...admins.map((admin) =>
      createNotificationRecord({
        userId: admin.id,
        type: "dispute",
        title: "Protected deal dispute opened",
        body: `A dispute was opened for '${transaction.listing.title}'.`
      })
    ),
    createAuditLog({
      actorUserId: input.actor.id,
      action: "dispute.opened",
      entityType: "dispute",
      entityId: created.id,
      metadata: {
        transactionId: transaction.id,
        reason: input.reason
      }
    })
  ]);

  return getTransactionDetail(transaction.id, input.actor);
}

export async function listAdminDisputes(status?: DisputeStatus) {
  const disputes = await prisma.dispute.findMany({
    where: status ? { status } : undefined,
    include: {
      ...transactionInclude.disputes.include,
      transaction: {
        include: transactionInclude
      }
    },
    orderBy: [{ createdAt: "desc" }]
  });

  return {
    data: disputes.map((dispute) => ({
      ...mapDispute(dispute, UserRole.ADMIN),
      transaction: mapTransaction(dispute.transaction, UserRole.ADMIN)
    })),
    meta: {
      total: disputes.length,
      openCount: disputes.filter((item) => item.status === "OPEN").length,
      underReviewCount: disputes.filter((item) => item.status === "UNDER_REVIEW").length
    }
  };
}

export async function addDisputeEvidence(input: {
  disputeId: string;
  actor: { id: string; role: UserRole };
  fileUrl: string;
  note?: string | null;
  visibility?: "participants" | "admin_only";
}) {
  const dispute = await getDisputeForActor(input.disputeId, input.actor);

  const nextVisibility =
    input.actor.role === UserRole.ADMIN && input.visibility === "admin_only"
      ? "admin_only"
      : "participants";

  const updated = await prisma.$transaction(async (trx) => {
    await trx.disputeEvidence.create({
      data: {
        disputeId: dispute.id,
        submittedById: input.actor.id,
        fileUrl: input.fileUrl,
        note: input.note ?? null,
        visibility: nextVisibility,
        kind: "file"
      }
    });

    await createDisputeCaseEventRecord(trx, {
      disputeId: dispute.id,
      actorUserId: input.actor.id,
      type: "evidence_added",
      visibility: nextVisibility,
      message:
        nextVisibility === "admin_only"
          ? "Admin uploaded internal dispute evidence."
          : "New dispute evidence was uploaded.",
      metadata: {
        visibility: nextVisibility
      }
    });

    return trx.dispute.findUniqueOrThrow({
      where: {
        id: dispute.id
      },
      include: transactionInclude.disputes.include
    });
  });

  await createAuditLog({
    actorUserId: input.actor.id,
    action: "dispute.evidence_added",
    entityType: "dispute",
    entityId: dispute.id,
    metadata: {
      visibility: nextVisibility
    }
  });

  return mapDispute(updated, input.actor.role);
}

export async function addDisputeCaseNote(input: {
  disputeId: string;
  actor: { id: string; role: UserRole };
  message: string;
  visibility?: "participants" | "admin_only";
}) {
  const dispute = await getDisputeForActor(input.disputeId, input.actor);

  if (input.actor.role !== UserRole.ADMIN && dispute.status === "CLOSED") {
    throw new ApiError(400, "Closed disputes can no longer accept participant updates");
  }

  const nextVisibility =
    input.actor.role === UserRole.ADMIN && input.visibility === "admin_only"
      ? "admin_only"
      : "participants";

  const eventType =
    input.actor.role === UserRole.ADMIN
      ? nextVisibility === "admin_only"
        ? "admin_note"
        : "admin_update"
      : "participant_update";

  const eventMessage =
    input.actor.role === UserRole.ADMIN && nextVisibility === "admin_only"
      ? `Internal ops note: ${input.message}`
      : input.message;

  const updated = await prisma.$transaction(async (trx) => {
    await createDisputeCaseEventRecord(trx, {
      disputeId: dispute.id,
      actorUserId: input.actor.id,
      type: eventType,
      visibility: nextVisibility,
      message: eventMessage
    });

    return trx.dispute.findUniqueOrThrow({
      where: {
        id: dispute.id
      },
      include: transactionInclude.disputes.include
    });
  });

  await Promise.all([
    nextVisibility === "participants"
      ? Promise.all([
          createNotificationRecord({
            userId: dispute.transaction.buyerId,
            type: "dispute_update",
            title: "New dispute update",
            body: `A new case note was added to the dispute for '${dispute.transaction.listing.title}'.`
          }),
          createNotificationRecord({
            userId: dispute.transaction.sellerId,
            type: "dispute_update",
            title: "New dispute update",
            body: `A new case note was added to the dispute for '${dispute.transaction.listing.title}'.`
          })
        ])
      : Promise.resolve(),
    createAuditLog({
      actorUserId: input.actor.id,
      action: "dispute.case_note_added",
      entityType: "dispute",
      entityId: dispute.id,
      metadata: {
        visibility: nextVisibility,
        type: eventType
      }
    })
  ]);

  return mapDispute(updated, input.actor.role);
}

export async function reviewDispute(input: {
  disputeId: string;
  actor: { id: string; role: UserRole };
  status:
    | "UNDER_REVIEW"
    | "RESOLVED_FOR_BUYER"
    | "RESOLVED_FOR_SELLER"
    | "CLOSED";
  resolutionNotes?: string | null;
  adminInternalNotes?: string | null;
  priority?: string | null;
}) {
  if (input.actor.role !== UserRole.ADMIN) {
    throw new ApiError(403, "Only admins can review disputes");
  }

  const dispute = await prisma.dispute.findUnique({
    where: {
      id: input.disputeId
    },
    include: {
      ...transactionInclude.disputes.include,
      transaction: {
        include: transactionInclude
      }
    }
  });

  if (!dispute) {
    throw new ApiError(404, "Dispute not found");
  }

  let nextTransactionStatus = dispute.transaction.status;
  let nextPayoutStatus = dispute.transaction.sellerPayoutStatus;

  if (input.status === "RESOLVED_FOR_BUYER") {
    nextTransactionStatus = "DISPUTED";
    nextPayoutStatus = "REFUND_PENDING";
  } else if (input.status === "RESOLVED_FOR_SELLER") {
    nextTransactionStatus = "COMPLETED";
    nextPayoutStatus = getPendingReleaseStatus(dispute.transaction);
  } else if (input.status === "CLOSED") {
    nextTransactionStatus = "BUYER_REVIEW";
    nextPayoutStatus = "NOT_READY";
  } else if (input.status === "UNDER_REVIEW") {
    nextPayoutStatus = "BLOCKED";
  }

  const updated = await prisma.$transaction(async (trx) => {
    const nextDispute = await trx.dispute.update({
      where: {
        id: dispute.id
      },
      data: {
        status: input.status,
        resolutionNotes: input.resolutionNotes ?? null,
        adminInternalNotes: input.adminInternalNotes ?? null,
        priority: input.priority ?? dispute.priority,
        resolvedAt:
          input.status === "UNDER_REVIEW" ? null : new Date(),
        resolvedById:
          input.status === "UNDER_REVIEW" ? null : input.actor.id
      },
      include: transactionInclude.disputes.include
    });

    await trx.transaction.update({
      where: {
        id: dispute.transaction.id
      },
      data: {
        status: nextTransactionStatus,
        sellerPayoutStatus: nextPayoutStatus,
        completedAt:
          nextTransactionStatus === "COMPLETED" ? new Date() : dispute.transaction.completedAt
      }
    });

    await createDisputeCaseEventRecord(trx, {
      disputeId: dispute.id,
      actorUserId: input.actor.id,
      type: "admin_review",
      visibility: "participants",
      message: `Admin moved the dispute to ${input.status.toLowerCase().replace(/_/g, " ")}.`,
      metadata: {
        priority: input.priority ?? dispute.priority,
        nextTransactionStatus,
        nextPayoutStatus
      }
    });

    if (input.adminInternalNotes) {
      await createDisputeCaseEventRecord(trx, {
        disputeId: dispute.id,
        actorUserId: input.actor.id,
        type: "admin_note",
        visibility: "admin_only",
        message: `Internal ops note: ${input.adminInternalNotes}`
      });
    }

    return nextDispute;
  });

  await Promise.all([
    createNotificationRecord({
      userId: dispute.transaction.buyer.id,
      type: "dispute_update",
      title: "Dispute updated",
      body: `The dispute for '${dispute.transaction.listing.title}' is now ${input.status.toLowerCase().replace(/_/g, " ")}.`
    }),
    createNotificationRecord({
      userId: dispute.transaction.seller.id,
      type: "dispute_update",
      title: "Dispute updated",
      body: `The dispute for '${dispute.transaction.listing.title}' is now ${input.status.toLowerCase().replace(/_/g, " ")}.`
    }),
    sendEmailToUser({
      userId: dispute.transaction.buyer.id,
      category: "transactions",
      subject: `Dispute update for ${dispute.transaction.listing.title}`,
      heading: "Your protected deal dispute has an update",
      bodyLines: [
        `The dispute status is now ${input.status.toLowerCase().replace(/_/g, " ")}.`,
        input.priority ? `Case priority: ${input.priority}.` : null,
        input.resolutionNotes
          ? `Admin note: ${input.resolutionNotes}`
          : "Open the transaction workspace to review the updated state."
      ].filter(Boolean) as string[],
      ctaLabel: "Open transaction",
      ctaUrl: `${env.CLIENT_URL}/transactions/${dispute.transaction.id}`
    }),
    createAuditLog({
      actorUserId: input.actor.id,
      action: "dispute.reviewed",
      entityType: "dispute",
      entityId: updated.id,
      metadata: {
        status: input.status,
        transactionId: dispute.transaction.id,
        nextTransactionStatus,
        nextPayoutStatus,
        priority: input.priority ?? dispute.priority
      }
    })
  ]);

  return {
    dispute: mapDispute(updated, UserRole.ADMIN),
    transaction: await getTransactionDetail(dispute.transaction.id, input.actor)
  };
}

export async function releaseSellerPayout(input: {
  transactionId: string;
  actor: { id: string; role: UserRole };
  notes?: string | null;
}) {
  if (input.actor.role !== UserRole.ADMIN) {
    throw new ApiError(403, "Only admins can release seller payouts");
  }

  const transaction = await prisma.transaction.findUnique({
    where: {
      id: input.transactionId
    },
    include: transactionInclude
  });

  if (!transaction) {
    throw new ApiError(404, "Transaction not found");
  }

  if (transaction.status !== "COMPLETED") {
    throw new ApiError(400, "Only completed transactions can move into payout release");
  }

  if (
    transaction.sellerPayoutStatus !== "PENDING_RELEASE" &&
    !(
      transaction.sellerPayoutStatus === "BLOCKED" &&
      transaction.sellerPayoutFailureReason
    )
  ) {
    throw new ApiError(400, "This transaction is not ready for seller payout release");
  }

  const isDemoTransaction = transaction.stripeCheckoutSessionId?.startsWith("demo_") ?? false;
  let releaseReference = `manual_connect_release_${Date.now()}`;
  const payoutAttemptedAt = new Date();

  try {
    if (!isDemoTransaction) {
      const stripe = getStripeClient();

      if (!stripe) {
        throw new ApiError(503, "Stripe is not configured");
      }

      const sellerPayoutAccount = await syncSellerPayoutAccount(transaction.seller.id);

      if (!sellerPayoutAccount.stripeConnectedAccountId) {
        throw new ApiError(
          400,
          "Seller has not completed Stripe payout onboarding yet"
        );
      }

      if (sellerPayoutAccount.stripeConnectedAccountStatus !== "ACTIVE") {
        throw new ApiError(
          400,
          sellerPayoutAccount.stripeConnectedAccountStatusReason ??
            "Seller payout onboarding is not ready for release yet"
        );
      }

      if (!transaction.stripePaymentIntentId) {
        throw new ApiError(
          400,
          "This transaction is missing the Stripe payment reference required for payout release"
        );
      }

      const paymentIntent = await stripe.paymentIntents.retrieve(
        transaction.stripePaymentIntentId,
        {
          expand: ["latest_charge"]
        }
      );

      const sourceTransaction =
        typeof paymentIntent.latest_charge === "string"
          ? paymentIntent.latest_charge
          : paymentIntent.latest_charge?.id;

      const transfer = await stripe.transfers.create({
        amount: Math.round(Number(transaction.agreedPrice) * 100),
        currency: transaction.currency.toLowerCase(),
        destination: sellerPayoutAccount.stripeConnectedAccountId,
        source_transaction: sourceTransaction,
        metadata: {
          transactionId: transaction.id,
          listingId: transaction.listing.id,
          sellerId: transaction.seller.id
        }
      });

      releaseReference = transfer.id;
    } else {
      releaseReference = `demo_release_${Date.now()}`;
    }
  } catch (error) {
    const failureReason = getPayoutFailureReason(error);

    const failedTransaction = await prisma.transaction.update({
      where: {
        id: transaction.id
      },
      data: {
        sellerPayoutStatus: "BLOCKED",
        sellerPayoutLastAttemptAt: payoutAttemptedAt,
        sellerPayoutFailureReason: failureReason
      },
      include: transactionInclude
    });

    const latestDispute = await prisma.dispute.findFirst({
      where: {
        transactionId: transaction.id
      },
      orderBy: {
        createdAt: "desc"
      },
      select: {
        id: true
      }
    });

    await Promise.all([
      latestDispute
        ? createDisputeCaseEventRecord(prisma, {
            disputeId: latestDispute.id,
            actorUserId: input.actor.id,
            type: "payout_release_failed",
            message: "Admin payout release failed and needs another retry.",
            metadata: {
              failureReason
            }
          })
        : Promise.resolve(),
      createNotificationRecord({
        userId: failedTransaction.seller.id,
        type: "payout_release_failed",
        title: "Seller payout delayed",
        body: `The payout release for '${failedTransaction.listing.title}' needs another retry from admin ops.`
      }),
      createAuditLog({
        actorUserId: input.actor.id,
        action: "transaction.payout_release_failed",
        entityType: "transaction",
        entityId: failedTransaction.id,
        metadata: {
          failureReason
        }
      })
    ]);

    throw new ApiError(502, failureReason);
  }

  const updated = await prisma.transaction.update({
    where: {
      id: transaction.id
    },
    data: {
      sellerPayoutStatus: "RELEASED",
      sellerPayoutLastAttemptAt: payoutAttemptedAt,
      sellerPayoutReleasedAt: new Date(),
      sellerPayoutReference: releaseReference,
      sellerPayoutFailureReason: null
    },
    include: transactionInclude
  });

  const latestDispute = await prisma.dispute.findFirst({
    where: {
      transactionId: transaction.id
    },
    orderBy: {
      createdAt: "desc"
    },
    select: {
      id: true
    }
  });

  if (latestDispute) {
    await createDisputeCaseEventRecord(prisma, {
      disputeId: latestDispute.id,
      actorUserId: input.actor.id,
      type: "payout_released",
      message: "Admin released seller payout after dispute resolution.",
      metadata: {
        releaseReference
      }
    });
  }

  await Promise.all([
    createNotificationRecord({
      userId: updated.seller.id,
      type: "payout_release",
      title: "Seller payout released",
      body: `The payout release for '${updated.listing.title}' has been recorded by admin operations.`
    }),
    sendEmailToUser({
      userId: updated.seller.id,
      category: "transactions",
      subject: `Payout released for ${updated.listing.title}`,
      heading: "Your protected deal payout has been released",
      bodyLines: [
        `The payout release for '${updated.listing.title}' has been marked as completed.`,
        input.notes ? `Ops note: ${input.notes}` : "Open the transaction workspace for the latest release record."
      ],
      ctaLabel: "Open transaction",
      ctaUrl: `${env.CLIENT_URL}/transactions/${updated.id}`
    }),
    createAuditLog({
      actorUserId: input.actor.id,
      action: "transaction.payout_released",
      entityType: "transaction",
      entityId: updated.id,
      metadata: {
        releaseReference,
        notes: input.notes ?? null
      }
    })
  ]);

  return mapTransaction(updated, UserRole.ADMIN);
}

export async function issueBuyerRefund(input: {
  transactionId: string;
  actor: { id: string; role: UserRole };
  notes?: string | null;
}) {
  if (input.actor.role !== UserRole.ADMIN) {
    throw new ApiError(403, "Only admins can issue buyer refunds");
  }

  const transaction = await prisma.transaction.findUnique({
    where: {
      id: input.transactionId
    },
    include: transactionInclude
  });

  if (!transaction) {
    throw new ApiError(404, "Transaction not found");
  }

  if (
    transaction.sellerPayoutStatus !== "REFUND_PENDING" &&
    transaction.status !== "DISPUTED"
  ) {
    throw new ApiError(400, "This transaction is not in a refund-ready state");
  }

  let refundReference = transaction.refundReference ?? `demo_refund_${Date.now()}`;

  if (
    transaction.stripeCheckoutSessionId &&
    !transaction.stripeCheckoutSessionId.startsWith("demo_") &&
    transaction.stripePaymentIntentId
  ) {
    const stripe = getStripeClient();

    if (!stripe) {
      throw new ApiError(503, "Stripe is not configured");
    }

    const refund = await stripe.refunds.create({
      payment_intent: transaction.stripePaymentIntentId,
      metadata: {
        transactionId: transaction.id
      }
    });

    refundReference = refund.id;
  }

  const updated = await prisma.transaction.update({
    where: {
      id: transaction.id
    },
    data: {
      status: "REFUNDED",
      sellerPayoutStatus: "REFUNDED",
      refundIssuedAt: new Date(),
      refundReference
    },
    include: transactionInclude
  });

  const latestDispute = await prisma.dispute.findFirst({
    where: {
      transactionId: transaction.id
    },
    orderBy: {
      createdAt: "desc"
    },
    select: {
      id: true
    }
  });

  if (latestDispute) {
    await createDisputeCaseEventRecord(prisma, {
      disputeId: latestDispute.id,
      actorUserId: input.actor.id,
      type: "refund_issued",
      message: "Admin issued a buyer refund from the dispute workflow.",
      metadata: {
        refundReference
      }
    });
  }

  await Promise.all([
    createNotificationRecord({
      userId: updated.buyer.id,
      type: "refund_issued",
      title: "Buyer refund issued",
      body: `The refund for '${updated.listing.title}' has been recorded.`
    }),
    createNotificationRecord({
      userId: updated.seller.id,
      type: "refund_issued",
      title: "Protected deal refunded",
      body: `The protected deal for '${updated.listing.title}' has been refunded to the buyer.`
    }),
    sendEmailToUser({
      userId: updated.buyer.id,
      category: "transactions",
      subject: `Refund issued for ${updated.listing.title}`,
      heading: "Your refund has been issued",
      bodyLines: [
        `The refund for '${updated.listing.title}' has been issued.`,
        input.notes ? `Ops note: ${input.notes}` : "Open the transaction workspace for the latest refund record."
      ],
      ctaLabel: "Open transaction",
      ctaUrl: `${env.CLIENT_URL}/transactions/${updated.id}`
    }),
    createAuditLog({
      actorUserId: input.actor.id,
      action: "transaction.refund_issued",
      entityType: "transaction",
      entityId: updated.id,
      metadata: {
        refundReference,
        notes: input.notes ?? null
      }
    })
  ]);

  return mapTransaction(updated, UserRole.ADMIN);
}
