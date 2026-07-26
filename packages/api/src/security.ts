import crypto from 'node:crypto';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { CORS_ALLOWED_ORIGINS, ENFORCE_HTTPS, IS_PRODUCTION } from './config';

// ---------------------------------------------------------------------------
// Response headers
//
// This process serves JSON and nothing else — no HTML, no scripts, no frames,
// no embedded media. The headers below say exactly that, so a browser that ends
// up rendering a response cannot be talked into treating it as anything richer.
// ---------------------------------------------------------------------------

export function securityHeaders(request: Request, response: Response, next: NextFunction): void {
  // Never let a browser second-guess our declared Content-Type.
  response.setHeader('X-Content-Type-Options', 'nosniff');
  // This API has no UI; framing it can only be for clickjacking.
  response.setHeader('X-Frame-Options', 'DENY');
  // Don't leak API paths (which contain ids) to third parties via Referer.
  response.setHeader('Referrer-Policy', 'no-referrer');
  // A JSON API needs no capability of any kind.
  response.setHeader(
    'Content-Security-Policy',
    "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  );
  response.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=(), payment=(), usb=()');
  // Keep responses out of other origins' caches and process memory.
  response.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  response.setHeader('Origin-Agent-Cluster', '?1');
  response.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  response.setHeader('X-DNS-Prefetch-Control', 'off');

  if (ENFORCE_HTTPS) {
    response.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  // Authenticated payloads must never be written to a shared cache.
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Pragma', 'no-cache');
  response.removeHeader('X-Powered-By');

  next();
}

/**
 * Rejects plaintext HTTP once TLS is expected. A redirect would be friendlier,
 * but the bearer token is already on the wire by the time we see the request —
 * the only safe response is to refuse and let the client retry over TLS.
 */
export function requireHttps(request: Request, response: Response, next: NextFunction): void {
  if (!ENFORCE_HTTPS || request.secure) {
    next();
    return;
  }
  // `request.protocol` already honours X-Forwarded-Proto when trust proxy is set.
  if (request.protocol === 'https') {
    next();
    return;
  }
  response.status(403).json({ error: 'HTTPS is required' });
}

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------

/**
 * Strict allowlist. Requests with no Origin (native apps, curl, server-to-server)
 * are passed through untouched — CORS is not a server-side authorisation control
 * and pretending otherwise would break the mobile client for no security gain.
 * Browser origins, however, must be on the list.
 */
export function corsOptions() {
  const allowed = new Set(CORS_ALLOWED_ORIGINS);
  return {
    origin(origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) {
      if (!origin) {
        callback(null, false); // no Origin header — nothing to echo back
        return;
      }
      callback(null, allowed.has(origin));
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Staff-Key', 'X-Idempotency-Key'],
    // No cookies are used; keeping this false means a wildcard can never combine
    // with credentials, and keeps the token strictly in the Authorization header.
    credentials: false,
    maxAge: 600,
    optionsSuccessStatus: 204,
  };
}

// ---------------------------------------------------------------------------
// Request identity + logging
// ---------------------------------------------------------------------------

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

export function requestId(request: Request, response: Response, next: NextFunction): void {
  const id = crypto.randomUUID();
  request.requestId = id;
  response.setHeader('X-Request-Id', id);
  next();
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/** An error whose message is safe to show a client. */
export class HttpError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.details = details;
  }
}

/**
 * Wraps an async handler so a rejected promise reaches the error middleware
 * instead of being swallowed. Express 5 forwards rejections on its own, but
 * being explicit keeps the behaviour independent of that version detail.
 */
export function asyncHandler(
  handler: (request: Request, response: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (request, response, next) => {
    handler(request, response, next).catch(next);
  };
}

function isBodyParserError(error: unknown): error is { type?: string; status?: number } {
  return typeof error === 'object' && error !== null && 'type' in error;
}

/**
 * Terminal error handler. Anything that is not a deliberate HttpError is logged
 * server-side with its request id and reported to the client as a bare 500 —
 * stack traces and driver messages stay on our side of the wire.
 */
export function errorHandler(error: unknown, request: Request, response: Response, _next: NextFunction): void {
  if (response.headersSent) {
    response.destroy();
    return;
  }

  if (error instanceof HttpError) {
    response.status(error.status).json({ error: error.message, ...(error.details ? { details: error.details } : {}) });
    return;
  }

  // Malformed JSON, body too large, unsupported charset — client-side mistakes.
  if (isBodyParserError(error)) {
    if (error.type === 'entity.too.large') {
      response.status(413).json({ error: 'Request body too large' });
      return;
    }
    if (
      error.type === 'entity.parse.failed' ||
      error.type === 'encoding.unsupported' ||
      error.type === 'charset.unsupported'
    ) {
      response.status(400).json({ error: 'Malformed request body' });
      return;
    }
  }

  // eslint-disable-next-line no-console
  console.error(`[error] request=${request.requestId ?? '-'} ${request.method} ${request.path}`, error);

  response.status(500).json({
    error: 'Internal server error',
    ...(IS_PRODUCTION ? {} : { requestId: request.requestId }),
  });
}

// ---------------------------------------------------------------------------
// Constant-time secret comparison
// ---------------------------------------------------------------------------

/**
 * Compares two secrets without leaking their contents through timing. Both
 * sides are hashed first so the comparison is over fixed-length buffers and
 * length alone reveals nothing.
 */
export function secretsMatch(candidate: string | undefined, expected: string | undefined): boolean {
  if (!candidate || !expected) return false;
  const a = crypto.createHash('sha256').update(candidate, 'utf8').digest();
  const b = crypto.createHash('sha256').update(expected, 'utf8').digest();
  return crypto.timingSafeEqual(a, b);
}
