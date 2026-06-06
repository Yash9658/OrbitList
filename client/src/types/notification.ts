export interface NotificationRecord {
  id: string;
  type: string;
  category: "messages" | "marketplace" | "transactions" | "trust" | "billing";
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationsResponse {
  data: NotificationRecord[];
  meta: {
    total: number;
    unreadCount: number;
  };
}
