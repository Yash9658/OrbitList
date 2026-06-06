import { useDeferredValue, useMemo, useState, startTransition } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAuth } from "../../app/providers/auth-provider";
import { Badge } from "../../components/ui/badge";
import { Button, buttonVariants } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { cn } from "../../lib/utils";
import {
  addFavoriteRequest,
  getFavorites,
  removeFavoriteRequest
} from "../../services/favorites.service";
import { getListingOptions, getListings } from "../../services/listing.service";

const fieldClass = "flex flex-col gap-2";
const labelClass = "text-sm font-semibold text-foreground";
const controlClass =
  "h-11 rounded-xl border bg-card px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15";
const toggleClass =
  "flex items-center gap-3 rounded-xl border bg-card px-3 py-3 text-sm font-semibold";

export function MarketplacePage() {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [nicheFilter, setNicheFilter] = useState("all");
  const [countryFilter, setCountryFilter] = useState("");
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [monetizedOnly, setMonetizedOnly] = useState(false);
  const [minFollowers, setMinFollowers] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sortBy, setSortBy] = useState<
    "newest" | "price_asc" | "price_desc" | "followers_desc" | "engagement_desc"
  >("newest");

  const deferredSearchTerm = useDeferredValue(searchTerm);
  const normalizedFilters = useMemo(
    () => ({
      search: deferredSearchTerm.trim() || undefined,
      platform: platformFilter === "all" ? undefined : platformFilter,
      niche: nicheFilter === "all" ? undefined : nicheFilter,
      country: countryFilter.trim() || undefined,
      status: "ACTIVE" as const,
      featured: featuredOnly || undefined,
      verified: verifiedOnly || undefined,
      monetized: monetizedOnly || undefined,
      minFollowers: minFollowers ? Number(minFollowers) : undefined,
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      sortBy,
      limit: 24
    }),
    [
      countryFilter,
      deferredSearchTerm,
      featuredOnly,
      maxPrice,
      minFollowers,
      minPrice,
      monetizedOnly,
      nicheFilter,
      platformFilter,
      sortBy,
      verifiedOnly
    ]
  );

  const listingsQuery = useQuery({
    queryKey: ["marketplace-listings", normalizedFilters],
    queryFn: () => getListings(normalizedFilters)
  });
  const optionsQuery = useQuery({
    queryKey: ["listing-options"],
    queryFn: getListingOptions
  });
  const favoritesQuery = useQuery({
    queryKey: ["favorites"],
    queryFn: getFavorites,
    enabled: isAuthenticated
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

  const favoriteIds = useMemo(
    () => new Set(favoritesQuery.data?.meta?.listingIds ?? []),
    [favoritesQuery.data?.meta?.listingIds]
  );

  const listings = listingsQuery.data?.data ?? [];

  const marketplaceStats = useMemo(() => {
    const totalValue = listings.reduce((sum, listing) => sum + listing.price, 0);
    const activeCount = listings.filter((listing) => listing.status === "ACTIVE").length;
    const featuredCount = listings.filter((listing) => listing.isFeatured).length;

    return {
      totalValue,
      activeCount,
      featuredCount
    };
  }, [listings]);

  return (
    <section className="flex flex-col gap-6">
      <div className="grid gap-5 py-6 lg:grid-cols-[1fr_340px] lg:items-end">
        <div className="flex max-w-4xl flex-col gap-4">
          <Badge variant="secondary" className="w-fit uppercase tracking-[0.24em]">
            Marketplace
          </Badge>
          <h1 className="max-w-4xl font-serif text-4xl font-black leading-[0.98] tracking-[-0.06em] md:text-5xl">
            Browse social assets with enough context to make fast decisions.
          </h1>
          <p className="max-w-2xl text-base leading-7 text-muted-foreground md:text-lg md:leading-8">
            Compare audience size, engagement, niche, verification status, and
            asking price without jumping between disconnected pages.
          </p>
        </div>

        <Card className="grid gap-3 p-4">
          {[
            ["Active listings", marketplaceStats.activeCount],
            ["Featured opportunities", marketplaceStats.featuredCount],
            ["Combined listed value", `$${marketplaceStats.totalValue.toLocaleString()}`]
          ].map(([label, value]) => (
            <div className="flex items-center justify-between gap-4 border-b pb-3 last:border-b-0 last:pb-0" key={label}>
              <span className="text-sm text-muted-foreground">{label}</span>
              <strong className="text-xl tracking-[-0.04em]">{value}</strong>
            </div>
          ))}
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
        <Card className="h-fit p-4 xl:sticky xl:top-24">
          <div>
            <Badge variant="outline" className="uppercase tracking-[0.22em]">
              Refine
            </Badge>
            <h2 className="mt-2 font-serif text-2xl font-bold tracking-[-0.04em]">
              Search inventory
            </h2>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:flex xl:flex-col">
            <label className={fieldClass}>
              <span className={labelClass}>Search listings</span>
              <input
                className={controlClass}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  startTransition(() => setSearchTerm(nextValue));
                }}
                placeholder="Search by title, platform, niche"
                value={searchTerm}
              />
            </label>

          <label className={fieldClass}>
            <span className={labelClass}>Platform</span>
            <select
              className={controlClass}
              onChange={(event) => setPlatformFilter(event.target.value)}
              value={platformFilter}
            >
              <option value="all">All platforms</option>
              {(optionsQuery.data?.platforms ?? []).map((platform) => (
                <option key={platform.id} value={platform.slug}>
                  {platform.name}
                </option>
              ))}
            </select>
          </label>

          <label className={fieldClass}>
            <span className={labelClass}>Niche</span>
            <select
              className={controlClass}
              onChange={(event) => setNicheFilter(event.target.value)}
              value={nicheFilter}
            >
              <option value="all">All niches</option>
              {(optionsQuery.data?.niches ?? []).map((niche) => (
                <option key={niche.id} value={niche.slug}>
                  {niche.name}
                </option>
              ))}
            </select>
          </label>

          <label className={fieldClass}>
            <span className={labelClass}>Audience country</span>
            <input
              className={controlClass}
              onChange={(event) => setCountryFilter(event.target.value)}
              placeholder="India, United States, UAE"
              value={countryFilter}
            />
          </label>

          <div className="grid grid-cols-2 gap-3 sm:col-span-2 xl:col-span-1">
            <label className={fieldClass}>
              <span className={labelClass}>Min price</span>
              <input
                className={controlClass}
                inputMode="numeric"
                onChange={(event) => setMinPrice(event.target.value.replace(/[^\d.]/g, ""))}
                placeholder="0"
                value={minPrice}
              />
            </label>
            <label className={fieldClass}>
              <span className={labelClass}>Max price</span>
              <input
                className={controlClass}
                inputMode="numeric"
                onChange={(event) => setMaxPrice(event.target.value.replace(/[^\d.]/g, ""))}
                placeholder="50000"
                value={maxPrice}
              />
            </label>
          </div>

          <label className={fieldClass}>
            <span className={labelClass}>Minimum followers</span>
            <input
              className={controlClass}
              inputMode="numeric"
              onChange={(event) => setMinFollowers(event.target.value.replace(/\D/g, ""))}
              placeholder="10000"
              value={minFollowers}
            />
          </label>

          <label className={fieldClass}>
            <span className={labelClass}>Sort by</span>
            <select
              className={controlClass}
              onChange={(event) =>
                setSortBy(
                  event.target.value as
                    | "newest"
                    | "price_asc"
                    | "price_desc"
                    | "followers_desc"
                    | "engagement_desc"
                )
              }
              value={sortBy}
            >
              <option value="newest">Newest first</option>
              <option value="price_asc">Price: low to high</option>
              <option value="price_desc">Price: high to low</option>
              <option value="followers_desc">Followers: high to low</option>
              <option value="engagement_desc">Engagement: high to low</option>
            </select>
          </label>

          <label className={cn(toggleClass, "sm:col-span-2 xl:col-span-1")}>
            <input
              checked={featuredOnly}
              className="size-4 accent-primary"
              onChange={(event) => setFeaturedOnly(event.target.checked)}
              type="checkbox"
            />
            <span>Featured listings only</span>
          </label>

          <label className={cn(toggleClass, "sm:col-span-2 xl:col-span-1")}>
            <input
              checked={verifiedOnly}
              className="size-4 accent-primary"
              onChange={(event) => setVerifiedOnly(event.target.checked)}
              type="checkbox"
            />
            <span>Verified listings only</span>
          </label>

          <label className={cn(toggleClass, "sm:col-span-2 xl:col-span-1")}>
            <input
              checked={monetizedOnly}
              className="size-4 accent-primary"
              onChange={(event) => setMonetizedOnly(event.target.checked)}
              type="checkbox"
            />
            <span>Monetized assets only</span>
          </label>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSearchTerm("");
              setPlatformFilter("all");
              setNicheFilter("all");
              setCountryFilter("");
              setFeaturedOnly(false);
              setVerifiedOnly(false);
              setMonetizedOnly(false);
              setMinFollowers("");
              setMinPrice("");
              setMaxPrice("");
              setSortBy("newest");
            }}
            type="button"
          >
            Reset filters
          </Button>

          <div className="rounded-2xl bg-secondary p-4 text-sm leading-6 text-muted-foreground sm:col-span-2 xl:col-span-1">
            <p>{listingsQuery.data?.meta?.total ?? listings.length} listings match your current view.</p>
            <p>
              Platforms available: {(optionsQuery.data?.platforms ?? []).length} | Niches:{" "}
              {(optionsQuery.data?.niches ?? []).length}
            </p>
          </div>
          </div>
        </Card>

        <div className="flex min-w-0 flex-col gap-5">
          <Card className="flex flex-col gap-3 p-5 md:flex-row md:items-end md:justify-between">
            <div>
              <Badge variant="outline" className="uppercase tracking-[0.22em]">
                Live inventory
              </Badge>
              <h2 className="mt-2 font-serif text-2xl font-bold tracking-[-0.05em] md:text-3xl">
                {listingsQuery.isLoading
                  ? "Loading marketplace..."
                  : `${listings.length} opportunities ready to review`}
              </h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-muted-foreground">
              Start with fit, then move into proof, messaging, and transfer
              details.
            </p>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            {listings.map((listing) => {
              const isFavorited = favoriteIds.has(listing.id);

              return (
            <Card className="flex min-h-[320px] flex-col p-5" key={listing.id}>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{listing.platform.name}</Badge>
                    <Badge variant="secondary">{listing.niche?.name ?? "General"}</Badge>
                    {listing.isFeatured ? <Badge>Featured</Badge> : null}
                  </div>

                  <div className="mt-4 flex flex-1 flex-col gap-3">
                    <h3 className="text-xl font-bold tracking-[-0.04em]">{listing.title}</h3>
                    <p className="text-sm leading-6 text-muted-foreground">
                      {listing.description?.slice(0, 150) ??
                        "This listing is still being prepared by the seller."}
                    </p>
                  </div>

                  <dl className="mt-5 grid grid-cols-2 gap-3">
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Followers</dt>
                      <dd className="mt-1 font-bold">{listing.metrics?.followersCount?.toLocaleString() ?? "N/A"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Engagement</dt>
                      <dd className="mt-1 font-bold">
                        {listing.metrics?.engagementRate
                          ? `${listing.metrics.engagementRate}%`
                          : "N/A"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Region</dt>
                      <dd className="mt-1 font-bold">{listing.primaryCountry ?? "Global"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Status</dt>
                      <dd className="mt-1 font-bold">{listing.status}</dd>
                    </div>
                  </dl>

                  <div className="mt-5 flex flex-col gap-4 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <strong className="block text-2xl tracking-[-0.04em]">
                        {listing.currency} {listing.price.toLocaleString()}
                      </strong>
                      <span className="text-sm text-muted-foreground">
                        {listing.isFeatured ? "Featured listing" : "Standard listing"}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {isAuthenticated ? (
                        <Button
                          variant={isFavorited ? "subtle" : "outline"}
                          size="sm"
                          disabled={favoriteMutation.isPending}
                          onClick={() =>
                            void favoriteMutation.mutateAsync({
                              listingId: listing.id,
                              isFavorited
                            })
                          }
                          type="button"
                        >
                          {isFavorited ? "Saved" : "Save"}
                        </Button>
                      ) : (
                        <Link className={buttonVariants({ variant: "outline", size: "sm" })} to="/login">
                          Save
                        </Link>
                      )}

                      <Link className={buttonVariants({ size: "sm" })} to={`/listing/${listing.slug}`}>
                        View listing
                      </Link>
                    </div>
                  </div>
                </Card>
              );
            })}

            {!listingsQuery.isLoading && listings.length === 0 ? (
              <Card className="p-8 lg:col-span-2">
                <h3 className="font-serif text-2xl font-bold tracking-[-0.04em]">
                  No listings match this filter view yet.
                </h3>
                <p className="mt-2 text-muted-foreground">
                  Try a broader search or switch back to all platforms.
                </p>
              </Card>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
