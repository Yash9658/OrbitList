import { ListingStatus, ReportStatus, UserRole } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { ApiError } from "../../utils/api-error.js";
import { createAuditLog } from "../audit/audit.service.js";
import { sendEmailToUser } from "../email/email.service.js";
import { createNotificationRecord } from "../notifications/notifications.service.js";
import { env } from "../../config/env.js";

type IncludedReport = {
  id: string;
  reason: string;
  details: string | null;
  status: ReportStatus;
  resolutionNotes: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  reporter: {
    id: string;
    email: string;
    fullName: string | null;
  };
  reviewer: {
    id: string;
    email: string;
    fullName: string | null;
  } | null;
  listing: {
    id: string;
    slug: string;
    title: string;
    status: ListingStatus;
    seller: {
      id: string;
      email: string;
      fullName: string | null;
    };
  } | null;
  reportedUser: {
    id: string;
    email: string;
    fullName: string | null;
    username: string | null;
    role: UserRole;
    country: string | null;
    isVerified: boolean;
  } | null;
};

function getReportTargetLabel(report: IncludedReport) {
  if (report.listing) {
    return `'${report.listing.title}'`;
  }

  if (report.reportedUser) {
    return report.reportedUser.fullName ?? report.reportedUser.username ?? report.reportedUser.email;
  }

  return "unknown target";
}

function mapReport(report: IncludedReport) {
  return {
    id: report.id,
    reason: report.reason,
    details: report.details,
    status: report.status,
    resolutionNotes: report.resolutionNotes,
    reviewedAt: report.reviewedAt,
    createdAt: report.createdAt,
    targetType: report.listing ? "LISTING" : "USER",
    reporter: report.reporter,
    reviewer: report.reviewer,
    listing: report.listing,
    reportedUser: report.reportedUser
  };
}

const reportInclude = {
  reporter: {
    select: {
      id: true,
      email: true,
      fullName: true
    }
  },
  reviewer: {
    select: {
      id: true,
      email: true,
      fullName: true
    }
  },
  listing: {
    select: {
      id: true,
      slug: true,
      title: true,
      status: true,
      seller: {
        select: {
          id: true,
          email: true,
          fullName: true
        }
      }
    }
  },
  reportedUser: {
    select: {
      id: true,
      email: true,
      fullName: true,
      username: true,
      role: true,
      country: true,
      isVerified: true
    }
  }
} as const;

async function notifyAdminsAboutReport(input: {
  targetType: "LISTING" | "USER";
  targetLabel: string;
  reason: string;
}) {
  const admins = await prisma.user.findMany({
    where: {
      role: UserRole.ADMIN
    },
    select: {
      id: true
    }
  });

  const title =
    input.targetType === "LISTING"
      ? "New listing report submitted"
      : "New user report submitted";
  const body =
    input.targetType === "LISTING"
      ? `A user reported ${input.targetLabel} for ${input.reason.toLowerCase()}.`
      : `A user reported ${input.targetLabel} for ${input.reason.toLowerCase()}.`;

  await Promise.all(
    admins.map((admin) =>
      createNotificationRecord({
        userId: admin.id,
        type: "report",
        title,
        body
      })
    )
  );
}

export async function createReport(input: {
  reporterId: string;
  listingId?: string | null;
  reportedUserId?: string | null;
  reason: string;
  details?: string | null;
}) {
  const hasListingTarget = Boolean(input.listingId);
  const hasUserTarget = Boolean(input.reportedUserId);

  if (Number(hasListingTarget) + Number(hasUserTarget) !== 1) {
    throw new ApiError(400, "Provide exactly one valid report target");
  }

  if (input.listingId) {
    const listing = await prisma.listing.findUnique({
      where: {
        id: input.listingId
      },
      select: {
        id: true,
        title: true,
        slug: true,
        sellerId: true
      }
    });

    if (!listing) {
      throw new ApiError(404, "Listing not found");
    }

    if (listing.sellerId === input.reporterId) {
      throw new ApiError(400, "You cannot report your own listing");
    }

    const existingOpenReport = await prisma.report.findFirst({
      where: {
        reporterId: input.reporterId,
        listingId: input.listingId,
        status: {
          in: [ReportStatus.OPEN, ReportStatus.UNDER_REVIEW]
        }
      }
    });

    if (existingOpenReport) {
      throw new ApiError(400, "You already have an active report for this listing");
    }

    const report = await prisma.report.create({
      data: {
        reporterId: input.reporterId,
        listingId: input.listingId,
        reason: input.reason,
        details: input.details ?? null
      },
      include: reportInclude
    });

    await Promise.all([
      notifyAdminsAboutReport({
        targetType: "LISTING",
        targetLabel: `'${report.listing!.title}'`,
        reason: report.reason
      }),
      createAuditLog({
        actorUserId: input.reporterId,
        action: "report.created",
        entityType: "report",
        entityId: report.id,
        metadata: {
          targetType: "LISTING",
          listingId: report.listing!.id,
          reason: report.reason
        }
      })
    ]);

    return mapReport(report);
  }

  const reportedUser = await prisma.user.findUnique({
    where: {
      id: input.reportedUserId!
    },
    select: {
      id: true,
      email: true,
      fullName: true,
      username: true,
      role: true
    }
  });

  if (!reportedUser) {
    throw new ApiError(404, "User not found");
  }

  if (reportedUser.id === input.reporterId) {
    throw new ApiError(400, "You cannot report your own account");
  }

  const existingOpenReport = await prisma.report.findFirst({
    where: {
      reporterId: input.reporterId,
      reportedUserId: input.reportedUserId,
      status: {
        in: [ReportStatus.OPEN, ReportStatus.UNDER_REVIEW]
      }
    }
  });

  if (existingOpenReport) {
    throw new ApiError(400, "You already have an active report for this user");
  }

  const report = await prisma.report.create({
    data: {
      reporterId: input.reporterId,
      reportedUserId: input.reportedUserId,
      reason: input.reason,
      details: input.details ?? null
    },
    include: reportInclude
  });

  await Promise.all([
    notifyAdminsAboutReport({
      targetType: "USER",
      targetLabel: reportedUser.fullName ?? reportedUser.username ?? reportedUser.email,
      reason: report.reason
    }),
    createAuditLog({
      actorUserId: input.reporterId,
      action: "report.created",
      entityType: "report",
      entityId: report.id,
      metadata: {
        targetType: "USER",
        reportedUserId: report.reportedUser!.id,
        reason: report.reason
      }
    })
  ]);

  return mapReport(report);
}

