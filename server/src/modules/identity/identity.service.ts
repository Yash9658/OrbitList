import { UserRole } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { ApiError } from "../../utils/api-error.js";
import { createAuditLog } from "../audit/audit.service.js";
import { createNotificationRecord } from "../notifications/notifications.service.js";
import { sendEmailToUser } from "../email/email.service.js";
import { env } from "../../config/env.js";

const identityInclude = {
  user: {
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true
    }
  },
  reviewedBy: {
    select: {
      id: true,
      email: true,
      fullName: true
    }
  }
} as const;

function mapIdentityVerification(
  verification: Awaited<
    ReturnType<typeof prisma.identityVerification.findFirstOrThrow>
  > & {
    user?: {
      id: string;
      email: string;
      fullName: string | null;
      role: UserRole;
    };
    reviewedBy?: {
      id: string;
      email: string;
      fullName: string | null;
    } | null;
  }
) {
  return {
    id: verification.id,
    userId: verification.userId,
    status: verification.status,
    legalName: verification.legalName,
    dateOfBirth: verification.dateOfBirth,
    country: verification.country,
    documentType: verification.documentType,
    documentNumberLast4: verification.documentNumberLast4,
    addressLine1: verification.addressLine1,
    city: verification.city,
    postalCode: verification.postalCode,
    documentUrl: verification.documentUrl,
    notes: verification.notes,
    rejectionReason: verification.rejectionReason,
    reviewedAt: verification.reviewedAt,
    createdAt: verification.createdAt,
    updatedAt: verification.updatedAt,
    user: verification.user,
    reviewedBy: verification.reviewedBy ?? null
  };
}

async function getVerificationByUserId(userId: string) {
  return prisma.identityVerification.findUnique({
    where: {
      userId
    },
    include: identityInclude
  });
}

export async function getMyIdentityVerification(userId: string) {
  const existing = await getVerificationByUserId(userId);

  if (!existing) {
    return {
      id: null,
      userId,
      status: "NOT_STARTED" as const,
      legalName: null,
      dateOfBirth: null,
      country: null,
      documentType: null,
      documentNumberLast4: null,
      addressLine1: null,
      city: null,
      postalCode: null,
      documentUrl: null,
      notes: null,
      rejectionReason: null,
      reviewedAt: null,
      createdAt: null,
      updatedAt: null,
      user: null,
      reviewedBy: null
    };
  }

  return mapIdentityVerification(existing);
}

export async function submitIdentityVerification(input: {
  userId: string;
  legalName: string;
  dateOfBirth: string;
  country: string;
  documentType: string;
  documentNumberLast4: string;
  addressLine1: string;
  city: string;
  postalCode: string;
  documentUrl: string;
  notes?: string | null;
}) {
  const existing = await getVerificationByUserId(input.userId);

  const next = existing
    ? await prisma.identityVerification.update({
        where: {
          userId: input.userId
        },
        data: {
          status: "PENDING",
          legalName: input.legalName,
          dateOfBirth: new Date(input.dateOfBirth),
          country: input.country,
          documentType: input.documentType,
          documentNumberLast4: input.documentNumberLast4,
          addressLine1: input.addressLine1,
          city: input.city,
          postalCode: input.postalCode,
          documentUrl: input.documentUrl,
          notes: input.notes ?? null,
          rejectionReason: null,
          reviewedAt: null,
          reviewedById: null
        },
        include: identityInclude
      })
    : await prisma.identityVerification.create({
        data: {
          userId: input.userId,
          status: "PENDING",
          legalName: input.legalName,
          dateOfBirth: new Date(input.dateOfBirth),
          country: input.country,
          documentType: input.documentType,
          documentNumberLast4: input.documentNumberLast4,
          addressLine1: input.addressLine1,
          city: input.city,
          postalCode: input.postalCode,
          documentUrl: input.documentUrl,
          notes: input.notes ?? null
        },
        include: identityInclude
      });

  const admins = await prisma.user.findMany({
    where: {
      role: "ADMIN"
    },
    select: {
      id: true
    }
  });

  await Promise.all([
    ...admins.map((admin) =>
      createNotificationRecord({
        userId: admin.id,
        type: "kyc_review",
        title: "Identity verification submitted",
        body: "A seller submitted identity verification for payout eligibility review."
      })
    ),
    createAuditLog({
      actorUserId: input.userId,
      action: "identity.submitted",
      entityType: "identity_verification",
      entityId: next.id,
      metadata: {
        documentType: input.documentType
      }
    })
  ]);

  return mapIdentityVerification(next);
}

export async function listPendingIdentityVerifications() {
  const items = await prisma.identityVerification.findMany({
    where: {
      status: {
        in: ["PENDING", "REJECTED"]
      }
    },
    include: identityInclude,
    orderBy: [{ updatedAt: "desc" }]
  });

  return {
    data: items.map(mapIdentityVerification),
    meta: {
      total: items.length,
      pendingCount: items.filter((item) => item.status === "PENDING").length,
      rejectedCount: items.filter((item) => item.status === "REJECTED").length
    }
  };
}

export async function reviewIdentityVerification(input: {
  verificationId: string;
  reviewerId: string;
  reviewerRole: UserRole;
  status: "APPROVED" | "REJECTED";
  rejectionReason?: string | null;
}) {
  if (input.reviewerRole !== "ADMIN") {
    throw new ApiError(403, "Only admins can review identity verification");
  }

  const existing = await prisma.identityVerification.findUnique({
    where: {
      id: input.verificationId
    },
    include: identityInclude
  });

  if (!existing) {
    throw new ApiError(404, "Identity verification not found");
  }

  const updated = await prisma.identityVerification.update({
    where: {
      id: input.verificationId
    },
    data: {
      status: input.status,
      rejectionReason: input.status === "REJECTED" ? input.rejectionReason ?? null : null,
      reviewedAt: new Date(),
      reviewedById: input.reviewerId
    },
    include: identityInclude
  });

  await Promise.all([
    createNotificationRecord({
      userId: updated.user.id,
      type: "kyc_update",
      title:
        input.status === "APPROVED"
          ? "Identity verification approved"
          : "Identity verification needs revision",
      body:
        input.status === "APPROVED"
          ? "Your identity verification is approved for protected money movement workflows."
          : "Your identity verification was rejected. Review the admin note and resubmit."
    }),
    sendEmailToUser({
      userId: updated.user.id,
      category: "trust",
      subject:
        input.status === "APPROVED"
          ? "Identity verification approved"
          : "Identity verification update",
      heading:
        input.status === "APPROVED"
          ? "Your payout identity review is approved"
          : "Your payout identity review needs changes",
      bodyLines:
        input.status === "APPROVED"
          ? [
              "Your identity review passed and you are now marked as ready for money-movement workflows.",
              "This does not yet automate payouts, but it clears the trust and compliance checkpoint inside the product."
            ]
          : [
              "Your identity review was not approved yet.",
              input.rejectionReason
                ? `Admin note: ${input.rejectionReason}`
                : "Update the submitted identity details and document package, then resubmit."
            ],
      ctaLabel: "Open settings",
      ctaUrl: `${env.CLIENT_URL}/settings`
    }),
    createAuditLog({
      actorUserId: input.reviewerId,
      action: "identity.reviewed",
      entityType: "identity_verification",
      entityId: updated.id,
      metadata: {
        status: input.status,
        rejectionReason: input.rejectionReason ?? null
      }
    })
  ]);

  return mapIdentityVerification(updated);
}
