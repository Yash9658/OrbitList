import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "../../app/providers/auth-provider";
import { Badge } from "../../components/ui/badge";
import { buttonVariants } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { cn } from "../../lib/utils";
import {
  createSubscriptionCheckoutRequest,
  getBillingPlans,
  getBillingSummary
} from "../../services/billing.service";

const marketingCopyBySlug: Record<
  string,
  { description: string; featured?: boolean; features: string[] }
> = {
  starter: {
    description: "For first-time sellers testing demand with a limited number of listings.",
    features: [
      "Up to 5 seller inventory slots",
      "Messaging, watchlist, and proof uploads",
      "Standard marketplace visibility",
      "Manual verification submission"
    ]
  },
  "pro-seller": {
    description: "For operators managing multiple assets and wanting more buyer attention.",
    featured: true,
    features: [
      "50 seller inventory slots",
      "3 included featured listing slots",
      "Priority verification review",
      "Stronger seller support and faster moderation"
    ]
  },
  studio: {
    description: "For agencies and portfolio sellers who need higher touch support and scale.",
    features: [
      "250 seller inventory slots",
      "10 included featured listing slots",
      "Dedicated onboarding support",
      "Portfolio-scale seller operations"
    ]
  }
};

export function PricingPage() {
  const { isAuthenticated } = useAuth();
  const plansQuery = useQuery({
    queryKey: ["billing-plans"],
    queryFn: getBillingPlans
  });
  const summaryQuery = useQuery({
    queryKey: ["billing-summary"],
    queryFn: getBillingSummary,
    enabled: isAuthenticated
  });
  const checkoutMutation = useMutation({
    mutationFn: (planSlug: string) => createSubscriptionCheckoutRequest(planSlug),
    onSuccess: (session) => {
      window.location.href = session.url;
    }
  });

  const plans = useMemo(
    () =>
      (plansQuery.data ?? []).map((plan) => ({
        ...plan,
        priceLabel: plan.isFree ? "$0" : `$${plan.priceMonthly}/mo`,
        description: marketingCopyBySlug[plan.slug]?.description ?? plan.supportLevel ?? plan.name,
        featured: marketingCopyBySlug[plan.slug]?.featured ?? false,
        features:
          marketingCopyBySlug[plan.slug]?.features ?? [
            `${plan.listingLimit} listing slots`,
            `${plan.featuredSlots} featured slots`,
            plan.supportLevel ?? "Marketplace seller support"
          ]
      })),
    [plansQuery.data]
  );
  const currentPlanSlug = summaryQuery.data?.currentPlan.slug;

  return (
    <section className="flex flex-col gap-8">
      <div className="py-6">
        <div className="flex max-w-4xl flex-col gap-4">
          <Badge variant="secondary" className="w-fit uppercase tracking-[0.24em]">
            Seller plans
          </Badge>
          <h1 className="font-serif text-4xl font-black leading-[0.98] tracking-[-0.06em] md:text-5xl">
            Pricing that scales with serious digital inventory.
          </h1>
          <p className="max-w-2xl text-base leading-7 text-muted-foreground md:text-lg md:leading-8">
            Start free, then unlock featured placement, faster review, and stronger seller tooling
            as your portfolio grows.
          </p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {plans.map((plan) => (
          <Card
            className={cn(
              "relative flex min-h-[420px] flex-col overflow-hidden p-0",
              plan.featured && "border-primary bg-secondary/70 shadow-[0_24px_70px_rgba(47,109,104,0.18)]"
            )}
            key={plan.slug}
          >
            {plan.featured ? (
              <Badge className="absolute right-5 top-5">Most useful</Badge>
            ) : null}
            <CardHeader className="gap-4 p-7">
              <Badge variant="outline" className="w-fit uppercase tracking-[0.22em]">
                {plan.name}
              </Badge>
              <CardTitle className="text-3xl">{plan.priceLabel}</CardTitle>
              <p className="min-h-16 text-base leading-7 text-muted-foreground">{plan.description}</p>
            </CardHeader>

            <CardContent className="flex flex-1 flex-col gap-6 p-7 pt-0">
              <div className="flex flex-1 flex-col gap-3">
              {plan.features.map((feature) => (
                <p className="border-l-2 border-primary/25 pl-4 text-sm leading-6 text-muted-foreground" key={feature}>
                  {feature}
                </p>
              ))}
              </div>

              {isAuthenticated ? (
                currentPlanSlug === plan.slug ? (
                  <button className={buttonVariants({ variant: "outline" })} disabled type="button">
                    Current plan
                  </button>
                ) : plan.isFree ? (
                  <Link className={buttonVariants({ variant: "outline" })} to="/dashboard">
                    Continue free
                  </Link>
                ) : (
                  <button
                    className={buttonVariants({ variant: plan.featured ? "default" : "outline" })}
                    disabled={checkoutMutation.isPending}
                    onClick={() => void checkoutMutation.mutateAsync(plan.slug)}
                    type="button"
                  >
                    {checkoutMutation.isPending ? "Redirecting..." : `Choose ${plan.name}`}
                  </button>
                )
              ) : (
                <Link className={buttonVariants({ variant: plan.featured ? "default" : "outline" })} to="/login">
                  Log in to upgrade
                </Link>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
