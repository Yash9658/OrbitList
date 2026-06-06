import { UserRole } from "@prisma/client";
import { z } from "zod";

export const signupSchema = z.object({
  params: z.object({}).optional().default({}),
  query: z.object({}).optional().default({}),
  body: z.object({
    email: z.string().trim().email(),
    password: z.string().min(8).max(64),
    fullName: z.string().trim().min(2).max(80),
    username: z.string().trim().min(3).max(30).optional(),
    country: z.string().trim().min(2).max(60).optional(),
    role: z
      .nativeEnum(UserRole)
      .refine((role) => role !== UserRole.ADMIN, "Admin signups are not allowed")
      .default(UserRole.BUYER)
  })
});

export const loginSchema = z.object({
  params: z.object({}).optional().default({}),
  query: z.object({}).optional().default({}),
  body: z.object({
    email: z.string().trim().email(),
    password: z.string().min(8).max(64)
  })
});

export const emptyAuthSchema = z.object({
  params: z.object({}).optional().default({}),
  query: z.object({}).optional().default({}),
  body: z.object({}).optional().default({})
});

export const updateRoleSchema = z.object({
  params: z.object({}).optional().default({}),
  query: z.object({}).optional().default({}),
  body: z.object({
    role: z.nativeEnum(UserRole)
  })
});

export const updateProfileSchema = z.object({
  params: z.object({}).optional().default({}),
  query: z.object({}).optional().default({}),
  body: z.object({
    fullName: z.string().trim().min(2).max(80),
    username: z.string().trim().min(3).max(30).nullable().optional(),
    avatarUrl: z.string().trim().url().nullable().optional(),
    bio: z.string().trim().max(280).nullable().optional(),
    country: z.string().trim().min(2).max(60).nullable().optional(),
    role: z
      .nativeEnum(UserRole)
      .refine((role) => role !== UserRole.ADMIN, "Admin role cannot be self-assigned")
      .optional(),
    notificationPreferences: z
      .object({
        inAppMessages: z.boolean(),
        inAppMarketplace: z.boolean(),
        inAppTransactions: z.boolean(),
        inAppTrust: z.boolean(),
        emailMessages: z.boolean(),
        emailMarketplace: z.boolean(),
        emailTransactions: z.boolean(),
        emailTrust: z.boolean(),
        emailBilling: z.boolean()
      })
      .optional()
  })
});

export const updatePasswordSchema = z.object({
  params: z.object({}).optional().default({}),
  query: z.object({}).optional().default({}),
  body: z.object({
    currentPassword: z.string().min(8).max(64),
    nextPassword: z.string().min(8).max(64)
  })
});
