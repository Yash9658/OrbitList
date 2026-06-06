import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { ListingForm } from "../../features/listings/listing-form";
import { useAuth } from "../../app/providers/auth-provider";
import { Badge } from "../../components/ui/badge";
import { buttonVariants } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import {
  createListingRequest,
  getListingOptions
} from "../../services/listing.service";

export function CreateListingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canSell =
    user?.role === "SELLER" || user?.role === "BOTH" || user?.role === "ADMIN";

  const optionsQuery = useQuery({
    queryKey: ["listing-options"],
    queryFn: getListingOptions
  });

  const createMutation = useMutation({
    mutationFn: createListingRequest,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["my-listings"] });
      await queryClient.invalidateQueries({ queryKey: ["marketplace-listings"] });
      navigate("/dashboard");
    }
  });

  const errorMessage = useMemo(() => {
    if (createMutation.error instanceof Error) {
      return createMutation.error.message;
    }

    return null;
  }, [createMutation.error]);

  if (!canSell) {
    return (
      <section className="grid min-h-[50vh] place-items-center">
        <Card className="max-w-xl p-8 text-center">
          <Badge variant="secondary" className="uppercase tracking-[0.22em]">Seller access</Badge>
          <h1 className="mt-4 font-serif text-4xl font-black tracking-[-0.06em]">Create listing</h1>
          <p className="mt-3 text-muted-foreground">
            Your account is currently in buyer mode. Switch to `SELLER` or `BOTH`
            from the dashboard to create marketplace listings.
          </p>
          <Link className={buttonVariants({ className: "mt-6" })} to="/dashboard">
            Back to dashboard
          </Link>
        </Card>
      </section>
    );
  }

  return (
    <ListingForm
      mode="create"
      platforms={optionsQuery.data?.platforms ?? []}
      niches={optionsQuery.data?.niches ?? []}
      isSubmitting={createMutation.isPending || optionsQuery.isLoading}
      errorMessage={errorMessage}
      submitLabel="Create listing"
      onSubmit={createMutation.mutateAsync}
    />
  );
}
