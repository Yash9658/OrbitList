import { VerificationStatus } from "@prisma/client";
import { z } from "zod";

export const listMyVerificationsSchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({}).optional().default({}),
  query: z.object({}).optional().default({})
});

export const submitVerificationRequestSchema = z.object({
  query: z.object({}).optional().default({}),
  params: z.object({}).optional().default({}),
  body: z.object({
    listingId: z.string().trim().min(1),
    notes: z.string().trim().min(10).max(1200).optional().nullable()
  })
});

export const listPendingVerificationsSchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({}).optional().default({}),
  query: z.object({}).optional().default({})
});

export const reviewVerificationRequestSchema = z.object({
  query: z.object({}).optional().default({}),
  params: z.object({
    id: z.string().trim().min(1)
  }),
  body: z.object({
    status: z.enum([VerificationStatus.APPROVED, VerificationStatus.REJECTED]),
    notes: z.string().trim().min(5).max(1200).optional().nullable()
  })
});
