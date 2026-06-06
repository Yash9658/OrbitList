import type { DisputeStatus, TransactionStatus } from "@prisma/client";
import { z } from "zod";

export const listTransactionsSchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({}).optional().default({}),
  query: z.object({}).optional().default({})
});

export const getTransactionSchema = z.object({
  body: z.object({}).optional().default({}),
  query: z.object({}).optional().default({}),
  params: z.object({
    id: z.string().trim().min(1)
  })
});

export const createTransactionCheckoutSchema = z.object({
  params: z.object({}).optional().default({}),
  query: z.object({}).optional().default({}),
  body: z.object({
    listingId: z.string().trim().min(1),
    buyerNotes: z.string().trim().max(1500).optional().nullable()
  })
});

export const confirmTransactionCheckoutSchema = z.object({
  params: z.object({}).optional().default({}),
  query: z.object({}).optional().default({}),
  body: z.object({
    sessionId: z.string().trim().min(1)
  })
});

export const updateTransactionStatusSchema = z.object({
  query: z.object({}).optional().default({}),
  params: z.object({
    id: z.string().trim().min(1)
  }),
  body: z.object({
    status: z.enum(["HANDOFF_SUBMITTED", "BUYER_REVIEW", "COMPLETED", "CANCELLED"]),
    notes: z.string().trim().max(1500).optional().nullable()
  })
});

export const openDisputeSchema = z.object({
  query: z.object({}).optional().default({}),
  params: z.object({
    id: z.string().trim().min(1)
  }),
  body: z.object({
    reason: z.string().trim().min(3).max(120),
    details: z.string().trim().max(1500).optional().nullable()
  })
});

export const addDisputeEvidenceSchema = z.object({
  query: z.object({}).optional().default({}),
  params: z.object({
    id: z.string().trim().min(1)
  }),
  body: z.object({
    fileUrl: z.string().trim().url(),
    note: z.string().trim().max(1500).optional().nullable(),
    visibility: z.enum(["participants", "admin_only"]).optional()
  })
});

export const addDisputeCaseNoteSchema = z.object({
  query: z.object({}).optional().default({}),
  params: z.object({
    id: z.string().trim().min(1)
  }),
  body: z.object({
    message: z.string().trim().min(3).max(1500),
    visibility: z.enum(["participants", "admin_only"]).optional()
  })
});

export const listAdminDisputesSchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({}).optional().default({}),
  query: z.object({
    status: z.enum(["OPEN", "UNDER_REVIEW", "RESOLVED_FOR_BUYER", "RESOLVED_FOR_SELLER", "CLOSED"]).optional() as z.ZodType<DisputeStatus | undefined>
  })
});

export const reviewDisputeSchema = z.object({
  query: z.object({}).optional().default({}),
  params: z.object({
    id: z.string().trim().min(1)
  }),
  body: z.object({
    status: z.enum(["UNDER_REVIEW", "RESOLVED_FOR_BUYER", "RESOLVED_FOR_SELLER", "CLOSED"]),
    resolutionNotes: z.string().trim().max(1500).optional().nullable(),
    adminInternalNotes: z.string().trim().max(2000).optional().nullable(),
    priority: z.enum(["low", "normal", "high", "critical"]).optional()
  })
});

export const releaseSellerPayoutSchema = z.object({
  query: z.object({}).optional().default({}),
  params: z.object({
    id: z.string().trim().min(1)
  }),
  body: z.object({
    notes: z.string().trim().max(1500).optional().nullable()
  })
});

export const issueBuyerRefundSchema = z.object({
  query: z.object({}).optional().default({}),
  params: z.object({
    id: z.string().trim().min(1)
  }),
  body: z.object({
    notes: z.string().trim().max(1500).optional().nullable()
  })
});
