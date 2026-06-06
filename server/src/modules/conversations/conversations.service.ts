import { Prisma } from "@prisma/client";
import { env } from "../../config/env.js";
import { prisma } from "../../config/prisma.js";
import { ApiError } from "../../utils/api-error.js";
import { sendEmailToUser } from "../email/email.service.js";
import { createNotificationRecord } from "../notifications/notifications.service.js";

const conversationInclude = {
  listing: {
    select: {
      id: true,
      slug: true,
      title: true,
      price: true,
      currency: true,
      platform: {
        select: {
          name: true,
          slug: true
        }
      }
    }
  },
  buyer: {
    select: {
      id: true,
      fullName: true,
      username: true,
      avatarUrl: true,
      country: true
    }
  },
  seller: {
    select: {
      id: true,
      fullName: true,
      username: true,
      avatarUrl: true,
      country: true
    }
  },
  messages: {
    orderBy: {
      createdAt: "asc" as const
    }
  }
} satisfies Prisma.ConversationInclude;

function mapConversation(
  conversation: Prisma.ConversationGetPayload<{ include: typeof conversationInclude }>,
  viewerId: string
) {
  const otherParty =
    conversation.buyer.id === viewerId ? conversation.seller : conversation.buyer;
  const lastMessage = conversation.messages[conversation.messages.length - 1] ?? null;
  const unreadCount = conversation.messages.filter(
    (message) => message.senderId !== viewerId && !message.readAt
  ).length;

  return {
    id: conversation.id,
    listing: {
      id: conversation.listing.id,
      slug: conversation.listing.slug,
      title: conversation.listing.title,
      price: Number(conversation.listing.price),
      currency: conversation.listing.currency,
      platform: conversation.listing.platform
    },
    buyer: conversation.buyer,
    seller: conversation.seller,
    otherParty,
    messages: conversation.messages,
    unreadCount,
    lastMessage,
    lastMessageAt: conversation.lastMessageAt,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt
  };
}

async function getConversationForUser(conversationId: string, userId: string) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: conversationInclude
  });

  if (!conversation) {
    throw new ApiError(404, "Conversation not found");
  }

  if (conversation.buyerId !== userId && conversation.sellerId !== userId) {
    throw new ApiError(403, "You do not have access to this conversation");
  }

  return conversation;
}

export async function listConversations(userId: string) {
  const conversations = await prisma.conversation.findMany({
    where: {
      OR: [{ buyerId: userId }, { sellerId: userId }]
    },
    include: conversationInclude,
    orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }]
  });

  return conversations.map((conversation) => mapConversation(conversation, userId));
}

export async function getConversationById(conversationId: string, userId: string) {
  const conversation = await getConversationForUser(conversationId, userId);
  return mapConversation(conversation, userId);
}

export async function markConversationAsRead(conversationId: string, userId: string) {
  await getConversationForUser(conversationId, userId);

  await prisma.message.updateMany({
    where: {
      conversationId,
      senderId: {
        not: userId
      },
      readAt: null
    },
    data: {
      readAt: new Date()
    }
  });

  const refreshedConversation = await getConversationForUser(conversationId, userId);
  return mapConversation(refreshedConversation, userId);
}

export async function createConversation(
  buyerId: string,
  input: { listingId: string; initialMessage?: string }
) {
  const listing = await prisma.listing.findUnique({
    where: { id: input.listingId },
    select: {
      id: true,
      sellerId: true,
      status: true
    }
  });

  if (!listing) {
    throw new ApiError(404, "Listing not found");
  }

  if (listing.sellerId === buyerId) {
    throw new ApiError(400, "You cannot message yourself about your own listing");
  }

  const existing = await prisma.conversation.findFirst({
    where: {
      listingId: listing.id,
      buyerId,
      sellerId: listing.sellerId
    },
    include: conversationInclude
  });

  if (existing) {
    if (input.initialMessage) {
      await prisma.message.create({
        data: {
          conversationId: existing.id,
          senderId: buyerId,
          messageText: input.initialMessage
        }
      });

      await prisma.conversation.update({
        where: { id: existing.id },
        data: {
          lastMessageAt: new Date()
        }
      });

      await createNotificationRecord({
        userId: existing.sellerId,
        type: "message",
        title: "New buyer message",
        body: `A buyer sent a new message about '${existing.listing.title}'.`
      });

      await sendEmailToUser({
        userId: existing.sellerId,
        category: "messages",
        subject: `New buyer message about ${existing.listing.title}`,
        heading: "A buyer replied to one of your listings",
        bodyLines: [
          `You received a new message about '${existing.listing.title}'.`,
          "Open the conversation to continue the discussion while buyer intent is still warm."
        ],
        ctaLabel: "Open conversation",
        ctaUrl: `${env.CLIENT_URL}/messages/${existing.id}`
      });
    }

    const refreshed = await getConversationForUser(existing.id, buyerId);
    return mapConversation(refreshed, buyerId);
  }

  const conversation = await prisma.conversation.create({
    data: {
      listingId: listing.id,
      buyerId,
      sellerId: listing.sellerId,
      lastMessageAt: input.initialMessage ? new Date() : null,
      messages: input.initialMessage
        ? {
            create: {
              senderId: buyerId,
              messageText: input.initialMessage
            }
          }
        : undefined
    },
    include: conversationInclude
  });

  await createNotificationRecord({
    userId: conversation.seller.id,
    type: "conversation",
    title: "New listing inquiry",
    body: `A buyer opened a conversation about '${conversation.listing.title}'.`
  });

  await sendEmailToUser({
    userId: conversation.seller.id,
    category: "messages",
    subject: `New listing inquiry for ${conversation.listing.title}`,
    heading: "A buyer opened a new listing inquiry",
    bodyLines: [
      `A buyer started a conversation about '${conversation.listing.title}'.`,
      input.initialMessage
        ? "There is already an opening message waiting in the thread."
        : "Open the inbox to answer the inquiry and keep the deal moving."
    ],
    ctaLabel: "View inquiry",
    ctaUrl: `${env.CLIENT_URL}/messages/${conversation.id}`
  });

  return mapConversation(conversation, buyerId);
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  messageText: string
) {
  const conversation = await getConversationForUser(conversationId, senderId);

  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      senderId,
      messageText
    }
  });

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      lastMessageAt: new Date()
    }
  });

  const recipientUserId =
    conversation.buyerId === senderId ? conversation.sellerId : conversation.buyerId;

  await createNotificationRecord({
    userId: recipientUserId,
    type: "message",
    title: "New message received",
    body: `You have a new message about '${conversation.listing.title}'.`
  });

  await sendEmailToUser({
    userId: recipientUserId,
    category: "messages",
    subject: `New message about ${conversation.listing.title}`,
    heading: "You have a new marketplace message",
    bodyLines: [
      `A new message arrived in your conversation about '${conversation.listing.title}'.`,
      "Reply quickly to keep the negotiation active and improve the chances of conversion."
    ],
    ctaLabel: "Reply now",
    ctaUrl: `${env.CLIENT_URL}/messages/${conversation.id}`
  });

  const refreshed = await getConversationForUser(conversation.id, senderId);
  return mapConversation(refreshed, senderId);
}
