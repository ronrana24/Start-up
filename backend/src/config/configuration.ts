const nodeEnv = process.env.NODE_ENV ?? 'development';

const configuration = () => ({
  nodeEnv,
  port: parseInt(process.env.PORT ?? '2424', 10),
  /** Comma-separated in CORS_ORIGIN; defaults to local Next.js when unset. */
  corsOrigins: parseCorsOrigins(process.env.CORS_ORIGIN),
  databaseUrl: process.env.DATABASE_URL,
  jwt: {
    secret: process.env.JWT_SECRET ?? 'dev-only-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? '',
  },
  auth: {
    cookie: {
      name: process.env.AUTH_COOKIE_NAME ?? 'access_token',
      maxAgeSeconds: parseInt(
        process.env.AUTH_COOKIE_MAX_AGE_SECONDS ?? `${7 * 24 * 60 * 60}`,
        10,
      ),
      secure: parseBoolean(
        process.env.AUTH_COOKIE_SECURE,
        nodeEnv === 'production',
      ),
      sameSite: parseSameSite(process.env.AUTH_COOKIE_SAMESITE),
      domain: optionalString(process.env.AUTH_COOKIE_DOMAIN),
    },
    registrationTokenSecret:
      process.env.REGISTRATION_TOKEN_SECRET ??
      process.env.JWT_SECRET ??
      'dev-only-change-me',
    registrationTokenTtlSeconds: parseInt(
      process.env.REGISTRATION_TOKEN_TTL_SECONDS ?? '600',
      10,
    ),
    rateLimit: {
      googleSendOtpLimit: parseInt(
        process.env.AUTH_GOOGLE_SEND_OTP_LIMIT ?? '5',
        10,
      ),
      googleSendOtpTtlSeconds: parseInt(
        process.env.AUTH_GOOGLE_SEND_OTP_TTL_SECONDS ?? '3600',
        10,
      ),
    },
  },
  pricing: {
    moqMinAmountInr: parseFloat(process.env.MOQ_MIN_AMOUNT_INR ?? '2000'),
    standardDeliveryFeeInr: parseFloat(
      process.env.STANDARD_DELIVERY_FEE_INR ?? '0',
    ),
    priorityDeliveryMultiplier: parseFloat(
      process.env.PRIORITY_DELIVERY_MULTIPLIER ?? '0.05',
    ),
    minPriorityDeliveryFeeInr: parseFloat(
      process.env.MIN_PRIORITY_DELIVERY_FEE_INR ?? '99',
    ),
  },
  otp: {
    ttlSeconds: parseInt(process.env.OTP_TTL_SECONDS ?? '300', 10),
    maxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS ?? '5', 10),
    pepper: process.env.OTP_PEPPER ?? '',
    devMode: process.env.OTP_DEV_MODE === 'true',
  },
  warehouse: {
    defaultId: process.env.DEFAULT_WAREHOUSE_ID ?? 'default',
  },
});

function parseCorsOrigins(raw: string | undefined): string[] {
  if (raw?.trim()) {
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return ['http://localhost:3000', 'http://127.0.0.1:3000'];
}

function parseBoolean(raw: string | undefined, fallback: boolean): boolean {
  if (raw == null || raw.trim() === '') {
    return fallback;
  }
  return ['1', 'true', 'yes', 'on'].includes(raw.trim().toLowerCase());
}

function parseSameSite(raw: string | undefined): 'lax' | 'strict' | 'none' {
  const normalized = raw?.trim().toLowerCase();
  if (normalized === 'strict' || normalized === 'none') {
    return normalized;
  }
  return 'lax';
}

function optionalString(raw: string | undefined): string | undefined {
  const trimmed = raw?.trim();
  return trimmed ? trimmed : undefined;
}

export default configuration;
export type AppConfig = ReturnType<typeof configuration>;
