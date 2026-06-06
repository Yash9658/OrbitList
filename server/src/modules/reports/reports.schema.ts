import { ReportStatus } from "@prisma/client";
import { z } from "zod";

export const createReportSchema = z.object({
  params: z.object({}).optional().default({}),
  query: z.object({}).optional().default({}),
  body: z.object({
    listingId: z.string().trim().min(1).optional(),
    reportedUserId: z.string().trim().min(1).optional(),
    reason: z.string().trim().min(3).max(120),
    details: z.string().trim().max(1500).optional().nullable()
  }).superRefine((value, context) => {
    const targetCount = Number(Boolean(value.listingId)) + Number(Boolean(value.reportedUserId));

    if (targetCount !== 1) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide exactly one report target",
        path: ["listingId"]
      });
    }
  })
});

export const listMyReportsSchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({}).optional().default({}),
  query: z.object({}).optional().default({})
});

export const listAdminReportsSchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({}).optional().default({}),
  query: z.object({
    status: z.nativeEnum(ReportStatus).optional()
  })
});

export const reviewReportSchema = z.object({
  query: z.object({}).optional().default({}),
  params: z.object({
    id: z.string().trim().min(1)
  }),
  body: z.object({
    status: z.enum(["UNDER_REVIEW", "RESOLVED", "DISMISSED"]),
    resolutionNotes: z.string().trim().max(1500).optional().nullable(),
    listingAction: z.enum(["NONE", "REJECTED", "ARCHIVED"]).default("NONE")
  })
});
