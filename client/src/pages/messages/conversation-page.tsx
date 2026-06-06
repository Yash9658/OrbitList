import {
  FormEvent,
  startTransition,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

  return (
    <section className="flex flex-col gap-8">
      <div className="grid gap-6 py-8 lg:grid-cols-[1fr_auto] lg:items-end">
        <div className="flex max-w-4xl flex-col gap-4">
          <Badge variant="secondary" className="w-fit uppercase tracking-[0.24em]">
            Conversation
          </Badge>
          <h1 className="font-serif text-5xl font-black leading-[0.96] tracking-[-0.06em] md:text-6xl">
            {conversation.listing.title}
          </h1>
          <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
            Talking with{" "}
            {conversation.otherParty.fullName ?? conversation.otherParty.username ?? "User"} about{" "}
            {conversation.listing.platform.name}.
          </p>
        </div>

        <Card className="flex flex-wrap gap-2 p-4">
          <Link className={buttonVariants({ variant: "outline", size: "sm" })} to="/messages">
            Back to inbox
          </Link>
          <Link className={buttonVariants({ size: "sm" })} to={`/listing/${conversation.listing.slug}`}>
            View listing
          </Link>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-5">
          <Card className="p-5 md:p-6">
            <div className="flex flex-col gap-3 border-b pb-5 md:flex-row md:items-end md:justify-between">
              <div>
                <Badge variant="outline" className="uppercase tracking-[0.22em]">Thread</Badge>
                <h2 className="mt-2 font-serif text-3xl font-bold tracking-[-0.05em]">Discussion timeline</h2>
              </div>
              <div className="flex flex-col gap-2 md:items-end">
                <p className="max-w-md text-sm leading-6 text-muted-foreground">Keep pricing, proof requests, and handoff notes in one place.</p>
                <Badge
                  variant={socketState === "connected" ? "default" : "outline"}
                  className={cn(
                    socketState === "connecting" && "bg-secondary text-secondary-foreground",
                    socketState === "connected"
                      ? ""
                      : socketState === "connecting"
                        ? ""
                        : "text-destructive"
                  )}
                >
                  {socketStateLabel}
                </Badge>
              </div>
            </div>

            <div className="mt-5 flex max-h-[560px] flex-col gap-3 overflow-y-auto rounded-2xl bg-background/70 p-4">
              {conversation.messages.map((message) => {
                const isOwnMessage = message.senderId === user?.id;

                return (
                  <article
                    className={cn(
                      "max-w-[82%] rounded-2xl border bg-card p-4",
                      isOwnMessage && "ml-auto border-primary/40 bg-secondary"
                    )}
                    key={message.id}
                  >
                    <p className="text-sm leading-6">{message.messageText}</p>
                    <span className="mt-2 block text-xs text-muted-foreground">{new Date(message.createdAt).toLocaleString()}</span>
                  </article>
                );
              })}
              {typingState.isActive ? (
                <div className="flex w-fit items-center gap-3 rounded-full border bg-card px-4 py-2 text-sm text-muted-foreground" aria-live="polite">
                  <span>
                    {(typingState.senderName ??
                      conversation.otherParty.fullName ??
                      conversation.otherParty.username ??
                      "User") + " is typing"}
                  </span>
                  <span className="flex gap-1" aria-hidden="true">
                    <span className="size-1.5 rounded-full bg-muted-foreground" />
                    <span className="size-1.5 rounded-full bg-muted-foreground" />
                    <span className="size-1.5 rounded-full bg-muted-foreground" />
                  </span>
                </div>
              ) : null}
            </div>
          </Card>

          <form className="rounded-2xl border bg-card p-5 shadow-[0_18px_50px_rgba(41,35,25,0.08)] md:p-6" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <Badge variant="outline" className="uppercase tracking-[0.22em]">Reply</Badge>
                <h2 className="mt-2 font-serif text-3xl font-bold tracking-[-0.05em]">Send your next message</h2>
              </div>
              <p className="max-w-md text-sm leading-6 text-muted-foreground">Ask for proof, clarify terms, or move the deal forward.</p>
            </div>

            <textarea
              className="mt-5 w-full rounded-2xl border bg-card px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
              placeholder="Write your message..."
              rows={5}
              value={messageText}
              onChange={(event) => handleMessageChange(event.target.value)}
            />
            {errorMessage ? (
              <p className="mt-4 rounded-xl border border-destructive/30 bg-red-50 px-4 py-3 text-sm font-semibold text-destructive">{errorMessage}</p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-3">
              <Button disabled={sendMutation.isPending} type="submit">
                {sendMutation.isPending ? "Sending..." : "Send message"}
              </Button>
              <Link className={buttonVariants({ variant: "outline" })} to="/messages">
                Cancel
              </Link>
            </div>
          </form>
        </div>

        <aside className="flex flex-col gap-4">
          <Card className="p-5">
            <Badge variant="outline" className="uppercase tracking-[0.22em]">Listing context</Badge>
            <h2 className="mt-2 font-serif text-2xl font-bold tracking-[-0.04em]">{conversation.listing.platform.name}</h2>
            <div className="mt-4 flex flex-col gap-3 text-sm leading-6 text-muted-foreground">
              <p>
                Asking price: {conversation.listing.currency}{" "}
                {conversation.listing.price.toLocaleString()}
              </p>
              <p>Use the listing page when you need the full audience and transfer overview.</p>
            </div>
          </Card>
        </aside>
      </div>
    </section>
  );
}
