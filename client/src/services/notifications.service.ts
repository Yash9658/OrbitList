import { apiRequest } from "../lib/api-client";
import { NotificationsResponse, NotificationRecord } from "../types/notification";

export function getNotifications() {
  return apiRequest<NotificationsResponse>("/notifications");
}

export function markNotificationReadRequest(notificationId: string) {
  return apiRequest<NotificationRecord>(`/notifications/${notificationId}/read`, {
    method: "PATCH"
  });
}

export function markAllNotificationsReadRequest() {
  return apiRequest<NotificationsResponse>("/notifications/read-all", {
    method: "PATCH"
  });
}
