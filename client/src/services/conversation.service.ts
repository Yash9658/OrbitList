import { apiRequest } from "../lib/api-client";
import { ConversationRecord } from "../types/conversation";

export function getConversations() {
  return apiRequest<ConversationRecord[]>("/conversations");
}

export function getConversation(id: string) {
  return apiRequest<ConversationRecord>(`/conversations/${id}`);
}

export function createConversationRequest(input: {
  listingId: string;
  initialMessage?: string;
}) {
  return apiRequest<ConversationRecord>("/conversations", {
    method: "POST",
    body: input
  });
}

export function sendMessageRequest(id: string, messageText: string) {
  return apiRequest<ConversationRecord>(`/conversations/${id}/messages`, {
    method: "POST",
    body: { messageText }
  });
}

export function markConversationReadRequest(id: string) {
  return apiRequest<ConversationRecord>(`/conversations/${id}/read`, {
    method: "PATCH"
  });
}
