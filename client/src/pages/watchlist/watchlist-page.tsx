import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Badge } from "../../components/ui/badge";
import { Button, buttonVariants } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import {
  getFavorites,
  removeFavoriteRequest
} from "../../services/favorites.service";

export function WatchlistPage() {
  const queryClient = useQueryClient();
  const favoritesQuery = useQuery({
    queryKey: ["favorites"],
    queryFn: getFavorites
  });

  const removeMutation = useMutation({
    mutationFn: removeFavoriteRequest,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["favorites"] });
    }
  });

  const favorites = favoritesQuery.data?.data ?? [];

  return (
    <section className="flex flex-col gap-8">
      <div className="grid gap-6 py-8 lg:grid-cols-[1fr_260px] lg:items-end">
        <div className="flex max-w-4xl flex-col gap-4">
          <Badge variant="secondary" className="w-fit uppercase tracking-[0.24em]">
            Watchlist
          </Badge>
          <h1 className="font-serif text-5xl font-black leading-[0.96] tracking-[-0.06em] md:text-6xl">
            Save promising listings so you can come back with context.
          </h1>
          <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
            Keep your shortlist of social assets in one place while you compare pricing,
            audience quality, and seller trust signals.
          </p>
        </div>

        <Card className="p-5">
          <strong className="block text-5xl tracking-[-0.06em]">{favorites.length}</strong>
          <span className="text-sm font-medium text-muted-foreground">saved listings</span>
        </Card>
      </div>

      <Card className="p-5 md:p-6">
        <div className="flex flex-col gap-3 border-b pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <Badge variant="outline" className="uppercase tracking-[0.22em]">Saved inventory</Badge>
            <h2 className="mt-2 font-serif text-3xl font-bold tracking-[-0.05em]">Your watchlist</h2>
          </div>
          <p className="max-w-md text-sm leading-6 text-muted-foreground">
            Open a listing when you want to review details or continue the buying process.
          </p>
        </div>

        {favoritesQuery.isLoading ? <p className="py-8 text-muted-foreground">Loading your watchlist...</p> : null}

        {!favoritesQuery.isLoading && favorites.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed bg-background/70 p-8">
            <h3 className="font-serif text-2xl font-bold tracking-[-0.04em]">No saved listings yet.</h3>
            <p className="mt-2 text-muted-foreground">Use the marketplace to save accounts and channels you want to compare later.</p>
            <Link className={buttonVariants({ className: "mt-5" })} to="/marketplace">
              Explore marketplace
            </Link>
          </div>
        ) : null}

        {favorites.length > 0 ? (
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {favorites.map((listing) => (
              <Card className="flex min-h-72 flex-col p-5" key={listing.id}>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{listing.platform.name}</Badge>
                  <Badge variant="secondary">{listing.niche?.name ?? "General"}</Badge>
                </div>

                <div className="mt-4 flex flex-1 flex-col gap-3">
                  <h3 className="text-2xl font-bold tracking-[-0.04em]">{listing.title}</h3>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {listing.description?.slice(0, 150) ??
                      "This listing does not have a longer description yet."}
                  </p>
                </div>

                <dl className="mt-5 grid grid-cols-2 gap-3">
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Followers</dt>
                    <dd className="mt-1 font-bold">{listing.metrics?.followersCount?.toLocaleString() ?? "N/A"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Saved on</dt>
                    <dd className="mt-1 font-bold">{new Date(listing.favoritedAt).toLocaleDateString()}</dd>
                  </div>
                </dl>

                <div className="mt-5 flex flex-col gap-4 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <strong className="block text-2xl tracking-[-0.04em]">
                      {listing.currency} {listing.price.toLocaleString()}
                    </strong>
                    <span className="text-sm text-muted-foreground">{listing.primaryCountry ?? "Global audience"}</span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={removeMutation.isPending}
                      onClick={() => void removeMutation.mutateAsync(listing.id)}
                      type="button"
                    >
                      Remove
                    </Button>
                    <Link className={buttonVariants({ size: "sm" })} to={`/listing/${listing.slug}`}>
                      View listing
                    </Link>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : null}
      </Card>
    </section>
  );
}
