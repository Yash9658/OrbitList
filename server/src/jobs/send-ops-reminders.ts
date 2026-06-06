import { ListingStatus, ReportStatus, UserRole } from "@prisma/client";
import { prisma } from "../config/prisma.js";
import { env } from "../config/env.js";
import { createAuditLog } from "../modules/audit/audit.service.js";
import { sendEmailToUser } from "../modules/email/email.service.js";
import { createNotificationRecord } from "../modules/notifications/notifications.service.js";
import { subHours } from "./job-utils.js";

export async function runOpsReminders() {
  const [staleListings, staleReports, admins] = await Promise.all([
    prisma.listing.count({
      where: {
        status: ListingStatus.PENDING_REVIEW,
        updatedAt: {
          lt: subHours(env.STALE_MODERATION_HOURS)
        }
      }
    }),
    prisma.report.count({
      where: {
        status: {
          in: [ReportStatus.OPEN, ReportStatus.UNDER_REVIEW]
        },
        createdAt: {
          lt: subHours(env.STALE_REPORT_HOURS)
        }
      }
    }),
    prisma.user.findMany({
      where: {
        role: UserRole.ADMIN
      },
      select: {
        id: true
      }
    })
  ]);

  if (staleListings === 0 && staleReports === 0) {
    return { staleListings, staleReports, notifiedAdmins: 0 };
  }

  await Promise.all(
    admins.map(async (admin) => {
      await createNotificationRecord({
        userId: admin.id,
        type: "ops_reminder",
        title: "Pending moderation needs attention",
        body: `${staleListings} stale listing reviews and ${staleReports} stale reports are waiting for action.`
      });

      await sendEmailToUser({
        userId: admin.id,
        category: "trust",
        subject: "Orbitlist moderation reminder",
        heading: "There are stale moderation items waiting",
        bodyLines: [
          `${staleListings} listings have been waiting for review longer than ${env.STALE_MODERATION_HOURS} hours.`,
          `${staleReports} reports have been open longer than ${env.STALE_REPORT_HOURS} hours.`
        ],
        ctaLabel: "Open admin review",
        ctaUrl: `${env.CLIENT_URL}/admin/listings`
      });
    })
  );

  await createAuditLog({
    action: "job.ops_reminder_sent",
    entityType: "job",
    entityId: "send-ops-reminders",
    metadata: {
      staleListings,
      staleReports,
      adminCount: admins.length
    }
  });

  return { staleListings, staleReports, notifiedAdmins: admins.length };
}

if (process.argv[1]?.includes("send-ops-reminders")) {
  runOpsReminders()
    .then((result) => {
      console.log(JSON.stringify(result));
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
