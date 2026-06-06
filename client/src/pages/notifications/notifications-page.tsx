import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Badge } from "../../components/ui/badge";
import { Button, buttonVariants } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { cn } from "../../lib/utils";
import {
  getNotifications,
  markAllNotificationsReadRequest,
  markNotificationReadRequest
} from "../../services/notifications.service";

export function NotificationsPage() {
  const queryClient = useQueryClient();
  const [categoryFilter, setCategoryFilter] = useState<
    "all" | "messages" | "marketplace" | "transactions" | "trust" | "billing"
  >("all");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const notificationsQuery = useQuery({
    queryKey: ["notifications"],
    queryFn: getNotifications
  });

  const markReadMutation = useMutation({
    mutationFn: markNotificationReadRequest,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    }
  });

  const markAllMutation = useMutation({
    mutationFn: markAllNotificationsReadRequest,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    }
  });

  const notifications = notificationsQuery.data?.data ?? [];
  const unreadCount = notificationsQuery.data?.meta?.unreadCount ?? 0;
  const filteredNotifications = useMemo(
    () =>
      notifications.filter((notification) => {
        const matchesCategory =
          categoryFilter === "all" || notification.category === categoryFilter;
        const matchesUnread = !unreadOnly || !notification.isRead;

        return matchesCategory && matchesUnread;
      }),
    [categoryFilter, notifications, unreadOnly]
  );

  return (
    <section className="flex flex-col gap-8">
      <div className="grid gap-6 py-8 lg:grid-cols-[1fr_320px] lg:items-end">
        <div className="flex max-w-3xl flex-col gap-4">
          <Badge variant="secondary" className="w-fit uppercase tracking-[0.24em]">
            Notifications
          </Badge>
          <h1 className="font-serif text-5xl font-black leading-[0.96] tracking-[-0.06em] md:text-6xl">
            Marketplace activity, cleaned up.
          </h1>
          <p className="text-lg leading-8 text-muted-foreground">
            Messages, listing updates, billing events, and trust reviews in one focused feed.
          </p>
        </div>

        <Card className="flex flex-col gap-4 p-5">
          <div>
            <strong className="block text-4xl tracking-[-0.05em]">{unreadCount}</strong>
            <span className="text-sm font-medium text-muted-foreground">Unread notifications</span>
          </div>
          <Button
            variant="outline"
            disabled={markAllMutation.isPending || unreadCount === 0}
            onClick={() => void markAllMutation.mutateAsync()}
            type="button"
          >
            Mark all as read
          </Button>
          <Link className={buttonVariants({ variant: "outline" })} to="/settings">
            Notification settings
          </Link>
        </Card>
      </div>

      <Card className="flex flex-col gap-5 p-5 md:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Badge variant="outline" className="uppercase tracking-[0.22em]">
              Activity feed
            </Badge>
            <h2 className="mt-2 font-serif text-3xl font-bold tracking-[-0.05em]">Recent updates</h2>
          </div>
          <label className="flex w-fit items-center gap-3 rounded-full border bg-card px-4 py-3 text-sm font-semibold">
            <input
              checked={unreadOnly}
              className="size-4 accent-primary"
              onChange={(event) => setUnreadOnly(event.target.checked)}
              type="checkbox"
            />
            <span>Unread only</span>
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          {["all", "messages", "marketplace", "transactions", "trust", "billing"].map(
            (category) => (
              <button
                key={category}
                className={cn(
                  "rounded-full border px-4 py-2 text-sm font-semibold capitalize transition hover:bg-secondary",
                  categoryFilter === category && "border-primary bg-primary text-primary-foreground"
                )}
                onClick={() =>
                  setCategoryFilter(
                    category as
                      | "all"
                      | "messages"
                      | "marketplace"
                      | "transactions"
                      | "trust"
                      | "billing"
                  )
                }
                type="button"
              >
                {category}
              </button>
            )
          )}
        </div>

        {notificationsQuery.isLoading ? (
          <p className="rounded-2xl border border-dashed p-6 text-muted-foreground">
            Loading notifications...
          </p>
        ) : null}

        {!notificationsQuery.isLoading && filteredNotifications.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-background/70 p-8">
            <h3 className="font-serif text-2xl font-bold tracking-[-0.04em]">
              No notifications match this view yet.
            </h3>
            <p className="mt-2 text-muted-foreground">
              Try another filter or check back after marketplace activity starts.
            </p>
          </div>
        ) : null}

        {filteredNotifications.length > 0 ? (
          <div className="flex flex-col gap-3">
            {filteredNotifications.map((notification) => (
              <article
                className={cn(
                  "flex flex-col gap-4 rounded-2xl border bg-card p-4 md:flex-row md:items-center md:justify-between",
                  !notification.isRead && "border-primary/50 bg-secondary/60"
                )}
                key={notification.id}
              >
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    <Badge variant="outline">{notification.category}</Badge>
                    <Badge variant="secondary">{notification.type}</Badge>
                    <span className="px-1 py-0.5">{new Date(notification.createdAt).toLocaleString()}</span>
                  </div>
                  <h3 className="text-lg font-bold">{notification.title}</h3>
                  <p className="text-sm leading-6 text-muted-foreground">{notification.body}</p>
                </div>

                {!notification.isRead ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={markReadMutation.isPending}
                    onClick={() => void markReadMutation.mutateAsync(notification.id)}
                    type="button"
                  >
                    Mark as read
                  </Button>
                ) : null}
              </article>
            ))}
          </div>
        ) : null}
      </Card>
    </section>
  );
}
