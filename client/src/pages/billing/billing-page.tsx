import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "../../components/ui/badge";
import { buttonVariants } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { getBillingHistory } from "../../services/billing.service";

export function BillingPage() {
  const billingQuery = useQuery({
    queryKey: ["billing-history"],
    queryFn: getBillingHistory
  });

  const history = billingQuery.data;

  if (billingQuery.isLoading) {
    return (
      <section className="grid min-h-[50vh] place-items-center">
        <Card className="max-w-xl p-8 text-center">
          <Badge variant="secondary" className="uppercase tracking-[0.22em]">Loading</Badge>
          <h1 className="mt-4 font-serif text-4xl font-black tracking-[-0.06em]">Preparing billing workspace</h1>
          <p className="mt-3 text-muted-foreground">Pulling your plan, usage, and recent payments.</p>
        </Card>
      </section>
    );
  }

  if (!history) {
    return (
      <section className="grid min-h-[50vh] place-items-center">
        <Card className="max-w-xl p-8 text-center">
          <Badge variant="secondary" className="uppercase tracking-[0.22em]">Unavailable</Badge>
          <h1 className="mt-4 font-serif text-4xl font-black tracking-[-0.06em]">Billing data could not be loaded</h1>
          <p className="mt-3 text-muted-foreground">Please try again in a moment.</p>
        </Card>
      </section>
    );
  }

  const { summary, payments } = history;

  return (
    <section className="flex flex-col gap-8">
      <div className="grid gap-6 py-8 lg:grid-cols-[1fr_360px] lg:items-end">
        <div className="flex max-w-4xl flex-col gap-4">
          <Badge variant="secondary" className="w-fit uppercase tracking-[0.24em]">Billing</Badge>
          <h1 className="font-serif text-5xl font-black leading-[0.96] tracking-[-0.06em] md:text-6xl">
            Keep plan access, featured spend, and payment history in one place.
          </h1>
          <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
            Your current plan is <strong>{summary.currentPlan.name}</strong>. Use this view to
            track inventory capacity, featured placement usage, and every marketplace charge.
          </p>
        </div>

        <Card className="flex flex-col gap-3 p-5 text-sm leading-6 text-muted-foreground">
          <p>
            Listing slots remaining: {summary.usage.remainingListingSlots} /{" "}
            {summary.usage.listingLimit}
          </p>
          <p>
            Featured slots remaining: {summary.usage.remainingFeaturedSlots} /{" "}
            {summary.usage.featuredSlots}
          </p>
          <p>
            {summary.stripeConfigured
              ? "Stripe checkout is configured for live upgrades."
              : "Stripe keys are not configured, so checkout currently runs in demo mode."}
          </p>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Current plan",
            value: summary.currentPlan.name,
            note: `$${summary.currentPlan.priceMonthly}/mo and ${summary.currentPlan.featuredSlots} featured slots`
          },
          {
            label: "Subscription status",
            value: summary.subscription?.status ?? "FREE",
            note: summary.subscription?.currentPeriodEnd
              ? `Renews through ${new Date(summary.subscription.currentPeriodEnd).toLocaleDateString()}`
              : "Starter access does not renew automatically"
          },
          {
            label: "Listings in use",
            value: `${summary.usage.totalListings} / ${summary.usage.listingLimit}`,
            note: "Archived listings do not consume seller inventory capacity."
          },
          {
            label: "Featured spend",
            value: `$${payments
              .filter((payment) => payment.type === "FEATURED_LISTING" && payment.status === "SUCCEEDED")
              .reduce((sum, payment) => sum + payment.amount, 0)
              .toLocaleString()}`,
            note: "Successful one-time featured placements purchased so far."
          }
        ].map((item) => (
          <Card className="p-5" key={item.label}>
            <span className="text-sm font-medium text-muted-foreground">{item.label}</span>
            <strong className="mt-3 block text-3xl tracking-[-0.05em]">{item.value}</strong>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.note}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div>
          <Card className="p-5 md:p-6">
            <div className="flex flex-col gap-3 border-b pb-5 md:flex-row md:items-end md:justify-between">
              <div>
                <Badge variant="outline" className="uppercase tracking-[0.22em]">Payments</Badge>
                <h2 className="mt-2 font-serif text-3xl font-bold tracking-[-0.05em]">Billing history</h2>
              </div>
              <p className="max-w-md text-sm leading-6 text-muted-foreground">Every plan charge and featured placement purchase shows up here.</p>
            </div>

            {payments.length === 0 ? (
              <div className="mt-5 rounded-2xl border border-dashed bg-background/70 p-8">
                <h3 className="font-serif text-2xl font-bold tracking-[-0.04em]">No payments yet.</h3>
                <p className="mt-2 text-muted-foreground">When you upgrade a plan or feature a listing, the charge will appear here.</p>
                <Link className={buttonVariants({ className: "mt-5" })} to="/pricing">
                  Explore plans
                </Link>
              </div>
            ) : (
              <div className="mt-5 flex flex-col gap-3">
                {payments.map((payment) => (
                  <article className="flex flex-col gap-4 rounded-2xl border bg-background/70 p-4 md:flex-row md:items-center md:justify-between" key={payment.id}>
                    <div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">{payment.type.replace(/_/g, " ")}</Badge>
                        <Badge variant="secondary">{payment.status}</Badge>
                        <Badge variant="outline">{new Date(payment.createdAt).toLocaleString()}</Badge>
                      </div>
                      <h3 className="mt-3 text-xl font-bold tracking-[-0.03em]">
                        {payment.plan?.name ??
                          payment.listing?.title ??
                          "Marketplace payment"}
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        {payment.currency} {payment.amount.toLocaleString()}
                        {" | "}
                        {payment.listing?.slug
                          ? `Listing: ${payment.listing.slug}`
                          : payment.plan
                            ? `Plan: ${payment.plan.slug}`
                            : "Billing record"}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {payment.listing ? (
                        <Link className={buttonVariants({ variant: "outline", size: "sm" })} to={`/listing/${payment.listing.slug}`}>
                          View listing
                        </Link>
                      ) : null}
                      <Badge>
                        {payment.status === "SUCCEEDED" ? "Paid" : payment.status}
                      </Badge>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </Card>
        </div>

        <aside className="flex flex-col gap-4">
          <Card className="p-5">
            <Badge variant="outline" className="uppercase tracking-[0.22em]">Upgrade</Badge>
            <h2 className="mt-2 font-serif text-2xl font-bold tracking-[-0.04em]">Need more room?</h2>
            <div className="mt-4 flex flex-col gap-3 text-sm leading-6 text-muted-foreground">
              <p>Move beyond the free plan when you need more inventory capacity.</p>
              <p>Use paid tiers for included featured slots and faster review support.</p>
              <p>One-time featured purchases remain available even without an upgrade.</p>
            </div>
            <Link className={buttonVariants({ className: "mt-5 w-full" })} to="/pricing">
              Change plan
            </Link>
          </Card>
        </aside>
      </div>
    </section>
  );
}
