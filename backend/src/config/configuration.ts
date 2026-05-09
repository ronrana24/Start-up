const requiredEnvVars = [
  'NODE_ENV',
  'PORT',
  'DATABASE_URL',
  'JWT_SECRET',
  'JWT_EXPIRES_IN',
  'GOOGLE_CLIENT_ID',
  'MOQ_MIN_AMOUNT_INR',
  'STANDARD_DELIVERY_FEE_INR',
  'PRIORITY_DELIVERY_MULTIPLIER',
  'MIN_PRIORITY_DELIVERY_FEE_INR',
  'OTP_TTL_SECONDS',
  'OTP_MAX_ATTEMPTS',
  'OTP_PEPPER',
  'OTP_DEV_MODE',
  'DEFAULT_WAREHOUSE_ID',
  'CORS_ORIGIN',
] as const;

const minSecretLength = 32;

const configuration = () => {
  const nodeEnv = process.env.NODE_ENV ?? 'development';

  return {
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
      rateLimit: {
        googleSendOtpLimit: parseInt(process.env.OTP_MAX_ATTEMPTS ?? '5', 10),
        googleSendOtpTtlSeconds: parseInt(
          process.env.OTP_TTL_SECONDS ?? '3600',
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
      devMode: parseBoolean(process.env.OTP_DEV_MODE, false),
    },
    warehouse: {
      defaultId: process.env.DEFAULT_WAREHOUSE_ID ?? 'default',
    },
    delivery: {
      locationUpdateIntervalSeconds: parseInt(
        process.env.RIDER_LOCATION_UPDATE_INTERVAL_SECONDS ?? '15',
        10,
      ),
      pickupLabel: process.env.DELIVERY_PICKUP_LABEL ?? 'Main warehouse',
      pickupCoordinates: parseCoordinates(
        process.env.DELIVERY_PICKUP_LAT,
        process.env.DELIVERY_PICKUP_LNG,
      ),
      fcmPush: {
        enabled: parseBoolean(process.env.FCM_PUSH_ENABLED, true),
      },
      expoPush: {
        enabled: parseBoolean(process.env.EXPO_PUSH_ENABLED, false),
        accessToken: optionalString(process.env.EXPO_ACCESS_TOKEN),
      },
      firebase: {
        projectId: optionalString(process.env.FIREBASE_PROJECT_ID),
        serviceAccountJson: optionalString(
          process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
        ),
      },
    },
  };
};

export function validateEnvironment(
  rawConfig: Record<string, unknown>,
): Record<string, unknown> {
  const missing = requiredEnvVars.filter((name) =>
    isBlank(readRawEnv(rawConfig, name)),
  );
  const invalid: string[] = [];

  validateEnum(rawConfig, invalid, 'NODE_ENV', [
    'development',
    'test',
    'production',
  ]);
  validateInteger(rawConfig, invalid, 'PORT', { min: 1, max: 65535 });
  validateDatabaseUrl(rawConfig, invalid, 'DATABASE_URL');
  validateMinLength(rawConfig, invalid, 'JWT_SECRET', minSecretLength);
  validateJwtExpiry(rawConfig, invalid, 'JWT_EXPIRES_IN');
  validateMinLength(rawConfig, invalid, 'GOOGLE_CLIENT_ID', 1);
  validateNumber(rawConfig, invalid, 'MOQ_MIN_AMOUNT_INR', {
    min: 0,
    exclusiveMin: true,
  });
  validateNumber(rawConfig, invalid, 'STANDARD_DELIVERY_FEE_INR', { min: 0 });
  validateNumber(rawConfig, invalid, 'PRIORITY_DELIVERY_MULTIPLIER', {
    min: 0,
  });
  validateNumber(rawConfig, invalid, 'MIN_PRIORITY_DELIVERY_FEE_INR', {
    min: 0,
  });
  validateInteger(rawConfig, invalid, 'OTP_TTL_SECONDS', {
    min: 0,
    exclusiveMin: true,
  });
  validateInteger(rawConfig, invalid, 'OTP_MAX_ATTEMPTS', {
    min: 0,
    exclusiveMin: true,
  });
  validateMinLength(rawConfig, invalid, 'OTP_PEPPER', minSecretLength);
  validateBoolean(rawConfig, invalid, 'OTP_DEV_MODE');
  validateMinLength(rawConfig, invalid, 'DEFAULT_WAREHOUSE_ID', 1);
  validateCorsOrigins(rawConfig, invalid, 'CORS_ORIGIN');

  if (missing.length || invalid.length) {
    const sections: string[] = ['Invalid backend environment configuration.'];
    if (missing.length) {
      sections.push(
        `Missing required variables: ${missing.map((name) => `"${name}"`).join(', ')}`,
      );
    }
    if (invalid.length) {
      sections.push(`Invalid variables: ${invalid.join('; ')}`);
    }
    throw new Error(sections.join('\n'));
  }

  return rawConfig;
}

export function isSecureSecretConfigured(secret: string | undefined): boolean {
  return (secret?.trim().length ?? 0) >= minSecretLength;
}

function readRawEnv(
  rawConfig: Record<string, unknown>,
  name: string,
): string | undefined {
  const value = rawConfig[name];
  if (typeof value === 'string') {
    return value.trim();
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return undefined;
}

function isBlank(raw: string | undefined): boolean {
  return raw == null || raw.trim() === '';
}

function validateEnum(
  rawConfig: Record<string, unknown>,
  invalid: string[],
  name: string,
  allowed: string[],
): void {
  const raw = readRawEnv(rawConfig, name);
  if (isBlank(raw)) return;
  if (!allowed.includes(raw!)) {
    invalid.push(`${name} must be one of: ${allowed.join(', ')}`);
  }
}

function validateInteger(
  rawConfig: Record<string, unknown>,
  invalid: string[],
  name: string,
  options: { min?: number; max?: number; exclusiveMin?: boolean } = {},
): void {
  const raw = readRawEnv(rawConfig, name);
  if (isBlank(raw)) return;
  const value = Number(raw);
  if (!Number.isInteger(value)) {
    invalid.push(`${name} must be an integer`);
    return;
  }
  validateNumberBounds(invalid, name, value, options);
}

function validateNumber(
  rawConfig: Record<string, unknown>,
  invalid: string[],
  name: string,
  options: { min?: number; max?: number; exclusiveMin?: boolean } = {},
): void {
  const raw = readRawEnv(rawConfig, name);
  if (isBlank(raw)) return;
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    invalid.push(`${name} must be a number`);
    return;
  }
  validateNumberBounds(invalid, name, value, options);
}

function validateNumberBounds(
  invalid: string[],
  name: string,
  value: number,
  options: { min?: number; max?: number; exclusiveMin?: boolean },
): void {
  if (
    options.min != null &&
    (options.exclusiveMin ? value <= options.min : value < options.min)
  ) {
    invalid.push(
      `${name} must be ${options.exclusiveMin ? 'greater than' : 'at least'} ${options.min}`,
    );
  }
  if (options.max != null && value > options.max) {
    invalid.push(`${name} must be at most ${options.max}`);
  }
}

function validateDatabaseUrl(
  rawConfig: Record<string, unknown>,
  invalid: string[],
  name: string,
): void {
  const raw = readRawEnv(rawConfig, name);
  if (isBlank(raw)) return;
  try {
    const parsed = new URL(raw!);
    if (parsed.protocol !== 'postgresql:' && parsed.protocol !== 'postgres:') {
      invalid.push(`${name} must use postgres:// or postgresql://`);
    }
  } catch {
    invalid.push(`${name} must be a valid PostgreSQL connection URL`);
  }
}

function validateMinLength(
  rawConfig: Record<string, unknown>,
  invalid: string[],
  name: string,
  minLength: number,
): void {
  const raw = readRawEnv(rawConfig, name);
  if (isBlank(raw)) return;
  if (raw!.length < minLength) {
    invalid.push(`${name} must be at least ${minLength} characters`);
  }
}

function validateJwtExpiry(
  rawConfig: Record<string, unknown>,
  invalid: string[],
  name: string,
): void {
  const raw = readRawEnv(rawConfig, name);
  if (isBlank(raw)) return;
  if (!/^\d+(?:\.\d+)?(?:ms|s|m|h|d|w|y)?$/i.test(raw!)) {
    invalid.push(`${name} must be a duration like 15m, 7d, or 3600`);
  }
}

function validateBoolean(
  rawConfig: Record<string, unknown>,
  invalid: string[],
  name: string,
): void {
  const raw = readRawEnv(rawConfig, name);
  if (isBlank(raw)) return;
  const normalized = raw!.toLowerCase();
  if (
    !['1', '0', 'true', 'false', 'yes', 'no', 'on', 'off'].includes(normalized)
  ) {
    invalid.push(`${name} must be a boolean`);
  }
}

function validateCorsOrigins(
  rawConfig: Record<string, unknown>,
  invalid: string[],
  name: string,
): void {
  const raw = readRawEnv(rawConfig, name);
  if (isBlank(raw)) return;
  for (const origin of raw!.split(',').map((s) => s.trim())) {
    if (!origin) continue;
    if (origin === '*') {
      invalid.push(`${name} cannot be "*" when credentialed CORS is enabled`);
      continue;
    }
    try {
      const parsed = new URL(origin);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        invalid.push(`${name} origin "${origin}" must use http or https`);
      }
    } catch {
      invalid.push(`${name} origin "${origin}" must be a valid URL`);
    }
  }
}

function parseCorsOrigins(raw: string | undefined): string[] {
  if (raw?.trim()) {
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return ['http://localhost:3000', 'http://127.0.0.1:3000'];
}

function parseCoordinates(
  rawLat: string | undefined,
  rawLng: string | undefined,
): { lat: number; lng: number } | null {
  if (!rawLat || !rawLng) {
    return null;
  }
  const lat = Number(rawLat);
  const lng = Number(rawLng);
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return null;
  }
  return { lat, lng };
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
