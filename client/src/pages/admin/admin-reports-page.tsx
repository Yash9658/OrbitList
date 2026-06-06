import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAuth } from "../../app/providers/auth-provider";
import { getAdminReports, reviewReportRequest } from "../../services/reports.service";
import type { ReportStatus } from "../../types/report";
import { Button, buttonVariants } from "../../components/ui/button";
import { cn } from "../../lib/utils";
import {
  AdminDenied,
  AdminEmpty,
  AdminHero,
  AdminList,
  AdminPage,
  AdminPanel,
  AdminRow,
  adminButtonRowClass,
  adminErrorClass,
  adminInputClass,
  adminMetaClass,
  adminNoteClass
} from "./admin-ui";

const statuses: ReportStatus[] = ["OPEN", "UNDER_REVIEW", "RESOLVED", "DISMISSED"];

export function AdminReportsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<ReportStatus | "ALL">("ALL");
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});

  const reportsQuery = useQuery({
    queryKey: ["admin-reports", statusFilter],
    queryFn: () => getAdminReports(statusFilter === "ALL" ? undefined : statusFilter),
    enabled: user?.role === "ADMIN"
  });

  const reviewMutation = useMutation({
    mutationFn: reviewReportRequest,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-reports"] }),
        queryClient.invalidateQueries({ queryKey: ["notifications"] }),
        queryClient.invalidateQueries({ queryKey: ["audit-logs"] }),
        queryClient.invalidateQueries({ queryKey: ["moderation-listings"] }),
        queryClient.invalidateQueries({ queryKey: ["marketplace-listings"] })
      ]);
    }
  });

  if (user?.role !== "ADMIN") {
    return (
      <AdminDenied eyebrow="Admin only" title="Reports workspace unavailable">
        This review queue is only available to admin operators.
      </AdminDenied>
    );
  }

  const reports = reportsQuery.data?.data ?? [];

  return (
    <AdminPage>
      <AdminHero
        eyebrow="Trust operations"
        stats={[
          { label: "open reports", value: reportsQuery.data?.meta?.openCount ?? 0 },
          { label: "under review", value: reportsQuery.data?.meta?.underReviewCount ?? 0 }
        ]}
        title="Review suspicious listing and seller reports before they damage trust."
      >
        Keep the marketplace healthy by triaging abuse reports, resolving trust cases, and taking
        action on listings or seller accounts when needed.
      </AdminHero>

      <AdminPanel
        action={
          <div className={adminButtonRowClass}>
            {["ALL", ...statuses].map((status) => (
              <Button
                key={status}
                onClick={() => setStatusFilter(status as ReportStatus | "ALL")}
                size="sm"
                type="button"
                variant={statusFilter === status ? "default" : "outline"}
              >
                {status}
              </Button>
            ))}
          </div>
        }
        eyebrow="Queue"
        title="Reported listings and users"
      >
        {reportsQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading reports...</p>
        ) : null}

        {!reportsQuery.isLoading && reports.length === 0 ? (
          <AdminEmpty title="No reports match this filter.">
            The trust queue is clear for now.
          </AdminEmpty>
        ) : null}

        {reports.length > 0 ? (
          <AdminList>
            {reports.map((report) => (
              <AdminRow key={report.id}>
                <div>
                  <div className={adminMetaClass}>
                    <span>{report.targetType}</span>
                    <span>{report.status}</span>
                    <span>{report.reason}</span>
                    <span>Reporter: {report.reporter.fullName ?? report.reporter.email}</span>
                  </div>

                  <h3 className="mt-3 text-xl font-bold">
                    {report.targetType === "LISTING"
                      ? report.listing?.title
                      : report.reportedUser?.fullName ??
                        report.reportedUser?.username ??
                        report.reportedUser?.email}
                  </h3>
                  <div className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
                    {report.targetType === "LISTING" && report.listing ? (
                      <p>
                        Seller: {report.listing.seller.fullName ?? report.listing.seller.email} |
                        Listing status: {report.listing.status}
                      </p>
                    ) : report.reportedUser ? (
                      <p>
                        User: {report.reportedUser.email} | Role: {report.reportedUser.role} |
                        Verified: {report.reportedUser.isVerified ? "Yes" : "No"} | Country:{" "}
                        {report.reportedUser.country ?? "Unknown"}
                      </p>
                    ) : null}
                    {report.details ? <p>{report.details}</p> : null}
                  </div>

                  {report.resolutionNotes ? (
                    <div className={`${adminNoteClass} mt-4`}>
                      <p>Latest admin note: {report.resolutionNotes}</p>
                    </div>
                  ) : null}

                  {report.targetType === "LISTING" && report.listing ? (
                    <div className={`${adminButtonRowClass} mt-4`}>
                      <Link
                        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                        to={`/listing/${report.listing.slug}`}
                      >
                        Open listing
                      </Link>
                    </div>
                  ) : null}
                </div>

                <div className="space-y-3">
                  <textarea
                    className={adminInputClass}
                    onChange={(event) =>
                      setReviewNotes((current) => ({
                        ...current,
                        [report.id]: event.target.value
                      }))
                    }
                    placeholder="Capture what you found and what action you took."
                    rows={6}
                    value={reviewNotes[report.id] ?? ""}
                  />

                  <div className={adminButtonRowClass}>
                    <Button
                      disabled={reviewMutation.isPending}
                      onClick={() =>
                        void reviewMutation.mutateAsync({
                          id: report.id,
                          status: "UNDER_REVIEW",
                          resolutionNotes: reviewNotes[report.id] ?? undefined,
                          listingAction: "NONE"
                        })
                      }
                      type="button"
                      variant="outline"
                    >
                      Mark under review
                    </Button>
                    <Button
                      disabled={reviewMutation.isPending}
                      onClick={() =>
                        void reviewMutation.mutateAsync({
                          id: report.id,
                          status: "RESOLVED",
                          resolutionNotes: reviewNotes[report.id] ?? undefined,
                          listingAction: report.targetType === "LISTING" ? "REJECTED" : "NONE"
                        })
                      }
                      type="button"
                    >
                      {report.targetType === "LISTING" ? "Resolve and unlist" : "Resolve report"}
                    </Button>
                    <Button
                      disabled={reviewMutation.isPending}
                      onClick={() =>
                        void reviewMutation.mutateAsync({
                          id: report.id,
                          status: "DISMISSED",
                          resolutionNotes: reviewNotes[report.id] ?? undefined,
                          listingAction: "NONE"
                        })
                      }
                      type="button"
                      variant="outline"
                    >
                      Dismiss report
                    </Button>
                  </div>
                </div>
              </AdminRow>
            ))}
          </AdminList>
        ) : null}

        {reviewMutation.error instanceof Error ? (
          <p className={adminErrorClass}>{reviewMutation.error.message}</p>
        ) : null}
      </AdminPanel>
    </AdminPage>
  );
}
