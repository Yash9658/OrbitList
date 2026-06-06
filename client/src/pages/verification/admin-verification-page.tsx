import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../app/providers/auth-provider";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import {
  getPendingVerifications,
  reviewVerificationRequest
} from "../../services/verification.service";

export function AdminVerificationPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});

  const pendingQuery = useQuery({
    queryKey: ["pending-verifications"],
    queryFn: getPendingVerifications,
    enabled: user?.role === "ADMIN"
  });

  const reviewMutation = useMutation({
    mutationFn: reviewVerificationRequest,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["pending-verifications"] });
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    }
  });

  if (user?.role !== "ADMIN") {
    return (
      <section className="grid min-h-[50vh] place-items-center">
        <Card className="max-w-xl p-8 text-center">
          <Badge variant="secondary" className="uppercase tracking-[0.22em]">Admin only</Badge>
          <h1 className="mt-4 font-serif text-4xl font-black tracking-[-0.06em]">Verification review access required</h1>
          <p className="mt-3 text-muted-foreground">This workspace is only available to admin reviewers.</p>
        </Card>
      </section>
    );
  }

  const requests = pendingQuery.data?.data ?? [];

  return (
    <section className="flex flex-col gap-8">
      <div className="grid gap-6 py-8 lg:grid-cols-[1fr_340px] lg:items-end">
        <div className="flex max-w-4xl flex-col gap-4">
          <Badge variant="secondary" className="w-fit uppercase tracking-[0.24em]">
            Admin review
          </Badge>
          <h1 className="font-serif text-5xl font-black leading-[0.96] tracking-[-0.06em] md:text-6xl">
            Review proof submissions and decide which listings earn trust signals.
          </h1>
          <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
            Each request includes listing media, seller notes, and the current listing state so you
            can approve or reject with context.
          </p>
        </div>

        <Card className="grid gap-3 p-5">
          <div className="flex items-center justify-between gap-4 border-b pb-3">
            <span className="text-sm text-muted-foreground">Pending reviews</span>
            <strong className="text-2xl tracking-[-0.04em]">{pendingQuery.data?.meta?.total ?? 0}</strong>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground">Review mode</span>
            <strong className="text-2xl tracking-[-0.04em]">Admin</strong>
          </div>
        </Card>
      </div>

      <Card className="p-5 md:p-6">
        <div className="flex flex-col gap-3 border-b pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <Badge variant="outline" className="uppercase tracking-[0.22em]">Review queue</Badge>
            <h2 className="mt-2 font-serif text-3xl font-bold tracking-[-0.05em]">Pending verification requests</h2>
          </div>
          <p className="max-w-md text-sm leading-6 text-muted-foreground">Approve when the proof is credible, reject when the listing still needs stronger evidence.</p>
        </div>

        {pendingQuery.isLoading ? <p className="py-8 text-muted-foreground">Loading review queue...</p> : null}

        {!pendingQuery.isLoading && requests.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed bg-background/70 p-8">
            <h3 className="font-serif text-2xl font-bold tracking-[-0.04em]">No pending verification requests.</h3>
            <p className="mt-2 text-muted-foreground">The review queue is clear right now.</p>
          </div>
        ) : null}

        {requests.length > 0 ? (
          <div className="mt-5 flex flex-col gap-4">
            {requests.map((request) => (
              <article className="grid gap-4 rounded-2xl border bg-background/70 p-4 lg:grid-cols-[1fr_340px]" key={request.id}>
                <div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{request.listing.platform.name}</Badge>
                    <Badge variant="secondary">{request.status}</Badge>
                    <Badge variant="outline">{request.listing.media.length} media items</Badge>
                  </div>
                  <h3 className="mt-3 text-xl font-bold tracking-[-0.03em]">{request.listing.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Seller: {request.seller.fullName ?? request.seller.username ?? request.seller.email}
                  </p>
                  <p className="text-sm leading-6 text-muted-foreground">
                    Submitted on {new Date(request.createdAt).toLocaleString()}
                  </p>
                  {request.notes ? <p className="text-sm leading-6 text-muted-foreground">Seller note: {request.notes}</p> : null}

                  {request.listing.media.length > 0 ? (
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {request.listing.media.map((item) => (
                        <article className="overflow-hidden rounded-2xl border bg-card p-3" key={item.id}>
                          <Badge variant="outline">{item.type}</Badge>
                          {item.type === "image" ? (
                            <img
                              alt={`${request.listing.title} proof`}
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
                  ) : null}
                </div>

                <div className="flex flex-col gap-3">
                  <textarea
                    className="w-full rounded-2xl border bg-card px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                    placeholder="Add reviewer notes for approval or rejection."
                    rows={5}
                    value={reviewNotes[request.id] ?? ""}
                    onChange={(event) =>
                      setReviewNotes((current) => ({
                        ...current,
                        [request.id]: event.target.value
                      }))
                    }
                  />

                  <div className="flex flex-wrap gap-2">
                    <Button
                      disabled={reviewMutation.isPending}
                      onClick={() =>
                        void reviewMutation.mutateAsync({
                          id: request.id,
                          status: "APPROVED",
                          notes: reviewNotes[request.id] ?? undefined
                        })
                      }
                      type="button"
                    >
                      Approve
                    </Button>
                    <Button
                      variant="outline"
                      disabled={reviewMutation.isPending}
                      onClick={() =>
                        void reviewMutation.mutateAsync({
                          id: request.id,
                          status: "REJECTED",
                          notes: reviewNotes[request.id] ?? undefined
                        })
                      }
                      type="button"
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : null}

        {reviewMutation.error instanceof Error ? (
          <p className="mt-4 rounded-xl border border-destructive/30 bg-red-50 px-4 py-3 text-sm font-semibold text-destructive">{reviewMutation.error.message}</p>
        ) : null}
      </Card>
    </section>
  );
}
