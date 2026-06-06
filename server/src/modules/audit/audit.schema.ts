import { z } from "zod";

export const listAuditLogsSchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({}).optional().default({}),
  query: z.object({
    limit: z.coerce.number().int().positive().max(100).default(50)
  })
});
