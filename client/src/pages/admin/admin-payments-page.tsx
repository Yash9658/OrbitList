import { useQuery } from "@tanstack/react-query";
import { getAdminPayments } from "../../services/billing.service";
import {
  AdminEmpty,
  AdminHero,
  AdminList,
  AdminPage,
  AdminPanel,
  AdminStatusBadge,
  adminMetaClass
} from "./admin-ui";

export function AdminPaymentsPage() {
  const paymentsQuery = useQuery({
    queryKey: ["admin-payments"],
    queryFn: () => getAdminPayments()
  });

  const payments = paymentsQuery.data?.items ?? [];
  const meta = paymentsQuery.data?.meta;

  return (
    <AdminPage>
      <AdminHero
        eyebrow="Admin payments"
        stats={[
          { label: "records loaded", value: meta?.total ?? 0 },
          { label: "succeeded revenue", value: `$${meta ? meta.totalRevenue.toLocaleString() : 0}` }
        ]}
        title="Review platform revenue, plan upgrades, and featured listing purchases."
      >
        Get quick visibility into successful billing activity across the marketplace.
      </AdminHero>

      <AdminPanel
        description="Subscription upgrades and featured purchases are shown with seller context."
        eyebrow="Transactions"
        title="Latest payment activity"
      >
        {paymentsQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading payments...</p>
        ) : null}

        {!paymentsQuery.isLoading && payments.length === 0 ? (
          <AdminEmpty title="No payments yet.">
            Charges will appear here once sellers begin using paid billing paths.
          </AdminEmpty>
        ) : null}

        {payments.length > 0 ? (
          <AdminList>
            {payments.map((payment) => (
              <article
                className="grid gap-4 rounded-3xl border border-border bg-muted/20 p-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
                key={payment.id}
              >
                <div>
                  <div className={adminMetaClass}>
                    <span>{payment.type.replace(/_/g, " ")}</span>
                    <span>{payment.status}</span>
                    <span>{new Date(payment.createdAt).toLocaleString()}</span>
                  </div>
                  <h3 className="mt-3 text-xl font-bold">{payment.user.fullName ?? payment.user.email}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {payment.currency} {payment.amount.toLocaleString()}
                    {" | "}
                    {payment.plan?.name ?? payment.listing?.title ?? "Marketplace payment"}
                  </p>
                </div>

                <AdminStatusBadge>
                  {payment.status === "SUCCEEDED" ? "Paid" : payment.status}
                </AdminStatusBadge>
              </article>
            ))}
          </AdminList>
        ) : null}
      </AdminPanel>
    </AdminPage>
  );
}
