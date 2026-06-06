import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../app/providers/auth-provider";
import { Badge } from "../../components/ui/badge";
import { Button, buttonVariants } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { createConversationRequest } from "../../services/conversation.service";
import {
  addFavoriteRequest,
  getFavorites,
  removeFavoriteRequest
} from "../../services/favorites.service";
import { getMyIdentityVerification } from "../../services/identity.service";
import { getSellerInsightsBySellerId } from "../../services/insights.service";
import { getListingBySlug } from "../../services/listing.service";
import { createReportRequest } from "../../services/reports.service";
import { createProtectedTransactionCheckout } from "../../services/transaction.service";

const inputClass =
  "w-full rounded-2xl border bg-card px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15";
const fieldClass = "flex flex-col gap-2";

export function ListingDetailPage() {
  const { slug = "" } = useParams();
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [initialMessage, setInitialMessage] = useState(
    "Hi, I'm interested in this listing. Can you share more details?"
  );
  const [reportReason, setReportReason] = useState("Suspicious ownership proof");
  const [reportDetails, setReportDetails] = useState("");
  const [sellerReportReason, setSellerReportReason] = useState("Suspicious seller behavior");
  const [sellerReportDetails, setSellerReportDetails] = useState("");

  const listingQuery = useQuery({
    queryKey: ["listing", slug],
    queryFn: () => getListingBySlug(slug),
    enabled: Boolean(slug)
  });
  const favoritesQuery = useQuery({
    queryKey: ["favorites"],
    queryFn: getFavorites,
    enabled: isAuthenticated
  });
  const buyerIdentityQuery = useQuery({
    queryKey: ["my-identity-verification"],
    queryFn: getMyIdentityVerification,
    enabled: isAuthenticated
  });

  const conversationMutation = useMutation({
    mutationFn: createConversationRequest,
    onSuccess: async (conversation) => {
      await queryClient.invalidateQueries({ queryKey: ["conversations"] });
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
      navigate(`/messages/${conversation.id}`);
    }
  });
  const favoriteMutation = useMutation({
    mutationFn: async ({
      listingId,
      isFavorited
    }: {
      listingId: string;
      isFavorited: boolean;
    }) =>
      isFavorited
        ? removeFavoriteRequest(listingId)
        : addFavoriteRequest(listingId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["favorites"] });
    }
  });
  const transactionMutation = useMutation({
    mutationFn: createProtectedTransactionCheckout
  });
  const reportMutation = useMutation({
    mutationFn: createReportRequest,
    onSuccess: async () => {
      setReportDetails("");
      setSellerReportDetails("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["notifications"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-reports"] })
      ]);
    }
  });

  const listing = listingQuery.data;
  const sellerInsightsQuery = useQuery({
    queryKey: ["seller-insights", listing?.seller.id],
    queryFn: () => getSellerInsightsBySellerId(listing!.seller.id),
    enabled: Boolean(listing?.seller.id)
  });
  const isOwnListing = listing?.seller.id === user?.id;
  const isFavorited = listing
    ? (favoritesQuery.data?.meta?.listingIds ?? []).includes(listing.id)
    : false;
  const sellerInsights = sellerInsightsQuery.data;
  const buyerIdentityStatus = buyerIdentityQuery.data?.status ?? "NOT_STARTED";
  const conversationError = useMemo(() => {
    if (conversationMutation.error instanceof Error) {
      return conversationMutation.error.message;
    }

    return null;
  }, [conversationMutation.error]);

  const buyerHighlights = useMemo(() => {
    if (!listing) {
      return [];
    }

    return [
      listing.metrics?.monetized ? "Monetization is already enabled." : null,
      listing.isVerified ? "Listing is marked as verified by the platform." : null,
      listing.metrics?.verifiedBadge ? "The account currently carries a verified badge." : null,
      listing.primaryCountry
        ? `Primary audience signal points to ${listing.primaryCountry}.`
        : null
    ].filter(Boolean) as string[];
  }, [listing]);
  const canStartProtectedDeal =
    Boolean(sellerInsights?.protectedTransferReady) &&
    buyerIdentityStatus === "APPROVED";
  const protectedDealMessage = !sellerInsights?.protectedTransferReady
    ? "The seller is not yet approved for protected money-movement workflows."
    : buyerIdentityStatus !== "APPROVED"
      ? "Complete identity verification in Settings before starting a protected deal."
      : "Both sides are identity-ready for the protected transfer workflow.";

  if (listingQuery.isLoading) {
    return (
      <section className="grid min-h-[50vh] place-items-center">
        <Card className="max-w-xl p-8 text-center">
          <Badge variant="secondary">Loading</Badge>
          <h1 className="mt-4 font-serif text-4xl font-black tracking-[-0.06em]">
            Loading listing details
          </h1>
        </Card>
      </section>
    );
  }

  if (!listing) {
    return (
      <section className="grid min-h-[50vh] place-items-center">
        <Card className="max-w-xl p-8 text-center">
          <Badge variant="secondary">Unavailable</Badge>
          <h1 className="mt-4 font-serif text-4xl font-black tracking-[-0.06em]">
            Listing not found.
          </h1>
        </Card>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-8">
      <div className="grid gap-6 py-8 lg:grid-cols-[1fr_340px] lg:items-end">
        <div className="flex max-w-4xl flex-col gap-4">
          <Badge variant="secondary" className="w-fit uppercase tracking-[0.24em]">
            Listing overview
          </Badge>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{listing.platform.name}</Badge>
            <Badge variant="secondary">{listing.niche?.name ?? "General"}</Badge>
            {listing.handle ? <Badge variant="outline">{listing.handle}</Badge> : null}
          </div>
          <h1 className="font-serif text-5xl font-black leading-[0.96] tracking-[-0.06em] md:text-6xl">
            {listing.title}
          </h1>
          <p className="max-w-3xl text-lg leading-8 text-muted-foreground">
            {listing.description ??
              "The seller has not added a longer description yet, but the core performance data is available below."}
          </p>
        </div>

        <Card className="p-5">
          <span className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Asking price
          </span>
          <strong className="mt-2 block text-4xl tracking-[-0.06em]">
            {listing.currency} {listing.price.toLocaleString()}
          </strong>
          <p className="mt-2 text-sm text-muted-foreground">{listing.status} listing</p>
          {isAuthenticated ? (
            <Button
              className="mt-5 w-full"
              variant={isFavorited ? "subtle" : "outline"}
              disabled={favoriteMutation.isPending}
              onClick={() =>
                void favoriteMutation.mutateAsync({
                  listingId: listing.id,
                  isFavorited
                })
              }
              type="button"
            >
              {isFavorited ? "Saved to watchlist" : "Save to watchlist"}
            </Button>
          ) : (
            <Link className={buttonVariants({ variant: "outline", className: "mt-5 w-full" })} to="/login">
              Log in to save
            </Link>
          )}
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-5">
          <Card className="p-5 md:p-6">
            <div className="flex flex-col gap-3 border-b pb-5 md:flex-row md:items-end md:justify-between">
              <div>
                <Badge variant="outline" className="uppercase tracking-[0.22em]">
                  Performance snapshot
                </Badge>
                <h2 className="mt-2 font-serif text-3xl font-bold tracking-[-0.05em]">
                  Core buyer metrics
                </h2>
              </div>
              <p className="max-w-md text-sm leading-6 text-muted-foreground">
                Enough signal to judge fit before the first message.
              </p>
            </div>

            <dl className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                ["Followers", listing.metrics?.followersCount?.toLocaleString() ?? "N/A"],
                [
                  "Engagement",
                  listing.metrics?.engagementRate
                    ? `${listing.metrics.engagementRate}%`
                    : "N/A"
                ],
                ["Monthly views", listing.metrics?.monthlyViews?.toLocaleString() ?? "N/A"],
                ["Monthly reach", listing.metrics?.monthlyReach?.toLocaleString() ?? "N/A"]
              ].map(([label, value]) => (
                <div className="rounded-2xl border bg-background/70 p-4" key={label}>
                  <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    {label}
                  </dt>
                  <dd className="mt-2 text-2xl font-bold tracking-[-0.04em]">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card className="p-5">
              <h2 className="font-serif text-2xl font-bold tracking-[-0.04em]">
                Audience and transfer context
              </h2>
              <dl className="mt-4 grid gap-3 text-sm">
                {[
                  ["Audience region", listing.primaryCountry ?? "Global / not specified"],
                  ["Age range", listing.audienceAgeRange ?? "Not specified"],
                  ["Monetized", listing.metrics?.monetized ? "Yes" : "No"],
                  ["Verified badge", listing.metrics?.verifiedBadge ? "Yes" : "No"]
                ].map(([label, value]) => (
                  <div className="flex items-center justify-between gap-4 border-b pb-2 last:border-b-0" key={label}>
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="font-semibold">{value}</dd>
                  </div>
                ))}
              </dl>
            </Card>

            <Card className="p-5">
              <h2 className="font-serif text-2xl font-bold tracking-[-0.04em]">Buyer notes</h2>
              <div className="mt-4 flex flex-col gap-3 text-sm leading-6 text-muted-foreground">
                {buyerHighlights.length > 0 ? (
                  buyerHighlights.map((item) => <p key={item}>{item}</p>)
                ) : (
                  <p>No extra seller signals have been added yet.</p>
                )}
              </div>
            </Card>
          </div>

          <Card className="p-5 md:p-6">
            <div className="flex flex-col gap-3 border-b pb-5 md:flex-row md:items-end md:justify-between">
              <div>
                <Badge variant="outline" className="uppercase tracking-[0.22em]">Proof media</Badge>
                <h2 className="mt-2 font-serif text-3xl font-bold tracking-[-0.05em]">
                  Media and supporting links
                </h2>
              </div>
              <p className="max-w-md text-sm leading-6 text-muted-foreground">
                Use these screenshots and links to validate ownership and performance claims.
              </p>
            </div>

            {listing.media.length > 0 ? (
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {listing.media.map((item) => (
                  <article className="overflow-hidden rounded-2xl border bg-background/70 p-3" key={item.id}>
                    <Badge variant="outline">{item.type}</Badge>
                    {item.type === "image" ? (
                      <img
                        alt={`${listing.title} proof`}
                        className="mt-3 aspect-video w-full rounded-xl object-cover"
                        src={item.fileUrl}
                      />
                    ) : null}
                    <a className="mt-3 block truncate text-sm font-semibold text-primary" href={item.fileUrl} rel="noreferrer" target="_blank">
                      {item.fileUrl}
                    </a>
                  </article>
                ))}
              </div>
            ) : (
              <p className="mt-5 text-sm text-muted-foreground">No proof media has been attached to this listing yet.</p>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="font-serif text-2xl font-bold tracking-[-0.04em]">Transfer notes</h2>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              {listing.transferNotes ??
                "Transfer notes have not been added yet. Use messaging to ask the seller about handoff process, included assets, and support after transfer."}
            </p>
          </Card>
        </div>

        <aside className="flex flex-col gap-4">
          <Card className="p-5">
            <Badge variant="outline" className="uppercase tracking-[0.22em]">Seller</Badge>
            <div className="mt-4 flex items-center gap-4">
              <div className="grid size-16 place-items-center overflow-hidden rounded-full bg-primary text-xl font-bold text-primary-foreground">
                {listing.seller.avatarUrl ? (
                  <img
                    alt={listing.seller.fullName ?? listing.seller.username ?? "Seller avatar"}
                    className="size-full object-cover"
                    src={listing.seller.avatarUrl}
                  />
                ) : (
                  <span>
                    {(listing.seller.fullName ??
                      listing.seller.username ??
                      "S").slice(0, 1).toUpperCase()}
                  </span>
                )}
              </div>
              <div>
                <h2 className="font-serif text-2xl font-bold tracking-[-0.04em]">
                  {listing.seller.fullName ?? listing.seller.username ?? "Seller"}
                </h2>
                <p className="text-sm text-muted-foreground">{listing.seller.country ?? "Unknown region"}</p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-7 text-muted-foreground">
              {listing.seller.bio ??
                "This seller has not added a public bio yet, but the listing metrics and proof media are available for review."}
            </p>

            <div className="mt-4 grid gap-3">
              <div className="flex justify-between gap-4 rounded-xl border bg-background/70 p-3 text-sm">
                <span className="text-muted-foreground">Verified seller</span>
                <strong>{listing.seller.isVerified ? "Yes" : "No"}</strong>
              </div>
              <div className="flex justify-between gap-4 rounded-xl border bg-background/70 p-3 text-sm">
                <span className="text-muted-foreground">Listing verified</span>
                <strong>{listing.isVerified ? "Yes" : "No"}</strong>
              </div>
            </div>

            {sellerInsights ? (
              <div className="mt-4 grid gap-3 text-sm">
                {[
                  ["Seller tier", sellerInsights.sellerTier],
                  ["Reputation", `${sellerInsights.reputationScore}/100`],
                  ["Completed deals", String(sellerInsights.completedDeals)],
                  ["Dispute rate", `${sellerInsights.disputeRate}%`],
                  ["Protected ready", sellerInsights.protectedTransferReady ? "Yes" : "No"]
                ].map(([label, value]) => (
                  <div className="flex justify-between gap-4 rounded-xl border bg-background/70 p-3" key={label}>
                    <span className="text-muted-foreground">{label}</span>
                    <strong>{value}</strong>
                  </div>
                ))}
              </div>
            ) : null}

            {!isAuthenticated ? (
              <Link className={buttonVariants({ className: "mt-5 w-full" })} to="/login">
                Log in to message seller
              </Link>
            ) : !isOwnListing ? (
              <div className="mt-5 flex flex-col gap-3">
                <label className={fieldClass}>
                  <span className="text-sm font-semibold">Open negotiation</span>
                  <textarea
                    className={inputClass}
                    rows={5}
                    value={initialMessage}
                    onChange={(event) => setInitialMessage(event.target.value)}
                  />
                </label>
                {conversationError ? (
                  <p className="rounded-xl border border-destructive/30 bg-red-50 px-4 py-3 text-sm font-semibold text-destructive">{conversationError}</p>
                ) : null}
                <Button
                  disabled={conversationMutation.isPending}
                  onClick={() =>
                    void conversationMutation.mutateAsync({
                      listingId: listing.id,
                      initialMessage
                    })
                  }
                  type="button"
                >
                  {conversationMutation.isPending ? "Opening..." : "Message seller"}
                </Button>
                <Button
                  variant="outline"
                  disabled={transactionMutation.isPending || !canStartProtectedDeal}
                  onClick={async () => {
                    const result = await transactionMutation.mutateAsync({
                      listingId: listing.id,
                      buyerNotes: initialMessage
                    });

                    if (result.mode === "live") {
                      window.location.href = result.url;
                      return;
                    }

                    navigate(`/transactions/success?session_id=${encodeURIComponent(result.sessionId)}`);
                  }}
                  type="button"
                >
                  {transactionMutation.isPending ? "Starting..." : "Start protected deal"}
                </Button>
                <p className="text-sm leading-6 text-muted-foreground">{protectedDealMessage}</p>
              </div>
            ) : (
              <p className="mt-5 text-sm text-muted-foreground">This is your own listing.</p>
            )}
            {transactionMutation.error instanceof Error ? (
              <p className="mt-4 rounded-xl border border-destructive/30 bg-red-50 px-4 py-3 text-sm font-semibold text-destructive">{transactionMutation.error.message}</p>
            ) : null}
          </Card>

          {isAuthenticated && !isOwnListing ? (
            <>
              <Card className="p-5">
                <Badge variant="outline" className="uppercase tracking-[0.22em]">Safety</Badge>
                <h3 className="mt-2 font-serif text-2xl font-bold tracking-[-0.04em]">Report this listing</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Flag suspicious ownership, misleading metrics, risky transfer claims, or other trust issues.
                </p>
                <label className={`${fieldClass} mt-4`}>
                  <span className="text-sm font-semibold">Reason</span>
                  <select className={inputClass} value={reportReason} onChange={(event) => setReportReason(event.target.value)}>
                    <option>Suspicious ownership proof</option>
                    <option>Misleading performance claims</option>
                    <option>Risky or unclear transfer process</option>
                    <option>Spam or abusive listing behavior</option>
                  </select>
                </label>
                <label className={`${fieldClass} mt-3`}>
                  <span className="text-sm font-semibold">Details</span>
                  <textarea className={inputClass} rows={4} value={reportDetails} onChange={(event) => setReportDetails(event.target.value)} />
                </label>
                <Button
                  className="mt-4 w-full"
                  variant="outline"
                  disabled={reportMutation.isPending}
                  onClick={() =>
                    void reportMutation.mutateAsync({
                      listingId: listing.id,
                      reason: reportReason,
                      details: reportDetails || undefined
                    })
                  }
                  type="button"
                >
                  {reportMutation.isPending ? "Submitting..." : "Submit listing report"}
                </Button>
              </Card>

              <Card className="p-5">
                <Badge variant="outline" className="uppercase tracking-[0.22em]">Seller safety</Badge>
                <h3 className="mt-2 font-serif text-2xl font-bold tracking-[-0.04em]">Report this seller</h3>
                <label className={`${fieldClass} mt-4`}>
                  <span className="text-sm font-semibold">Reason</span>
                  <select className={inputClass} value={sellerReportReason} onChange={(event) => setSellerReportReason(event.target.value)}>
                    <option>Suspicious seller behavior</option>
                    <option>Harassment or abusive communication</option>
                    <option>Repeated scam risk signals</option>
                    <option>Identity or trust mismatch</option>
                  </select>
                </label>
                <label className={`${fieldClass} mt-3`}>
                  <span className="text-sm font-semibold">Details</span>
                  <textarea className={inputClass} rows={4} value={sellerReportDetails} onChange={(event) => setSellerReportDetails(event.target.value)} />
                </label>
                {reportMutation.error instanceof Error ? (
                  <p className="mt-4 rounded-xl border border-destructive/30 bg-red-50 px-4 py-3 text-sm font-semibold text-destructive">{reportMutation.error.message}</p>
                ) : null}
                {reportMutation.isSuccess ? (
                  <p className="mt-4 rounded-xl border bg-secondary px-4 py-3 text-sm font-semibold">Report submitted. Admins will review it.</p>
                ) : null}
                <Button
                  className="mt-4 w-full"
                  variant="outline"
                  disabled={reportMutation.isPending}
                  onClick={() =>
                    void reportMutation.mutateAsync({
                      reportedUserId: listing.seller.id,
                      reason: sellerReportReason,
                      details: sellerReportDetails || undefined
                    })
                  }
                  type="button"
                >
                  {reportMutation.isPending ? "Submitting..." : "Submit seller report"}
                </Button>
              </Card>
            </>
          ) : null}
        </aside>
      </div>
    </section>
  );
}
