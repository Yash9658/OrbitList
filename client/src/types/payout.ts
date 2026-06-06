export type ConnectedAccountStatus =
  | "NOT_CONNECTED"
  | "PENDING"
  | "ACTION_REQUIRED"
  | "ACTIVE"
  | "RESTRICTED";

export interface PayoutAccountRecord {
  stripeConfigured: boolean;
  connectedAccountId: string | null;
  status: ConnectedAccountStatus;
  statusReason: string | null;
  onboardedAt: string | null;
  lastSyncedAt: string | null;
  payoutsReady: boolean;
  identityStatus: "NOT_STARTED" | "PENDING" | "APPROVED" | "REJECTED";
  protectedDealEligible: boolean;
  requiresAction: boolean;
  canStartOnboarding: boolean;
}

export interface PayoutOnboardingLinkResponse extends PayoutAccountRecord {
  url: string;
  mode: "demo" | "live";
}
