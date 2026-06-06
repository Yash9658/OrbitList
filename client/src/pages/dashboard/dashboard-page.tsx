import { useMemo } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient
} from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAuth } from "../../app/providers/auth-provider";
import { Badge } from "../../components/ui/badge";
import { Button, buttonVariants } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { cn } from "../../lib/utils";
import {
  createFeaturedCheckoutRequest,
  getBillingHistory
} from "../../services/billing.service";
import { getMyIdentityVerification } from "../../services/identity.service";
import { getMySellerInsights } from "../../services/insights.service";
import {
  getMyListings,
  updateListingRequest,
  updateListingStatusRequest
} from "../../services/listing.service";
import { getMyPayoutAccount } from "../../services/payout.service";
import { ListingRecord } from "../../types/listing";

function getStatusAction(listing: ListingRecord) {
  switch (listing.status) {
    case "ACTIVE":
      return {
        label: "Move to draft",
        status: "DRAFT" as const
      };
    case "PENDING_REVIEW":
      return {
        label: "Move to draft",
        status: "DRAFT" as const
      };
    case "REJECTED":
      return {
        label: "Resubmit",
        status: "ACTIVE" as const
      };
    case "ARCHIVED":
      return {
        label: "Restore to draft",
        status: "DRAFT" as const
      };
    case "DRAFT":
    default:
      return {
        label: "Submit for review",
        status: "ACTIVE" as const
      };
  }
}

function getStatusTone(status: ListingRecord["status"]) {
  switch (status) {
    case "ACTIVE":
      return "Live";
    case "PENDING_REVIEW":
      return "In review";
    case "REJECTED":
      return "Needs changes";
    case "ARCHIVED":
      return "Archived";
    case "DRAFT":
    default:
      return "Draft";
  }
}

