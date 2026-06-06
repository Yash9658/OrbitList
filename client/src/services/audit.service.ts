import { apiRequest } from "../lib/api-client";
import { AuditLogListResponse } from "../types/audit";

export function getAuditLogs(limit = 50) {
  return apiRequest<AuditLogListResponse>(`/audit-logs/admin?limit=${limit}`);
}
