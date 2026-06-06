import { config } from "dotenv";
import { z } from "zod";

config();

const booleanFromEnv = z
  .union([z.literal("true"), z.literal("false")])
  .transform((value) => value === "true");

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.string().default("4000"),
    CLIENT_URL: z.string().default("http://localhost:5173"),
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    JWT_SECRET: z.string().min(1, "JWT_SECRET is required"),
    ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().default(15),
    REFRESH_SESSION_TTL_DAYS: z.coerce.number().int().positive().default(30),
    AUTH_COOKIE_SECURE: booleanFromEnv.default(false),
    AUTH_COOKIE_SAME_SITE: z.enum(["lax", "strict", "none"]).default("lax"),
    AUTH_COOKIE_DOMAIN: z.string().optional(),
    ALLOWED_CORS_ORIGINS: z.string().default("http://localhost:5173"),
    JSON_BODY_LIMIT_MB: z.coerce.number().positive().default(8),
    AUTH_RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().int().positive().default(15),
    AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(25),
    MESSAGE_RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().int().positive().default(1),
    MESSAGE_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
    UPLOAD_RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().int().positive().default(10),
    UPLOAD_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(15),
    SUPABASE_URL: z.string().optional(),
    SUPABASE_ANON_KEY: z.string().optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
    SUPABASE_STORAGE_BUCKET: z.string().default("uploads"),
    SUPABASE_STORAGE_FOLDER: z.string().default("marketplace-media"),
    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),
    STRIPE_FEATURED_LISTING_PRICE_USD: z.coerce.number().positive().default(19),
    STRIPE_CURRENCY: z.string().default("usd"),
    STRIPE_DEFAULT_CONNECTED_ACCOUNT_COUNTRY: z.string().default("US"),
    STRIPE_CONNECT_REFRESH_URL: z.string().optional(),
    STRIPE_CONNECT_RETURN_URL: z.string().optional(),
    RESEND_API_KEY: z.string().optional(),
    EMAIL_FROM_ADDRESS: z.string().default("Orbitlist <no-reply@orbitlist.dev>"),
    EMAIL_OUTBOX_DIR: z.string().default("email-outbox"),
    EMAIL_RETRY_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
    TRANSACTION_REVIEW_WINDOW_DAYS: z.coerce.number().int().positive().default(7),
    NOTIFICATION_RETENTION_DAYS: z.coerce.number().int().positive().default(30),
    STALE_MODERATION_HOURS: z.coerce.number().int().positive().default(24),
    STALE_REPORT_HOURS: z.coerce.number().int().positive().default(24),
    DATABASE_BACKUP_DIR: z.string().default("backups/database"),
    DATABASE_BACKUP_RETENTION_DAYS: z.coerce.number().int().positive().default(14),
    PG_DUMP_PATH: z.string().optional(),
    SENTRY_DSN: z.string().optional(),
    SENTRY_ENVIRONMENT: z.string().default(process.env.NODE_ENV ?? "development"),
    SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0.1)
  })
  .superRefine((value, context) => {
    if (value.AUTH_COOKIE_SAME_SITE === "none" && !value.AUTH_COOKIE_SECURE) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "AUTH_COOKIE_SECURE must be true when AUTH_COOKIE_SAME_SITE is 'none'",
        path: ["AUTH_COOKIE_SECURE"]
      });
    }

    if (value.NODE_ENV !== "production") {
      return;
    }

    if (!value.AUTH_COOKIE_SECURE) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "AUTH_COOKIE_SECURE must be true in production",
        path: ["AUTH_COOKIE_SECURE"]
      });
    }

    if (!value.SUPABASE_URL || !value.SUPABASE_SERVICE_ROLE_KEY) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in production for cloud uploads",
        path: ["SUPABASE_URL"]
      });
    }
  });

export const env = envSchema.parse(process.env);
