import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../app/providers/auth-provider";
import { Badge } from "../../components/ui/badge";
import { buttonVariants } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { getTransactions } from "../../services/transaction.service";

export function TransactionsPage() {
  const { user } = useAuth();
  const transactionsQuery = useQuery({
    queryKey: ["transactions"],
    queryFn: getTransactions
  });

  const transactions = transactionsQuery.data?.data ?? [];

  return (
    <section className="flex flex-col gap-8">
      <div className="grid gap-6 py-8 lg:grid-cols-[1fr_340px] lg:items-end">
        <div className="flex max-w-4xl flex-col gap-4">
          <Badge variant="secondary" className="w-fit uppercase tracking-[0.24em]">
            Protected deals
          </Badge>
          <h1 className="font-serif text-5xl font-black leading-[0.96] tracking-[-0.06em] md:text-6xl">
            Track funded transfers, handoff progress, and deal outcomes in one workspace.
          </h1>
          <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
            These transactions sit between discovery and final account transfer, giving buyers and
            sellers a structured handoff path before we layer in full payout automation.
          </p>
        </div>

        <Card className="grid gap-3 p-5">
          <div className="flex items-center justify-between gap-4 border-b pb-3">
            <span className="text-sm text-muted-foreground">Total transactions</span>
            <strong className="text-2xl tracking-[-0.04em]">
              {transactionsQuery.data?.meta?.total ?? 0}
            </strong>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground">Currently active</span>
            <strong className="text-2xl tracking-[-0.04em]">
              {transactionsQuery.data?.meta?.activeCount ?? 0}
            </strong>
          </div>
        </Card>
      </div>

      <Card className="p-5 md:p-6">
        <div className="flex flex-col gap-3 border-b pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <Badge variant="outline" className="uppercase tracking-[0.22em]">
              Workspace
            </Badge>
            <h2 className="mt-2 font-serif text-3xl font-bold tracking-[-0.05em]">
              Your protected transactions
            </h2>
          </div>
          <p className="max-w-md text-sm leading-6 text-muted-foreground">
            {user?.role === "BUYER"
              ? "Review funded deals, submit disputes when needed, and confirm the final handoff."
              : "Manage funded deals, submit the handoff package, and keep transfer notes clear."}
          </p>
        </div>

        {transactionsQuery.isLoading ? (
          <p className="py-8 text-muted-foreground">Loading transactions...</p>
        ) : null}

        {!transactionsQuery.isLoading && transactions.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed bg-background/70 p-8">
            <h3 className="font-serif text-2xl font-bold tracking-[-0.04em]">
              No protected deals yet.
            </h3>
            <p className="mt-2 text-muted-foreground">
              Start one from a live listing when you want a more structured transfer flow.
            </p>
            <Link className={buttonVariants({ className: "mt-5" })} to="/marketplace">
              Browse listings
            </Link>
          </div>
        ) : null}

        {transactions.length > 0 ? (
          <div className="mt-5 flex flex-col gap-3">
            {transactions.map((transaction) => {
              const otherParty =
                user?.id === transaction.buyer.id ? transaction.seller : transaction.buyer;

              return (
                <article
                  className="flex flex-col gap-4 rounded-2xl border bg-background/70 p-4 md:flex-row md:items-center md:justify-between"
                  key={transaction.id}
                >
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">{transaction.status}</Badge>
                      <Badge variant="outline">{transaction.listing.platform.name}</Badge>
                      <Badge variant="outline">{transaction.disputes.length} dispute entries</Badge>
                    </div>
                    <h3 className="mt-3 text-xl font-bold tracking-[-0.03em]">
                      {transaction.listing.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      Counterparty: {otherParty.fullName ?? otherParty.username ?? otherParty.email}
                    </p>
                    <p className="text-sm leading-6 text-muted-foreground">
                      {transaction.currency} {transaction.agreedPrice.toLocaleString()}
                      {transaction.reviewDeadlineAt
                        ? ` | review window until ${new Date(transaction.reviewDeadlineAt).toLocaleDateString()}`
                        : ""}
                    </p>
                    <p className="text-sm leading-6 text-muted-foreground">
                      Buyer KYC: {transaction.compliance.buyerIdentityStatus} | Seller KYC:{" "}
                      {transaction.compliance.sellerIdentityStatus}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Link
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                      to={`/listing/${transaction.listing.slug}`}
                    >
                      View listing
                    </Link>
                    <Link
                      className={buttonVariants({ size: "sm" })}
                      to={`/transactions/${transaction.id}`}
                    >
                      Open transaction
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}
      </Card>
    </section>
  );
}
