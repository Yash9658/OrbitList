import { z } from "zod";

export const uploadFileSchema = z.object({
  query: z.object({}).optional().default({}),
  params: z.object({}).optional().default({}),
  body: z.object({
    fileName: z.string().trim().min(1).max(255),
    mimeType: z.string().trim().min(3).max(100),
    contentBase64: z.string().trim().min(1)
  })
});
