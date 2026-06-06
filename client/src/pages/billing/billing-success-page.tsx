import { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "../../components/ui/badge";
import { buttonVariants } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { confirmCheckoutRequest } from "../../services/billing.service";

export function BillingSuccessPage() {
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const sessionId = searchParams.get("session_id") ?? "";

  const confirmationQuery = useQuery({
    queryKey: ["billing-confirmation", sessionId],
    queryFn: () => confirmCheckoutRequest(sessionId),
    enabled: Boolean(sessionId)
  });

  useEffect(() => {
    if (!confirmationQuery.data) {
      return;
    }

    void queryClient.invalidateQueries({ queryKey: ["billing-history"] });
    void queryClient.invalidateQueries({ queryKey: ["billing-summary"] });
    void queryClient.invalidateQueries({ queryKey: ["my-listings"] });
    void queryClient.invalidateQueries({ queryKey: ["marketplace-listings"] });
  }, [confirmationQuery.data, queryClient]);

  if (!sessionId) {
    return (
      <section className="grid min-h-[50vh] place-items-center">
        <Card className="max-w-xl p-8 text-center">
          <Badge variant="secondary" className="uppercase tracking-[0.22em]">Missing session</Badge>
          <h1 className="mt-4 font-serif text-4xl font-black tracking-[-0.06em]">Checkout session not found</h1>
          <p className="mt-3 text-muted-foreground">The success page needs a valid session id to confirm billing.</p>
          <Link className={buttonVariants({ className: "mt-6" })} to="/billing">
            Back to billing
          </Link>
        </Card>
      </section>
    );
  }

  if (confirmationQuery.isLoading) {
    return (
      <section className="grid min-h-[50vh] place-items-center">
        <Card className="max-w-xl p-8 text-center">
          <Badge variant="secondary" className="uppercase tracking-[0.22em]">Confirming</Badge>
          <h1 className="mt-4 font-serif text-4xl font-black tracking-[-0.06em]">Finishing your checkout</h1>
          <p className="mt-3 text-muted-foreground">We are syncing the completed Stripe session into your seller workspace.</p>
        </Card>
      </section>
    );
  }

  if (!confirmationQuery.data) {
    return (
      <section className="grid min-h-[50vh] place-items-center">
        <Card className="max-w-xl p-8 text-center">
          <Badge variant="secondary" className="uppercase tracking-[0.22em]">Unavailable</Badge>
          <h1 className="mt-4 font-serif text-4xl font-black tracking-[-0.06em]">We could not confirm this checkout</h1>
          <p className="mt-3 text-muted-foreground">
            {confirmationQuery.error instanceof Error
              ? confirmationQuery.error.message
              : "Please try again from the billing page."}
          </p>
          <Link className={buttonVariants({ className: "mt-6" })} to="/billing">
            Back to billing
          </Link>
        </Card>
      </section>
    );
  }

  const confirmation = confirmationQuery.data;

  return (
    <section className="grid min-h-[50vh] place-items-center">
      <Card className="max-w-xl p-8 text-center">
        <Badge variant="secondary" className="uppercase tracking-[0.22em]">Confirmed</Badge>
        <h1 className="mt-4 font-serif text-4xl font-black tracking-[-0.06em]">{confirmation.message}</h1>
        <p className="mt-3 text-muted-foreground">
          {confirmation.payment.type === "SUBSCRIPTION"
            ? `You are now on ${confirmation.summary.currentPlan.name}.`
            : "Your listing now has paid featured placement support."}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link className={buttonVariants()} to="/billing">
            Open billing
          </Link>
          <Link className={buttonVariants({ variant: "outline" })} to="/dashboard">
            Back to dashboard
          </Link>
        </div>
      </Card>
    </section>
  );
}
