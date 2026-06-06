import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../app/providers/auth-provider";
import {
  getModerationQueueRequest,
  reviewListingModerationRequest
} from "../../services/listing.service";
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

export function AdminListingsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});

  const moderationQuery = useQuery({
    queryKey: ["moderation-listings"],
    queryFn: getModerationQueueRequest,
    enabled: user?.role === "ADMIN"
  });

  const reviewMutation = useMutation({
    mutationFn: reviewListingModerationRequest,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["moderation-listings"] });
      await queryClient.invalidateQueries({ queryKey: ["marketplace-listings"] });
      await queryClient.invalidateQueries({ queryKey: ["my-listings"] });
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    }
  });

  if (user?.role !== "ADMIN") {
    return (
      <AdminDenied eyebrow="Admin only" title="Listing moderation access required">
        This workspace is only available to admin reviewers.
      </AdminDenied>
    );
  }

  const listings = moderationQuery.data?.data ?? [];

  return (
    <AdminPage>
      <AdminHero
        eyebrow="Admin moderation"
        stats={[
          { label: "awaiting approval", value: moderationQuery.data?.meta?.pendingCount ?? 0 },
          { label: "needs revision", value: moderationQuery.data?.meta?.rejectedCount ?? 0 }
        ]}
        title="Approve, reject, and shape what reaches the live marketplace."
      >
        Review seller quality, proof media, transfer notes, and buyer-facing clarity before a listing
        goes public.
      </AdminHero>

      <AdminPanel
        description="Approve strong listings, or reject with notes so sellers know what to improve."
        eyebrow="Queue"
        title="Listing moderation queue"
      >
        {moderationQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading moderation queue...</p>
        ) : null}

        {!moderationQuery.isLoading && listings.length === 0 ? (
          <AdminEmpty title="No listings in the moderation queue.">
            The live marketplace is caught up for now.
          </AdminEmpty>
        ) : null}

        {listings.length > 0 ? (
          <AdminList>
            {listings.map((listing) => (
              <AdminRow key={listing.id}>
                <div>
                  <div className={adminMetaClass}>
                    <span>{listing.platform.name}</span>
                    <span>{listing.status === "PENDING_REVIEW" ? "Awaiting review" : "Rejected"}</span>
                    <span>{listing.niche?.name ?? "General"}</span>
                    <span>{listing.media.length} media items</span>
                    {listing.isFeatured ? <span>Featured</span> : null}
                  </div>

                  <h3 className="mt-3 text-xl font-bold">{listing.title}</h3>
                  <div className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
                    <p>
                      Seller: {listing.seller.fullName ?? listing.seller.username ?? "Unknown seller"}
                      {listing.seller.country ? ` | ${listing.seller.country}` : ""}
                    </p>
                    <p>
                      {listing.currency} {listing.price.toLocaleString()} |{" "}
                      {listing.metrics?.followersCount?.toLocaleString() ?? "N/A"} followers
                    </p>
                    {listing.description ? <p>{listing.description}</p> : null}
                  </div>

                  {listing.transferNotes ? (
                    <div className={`${adminNoteClass} mt-4`}>
                      <p>Transfer notes: {listing.transferNotes}</p>
                    </div>
                  ) : null}

                  <div className={`${adminButtonRowClass} mt-4`}>
                    <Link
                      className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                      to={`/listing/${listing.slug}`}
                    >
                      Open public view
                    </Link>
                    <Link
                      className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                      to={`/dashboard/listings/${listing.id}/edit`}
                    >
                      Open editor
                    </Link>
                  </div>

                  {listing.media.length > 0 ? (
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {listing.media.map((item) => (
                        <article className="rounded-2xl border border-border bg-background p-3" key={item.id}>
                          <div className={adminMetaClass}>
                            <span>{item.type}</span>
                          </div>
                          {item.type === "image" || item.type === "screenshot" ? (
                            <img
                              alt={`${listing.title} proof`}
                              className="mt-3 h-36 w-full rounded-xl object-cover"
                              src={item.fileUrl}
                            />
                          ) : null}
                          <a
                            className="mt-3 block truncate text-sm font-semibold text-primary"
                            href={item.fileUrl}
                            rel="noreferrer"
                            target="_blank"
                          >
                            Open proof file
                          </a>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className={`${adminErrorClass} mt-4`}>No proof media attached yet.</p>
                  )}
                </div>

                <div className="space-y-3">
                  <textarea
                    className={adminInputClass}
                    onChange={(event) =>
                      setReviewNotes((current) => ({
                        ...current,
                        [listing.id]: event.target.value
                      }))
                    }
                    placeholder="Explain why this listing is approved or what the seller needs to improve."
                    rows={6}
                    value={reviewNotes[listing.id] ?? ""}
                  />

                  <div className={adminButtonRowClass}>
                    <Button
                      disabled={reviewMutation.isPending}
                      onClick={() =>
                        void reviewMutation.mutateAsync({
                          id: listing.id,
                          status: "ACTIVE",
                          notes: reviewNotes[listing.id] ?? undefined
                        })
                      }
                      type="button"
                    >
                      Approve listing
                    </Button>
                    <Button
                      disabled={reviewMutation.isPending}
                      onClick={() =>
                        void reviewMutation.mutateAsync({
                          id: listing.id,
                          status: "REJECTED",
                          notes: reviewNotes[listing.id] ?? undefined
                        })
                      }
                      type="button"
                      variant="outline"
                    >
                      Reject with notes
                    </Button>
                  </div>
                </div>
              </AdminRow>
            ))}
          </AdminList>
        ) : null}

        {reviewMutation.error instanceof Error ? (
          <p className={adminErrorClass}>{reviewMutation.error.message}</p>
        ) : null}
      </AdminPanel>
    </AdminPage>
  );
}
