export type TransactionStatus =
  | "PENDING_PAYMENT"
  | "FUNDS_SECURED"
  | "HANDOFF_SUBMITTED"
  | "BUYER_REVIEW"
  | "COMPLETED"
  | "DISPUTED"
  | "CANCELLED"
  | "REFUNDED";

export type DisputeStatus =
  | "OPEN"
  | "UNDER_REVIEW"
  | "RESOLVED_FOR_BUYER"
  | "RESOLVED_FOR_SELLER"
  | "CLOSED";

export type IdentityVerificationStatus =
  | "NOT_STARTED"
  | "PENDING"
  | "APPROVED"
  | "REJECTED";

export type PayoutStatus =
  | "NOT_READY"
  | "PENDING_RELEASE"
  | "RELEASED"
  | "REFUND_PENDING"
  | "REFUNDED"
  | "BLOCKED";

export interface TransactionDisputeRecord {
  id: string;
  status: DisputeStatus;
  reason: string;
  details: string | null;
  resolutionNotes: string | null;
  adminInternalNotes: string | null;
  priority: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  openedBy: {
    id: string;
    email: string;
    fullName: string | null;
  };
  resolvedBy: {
    id: string;
    email: string;
    fullName: string | null;
  } | null;
  evidence: Array<{
    id: string;
    visibility: string;
    kind: string;
    fileUrl: string;
    note: string | null;
    createdAt: string;
    submittedBy: {
      id: string;
      email: string;
      fullName: string | null;
    };
  }>;
  caseEvents: Array<{
    id: string;
    type: string;
    visibility: string;
    message: string;
    metadata: Record<string, unknown> | null;
    createdAt: string;
    actor: {
      id: string;
      email: string;
      fullName: string | null;
    } | null;
  }>;
}

export interface TransactionRecord {
  id: string;
  agreedPrice: number;
  currency: string;
  status: TransactionStatus;
  buyerNotes: string | null;
  sellerNotes: string | null;
  handoffNotes: string | null;
  reviewDeadlineAt: string | null;
  completedAt: string | null;
  sellerPayoutStatus: PayoutStatus;
  sellerPayoutLastAttemptAt: string | null;
  sellerPayoutReleasedAt: string | null;
  sellerPayoutReference: string | null;
  sellerPayoutFailureReason: string | null;
  refundIssuedAt: string | null;
  refundReference: string | null;
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
  createdAt: string;
  updatedAt: string;
  listing: {
    id: string;
    slug: string;
    title: string;
    status: string;
    platform: {
      name: string;
      slug: string;
    };
  };
  buyer: {
    id: string;
    email: string;
    fullName: string | null;
    username: string | null;
    identityVerification: {
      status: IdentityVerificationStatus;
    } | null;
  };
  seller: {
    id: string;
    email: string;
    fullName: string | null;
    username: string | null;
    identityVerification: {
      status: IdentityVerificationStatus;
    } | null;
  };
  compliance: {
    buyerIdentityStatus: IdentityVerificationStatus;
    sellerIdentityStatus: IdentityVerificationStatus;
    buyerIdentityReady: boolean;
    sellerIdentityReady: boolean;
    sellerPayoutAccountStatus: string;
    sellerPayoutAccountReady: boolean;
  };
  disputes: TransactionDisputeRecord[];
}

export interface TransactionsResponse {
  data: TransactionRecord[];
  meta: {
    total: number;
    activeCount: number;
  };
}

export interface TransactionCheckoutResponse {
  transaction: TransactionRecord;
  sessionId: string;
  url: string;
  mode: "demo" | "live";
}

export interface TransactionConfirmResponse {
  transaction: TransactionRecord;
  mode: "demo" | "live";
}

export interface AdminDisputesResponse {
  data: Array<
    TransactionDisputeRecord & {
      transaction: TransactionRecord;
    }
  >;
  meta: {
    total: number;
    openCount: number;
    underReviewCount: number;
  };
}
