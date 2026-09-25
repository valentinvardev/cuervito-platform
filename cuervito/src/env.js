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
    /** Escape hatch: fuerza a que OCR y face-index vuelvan a bajar el
     *  original full-res en vez de reusar el JPEG 2400px que produce
     *  generatePreview. Solo para diagnosticar si la detección de dorsales
     *  empeorara — cuesta 2 descargas + 2 resizes por foto. */
    REKOGNITION_USE_ORIGINAL: z.coerce.boolean().default(false),

    /* El procesador de fotos en segundo plano.
       Apagado fuera de producción por defecto: un `npm run dev` con el .env de
       producción al lado no tiene que convertirse en un obrero que le saca
       trabajo al servidor de verdad. */
    PROCESADOR_ACTIVO: z
      .enum(["true", "false"])
      .default(process.env.NODE_ENV === "production" ? "true" : "false")
      .transform((v) => v === "true"),
    /* Cuántas fotos a la vez, a la par de los permisos de sharp.

       Estaba en 4 contra 3 permisos, y sobraba un obrero. Sobrar no es
       gratis: el que espera un permiso lo espera CON el reloj del tope
       corriendo, así que bajo carga gastaba sus cuatro minutos sin tocar la
       foto, la marcaba como fallida y le sumaba un intento. A los cuatro
       intentos la cola la aparta. Fotos que nunca se intentaron quedaban
       apartadas por no haber conseguido turno. */
    PROCESADOR_A_LA_VEZ: z.coerce.number().int().min(1).max(12).default(2),
    /* Si pm2 corre en fork con UNA instancia, un lease vivo al arrancar es de
       un proceso muerto y se puede liberar: eso repara al arrancar en vez de
       esperar los 25 minutos del vencimiento. En cluster hay que ponerlo en
       false, y lo que un deploy deja a medias casi nunca se repara (ver
       ecosystem.config.cjs). */
    PROCESADOR_UNICA_INSTANCIA: z
      .enum(["true", "false"])
      .default("true")
      .transform((v) => v === "true"),
    AWS_S3_BUCKET: z.string().optional(),
    AWS_S3_PREFIX: z.string().default("cuervito"),
    AWS_S3_ACCELERATE: z
      .enum(["true", "false"])
      .default("false")
      .transform((v) => v === "true"),

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

    // Cloudflare for SaaS (custom hostnames for /dashboard/tienda)
    CLOUDFRONT_DOMAIN: z.string().optional(),
    CLOUDFRONT_DISTRIBUTION_ID: z.string().optional(),

    CLOUDFLARE_API_TOKEN: z.string().optional(),
    CLOUDFLARE_ZONE_ID: z.string().optional(),
    CLOUDFLARE_FALLBACK_ORIGIN: z.string().default("cuervito.app"),

    // Retention windows (days). After a photo is soft-deleted, the daily
    // cron hard-deletes it from S3 + DB once this many days have passed.
    // Same window applies to download tokens (buyers can re-download within
    // this many days from payment).
    PHOTO_RETENTION_DAYS: z.coerce.number().int().min(1).max(365).default(30),
    DOWNLOAD_TOKEN_RETENTION_DAYS: z.coerce.number().int().min(1).max(365).default(30),
    // Shared secret for the /api/cron/cleanup endpoint. The VPS' cron job
    // calls it with `Authorization: Bearer <CRON_SECRET>`. Required in prod.
    CRON_SECRET: z.string().optional(),

    // Quotas
    QUOTA_STORAGE_BYTES_DEFAULT: z.coerce.number().default(107374182400), // 100 GB
    QUOTA_MAX_PHOTO_BYTES: z.coerce.number().default(31457280), // 30 MB
    QUOTA_RECOGNITION_MONTHLY_DEFAULT: z.coerce.number().default(10000),
    // Cortacircuitos de gasto en Rekognition, por fotógrafo y por mes. NO es
    // la cuota de arriba: esa se muestra en el panel y el fotógrafo principal
    // la pasa todos los meses. Este tope sólo existe para que un bucle no se
    // lleve puesta la factura, así que arranca en ~5× el pico real (agosto
    // proyectaba 29.500 llamadas). A USD 0,001 por llamada, son USD 50/mes.
    RECOGNITION_HARD_CAP_MONTHLY: z.coerce.number().default(50000),

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
    REKOGNITION_USE_ORIGINAL: process.env.REKOGNITION_USE_ORIGINAL,
    PROCESADOR_ACTIVO: process.env.PROCESADOR_ACTIVO,
    PROCESADOR_A_LA_VEZ: process.env.PROCESADOR_A_LA_VEZ,
    PROCESADOR_UNICA_INSTANCIA: process.env.PROCESADOR_UNICA_INSTANCIA,
    AWS_S3_BUCKET: process.env.AWS_S3_BUCKET,
    AWS_S3_PREFIX: process.env.AWS_S3_PREFIX,
    AWS_S3_ACCELERATE: process.env.AWS_S3_ACCELERATE,

    MP_CLIENT_ID: process.env.MP_CLIENT_ID,
    MP_CLIENT_SECRET: process.env.MP_CLIENT_SECRET,
    MP_PUBLIC_KEY: process.env.MP_PUBLIC_KEY,
    MP_PLATFORM_ACCESS_TOKEN: process.env.MP_PLATFORM_ACCESS_TOKEN,
    MP_WEBHOOK_SECRET: process.env.MP_WEBHOOK_SECRET,
    MP_ENVIRONMENT: process.env.MP_ENVIRONMENT,
    MP_TEST_MODE: process.env.MP_TEST_MODE,

    RESEND_API_KEY: process.env.RESEND_API_KEY,
    RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,

    CLOUDFRONT_DOMAIN: process.env.CLOUDFRONT_DOMAIN,
    CLOUDFRONT_DISTRIBUTION_ID: process.env.CLOUDFRONT_DISTRIBUTION_ID,

    CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN,
    CLOUDFLARE_ZONE_ID: process.env.CLOUDFLARE_ZONE_ID,
    CLOUDFLARE_FALLBACK_ORIGIN: process.env.CLOUDFLARE_FALLBACK_ORIGIN,

    PHOTO_RETENTION_DAYS: process.env.PHOTO_RETENTION_DAYS,
    DOWNLOAD_TOKEN_RETENTION_DAYS: process.env.DOWNLOAD_TOKEN_RETENTION_DAYS,
    CRON_SECRET: process.env.CRON_SECRET,

    QUOTA_STORAGE_BYTES_DEFAULT: process.env.QUOTA_STORAGE_BYTES_DEFAULT,
    QUOTA_MAX_PHOTO_BYTES: process.env.QUOTA_MAX_PHOTO_BYTES,
    QUOTA_RECOGNITION_MONTHLY_DEFAULT: process.env.QUOTA_RECOGNITION_MONTHLY_DEFAULT,
    RECOGNITION_HARD_CAP_MONTHLY: process.env.RECOGNITION_HARD_CAP_MONTHLY,

    PLATFORM_FEE_PERCENT: process.env.PLATFORM_FEE_PERCENT,

    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
