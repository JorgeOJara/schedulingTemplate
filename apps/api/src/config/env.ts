import 'dotenv/config';
import { z } from 'zod';

const booleanish = z
  .union([z.boolean(), z.string()])
  .optional()
  .transform((value) => {
    if (typeof value === 'boolean') {
      return value;
    }

    if (value === undefined) {
      return undefined;
    }

    const normalized = value.trim().toLowerCase();

    if (['1', 'true', 'yes', 'on'].includes(normalized)) {
      return true;
    }

    if (['0', 'false', 'no', 'off'].includes(normalized)) {
      return false;
    }

    return undefined;
  })
  .pipe(z.boolean());

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRY: z.string().default('15m'),
  REFRESH_TOKEN_EXPIRY: z.string().default('7d'),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  COOKIE_SECURE: booleanish.default(false),
  COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  REFRESH_COOKIE_NAME: z.string().trim().min(1).default('ss_refresh'),
  RATE_LIMIT_WINDOW: z.coerce.number().default(15 * 60 * 1000),
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().default(10),
  TRUST_PROXY: z.coerce.number().default(1),
  BODY_SIZE_LIMIT: z.string().default('100kb'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
});

const env = envSchema.parse(process.env);

export default env;
