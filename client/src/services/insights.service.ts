import { apiRequest } from "../lib/api-client";
import { SellerInsightsRecord } from "../types/insights";

export function getMySellerInsights() {
  return apiRequest<SellerInsightsRecord>("/insights/me");
}

export function getSellerInsightsBySellerId(sellerId: string) {
  return apiRequest<SellerInsightsRecord>(`/insights/seller/${sellerId}`);
}
