import { QueryClient } from "@tanstack/react-query";
import { ConversationRecord } from "../types/conversation";

export type ConversationMessage = ConversationRecord["messages"][number];

export type ChatMessageEvent = {
  conversationId: string;
  message: ConversationMessage;
};

function getConversationActivityTimestamp(conversation: ConversationRecord) {
  return new Date(
    conversation.lastMessageAt ?? conversation.updatedAt ?? conversation.createdAt
  ).getTime();
}

function sortConversationsByActivity(
  left: ConversationRecord,
  right: ConversationRecord
) {
  return getConversationActivityTimestamp(right) - getConversationActivityTimestamp(left);
}

function mergeConversationMessage(
  conversation: ConversationRecord,
  message: ConversationMessage,
  viewerId?: string
) {
  if (conversation.messages.some((entry) => entry.id === message.id)) {
    return conversation;
  }

  const isUnreadForViewer = viewerId ? message.senderId !== viewerId && !message.readAt : false;

  return {
    ...conversation,
    messages: [...conversation.messages, message],
    unreadCount: conversation.unreadCount + (isUnreadForViewer ? 1 : 0),
    lastMessage: message,
    lastMessageAt: message.createdAt,
    updatedAt: message.createdAt
  };
}

export function applyMessageToConversationCache(
  queryClient: QueryClient,
  conversationId: string,
  message: ConversationMessage,
  viewerId?: string
) {
  queryClient.setQueryData<ConversationRecord | undefined>(
    ["conversation", conversationId],
    (currentConversation) => {
      if (!currentConversation) {
        return currentConversation;
      }

      return mergeConversationMessage(currentConversation, message, viewerId);
    }
  );

  queryClient.setQueryData<ConversationRecord[] | undefined>(
    ["conversations"],
    (currentConversations) => {
      if (!currentConversations) {
        return currentConversations;
      }

      let hasChanged = false;
      const safeConversations = currentConversations.filter(Boolean);

      const updatedConversations = safeConversations.map((conversation) => {
        if (conversation.id !== conversationId) {
          return conversation;
        }

        const nextConversation = mergeConversationMessage(conversation, message, viewerId);

        if (nextConversation !== conversation) {
          hasChanged = true;
        }

        return nextConversation;
      });

      if (!hasChanged) {
        return currentConversations;
      }

      return [...updatedConversations].sort(sortConversationsByActivity);
    }
  );
}

export function upsertConversationInListCache(
  queryClient: QueryClient,
  conversation: ConversationRecord
) {
  queryClient.setQueryData<ConversationRecord[] | undefined>(
    ["conversations"],
    (currentConversations) => {
      if (!currentConversations) {
        return currentConversations;
      }

      const remainingConversations = currentConversations.filter(Boolean).filter(
        (entry) => entry.id !== conversation.id
      );

      return [conversation, ...remainingConversations].sort(sortConversationsByActivity);
    }
  );
}

export function markConversationAsReadInCache(
  queryClient: QueryClient,
  conversation: ConversationRecord
) {
  queryClient.setQueryData(["conversation", conversation.id], conversation);
  upsertConversationInListCache(queryClient, conversation);
}
