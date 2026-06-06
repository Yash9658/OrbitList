export type UserRole = "BUYER" | "SELLER" | "BOTH" | "ADMIN";

export interface NotificationPreferences {
  inAppMessages: boolean;
  inAppMarketplace: boolean;
  inAppTransactions: boolean;
  inAppTrust: boolean;
  emailMessages: boolean;
  emailMarketplace: boolean;
  emailTransactions: boolean;
  emailTrust: boolean;
  emailBilling: boolean;
}

export interface AuthUser {
  id: string;
  email: string;
  fullName: string | null;
  username: string | null;
  avatarUrl: string | null;
  bio: string | null;
  role: UserRole;
  country: string | null;
  isVerified: boolean;
  notificationPreferences: NotificationPreferences;
  createdAt: string;
}

export interface PasswordUpdateResult {
  success: boolean;
  forceLogout: boolean;
}
