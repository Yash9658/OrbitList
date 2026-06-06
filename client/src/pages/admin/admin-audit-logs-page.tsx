import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../app/providers/auth-provider";
import { getAuditLogs } from "../../services/audit.service";
import {
  AdminDenied,
  AdminEmpty,
  AdminHero,
  AdminList,
  AdminPage,
  AdminPanel,
  adminMetaClass
} from "./admin-ui";

export function AdminAuditLogsPage() {
  const { user } = useAuth();
  const auditQuery = useQuery({
    queryKey: ["audit-logs"],
    queryFn: () => getAuditLogs(75),
    enabled: user?.role === "ADMIN"
  });

  if (user?.role !== "ADMIN") {
    return (
      <AdminDenied eyebrow="Admin only" title="Audit logs unavailable">
        This operational trail is only visible to admin operators.
      </AdminDenied>
    );
  }

  const logs = auditQuery.data?.data ?? [];

  return (
    <AdminPage>
      <AdminHero
        eyebrow="Audit trail"
        stats={[{ label: "recent log entries", value: auditQuery.data?.meta?.total ?? 0 }]}
        title="Track who changed what across moderation, verification, reports, and jobs."
      >
        Use this log to understand operator actions and support incident review.
      </AdminHero>

      <AdminPanel eyebrow="Logs" title="Recent audit events">
        {auditQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading audit logs...</p>
        ) : null}

        {!auditQuery.isLoading && logs.length === 0 ? (
          <AdminEmpty title="No audit entries yet.">
            Admin actions and scheduled jobs will appear here.
          </AdminEmpty>
        ) : null}

        {logs.length > 0 ? (
          <AdminList>
            {logs.map((log) => (
              <article className="rounded-3xl border border-border bg-muted/20 p-5" key={log.id}>
                <div className={adminMetaClass}>
                  <span>{log.action}</span>
                  <span>{log.entityType}</span>
                </div>
                <h3 className="mt-3 text-xl font-bold">{log.entityId}</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Actor: {log.actor?.fullName ?? log.actor?.email ?? "System"} |{" "}
                  {new Date(log.createdAt).toLocaleString()}
                </p>
                {log.metadata ? (
                  <pre className="mt-4 max-h-72 overflow-auto rounded-2xl border border-border bg-background p-4 text-xs leading-6 text-muted-foreground">
                    {JSON.stringify(log.metadata, null, 2)}
                  </pre>
                ) : null}
              </article>
            ))}
          </AdminList>
        ) : null}
      </AdminPanel>
    </AdminPage>
  );
}
