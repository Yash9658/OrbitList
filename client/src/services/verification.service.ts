import { apiRequest } from "../lib/api-client";
import { VerificationRecord, VerificationsResponse } from "../types/verification";

export function getMyVerifications() {
  return apiRequest<VerificationsResponse>("/verifications/mine");
}

export function submitVerificationRequest(input: {
  listingId: string;
  notes?: string | null;
}) {
  return apiRequest<VerificationRecord>("/verifications", {
    method: "POST",
    body: input
  });
}

export function getPendingVerifications() {
  return apiRequest<VerificationsResponse>("/verifications/pending");
}

export function reviewVerificationRequest(input: {
  id: string;
  status: "APPROVED" | "REJECTED";
  notes?: string | null;
}) {
  return apiRequest<VerificationRecord>(`/verifications/${input.id}/review`, {
    method: "PATCH",
    body: {
      status: input.status,
      notes: input.notes ?? null
    }
  });
}
