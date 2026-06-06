import { apiRequest } from "../lib/api-client";
import {
  PayoutAccountRecord,
  PayoutOnboardingLinkResponse
} from "../types/payout";

export function getMyPayoutAccount() {
  return apiRequest<PayoutAccountRecord>("/payouts/me");
}

export function createPayoutOnboardingLinkRequest(mode?: "onboarding" | "update") {
  return apiRequest<PayoutOnboardingLinkResponse>("/payouts/onboarding-link", {
    method: "POST",
    body: {
      mode
    }
  });
}
