import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { Badge } from "../../components/ui/badge";
import { buttonVariants } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { confirmProtectedTransactionCheckout } from "../../services/transaction.service";

export function TransactionSuccessPage() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id") ?? "";

  const confirmMutation = useMutation({
    mutationFn: confirmProtectedTransactionCheckout
  });

  const shouldConfirm = useMemo(
    () => Boolean(sessionId) && confirmMutation.isIdle,
    [confirmMutation.isIdle, sessionId]
  );

  if (shouldConfirm) {
    void confirmMutation.mutate(sessionId);
  }

  return (
    <section className="grid min-h-[50vh] place-items-center">
      <Card className="max-w-xl p-8 text-center">
        <Badge variant="secondary" className="uppercase tracking-[0.22em]">
          Protected checkout
        </Badge>
        <h1 className="mt-4 font-serif text-4xl font-black tracking-[-0.06em]">
          Confirming secured funds
        </h1>
        {confirmMutation.isPending ? (
          <p className="mt-3 text-muted-foreground">
            We are confirming the payment and opening the protected transfer workspace.
          </p>
        ) : null}
        {confirmMutation.isError && confirmMutation.error instanceof Error ? (
          <p className="mt-4 rounded-xl border border-destructive/30 bg-red-50 px-4 py-3 text-sm font-semibold text-destructive">
            {confirmMutation.error.message}
          </p>
        ) : null}
        {confirmMutation.data ? (
          <>
            <p className="mt-3 text-muted-foreground">
              Funds are secured. The seller can now prepare the handoff for{" "}
              {confirmMutation.data.transaction.listing.title}.
            </p>
            <Link
              className={buttonVariants({ className: "mt-6" })}
              to={`/transactions/${confirmMutation.data.transaction.id}`}
            >
              Open transaction
            </Link>
          </>
        ) : null}
      </Card>
    </section>
  );
}
