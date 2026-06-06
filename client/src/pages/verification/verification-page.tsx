import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Badge } from "../../components/ui/badge";
import { Button, buttonVariants } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { getMyListings } from "../../services/listing.service";
import {
  getMyVerifications,
  submitVerificationRequest
} from "../../services/verification.service";

export function VerificationPage() {
  const queryClient = useQueryClient();
  const [notesByListing, setNotesByListing] = useState<Record<string, string>>({});

  const listingsQuery = useQuery({
    queryKey: ["my-listings"],
    queryFn: getMyListings
  });
  const verificationsQuery = useQuery({
    queryKey: ["my-verifications"],
    queryFn: getMyVerifications
  });

  const submitMutation = useMutation({
    mutationFn: submitVerificationRequest,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["my-verifications"] });
      await queryClient.invalidateQueries({ queryKey: ["my-listings"] });
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    }
  });

  const latestVerificationByListing = useMemo(() => {
    const records = verificationsQuery.data?.data ?? [];
    return new Map(records.map((record) => [record.listing.id, record]));
  }, [verificationsQuery.data?.data]);

  const listings = listingsQuery.data?.data ?? [];

  return (
    <section className="flex flex-col gap-8">
      <div className="grid gap-6 py-8 lg:grid-cols-[1fr_340px] lg:items-end">
        <div className="flex max-w-4xl flex-col gap-4">
          <Badge variant="secondary" className="w-fit uppercase tracking-[0.24em]">
            Verification
          </Badge>
          <h1 className="font-serif text-5xl font-black leading-[0.96] tracking-[-0.06em] md:text-6xl">
            Submit proof-rich listings for trust review.
          </h1>
          <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
            Add screenshots or proof URLs in the listing editor first, then submit that listing for
            verification so buyers can see stronger trust signals.
          </p>
        </div>

        <Card className="grid gap-3 p-5">
          <div className="flex items-center justify-between gap-4 border-b pb-3">
            <span className="text-sm text-muted-foreground">Pending reviews</span>
            <strong className="text-2xl tracking-[-0.04em]">{verificationsQuery.data?.meta?.pendingCount ?? 0}</strong>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground">Total submissions</span>
            <strong className="text-2xl tracking-[-0.04em]">{verificationsQuery.data?.meta?.total ?? 0}</strong>
          </div>
        </Card>
      </div>

      <Card className="p-5 md:p-6">
        <div className="flex flex-col gap-3 border-b pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <Badge variant="outline" className="uppercase tracking-[0.22em]">Queue</Badge>
            <h2 className="mt-2 font-serif text-3xl font-bold tracking-[-0.05em]">Listings ready for review</h2>
          </div>
          <p className="max-w-md text-sm leading-6 text-muted-foreground">Each request should reference a listing that already contains media proof.</p>
        </div>

        {listingsQuery.isLoading || verificationsQuery.isLoading ? (
          <p className="py-8 text-muted-foreground">Loading verification workspace...</p>
        ) : null}

        {listings.length > 0 ? (
          <div className="mt-5 flex flex-col gap-3">
            {listings.map((listing) => {
              const latestRequest = latestVerificationByListing.get(listing.id);
              const mediaCount = listing.media.length;
              const isPending = latestRequest?.status === "PENDING";

              return (
                <article className="grid gap-4 rounded-2xl border bg-background/70 p-4 lg:grid-cols-[1fr_360px]" key={listing.id}>
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">{listing.platform.name}</Badge>
                      <Badge variant="secondary">{latestRequest?.status ?? "NOT_SUBMITTED"}</Badge>
                      <Badge variant="outline">{mediaCount} proof links</Badge>
                    </div>
                    <h3 className="mt-3 text-xl font-bold tracking-[-0.03em]">{listing.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {listing.status} listing | {listing.currency} {listing.price.toLocaleString()}
                    </p>
                    <p className="text-sm leading-6 text-muted-foreground">
                      {latestRequest
                        ? `Last submitted on ${new Date(latestRequest.createdAt).toLocaleDateString()}`
                        : "No verification request has been submitted yet."}
                    </p>
                  </div>

                  <div className="flex flex-col gap-3">
                    <textarea
                      className="w-full rounded-2xl border bg-card px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                      placeholder="Add a short note for the review team about ownership proof, analytics screenshots, or transfer context."
                      rows={4}
                      value={notesByListing[listing.id] ?? ""}
                      onChange={(event) =>
                        setNotesByListing((current) => ({
                          ...current,
                          [listing.id]: event.target.value
                        }))
                      }
                    />

                    <div className="flex flex-wrap gap-2">
                      <Link
                        className={buttonVariants({ variant: "outline", size: "sm" })}
                        to={`/dashboard/listings/${listing.id}/edit`}
                      >
                        Edit proof
                      </Link>
                      <Button
                        size="sm"
                        disabled={submitMutation.isPending || mediaCount === 0 || isPending}
                        onClick={() =>
                          void submitMutation.mutateAsync({
                            listingId: listing.id,
                            notes: notesByListing[listing.id] ?? undefined
                          })
                        }
                        type="button"
                      >
                        {isPending ? "Pending review" : "Submit for review"}
                      </Button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}

        {!listingsQuery.isLoading && listings.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed bg-background/70 p-8">
            <h3 className="font-serif text-2xl font-bold tracking-[-0.04em]">No listings to verify yet.</h3>
            <p className="mt-2 text-muted-foreground">Create a listing, add proof media, and then come back here to submit it.</p>
            <Link className={buttonVariants({ className: "mt-5" })} to="/dashboard/listings/new">
              Create listing
            </Link>
          </div>
        ) : null}

        {submitMutation.error instanceof Error ? (
          <p className="mt-4 rounded-xl border border-destructive/30 bg-red-50 px-4 py-3 text-sm font-semibold text-destructive">{submitMutation.error.message}</p>
        ) : null}
      </Card>
    </section>
  );
}
