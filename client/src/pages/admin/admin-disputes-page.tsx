import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAuth } from "../../app/providers/auth-provider";
import {
  addDisputeCaseNoteRequest,
  getAdminDisputes,
  issueBuyerRefundRequest,
  releaseSellerPayoutRequest,
  reviewDisputeRequest
} from "../../services/transaction.service";
import type { DisputeStatus } from "../../types/transaction";
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

const filters: Array<DisputeStatus | "ALL"> = [
  "ALL",
  "OPEN",
  "UNDER_REVIEW",
  "RESOLVED_FOR_BUYER",
  "RESOLVED_FOR_SELLER",
  "CLOSED"
];

type Priority = "low" | "normal" | "high" | "critical";
type ReviewableDisputeStatus = Exclude<DisputeStatus, "OPEN">;

export function AdminDisputesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<DisputeStatus | "ALL">("ALL");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [priority, setPriority] = useState<Record<string, Priority>>({});
  const [caseNotes, setCaseNotes] = useState<Record<string, string>>({});

  const disputesQuery = useQuery({
    queryKey: ["admin-disputes", statusFilter],
    queryFn: () => getAdminDisputes(statusFilter === "ALL" ? undefined : statusFilter),
    enabled: user?.role === "ADMIN"
  });

  const reviewMutation = useMutation({
    mutationFn: reviewDisputeRequest,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-disputes"] }),
        queryClient.invalidateQueries({ queryKey: ["transactions"] }),
        queryClient.invalidateQueries({ queryKey: ["audit-logs"] }),
        queryClient.invalidateQueries({ queryKey: ["notifications"] })
      ]);
    }
  });
  const payoutMutation = useMutation({
    mutationFn: releaseSellerPayoutRequest,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-disputes"] }),
        queryClient.invalidateQueries({ queryKey: ["transactions"] }),
        queryClient.invalidateQueries({ queryKey: ["notifications"] })
      ]);
    }
  });
  const refundMutation = useMutation({
    mutationFn: issueBuyerRefundRequest,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-disputes"] }),
        queryClient.invalidateQueries({ queryKey: ["transactions"] }),
        queryClient.invalidateQueries({ queryKey: ["notifications"] })
      ]);
    }
  });
  const caseNoteMutation = useMutation({
    mutationFn: addDisputeCaseNoteRequest,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-disputes"] }),
        queryClient.invalidateQueries({ queryKey: ["transactions"] }),
        queryClient.invalidateQueries({ queryKey: ["notifications"] })
      ]);
    }
  });

  if (user?.role !== "ADMIN") {
    return (
      <AdminDenied eyebrow="Admin only" title="Dispute center unavailable">
        This workspace is only available to admin operators.
      </AdminDenied>
    );
  }

  const disputes = disputesQuery.data?.data ?? [];

  function resolveDispute(id: string, status: ReviewableDisputeStatus, fallbackPriority: Priority) {
    return reviewMutation.mutateAsync({
      id,
      status,
      resolutionNotes: notes[id] ?? undefined,
      adminInternalNotes: notes[id] ?? undefined,
      priority: priority[id] ?? fallbackPriority
    });
  }

  return (
    <AdminPage>
      <AdminHero
        eyebrow="Dispute center"
        stats={[
          { label: "open disputes", value: disputesQuery.data?.meta?.openCount ?? 0 },
          { label: "under review", value: disputesQuery.data?.meta?.underReviewCount ?? 0 }
        ]}
        title="Review protected deal conflicts before they become trust failures."
      >
        Triage disputes, capture case notes, and choose buyer- or seller-favoring outcomes with
        payout or refund handling.
      </AdminHero>

      <AdminPanel
        action={
          <div className={adminButtonRowClass}>
            {filters.map((filter) => (
              <Button
                key={filter}
                onClick={() => setStatusFilter(filter)}
                size="sm"
                type="button"
                variant={statusFilter === filter ? "default" : "outline"}
              >
                {filter}
              </Button>
            ))}
          </div>
        }
        eyebrow="Queue"
        title="Protected deal disputes"
      >
        {disputesQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading disputes...</p>
        ) : null}

        {!disputesQuery.isLoading && disputes.length === 0 ? (
          <AdminEmpty title="No disputes in this filter.">
            The dispute center is quiet for now.
          </AdminEmpty>
        ) : null}

        {disputes.length > 0 ? (
          <AdminList>
            {disputes.map((dispute) => {
              const currentPriority = (priority[dispute.id] ?? dispute.priority) as Priority;
              const currentCaseNote = caseNotes[dispute.id] ?? "";

              return (
                <AdminRow key={dispute.id}>
                  <div>
                    <div className={adminMetaClass}>
                      <span>{dispute.status}</span>
                      <span>{dispute.priority}</span>
                      <span>{dispute.reason}</span>
                      <span>{dispute.transaction.status}</span>
                    </div>
                    <h3 className="mt-3 text-xl font-bold">{dispute.transaction.listing.title}</h3>
                    <div className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
                      <p>
                        Buyer: {dispute.transaction.buyer.fullName ?? dispute.transaction.buyer.email} |
                        Seller: {dispute.transaction.seller.fullName ?? dispute.transaction.seller.email}
                      </p>
                      {dispute.details ? <p>{dispute.details}</p> : null}
                    </div>

                    {dispute.resolutionNotes ? (
                      <div className={`${adminNoteClass} mt-4`}>
                        <p>Latest resolution note: {dispute.resolutionNotes}</p>
                      </div>
                    ) : null}
                    {dispute.adminInternalNotes ? (
                      <div className={`${adminNoteClass} mt-4`}>
                        <p>Internal ops note: {dispute.adminInternalNotes}</p>
                      </div>
                    ) : null}

                    <div className={`${adminNoteClass} mt-4`}>
                      <p>Payout state: {dispute.transaction.sellerPayoutStatus}</p>
                      {dispute.transaction.sellerPayoutLastAttemptAt ? (
                        <p>
                          Last payout attempt:{" "}
                          {new Date(dispute.transaction.sellerPayoutLastAttemptAt).toLocaleString()}
                        </p>
                      ) : null}
                      <p>Evidence items: {dispute.evidence.length}</p>
                      <p>Case events: {dispute.caseEvents.length}</p>
                      {dispute.transaction.sellerPayoutReference ? (
                        <p>Release reference: {dispute.transaction.sellerPayoutReference}</p>
                      ) : null}
                      {dispute.transaction.sellerPayoutFailureReason ? (
                        <p>Failure reason: {dispute.transaction.sellerPayoutFailureReason}</p>
                      ) : null}
                      {dispute.transaction.refundReference ? (
                        <p>Refund reference: {dispute.transaction.refundReference}</p>
                      ) : null}
                    </div>

                    <div className={`${adminButtonRowClass} mt-4`}>
                      <Link
                        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                        to={`/transactions/${dispute.transaction.id}`}
                      >
                        Open transaction
                      </Link>
                    </div>

                    {dispute.evidence.length > 0 ? (
                      <div className={`${adminNoteClass} mt-4`}>
                        {dispute.evidence.map((evidence) => (
                          <p key={evidence.id}>
                            {evidence.visibility} evidence from{" "}
                            {evidence.submittedBy.fullName ?? evidence.submittedBy.email}
                            {" | "}
                            <a className="font-semibold text-primary" href={evidence.fileUrl} rel="noreferrer" target="_blank">
                              Open file
                            </a>
                            {evidence.note ? ` | ${evidence.note}` : ""}
                          </p>
                        ))}
                      </div>
                    ) : null}

                    {dispute.caseEvents.length > 0 ? (
                      <div className={`${adminNoteClass} mt-4`}>
                        {dispute.caseEvents.map((caseEvent) => (
                          <p key={caseEvent.id}>
                            [{caseEvent.visibility}] {new Date(caseEvent.createdAt).toLocaleString()} |{" "}
                            {caseEvent.message}
                          </p>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="space-y-3">
                    <select
                      className={adminInputClass}
                      onChange={(event) =>
                        setPriority((current) => ({
                          ...current,
                          [dispute.id]: event.target.value as Priority
                        }))
                      }
                      value={currentPriority}
                    >
                      <option value="low">low</option>
                      <option value="normal">normal</option>
                      <option value="high">high</option>
                      <option value="critical">critical</option>
                    </select>
                    <textarea
                      className={adminInputClass}
                      onChange={(event) =>
                        setNotes((current) => ({
                          ...current,
                          [dispute.id]: event.target.value
                        }))
                      }
                      placeholder="Capture internal ops notes and resolution reasoning."
                      rows={6}
                      value={notes[dispute.id] ?? ""}
                    />
                    <textarea
                      className={adminInputClass}
                      onChange={(event) =>
                        setCaseNotes((current) => ({
                          ...current,
                          [dispute.id]: event.target.value
                        }))
                      }
                      placeholder="Add a case note to the dispute timeline."
                      rows={4}
                      value={currentCaseNote}
                    />

                    <div className={adminButtonRowClass}>
                      <Button
                        disabled={caseNoteMutation.isPending || !currentCaseNote.trim()}
                        onClick={() =>
                          void caseNoteMutation
                            .mutateAsync({
                              id: dispute.id,
                              message: currentCaseNote,
                              visibility: "participants"
                            })
                            .then(() =>
                              setCaseNotes((current) => ({
                                ...current,
                                [dispute.id]: ""
                              }))
                            )
                        }
                        type="button"
                        variant="outline"
                      >
                        Add public case note
                      </Button>
                      <Button
                        disabled={caseNoteMutation.isPending || !currentCaseNote.trim()}
                        onClick={() =>
                          void caseNoteMutation
                            .mutateAsync({
                              id: dispute.id,
                              message: currentCaseNote,
                              visibility: "admin_only"
                            })
                            .then(() =>
                              setCaseNotes((current) => ({
                                ...current,
                                [dispute.id]: ""
                              }))
                            )
                        }
                        type="button"
                        variant="outline"
                      >
                        Add internal case note
                      </Button>
                      <Button
                        disabled={reviewMutation.isPending}
                        onClick={() => void resolveDispute(dispute.id, "UNDER_REVIEW", currentPriority)}
                        type="button"
                        variant="outline"
                      >
                        Mark under review
                      </Button>
                      <Button
                        disabled={reviewMutation.isPending}
                        onClick={() => void resolveDispute(dispute.id, "RESOLVED_FOR_BUYER", currentPriority)}
                        type="button"
                      >
                        Resolve for buyer
                      </Button>
                      <Button
                        disabled={reviewMutation.isPending}
                        onClick={() => void resolveDispute(dispute.id, "RESOLVED_FOR_SELLER", currentPriority)}
                        type="button"
                      >
                        Resolve for seller
                      </Button>
                      <Button
                        disabled={reviewMutation.isPending}
                        onClick={() => void resolveDispute(dispute.id, "CLOSED", currentPriority)}
                        type="button"
                        variant="outline"
                      >
                        Close without payout change
                      </Button>
                      {dispute.transaction.sellerPayoutStatus === "PENDING_RELEASE" ||
                      (dispute.transaction.sellerPayoutStatus === "BLOCKED" &&
                        Boolean(dispute.transaction.sellerPayoutFailureReason)) ? (
                        <Button
                          disabled={payoutMutation.isPending}
                          onClick={() =>
                            void payoutMutation.mutateAsync({
                              id: dispute.transaction.id,
                              notes: notes[dispute.id] ?? undefined
                            })
                          }
                          type="button"
                        >
                          {dispute.transaction.sellerPayoutStatus === "BLOCKED"
                            ? "Retry seller payout"
                            : "Release seller payout"}
                        </Button>
                      ) : null}
                      {dispute.transaction.sellerPayoutStatus === "REFUND_PENDING" ? (
                        <Button
                          disabled={refundMutation.isPending}
                          onClick={() =>
                            void refundMutation.mutateAsync({
                              id: dispute.transaction.id,
                              notes: notes[dispute.id] ?? undefined
                            })
                          }
                          type="button"
                          variant="outline"
                        >
                          Issue buyer refund
                        </Button>
                      ) : null}
                    </div>
                    {caseNoteMutation.error instanceof Error ? (
                      <p className={adminErrorClass}>{caseNoteMutation.error.message}</p>
                    ) : null}
                  </div>
                </AdminRow>
              );
            })}
          </AdminList>
        ) : null}
      </AdminPanel>
    </AdminPage>
  );
}
