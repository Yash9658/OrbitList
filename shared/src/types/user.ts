export type UserRole = "buyer" | "seller" | "both" | "admin";

export interface MarketplaceUser {
  id: string;
  email: string;
  fullName?: string;
  username?: string;
  role: UserRole;
}

