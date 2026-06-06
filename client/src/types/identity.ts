export type IdentityVerificationStatus =
  | "NOT_STARTED"
  | "PENDING"
  | "APPROVED"
  | "REJECTED";

export interface IdentityVerificationRecord {
  id: string | null;
  userId: string;
  status: IdentityVerificationStatus;
  legalName: string | null;
  dateOfBirth: string | null;
  country: string | null;
  documentType: string | null;
  documentNumberLast4: string | null;
  addressLine1: string | null;
  city: string | null;
  postalCode: string | null;
  documentUrl: string | null;
  notes: string | null;
  rejectionReason: string | null;
  reviewedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  user: {
    id: string;
    email: string;
    fullName: string | null;
    role: string;
  } | null;
  reviewedBy: {
    id: string;
    email: string;
    fullName: string | null;
  } | null;
}

export interface AdminIdentityQueueResponse {
  data: IdentityVerificationRecord[];
  meta: {
    total: number;
    pendingCount: number;
    rejectedCount: number;
  };
}
