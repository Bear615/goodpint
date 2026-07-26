import crypto from 'node:crypto';
import path from 'node:path';

// ---------------------------------------------------------------------------
// Centralised, fail-closed configuration.
//
// Rule of the file: a secret never has a usable default. In production a
// missing secret aborts the boot; in development we mint a random one per
// process so nothing usable can be committed or shared by accident.
// ---------------------------------------------------------------------------

const rawEnv = (process.env.NODE_ENV ?? 'development').trim().toLowerCase();
export const NODE_ENV: 'development' | 'test' | 'production' =
  rawEnv === 'production' ? 'production' : rawEnv === 'test' ? 'test' : 'development';

export const IS_PRODUCTION = NODE_ENV === 'production';
export const IS_TEST = NODE_ENV === 'test';

function optional(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function fatal(message: string): never {
  // eslint-disable-next-line no-console
  console.error(`[config] FATAL: ${message}`);
  process.exit(1);
}

function warn(message: string): void {
  if (IS_TEST) return;
  // eslint-disable-next-line no-console
  console.warn(`[config] ${message}`);
}

/**
 * Reads a secret from the environment. Production refuses to start without it;
 * development generates an ephemeral value that dies with the process.
 */
function secret(name: string, minLength = 24): string {
  const value = optional(name);
  if (value) {
    if (value.length < minLength) {
      fatal(`${name} must be at least ${minLength} characters (got ${value.length}).`);
    }
    return value;
  }
  if (IS_PRODUCTION) {
    fatal(`${name} is required in production. Refusing to start with a built-in default.`);
  }
  const generated = crypto.randomBytes(24).toString('base64url');
  warn(`${name} is not set — generated an ephemeral development value: ${generated}`);
  return generated;
}

function integer(name: string, fallback: number, { min, max }: { min: number; max: number }): number {
  const raw = optional(name);
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    fatal(`${name} must be an integer between ${min} and ${max} (got ${JSON.stringify(raw)}).`);
  }
  return parsed;
}

function boolean(name: string, fallback: boolean): boolean {
  const raw = optional(name)?.toLowerCase();
  if (raw === undefined) return fallback;
  if (['1', 'true', 'yes', 'on'].includes(raw)) return true;
  if (['0', 'false', 'no', 'off'].includes(raw)) return false;
  fatal(`${name} must be a boolean-ish value (true/false), got ${JSON.stringify(raw)}.`);
}

