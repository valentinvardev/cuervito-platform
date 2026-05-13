import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),

    // NextAuth
    AUTH_SECRET:
      process.env.NODE_ENV === "production"
        ? z.string()
        : z.string().optional(),
    AUTH_GOOGLE_ID: z.string().optional(),
    AUTH_GOOGLE_SECRET: z.string().optional(),

    // Database
    DATABASE_URL: z.string().url(),
    DIRECT_URL: z.string().url().optional(),

    // Supabase (server-side)
    SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),

    // AWS
    AWS_ACCESS_KEY_ID: z.string().optional(),
    AWS_SECRET_ACCESS_KEY: z.string().optional(),
    AWS_REGION: z.string().default("us-east-2"),
    AWS_S3_BUCKET: z.string().optional(),
    AWS_S3_PREFIX: z.string().default("cuervito"),

    // Mercado Pago
    MP_CLIENT_ID: z.string().optional(),
    MP_CLIENT_SECRET: z.string().optional(),
    MP_PUBLIC_KEY: z.string().optional(),
    MP_PLATFORM_ACCESS_TOKEN: z.string().optional(),
    MP_WEBHOOK_SECRET: z.string().optional(),
    MP_ENVIRONMENT: z.enum(["sandbox", "production"]).default("sandbox"),
    MP_TEST_MODE: z
      .enum(["true", "false"])
      .default("false")
      .transform((v) => v === "true"),

    // Resend
    RESEND_API_KEY: z.string().optional(),
    RESEND_FROM_EMAIL: z.string().default("Cuervito <hola@cuervito.app>"),

    // Quotas
    QUOTA_STORAGE_BYTES_DEFAULT: z.coerce.number().default(107374182400), // 100 GB
    QUOTA_MAX_PHOTO_BYTES: z.coerce.number().default(31457280), // 30 MB
    QUOTA_RECOGNITION_MONTHLY_DEFAULT: z.coerce.number().default(10000),

    // Commission
    PLATFORM_FEE_PERCENT: z.coerce.number().min(0).max(50).default(10),
  },

  client: {
    NEXT_PUBLIC_BASE_URL: z.string().url().default("http://localhost:3000"),
    NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  },

  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,

    AUTH_SECRET: process.env.AUTH_SECRET,
    AUTH_GOOGLE_ID: process.env.AUTH_GOOGLE_ID,
    AUTH_GOOGLE_SECRET: process.env.AUTH_GOOGLE_SECRET,

    DATABASE_URL: process.env.DATABASE_URL,
    DIRECT_URL: process.env.DIRECT_URL,

    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,

    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
    AWS_REGION: process.env.AWS_REGION,
    AWS_S3_BUCKET: process.env.AWS_S3_BUCKET,
    AWS_S3_PREFIX: process.env.AWS_S3_PREFIX,

    MP_CLIENT_ID: process.env.MP_CLIENT_ID,
    MP_CLIENT_SECRET: process.env.MP_CLIENT_SECRET,
    MP_PUBLIC_KEY: process.env.MP_PUBLIC_KEY,
    MP_PLATFORM_ACCESS_TOKEN: process.env.MP_PLATFORM_ACCESS_TOKEN,
    MP_WEBHOOK_SECRET: process.env.MP_WEBHOOK_SECRET,
    MP_ENVIRONMENT: process.env.MP_ENVIRONMENT,
    MP_TEST_MODE: process.env.MP_TEST_MODE,

    RESEND_API_KEY: process.env.RESEND_API_KEY,
    RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,

    QUOTA_STORAGE_BYTES_DEFAULT: process.env.QUOTA_STORAGE_BYTES_DEFAULT,
    QUOTA_MAX_PHOTO_BYTES: process.env.QUOTA_MAX_PHOTO_BYTES,
    QUOTA_RECOGNITION_MONTHLY_DEFAULT: process.env.QUOTA_RECOGNITION_MONTHLY_DEFAULT,

    PLATFORM_FEE_PERCENT: process.env.PLATFORM_FEE_PERCENT,

    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
