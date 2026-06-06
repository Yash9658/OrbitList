import { subDays } from "./job-utils.js";
import { prisma } from "../config/prisma.js";
import { env } from "../config/env.js";
import { createAuditLog } from "../modules/audit/audit.service.js";

export async function cleanupExpiredRefreshSessions() {
  const result = await prisma.refreshSession.deleteMany({
    where: {
      OR: [{ expiresAt: { lt: new Date() } }, { revokedAt: { not: null } }]
    }
  });

  await createAuditLog({
    action: "job.cleanup_refresh_sessions",
    entityType: "job",
    entityId: "cleanup-maintenance",
    metadata: {
      deletedCount: result.count
    }
  });

  return result.count;
}

export async function cleanupOldNotifications() {
  const result = await prisma.notification.deleteMany({
    where: {
      isRead: true,
      createdAt: {
        lt: subDays(env.NOTIFICATION_RETENTION_DAYS)
      }
    }
  });

  await createAuditLog({
    action: "job.cleanup_notifications",
    entityType: "job",
    entityId: "cleanup-maintenance",
    metadata: {
      deletedCount: result.count,
      retentionDays: env.NOTIFICATION_RETENTION_DAYS
    }
  });

  return result.count;
}

export async function runCleanupMaintenance() {
  const [deletedSessions, deletedNotifications] = await Promise.all([
    cleanupExpiredRefreshSessions(),
    cleanupOldNotifications()
  ]);

  return {
    deletedSessions,
    deletedNotifications
  };
}

if (process.argv[1]?.includes("cleanup-maintenance")) {
  runCleanupMaintenance()
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
