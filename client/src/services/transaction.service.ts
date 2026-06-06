import { apiRequest } from "../lib/api-client";
import {
  AdminDisputesResponse,
  TransactionCheckoutResponse,
  TransactionConfirmResponse,
  TransactionDisputeRecord,
  TransactionRecord,
  TransactionsResponse,
  DisputeStatus,
  TransactionStatus
} from "../types/transaction";

export function getTransactions() {
  return apiRequest<TransactionsResponse>("/transactions");
}

export function getTransactionById(id: string) {
  return apiRequest<TransactionRecord>(`/transactions/${id}`);
}

export function createProtectedTransactionCheckout(input: {
  listingId: string;
  buyerNotes?: string;
}) {
  return apiRequest<TransactionCheckoutResponse>("/transactions/checkout", {
    method: "POST",
    body: input
  });
}

export function confirmProtectedTransactionCheckout(sessionId: string) {
  return apiRequest<TransactionConfirmResponse>("/transactions/checkout/confirm", {
    method: "POST",
    body: { sessionId }
  });
}

export function updateTransactionStatusRequest(input: {
  id: string;
  status: Extract<
    TransactionStatus,
    "HANDOFF_SUBMITTED" | "BUYER_REVIEW" | "COMPLETED" | "CANCELLED"
  >;
  notes?: string;
}) {
  return apiRequest<TransactionRecord>(`/transactions/${input.id}/status`, {
    method: "PATCH",
    body: {
      status: input.status,
      notes: input.notes
    }
  });
}

export function openTransactionDisputeRequest(input: {
  id: string;
  reason: string;
  details?: string;
}) {
  return apiRequest<TransactionRecord>(`/transactions/${input.id}/disputes`, {
    method: "POST",
    body: {
      reason: input.reason,
      details: input.details
    }
  });
}

export function addDisputeEvidenceRequest(input: {
  id: string;
  fileUrl: string;
  note?: string;
  visibility?: "participants" | "admin_only";
}) {
  return apiRequest<TransactionDisputeRecord>(`/transactions/disputes/${input.id}/evidence`, {
    method: "POST",
    body: {
      fileUrl: input.fileUrl,
      note: input.note,
      visibility: input.visibility
    }
  });
}

export function addDisputeCaseNoteRequest(input: {
  id: string;
  message: string;
  visibility?: "participants" | "admin_only";
}) {
  return apiRequest<TransactionDisputeRecord>(`/transactions/disputes/${input.id}/case-notes`, {
    method: "POST",
    body: {
      message: input.message,
      visibility: input.visibility
    }
  });
}

export function getAdminDisputes(status?: DisputeStatus) {
  const query = status ? `?status=${status}` : "";
  return apiRequest<AdminDisputesResponse>(`/transactions/admin/disputes${query}`);
}

export function reviewDisputeRequest(input: {
  id: string;
  status: Exclude<DisputeStatus, "OPEN">;
  resolutionNotes?: string;
  adminInternalNotes?: string;
  priority?: "low" | "normal" | "high" | "critical";
}) {
  return apiRequest<{
    dispute: AdminDisputesResponse["data"][number];
    transaction: TransactionRecord;
  }>(`/transactions/admin/disputes/${input.id}`, {
    method: "PATCH",
    body: {
      status: input.status,
      resolutionNotes: input.resolutionNotes,
      adminInternalNotes: input.adminInternalNotes,
      priority: input.priority
    }
  });
}

export function releaseSellerPayoutRequest(input: {
  id: string;
  notes?: string;
}) {
  return apiRequest<TransactionRecord>(`/transactions/admin/${input.id}/release`, {
    method: "POST",
    body: {
      notes: input.notes
    }
  });
}

export function issueBuyerRefundRequest(input: {
  id: string;
  notes?: string;
}) {
  return apiRequest<TransactionRecord>(`/transactions/admin/${input.id}/refund`, {
    method: "POST",
    body: {
      notes: input.notes
    }
  });
}
