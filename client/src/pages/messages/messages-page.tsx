import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Badge } from "../../components/ui/badge";
import { buttonVariants } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { getConversations } from "../../services/conversation.service";

export function MessagesPage() {
  const conversationsQuery = useQuery({
    queryKey: ["conversations"],
    queryFn: getConversations
  });

  const conversations = conversationsQuery.data ?? [];
  const inboxStats = useMemo(
    () => ({
      total: conversations.length,
      activeListings: new Set(conversations.map((conversation) => conversation.listing.id)).size,
      unread: conversations.reduce(
        (sum, conversation) => sum + conversation.unreadCount,
        0
      ),
      latest: (() => {
        const orderedDates = conversations
          .map((conversation) => conversation.lastMessageAt)
          .filter(Boolean)
          .sort();

        return orderedDates.length > 0 ? orderedDates[orderedDates.length - 1] : null;
      })()
    }),
    [conversations]
  );

  return (
    <section className="flex flex-col gap-8">
      <div className="grid gap-6 py-8 lg:grid-cols-[1fr_420px] lg:items-end">
        <div className="flex max-w-4xl flex-col gap-4">
          <Badge variant="secondary" className="w-fit uppercase tracking-[0.24em]">
            Inbox
          </Badge>
          <h1 className="font-serif text-5xl font-black leading-[0.96] tracking-[-0.06em] md:text-6xl">
            Keep every buyer and seller conversation tied to the listing.
          </h1>
          <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
            Messages stay anchored to the asset, so pricing, proof requests, and transfer details
            keep their context.
          </p>
        </div>

        <Card className="grid grid-cols-2 gap-3 p-5">
          {[
            ["Conversations", inboxStats.total],
            ["Listings", inboxStats.activeListings],
            ["Unread", inboxStats.unread],
            [
              "Latest",
              inboxStats.latest ? new Date(inboxStats.latest).toLocaleDateString() : "No activity"
            ]
          ].map(([label, value]) => (
            <div className="rounded-2xl bg-background/70 p-3" key={label}>
              <strong className="block text-2xl tracking-[-0.04em]">{value}</strong>
              <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                {label}
              </span>
            </div>
          ))}
        </Card>
      </div>

      <Card className="p-5 md:p-6">
        <div className="flex flex-col gap-3 border-b pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <Badge variant="outline" className="uppercase tracking-[0.22em]">
              Threads
            </Badge>
            <h2 className="mt-2 font-serif text-3xl font-bold tracking-[-0.05em]">
              Conversation list
            </h2>
          </div>
          <p className="max-w-md text-sm leading-6 text-muted-foreground">
            Open a thread to continue negotiation, clarify metrics, or discuss transfer steps.
          </p>
        </div>

        {conversationsQuery.isLoading ? <p className="py-8 text-muted-foreground">Loading conversations...</p> : null}

        {!conversationsQuery.isLoading && conversations.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed bg-background/70 p-8">
            <h3 className="font-serif text-2xl font-bold tracking-[-0.04em]">No conversations yet.</h3>
            <p className="mt-2 text-muted-foreground">Start from any listing page to open the first buyer-seller thread.</p>
            <Link className={buttonVariants({ className: "mt-5" })} to="/marketplace">
              Explore marketplace
            </Link>
          </div>
        ) : null}

        {conversations.length > 0 ? (
          <div className="mt-5 flex flex-col gap-3">
            {conversations.map((conversation) => (
              <article className="flex flex-col gap-4 rounded-2xl border bg-background/70 p-4 md:flex-row md:items-center md:justify-between" key={conversation.id}>
                <div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{conversation.listing.platform.name}</Badge>
                    <Badge variant="secondary">
                      {conversation.otherParty.fullName ??
                        conversation.otherParty.username ??
                        "User"}
                    </Badge>
                  </div>

                  <h3 className="mt-3 text-xl font-bold tracking-[-0.03em]">{conversation.listing.title}</h3>

                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {conversation.lastMessage?.messageText ?? "No messages yet."}
                  </p>

                  <div className="mt-2 flex flex-wrap gap-3 text-sm text-muted-foreground">
                    <span>
                      {conversation.listing.currency} {conversation.listing.price.toLocaleString()}
                    </span>
                    <span>
                      {conversation.lastMessageAt
                        ? new Date(conversation.lastMessageAt).toLocaleString()
                        : "No recent activity"}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {conversation.unreadCount > 0 ? (
                    <Badge>
                      {conversation.unreadCount} new
                    </Badge>
                  ) : null}
                  <Link
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                    to={`/listing/${conversation.listing.slug}`}
                  >
                    View listing
                  </Link>
                  <Link className={buttonVariants({ size: "sm" })} to={`/messages/${conversation.id}`}>
                    Open thread
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </Card>
    </section>
  );
}
