import { ListingStatus, Prisma, UserRole, VerificationStatus } from "@prisma/client";
import { env } from "../../config/env.js";
import { prisma } from "../../config/prisma.js";
import { ApiError } from "../../utils/api-error.js";
import { createAuditLog } from "../audit/audit.service.js";
import { sendEmailToUser } from "../email/email.service.js";
import { createNotificationRecord } from "../notifications/notifications.service.js";

const verificationInclude = {
  listing: {
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      isVerified: true,
      platform: {
        select: {
          name: true,
          slug: true
        }
      },
      media: {
        orderBy: {
          sortOrder: "asc" as const
        }
      }
    }
  },
  seller: {
    select: {
      id: true,
      fullName: true,
      username: true,
      email: true
    }
  }
} satisfies Prisma.VerificationRequestInclude;

function mapVerification(
  verification: Prisma.VerificationRequestGetPayload<{ include: typeof verificationInclude }>
) {
  return {
    id: verification.id,
    status: verification.status,
    notes: verification.notes,
    reviewedAt: verification.reviewedAt,
    createdAt: verification.createdAt,
    listing: verification.listing,
    seller: verification.seller
  };
}

async function getOwnedListing(listingId: string, sellerId: string, role: UserRole) {
  const listing = await prisma.listing.findUnique({
    where: {
      id: listingId
    },
    include: {
      media: {
        orderBy: {
          sortOrder: "asc"
        }
      }
    }
  });

  if (!listing) {
    throw new ApiError(404, "Listing not found");
  }

  if (role !== UserRole.ADMIN && listing.sellerId !== sellerId) {
    throw new ApiError(403, "You can only submit verification for your own listings");
  }

  return listing;
}

export async function listMyVerifications(sellerId: string) {
  const requests = await prisma.verificationRequest.findMany({
    where: {
      sellerId
    },
    include: verificationInclude,
    orderBy: [{ createdAt: "desc" }]
  });

  return {
    data: requests.map(mapVerification),
    meta: {
      total: requests.length,
      pendingCount: requests.filter((request) => request.status === VerificationStatus.PENDING)
        .length
    }
  };
}

export async function submitVerificationRequest(
  actor: { id: string; role: UserRole },
  input: { listingId: string; notes?: string | null }
) {
  const listing = await getOwnedListing(input.listingId, actor.id, actor.role);

  if (listing.media.length === 0) {
    throw new ApiError(
      400,
      "Add at least one proof or media link to the listing before requesting verification"
    );
  }

  const existingPending = await prisma.verificationRequest.findFirst({
    where: {
      listingId: listing.id,
      sellerId: listing.sellerId,
      status: VerificationStatus.PENDING
    }
  });

  if (existingPending) {
    throw new ApiError(400, "This listing already has a verification request pending review");
  }

  const request = await prisma.verificationRequest.create({
    data: {
      listingId: listing.id,
      sellerId: listing.sellerId,
      notes: input.notes ?? null,
      status: VerificationStatus.PENDING
    },
    include: verificationInclude
  });

  await prisma.listing.update({
    where: {
      id: listing.id
    },
    data: {
      status:
        listing.status === ListingStatus.ACTIVE || listing.status === ListingStatus.DRAFT
          ? ListingStatus.PENDING_REVIEW
          : listing.status
    }
  });

  return mapVerification(request);
}

export async function listPendingVerifications() {
  const requests = await prisma.verificationRequest.findMany({
    where: {
      status: VerificationStatus.PENDING
    },
    include: verificationInclude,
    orderBy: [{ createdAt: "asc" }]
  });

  return {
    data: requests.map(mapVerification),
    meta: {
      total: requests.length,
      pendingCount: requests.length
    }
  };
}

export async function reviewVerificationRequest(
  verificationId: string,
  actor: { id: string; role: UserRole },
  input: { status: "APPROVED" | "REJECTED"; notes?: string | null }
) {
  if (actor.role !== UserRole.ADMIN) {
    throw new ApiError(403, "Only admins can review verification requests");
  }

  const existing = await prisma.verificationRequest.findUnique({
    where: {
      id: verificationId
    },
    include: verificationInclude
  });

  if (!existing) {
    throw new ApiError(404, "Verification request not found");
  }

  const request = await prisma.verificationRequest.update({
    where: {
      id: verificationId
    },
    data: {
      status: input.status,
      notes: input.notes ?? existing.notes ?? null,
      reviewedAt: new Date()
    },
    include: verificationInclude
  });

  await prisma.listing.update({
    where: {
      id: existing.listing.id
    },
    data: {
      isVerified: input.status === VerificationStatus.APPROVED,
      status:
        input.status === VerificationStatus.APPROVED
          ? ListingStatus.ACTIVE
          : ListingStatus.DRAFT
    }
  });

  await createNotificationRecord({
    userId: existing.seller.id,
    type: "verification",
    title:
      input.status === VerificationStatus.APPROVED
        ? "Verification approved"
        : "Verification needs changes",
    body:
      input.status === VerificationStatus.APPROVED
        ? `Your listing '${existing.listing.title}' is now verified.`
        : `Your listing '${existing.listing.title}' needs updates before it can be verified.`
  });

  await sendEmailToUser({
    userId: existing.seller.id,
    category: "trust",
    subject:
      input.status === VerificationStatus.APPROVED
        ? `Verification approved for ${existing.listing.title}`
        : `Verification update for ${existing.listing.title}`,
    heading:
      input.status === VerificationStatus.APPROVED
        ? "Your listing is now verified"
        : "Your verification request needs another pass",
    bodyLines:
      input.status === VerificationStatus.APPROVED
        ? [
            `Your listing '${existing.listing.title}' has been approved and now carries a verified signal.`,
            "That added trust should help buyers feel more confident when they review the asset."
          ]
        : [
            `Your verification request for '${existing.listing.title}' was not approved yet.`,
            input.notes
              ? `Reviewer note: ${input.notes}`
              : "Add stronger proof media or clearer ownership evidence, then submit again."
          ],
    ctaLabel: "Open verification workspace",
    ctaUrl: `${env.CLIENT_URL}/dashboard/verification`
  });

  await createAuditLog({
    actorUserId: actor.id,
    action: "verification.reviewed",
    entityType: "verification",
    entityId: request.id,
    metadata: {
      listingId: existing.listing.id,
      status: input.status,
      notes: input.notes ?? null
    }
  });

  return mapVerification(request);
}
