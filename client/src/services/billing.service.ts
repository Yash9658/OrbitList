import { apiRequest } from "../lib/api-client";
import {
  AdminPaymentsResponse,
  BillingHistoryResponse,
  BillingPlan,
  BillingSummary,
  CheckoutConfirmationResponse,
  CheckoutSessionResponse
} from "../types/billing";

export function getBillingPlans() {
  return apiRequest<BillingPlan[]>("/billing/plans");
}

export function getBillingSummary() {
  return apiRequest<BillingSummary>("/billing/summary");
}

export function getBillingHistory() {
  return apiRequest<BillingHistoryResponse>("/billing/history");
}

export function createSubscriptionCheckoutRequest(planSlug: string) {
  return apiRequest<CheckoutSessionResponse>("/billing/checkout/subscription", {
    method: "POST",
    body: {
      planSlug
    }
  });
}

export function createFeaturedCheckoutRequest(listingId: string) {
  return apiRequest<CheckoutSessionResponse>("/billing/checkout/featured", {
    method: "POST",
    body: {
      listingId
    }
  });
}

export function confirmCheckoutRequest(sessionId: string) {
  return apiRequest<CheckoutConfirmationResponse>("/billing/checkout/confirm", {
    method: "POST",
    body: {
      sessionId
    }
  });
}

export function getAdminPayments(limit = 50) {
  return apiRequest<AdminPaymentsResponse>(`/billing/admin/payments?limit=${limit}`);
}
