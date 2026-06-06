import { apiRequest } from "../lib/api-client";
import {
  AdminIdentityQueueResponse,
  IdentityVerificationRecord
} from "../types/identity";

export function getMyIdentityVerification() {
  return apiRequest<IdentityVerificationRecord>("/identity/me");
}

export function submitIdentityVerificationRequest(input: {
  legalName: string;
  dateOfBirth: string;
  country: string;
  documentType: string;
  documentNumberLast4: string;
  addressLine1: string;
  city: string;
  postalCode: string;
  documentUrl: string;
  notes?: string | null;
}) {
  return apiRequest<IdentityVerificationRecord>("/identity/me", {
    method: "POST",
    body: input
  });
}

export function getAdminIdentityQueue() {
  return apiRequest<AdminIdentityQueueResponse>("/identity/admin");
}

export function reviewIdentityVerificationRequest(input: {
  id: string;
  status: "APPROVED" | "REJECTED";
  rejectionReason?: string;
}) {
  return apiRequest<IdentityVerificationRecord>(`/identity/admin/${input.id}`, {
    method: "PATCH",
    body: {
      status: input.status,
      rejectionReason: input.rejectionReason
    }
  });
}