function list(name: string): string[] {
  const raw = optional(name);
  if (!raw) return [];
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

export const PORT = integer('PORT', 4000, { min: 1, max: 65535 });

/**
 * Network interface to bind.
 *
 * The default binds every interface, which is what makes the documented dev
 * workflow work — a physical phone on the same Wi-Fi has to reach this process.
 * That also means the API, including the staff till endpoint, is reachable by
 * anything on the network, so a production deployment should set this to
 * 127.0.0.1 and put a TLS-terminating reverse proxy in front.
 */
export const HOST = optional('HOST') ?? '0.0.0.0';

if (IS_PRODUCTION && (HOST === '0.0.0.0' || HOST === '::')) {
  warn(
    `Binding all interfaces (${HOST}) in production. The API — including /api/staff/redeem — is reachable ` +
      'from any network that can route here. Prefer HOST=127.0.0.1 behind a reverse proxy.',
  );
}

export const DB_PATH = optional('GOODPINT_DB_PATH') ?? path.join(process.cwd(), 'goodpint.db');

/**
 * How many reverse proxies sit in front of this process. Express uses it to
 * pick the real client IP out of X-Forwarded-For. Getting this wrong either
 * rate-limits every user as one IP (too low) or lets a client spoof its own IP
 * and bypass rate limiting entirely (too high), so it is explicit, defaults to
 * "no proxy", and is never inferred.
 */
export const TRUST_PROXY_HOPS = integer('TRUST_PROXY_HOPS', 0, { min: 0, max: 10 });

/**
 * Browser origins allowed to call the API. Native apps are unaffected — CORS is
 * a browser control. Empty means "same-origin only", which is the safe default:
 * production must opt in explicitly rather than inheriting a wildcard.
 */
const configuredOrigins = list('CORS_ALLOWED_ORIGINS');
export const CORS_ALLOWED_ORIGINS: string[] = configuredOrigins.length
  ? configuredOrigins
  : IS_PRODUCTION
    ? []
    : [
        'http://localhost:8081',
        'http://localhost:19006',
        'http://localhost:3000',
        'http://127.0.0.1:8081',
        'http://127.0.0.1:19006',
        'http://127.0.0.1:3000',
      ];

if (IS_PRODUCTION && CORS_ALLOWED_ORIGINS.length === 0) {
  warn('CORS_ALLOWED_ORIGINS is empty — cross-origin browser requests will be rejected.');
}

if (CORS_ALLOWED_ORIGINS.includes('*')) {
  fatal('CORS_ALLOWED_ORIGINS must not contain "*". List explicit origins instead.');
}

/** Enable HSTS + HTTPS redirection. On when the deployment terminates TLS. */
export const ENFORCE_HTTPS = boolean('ENFORCE_HTTPS', IS_PRODUCTION);

// ---------------------------------------------------------------------------
// Secrets
// ---------------------------------------------------------------------------

/**
 * Shared secret a pub's till/staff app presents to redeem vouchers.
 *
 * Optionally scoped per venue via STAFF_KEYS="venueId:key,venueId:key", which
 * limits the blast radius of one leaked till key to a single pub. STAFF_KEY
 * remains supported as an unscoped key for single-venue deployments.
 */
function parseStaffKeys(): Map<string, string> {
  const entries = list('STAFF_KEYS');
  const map = new Map<string, string>();
  for (const entry of entries) {
    const separator = entry.indexOf(':');
    if (separator <= 0 || separator === entry.length - 1) {
      fatal(`STAFF_KEYS entries must look like "venueId:key" (got ${JSON.stringify(entry)}).`);
    }
    const venueId = entry.slice(0, separator).trim();
    const key = entry.slice(separator + 1).trim();
    if (key.length < 24) fatal(`STAFF_KEYS key for venue ${venueId} must be at least 24 characters.`);
    map.set(venueId, key);
  }
  return map;
}

export const STAFF_KEYS = parseStaffKeys();
export const STAFF_KEY = STAFF_KEYS.size > 0 ? optional('STAFF_KEY') : secret('STAFF_KEY');

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

/**
 * Wallet top-ups move real money onto an account. There is no payment provider
 * wired up in this codebase, so the endpoint that credits a wallet is a mint.
 * It stays available for local development and is refused in production unless
 * an operator has consciously opted in, which they should only do once a real
 * provider actually authorises the charge upstream.
 */
export const ALLOW_UNVERIFIED_TOPUPS = boolean('ALLOW_UNVERIFIED_TOPUPS', !IS_PRODUCTION);

if (IS_PRODUCTION && ALLOW_UNVERIFIED_TOPUPS) {
  warn(
    'ALLOW_UNVERIFIED_TOPUPS is enabled in production. Wallet balances can be credited without ' +
      'any payment authorisation. Disable this until a payment provider is integrated.',
  );
}

// ---------------------------------------------------------------------------
// Limits
// ---------------------------------------------------------------------------

/** Largest JSON body accepted. Every legitimate request here is well under 1 KB. */
export const MAX_JSON_BODY_BYTES = 16 * 1024;

/** Sessions expire this long after they are created, regardless of activity. */
export const SESSION_ABSOLUTE_TTL_MS = integer('SESSION_TTL_HOURS', 24 * 30, { min: 1, max: 24 * 365 }) * 60 * 60 * 1000;

/** Sessions also expire after this long without being used. */
export const SESSION_IDLE_TTL_MS = integer('SESSION_IDLE_TTL_HOURS', 24 * 14, { min: 1, max: 24 * 365 }) * 60 * 60 * 1000;

/** Most sessions one account may hold at once; the oldest are evicted past this. */
export const MAX_SESSIONS_PER_USER = integer('MAX_SESSIONS_PER_USER', 10, { min: 1, max: 100 });

/** Minimum accepted password length. */
export const MIN_PASSWORD_LENGTH = integer('MIN_PASSWORD_LENGTH', 10, { min: 8, max: 128 });

/** A single check-in at the same venue may only earn points once per window. */
export const CHECK_IN_COOLDOWN_MS = integer('CHECK_IN_COOLDOWN_HOURS', 4, { min: 1, max: 168 }) * 60 * 60 * 1000;

/** Ceiling on points earned from check-ins per user per rolling day. */
export const CHECK_IN_DAILY_POINT_CAP = integer('CHECK_IN_DAILY_POINT_CAP', 100, { min: 0, max: 10_000 });

export function describeConfig(): Record<string, unknown> {
  return {
    env: NODE_ENV,
    port: PORT,
    dbPath: DB_PATH,
    trustProxyHops: TRUST_PROXY_HOPS,
    corsAllowedOrigins: CORS_ALLOWED_ORIGINS,
    enforceHttps: ENFORCE_HTTPS,
    staffKeyScoping: STAFF_KEYS.size > 0 ? `${STAFF_KEYS.size} venue-scoped key(s)` : 'single unscoped key',
    allowUnverifiedTopUps: ALLOW_UNVERIFIED_TOPUPS,
  };
}
