import { z } from "zod";

const messageBodySchema = z.object({
  messageText: z.string().trim().min(1).max(2000)
});

export const listConversationsSchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({}).optional().default({}),
  query: z.object({}).optional().default({})
});

export const getConversationSchema = z.object({
  body: z.object({}).optional().default({}),
  query: z.object({}).optional().default({}),
  params: z.object({
    id: z.string().trim().min(1)
  })
});

export const createConversationSchema = z.object({
  params: z.object({}).optional().default({}),
  query: z.object({}).optional().default({}),
  body: z.object({
    listingId: z.string().trim().min(1),
    initialMessage: z.string().trim().min(1).max(2000).optional()
  })
});

export const sendMessageSchema = z.object({
  query: z.object({}).optional().default({}),
  params: z.object({
    id: z.string().trim().min(1)
  }),
  body: messageBodySchema
});

export const markConversationReadSchema = z.object({
  body: z.object({}).optional().default({}),
  query: z.object({}).optional().default({}),
  params: z.object({
    id: z.string().trim().min(1)
  })
});
