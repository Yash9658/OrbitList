export interface ConversationParty {
  id: string;
  fullName: string | null;
  username: string | null;
  avatarUrl: string | null;
  country: string | null;
}

export interface ConversationRecord {
  id: string;
  listing: {
    id: string;
    slug: string;
    title: string;
    price: number;
    currency: string;
    platform: {
      name: string;
      slug: string;
    };
  };
  buyer: ConversationParty;
  seller: ConversationParty;
  otherParty: ConversationParty;
  messages: Array<{
    id: string;
    conversationId: string;
    senderId: string;
    messageText: string;
    createdAt: string;
    readAt: string | null;
  }>;
  unreadCount: number;
  lastMessage: {
    id: string;
    conversationId: string;
    senderId: string;
    messageText: string;
    createdAt: string;
    readAt: string | null;
  } | null;
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
}
