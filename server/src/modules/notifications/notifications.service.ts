import { prisma } from "../../config/prisma.js";
import { ApiError } from "../../utils/api-error.js";

type NotificationCategory = "messages" | "marketplace" | "transactions" | "trust" | "billing";

function mapNotification(notification: {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: Date;
}) {
  return {
    id: notification.id,
    type: notification.type,
    category: resolveNotificationCategory(notification.type),
    title: notification.title,
    body: notification.body,
    isRead: notification.isRead,
    createdAt: notification.createdAt
  };
}

function resolveNotificationCategory(type: string): NotificationCategory {
  if (["message", "conversation"].includes(type)) {
    return "messages";
  }

  if (
    [
      "transaction_funded",
      "transaction_update",
      "payout_release_failed",
      "payout_release",
      "payout_released",
      "refund_issued",
      "payout_onboarding",
      "account_update",
      "account_onboarding"
    ].includes(type)
  ) {
    return "transactions";
  }

  if (
    [
      "kyc_review",
      "kyc_update",
      "verification",
      "report",
      "report_update",
      "dispute",
      "dispute_opened",
      "dispute_update",
      "listing_review"
    ].includes(type)
  ) {
    return "trust";
  }

  if (["favorite", "listing_submitted", "listing_approved", "listing_rejected"].includes(type)) {
    return "marketplace";
  }

  return "billing";
}

function isInAppPreferenceEnabled(
  category: NotificationCategory,
  preferences: {
    prefInAppMessages: boolean;
    prefInAppMarketplace: boolean;
    prefInAppTransactions: boolean;
    prefInAppTrust: boolean;
  }
) {
  switch (category) {
    case "messages":
      return preferences.prefInAppMessages;
    case "marketplace":
      return preferences.prefInAppMarketplace;
    case "transactions":
      return preferences.prefInAppTransactions;
    case "trust":
      return preferences.prefInAppTrust;
    case "billing":
    default:
      return true;
  }
}

export async function createNotificationRecord(input: {
  userId: string;
  type: string;
  title: string;
  body: string;
  category?: NotificationCategory;
}) {
  const preferences = await prisma.user.findUnique({
    where: {
      id: input.userId
    },
    select: {
      prefInAppMessages: true,
      prefInAppMarketplace: true,
      prefInAppTransactions: true,
      prefInAppTrust: true
    }
  });

  if (!preferences) {
    return null;
  }

  const category = input.category ?? resolveNotificationCategory(input.type);

  if (!isInAppPreferenceEnabled(category, preferences)) {
    return null;
  }

  return prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body
    }
  });
}

export async function listNotifications(userId: string) {
  const notifications = await prisma.notification.findMany({
    where: {
      userId
    },
    orderBy: [
      { createdAt: "desc" }
    ],
    take: 50
  });

  return {
    data: notifications.map(mapNotification),
    meta: {
      total: notifications.length,
      unreadCount: notifications.filter((notification) => !notification.isRead).length
    }
  };
}

export async function markNotificationAsRead(notificationId: string, userId: string) {
  const notification = await prisma.notification.findUnique({
    where: {
      id: notificationId
    }
  });

  if (!notification) {
    throw new ApiError(404, "Notification not found");
  }

  if (notification.userId !== userId) {
    throw new ApiError(403, "You do not have access to this notification");
  }

  const updated = await prisma.notification.update({
    where: {
      id: notificationId
    },
    data: {
      isRead: true
    }
  });

  return mapNotification(updated);
}

export async function markAllNotificationsAsRead(userId: string) {
  await prisma.notification.updateMany({
    where: {
      userId,
      isRead: false
    },
    data: {
      isRead: true
    }
  });

  return listNotifications(userId);
}
