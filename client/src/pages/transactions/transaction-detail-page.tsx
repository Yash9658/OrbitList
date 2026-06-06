import { ChangeEvent, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../app/providers/auth-provider";
import { Badge } from "../../components/ui/badge";
import { Button, buttonVariants } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import {
  addDisputeCaseNoteRequest,
  addDisputeEvidenceRequest,
  getTransactionById,
  issueBuyerRefundRequest,
  openTransactionDisputeRequest,
  releaseSellerPayoutRequest,
  updateTransactionStatusRequest
} from "../../services/transaction.service";
import { uploadProofFile } from "../../services/upload.service";

const inputClass =
  "w-full rounded-2xl border bg-card px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15";

export function TransactionDetailPage() {
  const { id = "" } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [statusNotes, setStatusNotes] = useState("");
  const [disputeReason, setDisputeReason] = useState("Transfer access issue");
  const [disputeDetails, setDisputeDetails] = useState("");
  const [evidenceNotes, setEvidenceNotes] = useState<Record<string, string>>({});
  const [caseNotes, setCaseNotes] = useState<Record<string, string>>({});

  const transactionQuery = useQuery({
    queryKey: ["transaction", id],
    queryFn: () => getTransactionById(id),
    enabled: Boolean(id)
  });

  const invalidateTransaction = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["transactions"] }),
      queryClient.invalidateQueries({ queryKey: ["transaction", id] }),
      queryClient.invalidateQueries({ queryKey: ["notifications"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-disputes"] })
    ]);
  };

  const statusMutation = useMutation({
    mutationFn: updateTransactionStatusRequest,
    onSuccess: async () => {
      await invalidateTransaction();
      setStatusNotes("");
    }
  });
  const disputeMutation = useMutation({
    mutationFn: openTransactionDisputeRequest,
    onSuccess: async () => {
      await invalidateTransaction();
      setDisputeDetails("");
    }
  });
  const payoutMutation = useMutation({
    mutationFn: releaseSellerPayoutRequest,
    onSuccess: invalidateTransaction
  });
  const evidenceMutation = useMutation({
    mutationFn: addDisputeEvidenceRequest,
    onSuccess: invalidateTransaction
  });
  const caseNoteMutation = useMutation({
    mutationFn: addDisputeCaseNoteRequest,
    onSuccess: invalidateTransaction
  });
  const refundMutation = useMutation({
    mutationFn: issueBuyerRefundRequest,
    onSuccess: invalidateTransaction
  });

  const transaction = transactionQuery.data;
  const isBuyer = transaction?.buyer.id === user?.id;
  const isSeller = transaction?.seller.id === user?.id;
  const isAdmin = user?.role === "ADMIN";

  const allowedActions = useMemo(() => {
    if (!transaction) {
      return [];
    }

    const actions: Array<{ label: string; status: "HANDOFF_SUBMITTED" | "BUYER_REVIEW" | "COMPLETED" | "CANCELLED" }> = [];

    if (isSeller && transaction.status === "FUNDS_SECURED") {
      actions.push({ label: "Submit handoff package", status: "HANDOFF_SUBMITTED" });
    }
    if (isBuyer && transaction.status === "HANDOFF_SUBMITTED") {
      actions.push({ label: "Move to buyer review", status: "BUYER_REVIEW" });
      actions.push({ label: "Complete transfer", status: "COMPLETED" });
    }
    if (isBuyer && transaction.status === "BUYER_REVIEW") {
      actions.push({ label: "Complete transfer", status: "COMPLETED" });
    }
    if (isBuyer && transaction.status === "PENDING_PAYMENT") {
      actions.push({ label: "Cancel request", status: "CANCELLED" });
    }

    return actions;
  }, [isBuyer, isSeller, transaction]);

  async function handleEvidenceUpload(
    disputeId: string,
    visibility: "participants" | "admin_only",
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      const upload = await uploadProofFile(file);
      await evidenceMutation.mutateAsync({
        id: disputeId,
        fileUrl: upload.fileUrl,
        note: evidenceNotes[disputeId] || undefined,
        visibility
      });
      setEvidenceNotes((current) => ({
        ...current,
        [disputeId]: ""
      }));
    } finally {
      event.target.value = "";
    }
  }

  if (transactionQuery.isLoading) {
    return (
      <section className="grid min-h-[50vh] place-items-center">
        <Card className="max-w-xl p-8 text-center">
          <Badge variant="secondary">Loading</Badge>
          <h1 className="mt-4 font-serif text-4xl font-black tracking-[-0.06em]">
            Preparing protected transaction
          </h1>
          <p className="mt-3 text-muted-foreground">Pulling funding state, handoff context, and dispute history.</p>
        </Card>
      </section>
    );
  }

  if (!transaction) {
    return (
      <section className="grid min-h-[50vh] place-items-center">
        <Card className="max-w-xl p-8 text-center">
          <Badge variant="secondary">Unavailable</Badge>
          <h1 className="mt-4 font-serif text-4xl font-black tracking-[-0.06em]">
            Transaction not found
          </h1>
        </Card>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-8">
      <div className="grid gap-6 py-8 lg:grid-cols-[1fr_auto] lg:items-end">
        <div className="flex max-w-4xl flex-col gap-4">
          <Badge variant="secondary" className="w-fit uppercase tracking-[0.24em]">
            Protected deal
          </Badge>
          <h1 className="font-serif text-5xl font-black leading-[0.96] tracking-[-0.06em] md:text-6xl">
            {transaction.listing.title}
          </h1>
          <p className="text-lg leading-8 text-muted-foreground">
            {transaction.currency} {transaction.agreedPrice.toLocaleString()} | status:{" "}
            {transaction.status.replace(/_/g, " ")}
          </p>
        </div>

        <Card className="flex flex-wrap gap-2 p-4">
          <Link className={buttonVariants({ variant: "outline", size: "sm" })} to={`/listing/${transaction.listing.slug}`}>
            Open listing
          </Link>
          <Link className={buttonVariants({ variant: "outline", size: "sm" })} to="/transactions">
            Back to deals
          </Link>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-5">
          <Card className="p-5 md:p-6">
            <Badge variant="outline" className="uppercase tracking-[0.22em]">Lifecycle</Badge>
            <h2 className="mt-2 font-serif text-3xl font-bold tracking-[-0.05em]">Funding and handoff state</h2>
            <dl className="mt-5 grid gap-4 md:grid-cols-2">
              {[
                ["Buyer", transaction.buyer.fullName ?? transaction.buyer.email],
                ["Seller", transaction.seller.fullName ?? transaction.seller.email],
                [
                  "Review deadline",
                  transaction.reviewDeadlineAt
                    ? new Date(transaction.reviewDeadlineAt).toLocaleDateString()
                    : "Not started"
                ],
                [
                  "Completed at",
                  transaction.completedAt
                    ? new Date(transaction.completedAt).toLocaleDateString()
                    : "Not completed"
                ]
              ].map(([label, value]) => (
                <div className="rounded-2xl border bg-background/70 p-4" key={label}>
                  <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</dt>
                  <dd className="mt-2 font-bold">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-5 flex flex-col gap-2 text-sm leading-6 text-muted-foreground">
              <p>Buyer notes: {transaction.buyerNotes ?? "No buyer notes yet."}</p>
              <p>Seller notes: {transaction.sellerNotes ?? "No seller notes yet."}</p>
              <p>Handoff notes: {transaction.handoffNotes ?? "No handoff package submitted yet."}</p>
              <p>Buyer identity status: {transaction.compliance.buyerIdentityStatus}</p>
              <p>Seller identity status: {transaction.compliance.sellerIdentityStatus}</p>
              <p>Seller payout onboarding: {transaction.compliance.sellerPayoutAccountStatus}</p>
              <p>Seller payout state: {transaction.sellerPayoutStatus}</p>
              {transaction.sellerPayoutFailureReason ? <p>Payout failure reason: {transaction.sellerPayoutFailureReason}</p> : null}
              {transaction.refundReference ? <p>Refund reference: {transaction.refundReference}</p> : null}
            </div>
          </Card>

          <Card className="p-5">
            <Badge variant="outline" className="uppercase tracking-[0.22em]">Actions</Badge>
            <h2 className="mt-2 font-serif text-2xl font-bold tracking-[-0.04em]">Next step</h2>
            {allowedActions.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">No direct action is available right now for your role and the current status.</p>
            ) : (
              <div className="mt-4 flex flex-col gap-4">
                <textarea
                  className={inputClass}
                  rows={4}
                  value={statusNotes}
                  onChange={(event) => setStatusNotes(event.target.value)}
                  placeholder="Share transfer details, review notes, or context for the next step."
                />
                <div className="flex flex-wrap gap-2">
                  {allowedActions.map((action) => (
                    <Button
                      key={action.status}
                      disabled={statusMutation.isPending}
                      onClick={() =>
                        void statusMutation.mutateAsync({
                          id: transaction.id,
                          status: action.status,
                          notes: statusNotes || undefined
                        })
                      }
                      type="button"
                    >
                      {action.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            {statusMutation.error instanceof Error ? (
              <p className="mt-4 rounded-xl border border-destructive/30 bg-red-50 px-4 py-3 text-sm font-semibold text-destructive">{statusMutation.error.message}</p>
            ) : null}
          </Card>

          {isAdmin ? (
            <Card className="p-5">
              <Badge variant="outline" className="uppercase tracking-[0.22em]">Funds ops</Badge>
              <h2 className="mt-2 font-serif text-2xl font-bold tracking-[-0.04em]">Payout and refund controls</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  disabled={
                    payoutMutation.isPending ||
                    !(
                      transaction.sellerPayoutStatus === "PENDING_RELEASE" ||
                      (transaction.sellerPayoutStatus === "BLOCKED" &&
                        Boolean(transaction.sellerPayoutFailureReason))
                    )
                  }
                  onClick={() =>
                    void payoutMutation.mutateAsync({
                      id: transaction.id,
                      notes: statusNotes || undefined
                    })
                  }
                  type="button"
                >
                  {transaction.sellerPayoutStatus === "BLOCKED" ? "Retry seller payout" : "Release seller payout"}
                </Button>
                <Button
                  variant="outline"
                  disabled={refundMutation.isPending || transaction.sellerPayoutStatus !== "REFUND_PENDING"}
                  onClick={() =>
                    void refundMutation.mutateAsync({
                      id: transaction.id,
                      notes: statusNotes || undefined
                    })
                  }
                  type="button"
                >
                  Issue buyer refund
                </Button>
              </div>
            </Card>
          ) : null}

          <Card className="p-5 md:p-6">
            <Badge variant="outline" className="uppercase tracking-[0.22em]">Disputes</Badge>
            <h2 className="mt-2 font-serif text-3xl font-bold tracking-[-0.05em]">Protection path</h2>
            {transaction.disputes.length > 0 ? (
              <div className="mt-5 flex flex-col gap-4">
                {transaction.disputes.map((dispute) => (
                  <article className="rounded-2xl border bg-background/70 p-4" key={dispute.id}>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">{dispute.status}</Badge>
                      <Badge variant="outline">{dispute.reason}</Badge>
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">
                      Opened by {dispute.openedBy.fullName ?? dispute.openedBy.email}
                    </p>
                    {dispute.details ? <p className="mt-2 text-sm leading-6 text-muted-foreground">{dispute.details}</p> : null}
                    {dispute.evidence.length > 0 ? (
                      <div className="mt-4 flex flex-col gap-2 text-sm">
                        {dispute.evidence.map((evidence) => (
                          <a className="font-semibold text-primary" href={evidence.fileUrl} key={evidence.id} rel="noreferrer" target="_blank">
                            Evidence from {evidence.submittedBy.fullName ?? evidence.submittedBy.email}
                          </a>
                        ))}
                      </div>
                    ) : null}
                    {(isBuyer || isSeller || isAdmin) ? (
                      <div className="mt-4 flex flex-col gap-3">
                        <textarea
                          className={inputClass}
                          rows={3}
                          value={caseNotes[dispute.id] ?? ""}
                          onChange={(event) =>
                            setCaseNotes((current) => ({
                              ...current,
                              [dispute.id]: event.target.value
                            }))
                          }
                          placeholder="Add a case note."
                        />
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            disabled={caseNoteMutation.isPending || !(caseNotes[dispute.id] ?? "").trim()}
                            onClick={() =>
                              void caseNoteMutation.mutateAsync({
                                id: dispute.id,
                                message: caseNotes[dispute.id] ?? "",
                                visibility: "participants"
                              }).then(() =>
                                setCaseNotes((current) => ({
                                  ...current,
                                  [dispute.id]: ""
                                }))
                              )
                            }
                            type="button"
                          >
                            Add case update
                          </Button>
                          <label className={buttonVariants({ variant: "outline" })} htmlFor={`dispute-evidence-${dispute.id}`}>
                            {evidenceMutation.isPending ? "Uploading..." : "Upload evidence"}
                          </label>
                          <input
                            className="hidden"
                            id={`dispute-evidence-${dispute.id}`}
                            type="file"
                            accept=".png,.jpg,.jpeg,.webp,.pdf,image/*,application/pdf"
                            onChange={(event) => void handleEvidenceUpload(dispute.id, "participants", event)}
                          />
                          {isAdmin ? (
                            <label className={buttonVariants({ variant: "outline" })} htmlFor={`dispute-internal-evidence-${dispute.id}`}>
                              Upload internal evidence
                            </label>
                          ) : null}
                          {isAdmin ? (
                            <input
                              className="hidden"
                              id={`dispute-internal-evidence-${dispute.id}`}
                              type="file"
                              accept=".png,.jpg,.jpeg,.webp,.pdf,image/*,application/pdf"
                              onChange={(event) => void handleEvidenceUpload(dispute.id, "admin_only", event)}
                            />
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">No disputes have been opened on this deal.</p>
            )}

            {!["CANCELLED", "REFUNDED", "COMPLETED"].includes(transaction.status) ? (
              <div className="mt-5 rounded-2xl border bg-background/70 p-4">
                <h3 className="font-serif text-2xl font-bold tracking-[-0.04em]">Open dispute</h3>
                <div className="mt-4 grid gap-3">
                  <select className={inputClass} value={disputeReason} onChange={(event) => setDisputeReason(event.target.value)}>
                    <option>Transfer access issue</option>
                    <option>Ownership mismatch</option>
                    <option>Missing account assets</option>
                    <option>Unexpected seller behavior</option>
                  </select>
                  <textarea
                    className={inputClass}
                    rows={4}
                    value={disputeDetails}
                    onChange={(event) => setDisputeDetails(event.target.value)}
                    placeholder="Explain what went wrong so an admin can step in."
                  />
                  <Button
                    variant="outline"
                    disabled={disputeMutation.isPending}
                    onClick={() =>
                      void disputeMutation.mutateAsync({
                        id: transaction.id,
                        reason: disputeReason,
                        details: disputeDetails || undefined
                      })
                    }
                    type="button"
                  >
                    {disputeMutation.isPending ? "Opening dispute..." : "Open dispute"}
                  </Button>
                </div>
              </div>
            ) : null}
          </Card>
        </div>

        <aside className="flex flex-col gap-4">
          <Card className="p-5">
            <Badge variant="outline" className="uppercase tracking-[0.22em]">Workflow</Badge>
            <div className="mt-4 flex flex-col gap-3 text-sm leading-6 text-muted-foreground">
              <p>1. Buyer secures funds through a protected checkout.</p>
              <p>2. Seller submits the handoff package and transfer notes.</p>
              <p>3. Buyer reviews the transfer and either completes or disputes.</p>
              <p>4. Admins step in if the deal moves into dispute.</p>
            </div>
          </Card>
        </aside>
      </div>
    </section>
  );
}
