import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../app/providers/auth-provider";
import {
  getAdminIdentityQueue,
  reviewIdentityVerificationRequest
} from "../../services/identity.service";
import { Button } from "../../components/ui/button";
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

export function AdminIdentityPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});

  const queueQuery = useQuery({
    queryKey: ["admin-identity-queue"],
    queryFn: getAdminIdentityQueue,
    enabled: user?.role === "ADMIN"
  });

  const reviewMutation = useMutation({
    mutationFn: reviewIdentityVerificationRequest,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-identity-queue"] }),
        queryClient.invalidateQueries({ queryKey: ["audit-logs"] }),
        queryClient.invalidateQueries({ queryKey: ["notifications"] })
      ]);
    }
  });

  if (user?.role !== "ADMIN") {
    return (
      <AdminDenied eyebrow="Admin only" title="Identity review workspace unavailable">
        This queue is restricted to admins handling payout-readiness checks.
      </AdminDenied>
    );
  }

  const requests = queueQuery.data?.data ?? [];

  return (
    <AdminPage>
      <AdminHero
        eyebrow="Identity review"
        stats={[
          { label: "pending reviews", value: queueQuery.data?.meta?.pendingCount ?? 0 },
          { label: "returned for revision", value: queueQuery.data?.meta?.rejectedCount ?? 0 }
        ]}
        title="Approve payout-ready operators before protected money movement scales."
      >
        Review legal identity, address, and submitted document proof before sellers enter
        higher-trust transfer workflows.
      </AdminHero>

      <AdminPanel
        description="Use rejection notes when a seller needs to correct their compliance packet."
        eyebrow="Compliance queue"
        title="Identity verification requests"
      >
        {queueQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading identity review queue...</p>
        ) : null}

        {!queueQuery.isLoading && requests.length === 0 ? (
          <AdminEmpty title="No identity submissions to review.">
            The payout-readiness queue is clear right now.
          </AdminEmpty>
        ) : null}

        {requests.length > 0 ? (
          <AdminList>
            {requests.map((request) => {
              const requestKey = request.id ?? request.userId;

              return (
                <AdminRow key={requestKey}>
                  <div>
                    <div className={adminMetaClass}>
                      <span>{request.status}</span>
                      <span>{request.documentType ?? "Document not set"}</span>
                      <span>{request.country ?? "Country not set"}</span>
                    </div>
                    <h3 className="mt-3 text-xl font-bold">
                      {request.legalName ??
                        request.user?.fullName ??
                        request.user?.email ??
                        "Unknown user"}
                    </h3>
                    <div className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
                      <p>Account: {request.user?.fullName ?? request.user?.email ?? request.userId}</p>
                      <p>
                        Last 4: {request.documentNumberLast4 ?? "N/A"} | Postal code:{" "}
                        {request.postalCode ?? "N/A"}
                      </p>
                      <p>
                        Address: {request.addressLine1 ?? "N/A"}, {request.city ?? "N/A"}
                      </p>
                      {request.notes ? <p>Applicant note: {request.notes}</p> : null}
                    </div>
                    {request.documentUrl ? (
                      <div className={`${adminNoteClass} mt-4`}>
                        <p>
                          Review document:{" "}
                          <a className="font-semibold text-primary" href={request.documentUrl} rel="noreferrer" target="_blank">
                            Open submitted proof
                          </a>
                        </p>
                      </div>
                    ) : null}
                  </div>

                  <div className="space-y-3">
                    <textarea
                      className={adminInputClass}
                      onChange={(event) =>
                        setReviewNotes((current) => ({
                          ...current,
                          [requestKey]: event.target.value
                        }))
                      }
                      placeholder="Share approval context or the correction needed."
                      rows={6}
                      value={reviewNotes[requestKey] ?? ""}
                    />

                    <div className={adminButtonRowClass}>
                      <Button
                        disabled={reviewMutation.isPending || !request.id}
                        onClick={() =>
                          request.id
                            ? void reviewMutation.mutateAsync({
                                id: request.id,
                                status: "APPROVED",
                                rejectionReason: reviewNotes[request.id] ?? undefined
                              })
                            : undefined
                        }
                        type="button"
                      >
                        Approve
                      </Button>
                      <Button
                        disabled={reviewMutation.isPending || !request.id}
                        onClick={() =>
                          request.id
                            ? void reviewMutation.mutateAsync({
                                id: request.id,
                                status: "REJECTED",
                                rejectionReason: reviewNotes[request.id] ?? undefined
                              })
                            : undefined
                        }
                        type="button"
                        variant="outline"
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                </AdminRow>
              );
            })}
          </AdminList>
        ) : null}

        {reviewMutation.error instanceof Error ? (
          <p className={adminErrorClass}>{reviewMutation.error.message}</p>
        ) : null}
      </AdminPanel>
    </AdminPage>
  );
}
