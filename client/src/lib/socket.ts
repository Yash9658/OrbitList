import { io, Socket } from "socket.io-client";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api";

const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ?? API_BASE_URL.replace(/\/api\/?$/, "");

type ServerToClientEvents = {
  "chat:message": (payload: {
    conversationId: string;
    message: {
      id: string;
      conversationId: string;
      senderId: string;
      messageText: string;
      createdAt: string;
      readAt: string | null;
    };
  }) => void;
  "chat:typing": (payload: {
    conversationId: string;
    senderId: string;
    senderName: string;
  }) => void;
  "chat:stop-typing": (payload: {
    conversationId: string;
    senderId: string;
  }) => void;
};

type ClientToServerEvents = {
  "chat:join": (conversationId: string) => void;
  "chat:message": (payload: {
    conversationId: string;
    message: {
      id: string;
      conversationId: string;
      senderId: string;
      messageText: string;
      createdAt: string;
      readAt: string | null;
    };
  }) => void;
  "chat:typing": (payload: {
    conversationId: string;
    senderId: string;
    senderName: string;
  }) => void;
  "chat:stop-typing": (payload: {
    conversationId: string;
    senderId: string;
  }) => void;
};

let chatSocket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

export function getChatSocket() {
  if (!chatSocket) {
    chatSocket = io(SOCKET_URL, {
      autoConnect: false
    });
  }

  return chatSocket;
}
