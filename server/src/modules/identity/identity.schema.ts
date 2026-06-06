import { z } from "zod";

const isoDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date of birth must use YYYY-MM-DD format")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "Date of birth must be a valid date")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date <= today;
  }, "Date of birth cannot be in the future");

const documentUrlSchema = z
  .string()
  .trim()
  .url("Document proof URL must be a valid uploaded file URL")
  .refine(
    (value) => /^https?:\/\//i.test(value),
    "Document proof URL must start with http:// or https://"
  );

export const getMyIdentityVerificationSchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({}).optional().default({}),
  query: z.object({}).optional().default({})
});

export const submitIdentityVerificationSchema = z.object({
  params: z.object({}).optional().default({}),
  query: z.object({}).optional().default({}),
  body: z.object({
    legalName: z
      .string()
      .trim()
      .min(3, "Legal name must be at least 3 characters")
      .max(120, "Legal name must be 120 characters or less"),
    dateOfBirth: isoDateSchema,
    country: z
      .string()
      .trim()
      .min(2, "Country is required")
      .max(120, "Country must be 120 characters or less"),
    documentType: z.enum(
      ["Passport", "National ID", "Driving License", "Business Document"],
      "Select a valid document type"
    ),
    documentNumberLast4: z
      .string()
      .trim()
      .regex(/^\d{4}$/, "Enter the last 4 digits of the document number"),
    addressLine1: z
      .string()
      .trim()
      .min(4, "Address line must be at least 4 characters")
      .max(200, "Address line must be 200 characters or less"),
    city: z
      .string()
      .trim()
      .min(2, "City is required")
      .max(100, "City must be 100 characters or less"),
    postalCode: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9][A-Za-z0-9 -]{2,19}$/, "Enter a valid postal code"),
    documentUrl: documentUrlSchema,
    notes: z.string().trim().max(1500, "Notes must be 1500 characters or less").optional().nullable()
  })
});

export const listPendingIdentityVerificationsSchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({}).optional().default({}),
  query: z.object({}).optional().default({})
});

export const reviewIdentityVerificationSchema = z.object({
  query: z.object({}).optional().default({}),
  params: z.object({
    id: z.string().trim().min(1)
  }),
  body: z.object({
    status: z.enum(["APPROVED", "REJECTED"]),
    rejectionReason: z.string().trim().max(1500).optional().nullable()
  })
});
