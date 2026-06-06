import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ListingForm } from "../../features/listings/listing-form";
import { useAuth } from "../../app/providers/auth-provider";
import { Badge } from "../../components/ui/badge";
import { buttonVariants } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import {
  getListingOptions,
  getManagedListing,
  updateListingRequest
} from "../../services/listing.service";

export function EditListingPage() {
  const { user } = useAuth();
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canSell =
    user?.role === "SELLER" || user?.role === "BOTH" || user?.role === "ADMIN";

  const optionsQuery = useQuery({
    queryKey: ["listing-options"],
    queryFn: getListingOptions
  });

  const listingQuery = useQuery({
    queryKey: ["managed-listing", id],
    queryFn: () => getManagedListing(id),
    enabled: Boolean(id)
  });

  const updateMutation = useMutation({
    mutationFn: (payload: Parameters<typeof updateListingRequest>[1]) =>
      updateListingRequest(id, payload),
    onSuccess: async (listing) => {
      await queryClient.invalidateQueries({ queryKey: ["my-listings"] });
      await queryClient.invalidateQueries({ queryKey: ["marketplace-listings"] });
      await queryClient.invalidateQueries({ queryKey: ["managed-listing", id] });
      await queryClient.invalidateQueries({ queryKey: ["listing", listing.slug] });
      navigate("/dashboard");
    }
  });

  const errorMessage = useMemo(() => {
    const sourceError = updateMutation.error ?? listingQuery.error;

    if (sourceError instanceof Error) {
      return sourceError.message;
    }

    return null;
  }, [listingQuery.error, updateMutation.error]);

  if (!canSell) {
    return (
      <section className="grid min-h-[50vh] place-items-center">
        <Card className="max-w-xl p-8 text-center">
          <Badge variant="secondary" className="uppercase tracking-[0.22em]">Seller access</Badge>
          <h1 className="mt-4 font-serif text-4xl font-black tracking-[-0.06em]">Edit listing</h1>
          <p className="mt-3 text-muted-foreground">
            Your account needs seller access before you can manage listings.
          </p>
          <Link className={buttonVariants({ className: "mt-6" })} to="/dashboard">
            Back to dashboard
          </Link>
        </Card>
      </section>
    );
  }

  if (listingQuery.isLoading) {
    return (
      <section className="grid min-h-[50vh] place-items-center">
        <Card className="max-w-xl p-8 text-center">
          <Badge variant="secondary" className="uppercase tracking-[0.22em]">Loading</Badge>
          <h1 className="mt-4 font-serif text-4xl font-black tracking-[-0.06em]">Loading listing editor</h1>
          <p className="mt-3 text-muted-foreground">We are preparing the current listing details for editing.</p>
        </Card>
      </section>
    );
  }

  if (!listingQuery.data) {
    return (
      <section className="grid min-h-[50vh] place-items-center">
        <Card className="max-w-xl p-8 text-center">
          <Badge variant="secondary" className="uppercase tracking-[0.22em]">Unavailable</Badge>
          <h1 className="mt-4 font-serif text-4xl font-black tracking-[-0.06em]">Listing not found</h1>
          <p className="mt-3 text-muted-foreground">This listing could not be loaded for editing.</p>
          <Link className={buttonVariants({ className: "mt-6" })} to="/dashboard">
            Back to dashboard
          </Link>
        </Card>
      </section>
    );
  }

  return (
    <ListingForm
      mode="edit"
      initialListing={listingQuery.data}
      platforms={optionsQuery.data?.platforms ?? []}
      niches={optionsQuery.data?.niches ?? []}
      isSubmitting={
        updateMutation.isPending || optionsQuery.isLoading || listingQuery.isLoading
      }
      errorMessage={errorMessage}
      submitLabel="Save changes"
      onSubmit={updateMutation.mutateAsync}
    />
  );
}
