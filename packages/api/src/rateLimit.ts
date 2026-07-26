import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { IS_TEST } from './config';

// ---------------------------------------------------------------------------
// Fixed-window rate limiting, in process memory, no dependencies.
//
// Scope note: state lives in this process. That is correct for the current
// single-process deployment; running more than one instance behind a load
// balancer means each instance enforces its own share of the budget, and the
// counters would need to move to a shared store (Redis, or a SQLite table if
// the instances share a volume) to stay accurate.
// ---------------------------------------------------------------------------

interface Bucket {
  count: number;
  resetAt: number;
}

export interface RateLimitOptions {
  /** Length of the counting window. */
  windowMs: number;
  /** Requests allowed per key per window. */
  max: number;
  /** Derives the bucket key. Defaults to the client IP. */
  keyFn?: (request: Request) => string;
  /** Message returned when the limit is hit. */
  message?: string;
  /** When true, only requests that failed (status >= 400) count toward the limit. */
  countFailuresOnly?: boolean;
}

const registry: Array<Map<string, Bucket>> = [];

function sweep(): void {
  const now = Date.now();
  for (const store of registry) {
    for (const [key, bucket] of store) {
      if (bucket.resetAt <= now) store.delete(key);
    }
  }
}

// Periodic sweep keeps memory bounded under key churn (one key per IP/account).
// unref() so an idle timer never holds the process open.
if (!IS_TEST) {
  const timer = setInterval(sweep, 60_000);
  timer.unref?.();
}

function defaultKey(request: Request): string {
  // request.ip honours the configured trust-proxy depth. Falling back to the
  // raw socket address means a missing IP can never collapse every client into
  // one shared bucket.
  return request.ip ?? request.socket.remoteAddress ?? 'unknown';
}

export function createRateLimiter(options: RateLimitOptions): RequestHandler {
  const store = new Map<string, Bucket>();
  registry.push(store);

  const keyFn = options.keyFn ?? defaultKey;
  const message = options.message ?? 'Too many requests. Please slow down and try again shortly.';

  return function rateLimit(request: Request, response: Response, next: NextFunction): void {
    const key = keyFn(request);
    const now = Date.now();

    let bucket = store.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + options.windowMs };
      store.set(key, bucket);
    }

    const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));

    if (bucket.count >= options.max) {
      response.setHeader('Retry-After', String(retryAfterSeconds));
      response.setHeader('RateLimit-Limit', String(options.max));
      response.setHeader('RateLimit-Remaining', '0');
      response.setHeader('RateLimit-Reset', String(retryAfterSeconds));
      response.status(429).json({ error: message });
      return;
    }

    if (options.countFailuresOnly) {
      // Charge the bucket only once we know the outcome, so a user who keeps
      // succeeding is never throttled while a guesser is.
      response.on('finish', () => {
        if (response.statusCode >= 400) {
          const current = store.get(key);
          if (current && current.resetAt > Date.now()) current.count += 1;
        }
      });
    } else {
      bucket.count += 1;
    }

    response.setHeader('RateLimit-Limit', String(options.max));
    response.setHeader('RateLimit-Remaining', String(Math.max(0, options.max - bucket.count)));
    response.setHeader('RateLimit-Reset', String(retryAfterSeconds));

    next();
  };
}

/** Clears every limiter's state. Test-only helper. */
export function resetAllRateLimits(): void {
  for (const store of registry) store.clear();
}

// ---------------------------------------------------------------------------
// Named limiters
// ---------------------------------------------------------------------------

/** Broad backstop so a single host cannot saturate the process. */
export const globalLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 300,
});

/**
 * Sign-in attempts per IP. Deliberately tight: password verification is
 * intentionally expensive, so this doubles as the guard against burning CPU on
 * unauthenticated work.
 */
export const loginLimiter = createRateLimiter({
  windowMs: 15 * 60_000,
  max: 10,
  countFailuresOnly: true,
  message: 'Too many failed sign-in attempts. Please wait a few minutes and try again.',
});

/**
 * Per-account failure limiter, so an attacker spread across many IPs still
 * cannot grind one account. Keyed on the submitted email; unknown emails share
 * the "unknown" bucket, which is fine — they cannot succeed either way.
 */
export const loginAccountLimiter = createRateLimiter({
  windowMs: 15 * 60_000,
  max: 20,
  countFailuresOnly: true,
  keyFn: (request) => {
    const email = (request.body as { email?: unknown } | undefined)?.email;
    return typeof email === 'string' ? `account:${email.toLowerCase().slice(0, 320)}` : 'account:unknown';
  },
  message: 'Too many failed sign-in attempts for this account. Please wait a few minutes and try again.',
});

/** Account creation, to blunt automated signup floods. */
export const signupLimiter = createRateLimiter({
  windowMs: 60 * 60_000,
  max: 5,
  message: 'Too many accounts created from this network. Please try again later.',
});

/**
 * Voucher redemption at the till. Voucher codes are high-entropy, but this
 * turns an online guessing attack from "implausible" into "impossible" and
 * caps the damage of a leaked till key.
 */
export const staffRedeemLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 30,
  message: 'Too many redemption attempts. Please wait a moment.',
});

/** Value-moving user actions: orders, redemptions, top-ups, check-ins, reviews. */
export const writeLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 30,
  keyFn: (request) => `user:${request.userId ?? defaultKey(request)}`,
  message: 'You are doing that too often. Please wait a moment and try again.',
});
