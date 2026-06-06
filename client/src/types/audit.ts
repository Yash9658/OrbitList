export interface AuditLogRecord {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  actor: {
    id: string;
    email: string;
    fullName: string | null;
    role: string;
  } | null;
}

export interface AuditLogListResponse {
  data: AuditLogRecord[];
  meta: {
    total: number;
  };
}
