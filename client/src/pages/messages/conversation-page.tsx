import {
  FormEvent,
  startTransition,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  ExternalLink,
  MessageCircle,
  Send,
  ShieldCheck,
  Wifi,
  WifiOff
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../../app/providers/auth-provider";
import { Badge } from "../../components/ui/badge";
import { Button, buttonVariants } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { cn } from "../../lib/utils";
import {
  applyMessageToConversationCache,
  ChatMessageEvent,
  markConversationAsReadInCache,
  upsertConversationInListCache
} from "../../lib/conversation-cache";
import { getChatSocket } from "../../lib/socket";
import {
  getConversation,
  markConversationReadRequest,
  sendMessageRequest
} from "../../services/conversation.service";

export function ConversationPage() {
  const { id = "" } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [messageText, setMessageText] = useState("");
  const [socketState, setSocketState] = useState<"connecting" | "connected" | "offline">(
    "connecting"
  );
  const [typingState, setTypingState] = useState<{
    isActive: boolean;
    senderName: string | null;
  }>({
    isActive: false,
    senderName: null
  });
  const localTypingTimeoutRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const remoteTypingTimeoutRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  const senderName = user?.fullName ?? user?.username ?? "User";

  const conversationQuery = useQuery({
    queryKey: ["conversation", id],
    queryFn: () => getConversation(id),
    enabled: Boolean(id)
  });

  const sendMutation = useMutation({
    mutationFn: (text: string) => sendMessageRequest(id, text),
    onSuccess: (conversation) => {
      setMessageText("");
      emitStopTyping();

      startTransition(() => {
        queryClient.setQueryData(["conversation", id], conversation);
        upsertConversationInListCache(queryClient, conversation);
      });

      if (conversation.lastMessage) {
        getChatSocket().emit("chat:message", {
          conversationId: conversation.id,
          message: conversation.lastMessage
        });
      }
    }
  });

  const markReadMutation = useMutation({
    mutationFn: () => markConversationReadRequest(id),
    onSuccess: (conversation) => {
      startTransition(() => {
        markConversationAsReadInCache(queryClient, conversation);
      });
    }
  });

  const errorMessage = useMemo(() => {
    if (sendMutation.error instanceof Error) {
      return sendMutation.error.message;
    }

    return null;
  }, [sendMutation.error]);

  function emitStopTyping() {
    if (!id || !user?.id || !isTypingRef.current) {
      return;
    }

    getChatSocket().emit("chat:stop-typing", {
      conversationId: id,
      senderId: user.id
    });

    isTypingRef.current = false;
  }

  function scheduleTypingStop() {
    if (localTypingTimeoutRef.current) {
      window.clearTimeout(localTypingTimeoutRef.current);
    }

    localTypingTimeoutRef.current = window.setTimeout(() => {
      emitStopTyping();
      localTypingTimeoutRef.current = null;
    }, 1400);
  }

  function announceTyping(nextValue: string) {
    if (!id || !user?.id) {
      return;
    }

    const socket = getChatSocket();

    if (!nextValue.trim()) {
      emitStopTyping();
      return;
    }

    if (!isTypingRef.current) {
      socket.emit("chat:typing", {
        conversationId: id,
        senderId: user.id,
        senderName
      });
      isTypingRef.current = true;
    }

    scheduleTypingStop();
  }

  useEffect(() => {
    if (!id) {
      setSocketState("offline");
      return;
    }

    const socket = getChatSocket();

    function joinConversationRoom() {
      setSocketState("connected");
      socket.emit("chat:join", id);
    }

    function handleDisconnect() {
      setSocketState("offline");
    }

    function handleIncomingMessage(payload: ChatMessageEvent) {
      if (payload.conversationId !== id) {
        return;
      }

      setTypingState((currentState) =>
        currentState.isActive
          ? {
              isActive: false,
              senderName: null
            }
          : currentState
      );

      startTransition(() => {
        applyMessageToConversationCache(
          queryClient,
          payload.conversationId,
          payload.message,
          user?.id
        );
      });

      if (payload.message.senderId !== user?.id) {
        void markReadMutation.mutateAsync();
      }
    }

    function handleTyping(payload: {
      conversationId: string;
      senderId: string;
      senderName: string;
    }) {
      if (payload.conversationId !== id || payload.senderId === user?.id) {
        return;
      }

      setTypingState({
        isActive: true,
        senderName: payload.senderName
      });

      if (remoteTypingTimeoutRef.current) {
        window.clearTimeout(remoteTypingTimeoutRef.current);
      }

      remoteTypingTimeoutRef.current = window.setTimeout(() => {
        setTypingState({
          isActive: false,
          senderName: null
        });
        remoteTypingTimeoutRef.current = null;
      }, 1800);
    }

    function handleStopTyping(payload: { conversationId: string; senderId: string }) {
      if (payload.conversationId !== id || payload.senderId === user?.id) {
        return;
      }

      if (remoteTypingTimeoutRef.current) {
        window.clearTimeout(remoteTypingTimeoutRef.current);
        remoteTypingTimeoutRef.current = null;
      }

      setTypingState({
        isActive: false,
        senderName: null
      });
    }

    socket.on("connect", joinConversationRoom);
    socket.on("disconnect", handleDisconnect);
    socket.on("chat:message", handleIncomingMessage);
    socket.on("chat:typing", handleTyping);
    socket.on("chat:stop-typing", handleStopTyping);

    if (socket.connected) {
      joinConversationRoom();
    } else {
      setSocketState("connecting");
      socket.connect();
    }

    return () => {
      socket.off("connect", joinConversationRoom);
      socket.off("disconnect", handleDisconnect);
      socket.off("chat:message", handleIncomingMessage);
      socket.off("chat:typing", handleTyping);
      socket.off("chat:stop-typing", handleStopTyping);

      if (localTypingTimeoutRef.current) {
        window.clearTimeout(localTypingTimeoutRef.current);
        localTypingTimeoutRef.current = null;
      }

      if (remoteTypingTimeoutRef.current) {
        window.clearTimeout(remoteTypingTimeoutRef.current);
        remoteTypingTimeoutRef.current = null;
      }

      emitStopTyping();
      isTypingRef.current = false;
      setTypingState({
        isActive: false,
        senderName: null
      });
      socket.disconnect();
      setSocketState("offline");
    };
  }, [id, markReadMutation, queryClient, user?.id]);

  useEffect(() => {
    if (!conversationQuery.data || conversationQuery.data.unreadCount === 0) {
      return;
    }

    void markReadMutation.mutateAsync();
  }, [conversationQuery.data, markReadMutation]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!messageText.trim()) {
      return;
    }

    await sendMutation.mutateAsync(messageText);
  }

  function handleMessageChange(nextValue: string) {
    setMessageText(nextValue);
    announceTyping(nextValue);
  }

  if (conversationQuery.isLoading) {
    return (
      <section className="grid min-h-[50vh] place-items-center">
        <Card className="max-w-xl p-8 text-center">
          <Badge variant="secondary" className="uppercase tracking-[0.22em]">Loading</Badge>
          <h1 className="mt-4 font-serif text-4xl font-black tracking-[-0.06em]">Loading conversation</h1>
          <p className="mt-3 text-muted-foreground">We are pulling the current thread and listing context.</p>
        </Card>
      </section>
    );
  }

  if (!conversationQuery.data) {
    return (
      <section className="grid min-h-[50vh] place-items-center">
        <Card className="max-w-xl p-8 text-center">
          <Badge variant="secondary" className="uppercase tracking-[0.22em]">Unavailable</Badge>
          <h1 className="mt-4 font-serif text-4xl font-black tracking-[-0.06em]">Conversation not found</h1>
          <p className="mt-3 text-muted-foreground">This thread could not be loaded right now.</p>
          <Link className={buttonVariants({ className: "mt-6" })} to="/messages">
            Back to messages
          </Link>
        </Card>
      </section>
    );
  }

  const conversation = conversationQuery.data;
  const socketStateLabel =
    socketState === "connected"
      ? "Live updates on"
      : socketState === "connecting"
        ? "Connecting live updates"
        : "Live updates offline";
  const otherPartyName =
    conversation.otherParty.fullName ?? conversation.otherParty.username ?? "User";
  const listingPrice = `${conversation.listing.currency} ${conversation.listing.price.toLocaleString()}`;
  const socketIcon =
    socketState === "connected" ? (
      <Wifi className="size-4" />
    ) : socketState === "connecting" ? (
      <Clock3 className="size-4" />
    ) : (
      <WifiOff className="size-4" />
    );

  return (
    <section className="mx-auto flex w-full max-w-7xl flex-col gap-5 py-6">
      <div className="flex flex-col gap-4 rounded-[2rem] border bg-card/90 p-4 shadow-[0_24px_70px_rgba(34,31,24,0.08)] backdrop-blur md:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <Link
              className={buttonVariants({
                variant: "outline",
                size: "icon",
                className: "mt-1 shrink-0"
              })}
              to="/messages"
              aria-label="Back to inbox"
            >
              <ArrowLeft className="size-4" />
            </Link>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="uppercase tracking-[0.18em]">
                  {conversation.listing.platform.name}
                </Badge>
                <span
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold",
                    socketState === "connected"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : socketState === "connecting"
                        ? "border-amber-200 bg-amber-50 text-amber-800"
                        : "border-red-200 bg-red-50 text-red-700"
                  )}
                >
                  {socketIcon}
                  {socketStateLabel}
                </span>
              </div>
              <h1 className="mt-3 max-w-4xl truncate font-serif text-3xl font-black tracking-[-0.05em] md:text-4xl">
                {conversation.listing.title}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Conversation with <span className="font-semibold text-foreground">{otherPartyName}</span>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 rounded-3xl bg-secondary/60 p-3 text-sm md:flex md:items-center">
            <div className="rounded-2xl bg-card px-4 py-3">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Asking price</p>
              <p className="mt-1 font-bold">{listingPrice}</p>
            </div>
            <Link
              className={buttonVariants({ size: "sm", className: "h-full min-h-12 px-5" })}
              to={`/listing/${conversation.listing.slug}`}
            >
              View listing
              <ExternalLink className="size-4" />
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="overflow-hidden p-0">
          <div className="flex items-center justify-between border-b bg-card px-5 py-4 md:px-6">
            <div className="flex items-center gap-3">
              <div className="grid size-11 place-items-center rounded-full bg-primary text-primary-foreground">
                <MessageCircle className="size-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Messages</h2>
                <p className="text-sm text-muted-foreground">Proof, pricing, and handoff notes stay here.</p>
              </div>
            </div>
            <Badge variant="outline" className="hidden md:inline-flex">
              {conversation.messages.length} messages
            </Badge>
          </div>

          <div className="flex h-[58vh] min-h-[520px] flex-col">
            <div className="flex-1 space-y-4 overflow-y-auto bg-[#f7f3ea] px-4 py-5 md:px-6">
              {conversation.messages.map((message) => {
                const isOwnMessage = message.senderId === user?.id;

                return (
                  <article
                    className={cn(
                      "group flex max-w-[78%] gap-3",
                      isOwnMessage ? "ml-auto flex-row-reverse" : "mr-auto"
                    )}
                    key={message.id}
                  >
                    <div
                      className={cn(
                        "mt-1 grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold",
                        isOwnMessage
                          ? "bg-primary text-primary-foreground"
                          : "border bg-card text-foreground"
                      )}
                    >
                      {isOwnMessage ? "You".slice(0, 1) : otherPartyName.slice(0, 1).toUpperCase()}
                    </div>
                    <div
                      className={cn(
                        "rounded-3xl border px-4 py-3 shadow-sm",
                        isOwnMessage
                          ? "rounded-tr-md border-primary/25 bg-primary text-primary-foreground"
                          : "rounded-tl-md bg-card"
                      )}
                    >
                      <p className="whitespace-pre-wrap text-sm leading-6">{message.messageText}</p>
                      <span
                        className={cn(
                          "mt-2 block text-xs",
                          isOwnMessage ? "text-primary-foreground/70" : "text-muted-foreground"
                        )}
                      >
                        {new Date(message.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </article>
                );
              })}
              {typingState.isActive ? (
                <div className="flex w-fit items-center gap-3 rounded-full border bg-card px-4 py-2 text-sm text-muted-foreground shadow-sm" aria-live="polite">
                  <span>
                    {(typingState.senderName ??
                      otherPartyName) + " is typing"}
                  </span>
                  <span className="flex gap-1" aria-hidden="true">
                    <span className="size-1.5 rounded-full bg-muted-foreground" />
                    <span className="size-1.5 rounded-full bg-muted-foreground" />
                    <span className="size-1.5 rounded-full bg-muted-foreground" />
                  </span>
                </div>
              ) : null}
            </div>

            <form className="border-t bg-card p-4 md:p-5" onSubmit={handleSubmit}>
              {errorMessage ? (
                <p className="mb-3 rounded-2xl border border-destructive/30 bg-red-50 px-4 py-3 text-sm font-semibold text-destructive">{errorMessage}</p>
              ) : null}
              <div className="flex flex-col gap-3 rounded-[1.75rem] border bg-background p-3 shadow-inner md:flex-row md:items-end">
                <textarea
                  className="min-h-24 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-muted-foreground md:min-h-16"
                  placeholder="Write a reply. Ask for proof, clarify terms, or move the deal forward..."
                  value={messageText}
                  onChange={(event) => handleMessageChange(event.target.value)}
                />
                <div className="flex items-center gap-2 self-end">
                  <Link className={buttonVariants({ variant: "ghost", size: "sm" })} to="/messages">
                    Cancel
                  </Link>
                  <Button disabled={sendMutation.isPending} type="submit" className="min-w-32">
                    {sendMutation.isPending ? "Sending..." : "Send"}
                    <Send className="size-4" />
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </Card>

        <aside className="flex flex-col gap-4">
          <Card className="p-5">
            <Badge variant="outline" className="uppercase tracking-[0.18em]">Deal context</Badge>
            <h2 className="mt-4 font-serif text-3xl font-bold tracking-[-0.05em]">
              {conversation.listing.platform.name}
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Use this panel to keep the asset, price, and trust signals visible while negotiating.
            </p>

            <div className="mt-5 space-y-3">
              <div className="rounded-2xl border bg-background px-4 py-3">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Asking price</p>
                <p className="mt-1 text-xl font-black">{listingPrice}</p>
              </div>
              <div className="rounded-2xl border bg-background px-4 py-3">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Counterparty</p>
                <p className="mt-1 font-bold">{otherPartyName}</p>
              </div>
            </div>

            <div className="mt-5 rounded-3xl bg-secondary/70 p-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 size-5 text-primary" />
                <div>
                  <h3 className="font-bold">Recommended next step</h3>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    Request proof, confirm transfer terms, and keep payment outside chat until protected checkout is configured.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 space-y-3 text-sm">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="size-4 text-primary" />
                <span>Conversation history saved</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle2 className="size-4 text-primary" />
                <span>Listing context attached</span>
              </div>
            </div>

            <Link
              className={buttonVariants({ variant: "outline", className: "mt-6 w-full" })}
              to={`/listing/${conversation.listing.slug}`}
            >
              Open full listing
              <ExternalLink className="size-4" />
            </Link>
          </Card>
        </aside>
      </div>
    </section>
  );
}
