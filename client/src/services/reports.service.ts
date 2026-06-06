import { apiRequest } from "../lib/api-client";
import { ReportListResponse, ReportRecord, ReportStatus } from "../types/report";

export function createReportRequest(input: {
  listingId?: string;
  reportedUserId?: string;
  reason: string;
  details?: string;
}) {
  return apiRequest<ReportRecord>("/reports", {
    method: "POST",
    body: input
  });
}

export function getMyReports() {
  return apiRequest<ReportListResponse>("/reports/mine");
}

export function getAdminReports(status?: ReportStatus) {
  const query = status ? `?status=${status}` : "";
  return apiRequest<ReportListResponse>(`/reports/admin${query}`);
}

export function reviewReportRequest(input: {
  id: string;
  status: Exclude<ReportStatus, "OPEN">;
  resolutionNotes?: string;
  listingAction?: "NONE" | "REJECTED" | "ARCHIVED";
}) {
  return apiRequest<ReportRecord>(`/reports/admin/${input.id}`, {
    method: "PATCH",
    body: {
      status: input.status,
      resolutionNotes: input.resolutionNotes,
      listingAction: input.listingAction ?? "NONE"
    }
  });
}
