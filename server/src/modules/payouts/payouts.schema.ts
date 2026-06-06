import { z } from "zod";

export const getMyPayoutAccountSchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({}).optional().default({}),
  query: z.object({}).optional().default({})
});

export const createPayoutOnboardingLinkSchema = z.object({
  params: z.object({}).optional().default({}),
  query: z.object({}).optional().default({}),
  body: z.object({
    mode: z.enum(["onboarding", "update"]).optional()
  })
});