export function DashboardPage() {
  const { user } = useAuth();
  const canSell =
    user?.role === "SELLER" || user?.role === "BOTH" || user?.role === "ADMIN";
  const queryClient = useQueryClient();
  const listingsQuery = useQuery({
    queryKey: ["my-listings"],
    queryFn: getMyListings
  });
  const billingHistoryQuery = useQuery({
    queryKey: ["billing-history"],
    queryFn: getBillingHistory,
    enabled: canSell
  });
  const identityQuery = useQuery({
    queryKey: ["my-identity-verification"],
    queryFn: getMyIdentityVerification,
    enabled: canSell
  });
  const payoutQuery = useQuery({
    queryKey: ["my-payout-account"],
    queryFn: getMyPayoutAccount,
    enabled: canSell
  });
  const insightsQuery = useQuery({
    queryKey: ["seller-insights", "me"],
    queryFn: getMySellerInsights,
    enabled: canSell
  });

  const statusMutation = useMutation({
    mutationFn: ({
      id,
      status
    }: {
      id: string;
      status: "DRAFT" | "ACTIVE" | "ARCHIVED";
    }) =>
      updateListingStatusRequest(id, status),
    onSuccess: async (listing) => {
      await queryClient.invalidateQueries({ queryKey: ["my-listings"] });
      await queryClient.invalidateQueries({ queryKey: ["marketplace-listings"] });
      await queryClient.invalidateQueries({ queryKey: ["listing", listing.slug] });
      await queryClient.invalidateQueries({ queryKey: ["managed-listing", listing.id] });
      await queryClient.invalidateQueries({ queryKey: ["billing-history"] });
      await queryClient.invalidateQueries({ queryKey: ["billing-summary"] });
      await queryClient.invalidateQueries({ queryKey: ["moderation-listings"] });
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    }
  });
  const featureMutation = useMutation({
    mutationFn: async ({
      id,
      nextFeaturedState,
      requiresCheckout
    }: {
      id: string;
      nextFeaturedState: boolean;
      requiresCheckout: boolean;
    }) => {
      if (requiresCheckout && nextFeaturedState) {
        return createFeaturedCheckoutRequest(id);
      }

      return updateListingRequest(id, {
        isFeatured: nextFeaturedState
      });
    },
    onSuccess: async (result, variables) => {
      if ("url" in result) {
        window.location.href = result.url;
        return;
      }

      await queryClient.invalidateQueries({ queryKey: ["my-listings"] });
      await queryClient.invalidateQueries({ queryKey: ["marketplace-listings"] });
      await queryClient.invalidateQueries({ queryKey: ["billing-history"] });
      await queryClient.invalidateQueries({ queryKey: ["billing-summary"] });
      await queryClient.invalidateQueries({ queryKey: ["listing", result.slug] });
      await queryClient.invalidateQueries({ queryKey: ["managed-listing", variables.id] });
    }
  });

  const listings = listingsQuery.data?.data ?? [];
  const meta = listingsQuery.data?.meta;
  const billingSummary = billingHistoryQuery.data?.summary;
  const identityStatus = identityQuery.data?.status ?? "NOT_STARTED";
  const insights = insightsQuery.data;
  const payoutAccount = payoutQuery.data;
  const launchChecklist = useMemo(
    () => [
      {
        label: "Complete public profile",
        complete: Boolean(user?.fullName?.trim() && user?.username?.trim() && user?.bio?.trim())
      },
      {
        label: "Add a seller avatar",
        complete: Boolean(user?.avatarUrl)
      },
      {
        label: "Submit identity verification",
        complete: identityStatus === "APPROVED"
      },
      {
        label: "Connect payout onboarding",
        complete: payoutAccount?.payoutsReady ?? false
      },
      {
        label: "Create at least one listing",
        complete: (meta?.total ?? 0) > 0
      },
      {
        label: "Have a live marketplace listing",
        complete: (meta?.activeCount ?? 0) > 0
      }
    ],
    [
      identityStatus,
      meta?.activeCount,
      meta?.total,
      payoutAccount?.payoutsReady,
      user?.avatarUrl,
      user?.bio,
      user?.fullName,
      user?.username
    ]
  );
  const launchChecklistCompleteCount = launchChecklist.filter((item) => item.complete).length;
  const launchReadinessPercentage = Math.round(
    (launchChecklistCompleteCount / Math.max(launchChecklist.length, 1)) * 100
  );

  const dashboardSignals = useMemo(
    () => [
      {
        label: "Total listings",
        value: String(meta?.total ?? 0),
        note: `${meta?.activeCount ?? 0} live, ${meta?.pendingReviewCount ?? 0} in review`
      },
      {
        label: "Listed value",
        value: `$${meta ? meta.totalValue.toLocaleString() : 0}`,
        note: "Combined asking price"
      },
      {
        label: "Reputation",
        value: String(insights?.reputationScore ?? 0),
        note: `${insights?.sellerTier ?? "Emerging"} seller tier`
      },
      {
        label: "Completed deals",
        value: String(insights?.completedDeals ?? 0),
        note: `$${(insights?.totalTransactionVolume ?? 0).toLocaleString()} protected volume`
      }
    ],
    [insights, meta]
  );

  return (
    <section className="flex flex-col gap-6">
      <div className="grid gap-5 py-6 lg:grid-cols-[1fr_320px] lg:items-end">
        <div className="flex max-w-4xl flex-col gap-4">
          <Badge variant="secondary" className="w-fit uppercase tracking-[0.24em]">
            Seller workspace
          </Badge>
          <h1 className="font-serif text-4xl font-black leading-[0.98] tracking-[-0.06em] md:text-5xl">
            Seller dashboard
          </h1>
          <p className="max-w-2xl text-base leading-7 text-muted-foreground md:text-lg md:leading-8">
            Signed in as {user?.fullName ?? user?.email} with the {user?.role} role.
            Manage listings, reviews, billing, verification, and marketplace readiness.
          </p>
        </div>

        <Card className="grid grid-cols-2 gap-3 p-5">
          <Link className={cn(buttonVariants({ size: "sm" }), "h-10 w-full")} to="/dashboard/listings/new">
            New listing
          </Link>
          <Link className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-10 w-full")} to="/dashboard/verification">
            Verification
          </Link>
          <Link className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-10 w-full")} to="/billing">
            Billing
          </Link>
          {user?.role === "ADMIN" ? (
            <Link className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-10 w-full")} to="/admin/listings">
              Moderation queue
            </Link>
          ) : null}
          <Link className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-10 w-full")} to="/marketplace">
            Marketplace
          </Link>
        </Card>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {dashboardSignals.map((signal) => (
          <Card className="p-4" key={signal.label}>
            <span className="text-sm font-medium text-muted-foreground">{signal.label}</span>
            <strong className="mt-2 block text-2xl tracking-[-0.05em]">{signal.value}</strong>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{signal.note}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div>
          <Card className="p-5 md:p-6">
            <div className="flex flex-col gap-3 border-b pb-5 md:flex-row md:items-end md:justify-between">
              <div>
                <Badge variant="outline" className="uppercase tracking-[0.22em]">
                  Listings
                </Badge>
                <h2 className="mt-2 font-serif text-2xl font-bold tracking-[-0.05em] md:text-3xl">
                  Your inventory
                </h2>
              </div>
              <p className="max-w-md text-sm leading-6 text-muted-foreground">
                Each asset should feel clear, comparable, and ready for conversation.
              </p>
            </div>

            {listingsQuery.isLoading ? (
              <p className="py-8 text-muted-foreground">Loading your listings...</p>
            ) : null}

            {!listingsQuery.isLoading && listings.length === 0 ? (
              <div className="mt-5 rounded-2xl border border-dashed bg-background/70 p-8">
                <h3 className="font-serif text-2xl font-bold tracking-[-0.04em]">No listings yet.</h3>
                <p className="mt-2 max-w-xl text-muted-foreground">
                  {canSell
                    ? "Start with your first asset and we will turn this workspace into a real seller dashboard."
                    : "Switch into a seller-capable role to begin listing inventory."}
                </p>
                {canSell ? (
                  <Link className={cn(buttonVariants(), "mt-5")} to="/dashboard/listings/new">
                    Create your first listing
                  </Link>
                ) : null}
              </div>
            ) : null}

            {listings.length > 0 ? (
              <div className="mt-5 flex flex-col gap-3">
                {listings.map((listing) => (
                  <article className="rounded-2xl border bg-background/70 p-4" key={listing.id}>
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline">{listing.platform.name}</Badge>
                          <Badge variant="secondary">{getStatusTone(listing.status)}</Badge>
                          <Badge variant="outline">{listing.niche?.name ?? "General"}</Badge>
                          <Badge variant="outline">{listing.media.length} media</Badge>
                          {listing.isFeatured ? <Badge>Featured</Badge> : null}
                        </div>
                        <h3 className="mt-3 text-xl font-bold tracking-[-0.03em]">{listing.title}</h3>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                          {listing.metrics?.followersCount?.toLocaleString() ?? "N/A"} followers
                          {" | "}
                          {listing.primaryCountry ?? "Global audience"}
                          {" | "}
                          {listing.currency} {listing.price.toLocaleString()}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                          {listing.status === "PENDING_REVIEW"
                            ? "This listing is waiting in the admin moderation queue."
                            : listing.status === "REJECTED"
                              ? "This listing needs a few revisions before it can go live."
                              : listing.status === "ACTIVE"
                                ? "This listing is visible to buyers in the marketplace."
                                : listing.status === "ARCHIVED"
                                  ? "This listing is archived and hidden from buyers."
                                  : "This listing is still in draft and not yet submitted."}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2 xl:max-w-xs xl:justify-end">
                      <Link
                        className={buttonVariants({ variant: "outline", size: "sm" })}
                        to={`/dashboard/listings/${listing.id}/edit`}
                      >
                        Edit
                      </Link>
                      <Link
                        className={buttonVariants({ variant: "outline", size: "sm" })}
                        to="/dashboard/verification"
                      >
                        Verify
                      </Link>
                      {listing.isFeatured ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={featureMutation.isPending}
                          onClick={() =>
                            void featureMutation.mutateAsync({
                              id: listing.id,
                              nextFeaturedState: false,
                              requiresCheckout: false
                            })
                          }
                          type="button"
                        >
                          Remove feature
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={featureMutation.isPending}
                          onClick={() =>
                            void featureMutation.mutateAsync({
                              id: listing.id,
                              nextFeaturedState: true,
                              requiresCheckout: !Boolean(billingSummary?.usage.canFeatureMore)
                            })
                          }
                          type="button"
                        >
                          {billingSummary?.usage.canFeatureMore
                            ? "Use featured slot"
                            : `Buy feature ($${billingSummary?.featuredListingPriceUsd ?? 19})`}
                        </Button>
                      )}

                      <Button
                        variant="outline"
                        size="sm"
                        disabled={statusMutation.isPending}
                        onClick={() =>
                          void statusMutation.mutateAsync({
                            id: listing.id,
                            status: getStatusAction(listing).status
                          })
                        }
                        type="button"
                      >
                        {getStatusAction(listing).label}
                      </Button>

                      {listing.status !== "ARCHIVED" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={statusMutation.isPending}
                          onClick={() =>
                            void statusMutation.mutateAsync({
                              id: listing.id,
                              status: "ARCHIVED"
                            })
                          }
                          type="button"
                        >
                          Archive
                        </Button>
                      ) : null}

                      <Link className={buttonVariants({ size: "sm" })} to={`/listing/${listing.slug}`}>
                        View
                      </Link>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : null}
          </Card>
        </div>

        <aside className="xl:sticky xl:top-24 xl:self-start">
          <Card className="overflow-hidden p-0">
            <div className="bg-primary p-6 text-primary-foreground">
              <Badge className="border-white/20 bg-white/15 text-primary-foreground">
                Seller readiness
              </Badge>
              <div className="mt-5 flex items-end justify-between gap-4">
                <div>
                  <strong className="block text-5xl tracking-[-0.07em]">
                    {launchReadinessPercentage}%
                  </strong>
                  <span className="text-sm text-primary-foreground/75">
                    launch checklist complete
                  </span>
                </div>
                <div className="grid size-20 place-items-center rounded-full border border-white/20 bg-white/10 text-sm font-bold">
                  {launchChecklistCompleteCount}/{launchChecklist.length}
                </div>
              </div>
            </div>

            <div className="space-y-6 p-5">
              <div>
                <h2 className="text-xl font-bold tracking-[-0.04em]">
                  {user?.fullName ?? user?.email}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {user?.role} account |{" "}
                  {identityStatus === "APPROVED"
                    ? "identity approved"
                    : identityStatus === "PENDING"
                      ? "identity in review"
                      : identityStatus === "REJECTED"
                        ? "identity needs updates"
                        : "identity not started"}
                </p>
              </div>

              <div className="space-y-2">
                {launchChecklist.map((item) => (
                  <div className="flex items-center justify-between gap-3 rounded-2xl bg-muted/45 px-3 py-2 text-sm" key={item.label}>
                    <span className="text-muted-foreground">{item.label}</span>
                    <Badge variant={item.complete ? "default" : "outline"}>
                      {item.complete ? "Done" : "Todo"}
                    </Badge>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3 border-y py-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Plan</span>
                  <strong className="mt-1 block">{billingSummary?.currentPlan.name ?? "Starter"}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Featured slots</span>
                  <strong className="mt-1 block">
                    {billingSummary?.usage.remainingFeaturedSlots ?? 0} left
                  </strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Completion</span>
                  <strong className="mt-1 block">{insights?.completionRate ?? 0}%</strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Disputes</span>
                  <strong className="mt-1 block">{insights?.disputeRate ?? 0}%</strong>
                </div>
              </div>

              <p className="text-sm leading-6 text-muted-foreground">
                {payoutAccount?.status === "ACTIVE"
                  ? "Payout onboarding is active for seller release transfers."
                  : "Finish profile, identity, and payout setup before live protected transfers."}
              </p>

              <div className="grid gap-2">
                <Link className={cn(buttonVariants(), "w-full")} to="/settings">
                  Finish setup
                </Link>
                <Link className={cn(buttonVariants({ variant: "outline" }), "w-full")} to="/pricing">
                  Manage plan
                </Link>
              </div>
            </div>
          </Card>
        </aside>
      </div>
    </section>
  );
}