export async function listMyReports(reporterId: string) {
  const reports = await prisma.report.findMany({
    where: {
      reporterId
    },
    include: reportInclude,
    orderBy: {
      createdAt: "desc"
    }
  });

  return {
    data: reports.map(mapReport),
    meta: {
      total: reports.length,
      openCount: reports.filter((report) => report.status === ReportStatus.OPEN).length
    }
  };
}

export async function listAdminReports(status?: ReportStatus) {
  const reports = await prisma.report.findMany({
    where: status
      ? {
          status
        }
      : undefined,
    include: reportInclude,
    orderBy: [{ status: "asc" }, { createdAt: "desc" }]
  });

  return {
    data: reports.map(mapReport),
    meta: {
      total: reports.length,
      openCount: reports.filter((report) => report.status === ReportStatus.OPEN).length,
      underReviewCount: reports.filter((report) => report.status === ReportStatus.UNDER_REVIEW).length
    }
  };
}

export async function reviewReport(input: {
  reportId: string;
  reviewerId: string;
  status: Extract<ReportStatus, "UNDER_REVIEW" | "RESOLVED" | "DISMISSED">;
  resolutionNotes?: string | null;
  listingAction?: "NONE" | "REJECTED" | "ARCHIVED";
}) {
  const existing = await prisma.report.findUnique({
    where: {
      id: input.reportId
    },
    include: reportInclude
  });

  if (!existing) {
    throw new ApiError(404, "Report not found");
  }

  if (!existing.listing && input.listingAction && input.listingAction !== "NONE") {
    throw new ApiError(400, "Listing actions only apply to listing-targeted reports");
  }

  const updated = await prisma.$transaction(async (transaction) => {
    if (existing.listing && input.listingAction && input.listingAction !== "NONE") {
      await transaction.listing.update({
        where: {
          id: existing.listing.id
        },
        data: {
          status: input.listingAction,
          publishedAt: input.listingAction === "REJECTED" ? null : undefined
        }
      });
    }

    return transaction.report.update({
      where: {
        id: input.reportId
      },
      data: {
        status: input.status,
        resolutionNotes: input.resolutionNotes ?? null,
        reviewedAt: new Date(),
        reviewedById: input.reviewerId
      },
      include: reportInclude
    });
  });

  const targetLabel = getReportTargetLabel(existing);
  const targetType = existing.listing ? "LISTING" : "USER";

  await Promise.all([
    createNotificationRecord({
      userId: existing.reporter.id,
      type: "report_update",
      title:
        input.status === ReportStatus.RESOLVED
          ? "Report resolved"
          : input.status === ReportStatus.DISMISSED
            ? "Report dismissed"
            : "Report under review",
      body:
        input.status === ReportStatus.UNDER_REVIEW
          ? `Your report for ${targetLabel} is under admin review.`
          : `Your report for ${targetLabel} has been ${input.status.toLowerCase().replace("_", " ")}.`
    }),
    createAuditLog({
      actorUserId: input.reviewerId,
      action: "report.reviewed",
      entityType: "report",
      entityId: updated.id,
      metadata: {
        status: input.status,
        targetType,
        listingAction: input.listingAction ?? "NONE",
        listingId: updated.listing?.id ?? null,
        reportedUserId: updated.reportedUser?.id ?? null
      }
    }),
    sendEmailToUser({
      userId: existing.reporter.id,
      category: "trust",
      subject: `Report update for ${targetLabel}`,
      heading: "Your marketplace report has an update",
      bodyLines: [
        `The report you submitted for ${targetLabel} is now marked as ${input.status.toLowerCase().replace("_", " ")}.`,
        input.resolutionNotes
          ? `Admin note: ${input.resolutionNotes}`
          : "You can review the updated status inside your marketplace account."
      ],
      ctaLabel: "Open notifications",
      ctaUrl: `${env.CLIENT_URL}/notifications`
    })
  ]);

  return mapReport(updated);
}
