import crypto from 'node:crypto';
import cors from 'cors';
import express from 'express';
import { z } from 'zod';
import type { Drink, EarningRule, Reward, Tier, Venue } from './data';
import { audit, getCatalog, sqlite } from './db';
import {
  ALLOW_UNVERIFIED_TOPUPS,
  CHECK_IN_DAILY_POINT_CAP,
  HOST,
  MAX_JSON_BODY_BYTES,
  MIN_PASSWORD_LENGTH,
  NODE_ENV,
  PORT,
  STAFF_KEY,
  STAFF_KEYS,
  TRUST_PROXY_HOPS,
  describeConfig,
} from './config';
import {
  createSession,
  createUser,
  deleteAllSessionsForUser,
  deleteSession,
  dummyVerify,
  findUserByEmail,
  findUserById,
  bearerToken,
  needsRehash,
  optionalAuth,
  passwordProblem,
  purgeExpiredSessions,
  requireAuth,
  toPublicUser,
  upgradePasswordHash,
  verifyPassword,
} from './auth';
import {
  addPoints,
  addTransaction,
  createVoucher,
  creditWallet,
  debitWallet,
  findIdempotentResponse,
  getPoints,
  getTransactions,
  getVouchers,
  getWallet,
  penceToPounds,
  poundsToPence,
  purgeOldIdempotencyKeys,
  recordCheckIn,
  redeemVoucherByCode,
  saveIdempotentResponse,
  spendPoints,
} from './store';
import { addReview, countRecentPointGrants, getAllRatings, getPubReviews, getRating, getUserRatings } from './reviews';
import { withTransaction } from './db';
import {
  asyncHandler,
  corsOptions,
  errorHandler,
  requestId,
  requireHttps,
  secretsMatch,
  securityHeaders,
} from './security';
import {
  globalLimiter,
  loginAccountLimiter,
  loginLimiter,
  signupLimiter,
  staffRedeemLimiter,
  writeLimiter,
} from './rateLimit';

const app = express();

// ---------------------------------------------------------------------------
// Baseline hardening — applied before any route can run
// ---------------------------------------------------------------------------

// Don't advertise the framework.
app.disable('x-powered-by');
// Only trust as many forwarding hops as are actually deployed; trusting more
// lets a client forge X-Forwarded-For and shed every per-IP rate limit.
app.set('trust proxy', TRUST_PROXY_HOPS);
// Reject ?a[b]=c style nesting outright rather than reviving qs quirks.
app.set('query parser', 'simple');

app.use(requestId);
app.use(securityHeaders);
app.use(requireHttps);
app.use(cors(corsOptions()));
app.use(
  express.json({
    limit: MAX_JSON_BODY_BYTES,
    // Only parse bodies that actually claim to be JSON.
    type: 'application/json',
    strict: true,
  }),
);
app.use(globalLimiter);

// ---------------------------------------------------------------------------
// Schemas
//
// Every object is strict: an unexpected field is a signal that the client and
// server disagree about the contract, and silently ignoring it is how mass
// assignment bugs start.
// ---------------------------------------------------------------------------

// Rejects control characters, which have no place in a display string and are
// the usual vehicle for log injection and terminal escape tricks.
const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F-\u009F]/;
const safeText = (max: number) =>
  z
    .string()
    .max(max)
    .refine((value) => !CONTROL_CHARACTERS.test(value), 'Contains control characters');

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .email();

// An id we hand back out or look up. Bounded and restricted to characters that
// cannot be confused for markup or a path segment.
const idSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9._:-]+$/, 'Invalid identifier');

const signupSchema = z
  .object({
    email: emailSchema,
    // The upper bound matters: scrypt cost scales with input, so an unbounded
    // password is a free CPU-exhaustion primitive on an unauthenticated route.
    password: z.string().min(MIN_PASSWORD_LENGTH).max(200),
    name: safeText(120).pipe(z.string().trim().min(1)),
  })
  .strict();

const loginSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1).max(200),
  })
  .strict();

const cartItemSchema = z
  .object({
    drinkId: idSchema,
    quantity: z.number().int().positive().max(12),
  })
  .strict();

const orderSchema = z
  .object({
    venueId: idSchema,
    items: z.array(cartItemSchema).min(1).max(20),
  })
  .strict();

const redemptionSchema = z.object({ rewardId: idSchema }).strict();

// Money arrives as pounds and must be a whole number of pence.
const topUpSchema = z
  .object({
    amount: z
      .number()
      .positive()
      .max(500)
      .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6, 'Amount must be in whole pence'),
  })
  .strict();

const checkInSchema = z.object({ venueId: idSchema }).strict();

const staffRedeemSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(4)
      .max(40)
      .regex(/^[A-Za-z0-9 -]+$/, 'Invalid code'),
  })
  .strict();

const reviewSchema = z
  .object({
    pubId: idSchema,
    rating: z.number().min(0.5).max(5).refine((v) => Math.round(v * 2) === v * 2, 'Must be a multiple of 0.5'),
    pubName: safeText(200).optional(),
    note: safeText(280).optional(),
  })
  .strict();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function badRequest(response: express.Response, message: string, error: z.ZodError): void {
  // Field names and the reason are useful to a legitimate client; the raw Zod
  // dump can echo submitted values (including a password) straight back, so it
  // is reduced to a path/message pair.
  const details = error.issues.slice(0, 20).map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));
  response.status(400).json({ error: message, details });
}

function clientIp(request: express.Request): string {
  return request.ip ?? request.socket.remoteAddress ?? 'unknown';
}

/** Reads and validates an optional idempotency key. */
function idempotencyKey(request: express.Request): string | null {
  const raw = request.header('x-idempotency-key');
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!/^[A-Za-z0-9._:-]{8,128}$/.test(trimmed)) return null;
  return trimmed;
}

/**
 * Runs a value-moving handler at most once per (user, endpoint, key).
 *
 * A retry after a timeout is indistinguishable from a second deliberate request,
 * so without this a flaky connection can double-charge a wallet. The recorded
 * response is replayed byte-for-byte, and storing it in the same transaction as
 * the effect keeps the two from diverging.
 */
function runIdempotent(
  request: express.Request,
  response: express.Response,
  endpoint: string,
  work: () => { status: number; body: unknown },
): void {
  const userId = request.userId!;
  const key = idempotencyKey(request);

  if (!key) {
    const result = work();
    response.status(result.status).json(result.body);
    return;
  }

  const outcome = withTransaction(() => {
    const replay = findIdempotentResponse(userId, endpoint, key);
    if (replay) return { status: replay.status, body: replay.body, replayed: true };
    const fresh = work();
    saveIdempotentResponse(userId, endpoint, key, fresh.status, fresh.body);
    return { ...fresh, replayed: false };
  });

  if (outcome.replayed) response.setHeader('Idempotent-Replay', 'true');
  response.status(outcome.status).json(outcome.body);
}

// Build the full per-user app state the mobile client loads on launch.
function buildAppState(userId: string) {
  const user = findUserById(userId)!;
  const wallet = getWallet(userId);
  return {
    user: { id: user.id, email: user.email },
    profile: toPublicUser(user),
    points: getPoints(userId),
    wallet: { cardLast4: wallet.cardLast4, balance: wallet.balance },
    transactions: getTransactions(userId),
    vouchers: getVouchers(userId),
    venues: getCatalog<Venue>('venues'),
    drinks: getCatalog<Drink>('drinks'),
    rewards: getCatalog<Reward>('rewards'),
    earningRules: getCatalog<EarningRule>('earning_rules'),
    tiers: getCatalog<Tier>('tiers'),
    // Passes and trips are per-user features with no data for a fresh account.
    passes: [] as unknown[],
    trips: [] as unknown[],
  };
}

app.get('/health', (_request, response) => {
  response.json({ ok: true, service: 'goodpint-api' });
});

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

app.post(
  '/api/auth/signup',
  signupLimiter,
  asyncHandler(async (request, response) => {
    const parsed = signupSchema.safeParse(request.body);
    if (!parsed.success) {
      badRequest(response, 'Invalid signup payload', parsed.error);
      return;
    }

    const { email, password, name } = parsed.data;

    const problem = passwordProblem(password, email, name);
    if (problem) {
      response.status(400).json({ error: problem });
      return;
    }

    if (findUserByEmail(email)) {
      // A signup form has to tell the user their email is taken, so this does
      // leak account existence. The mitigations are the signup rate limit above
      // and the fact that login reveals nothing further.
      response.status(409).json({ error: 'An account with that email already exists' });
      return;
    }

    const user = await createUser(email, password, name);
    const token = createSession(user.id);
    audit({ actor: 'user', userId: user.id, action: 'auth.signup', requestId: request.requestId, ip: clientIp(request) });
    response.status(201).json({ token, user: toPublicUser(user) });
  }),
);

app.post(
  '/api/auth/login',
  loginLimiter,
  loginAccountLimiter,
  asyncHandler(async (request, response) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      badRequest(response, 'Invalid login payload', parsed.error);
      return;
    }

    const { email, password } = parsed.data;
    const user = findUserByEmail(email);

    if (!user) {
      // Spend the same work as a real verification so response time does not
      // reveal whether the account exists.
      await dummyVerify(password);
      response.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const valid = await verifyPassword(password, user.password_hash, user.password_salt);
    if (!valid) {
      audit({
        actor: 'user',
        userId: user.id,
        action: 'auth.login_failed',
        requestId: request.requestId,
        ip: clientIp(request),
      });
      response.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    // Opportunistically move the stored hash to current parameters.
    if (needsRehash(user.password_hash)) {
      await upgradePasswordHash(user.id, password);
    }

    const token = createSession(user.id);
    audit({ actor: 'user', userId: user.id, action: 'auth.login', requestId: request.requestId, ip: clientIp(request) });
    response.json({ token, user: toPublicUser(findUserById(user.id)!) });
  }),
);

app.post('/api/auth/logout', requireAuth, (request, response) => {
  const token = bearerToken(request);
  if (token) deleteSession(token);
  response.json({ ok: true });
});

app.post('/api/auth/logout-all', requireAuth, (request, response) => {
  deleteAllSessionsForUser(request.userId!);
  audit({
    actor: 'user',
    userId: request.userId,
    action: 'auth.logout_all',
    requestId: request.requestId,
    ip: clientIp(request),
  });
  response.json({ ok: true });
});

app.get('/api/auth/me', requireAuth, (request, response) => {
  const user = findUserById(request.userId!);
  if (!user) {
    response.status(404).json({ error: 'User not found' });
    return;
  }
  response.json({ user: toPublicUser(user) });
});

// ---------------------------------------------------------------------------
// App state + catalog
// ---------------------------------------------------------------------------

app.get('/api/app-state', requireAuth, (request, response) => {
  response.json(buildAppState(request.userId!));
});

// Public catalog reads (no auth needed — same for everyone).
app.get('/api/venues', (_request, response) => {
  response.json(getCatalog<Venue>('venues'));
});

app.get('/api/rewards', (_request, response) => {
  response.json(getCatalog<Reward>('rewards'));
});

app.get('/api/vouchers', requireAuth, (request, response) => {
  response.json(getVouchers(request.userId!));
});

// ---------------------------------------------------------------------------
// Orders — spend wallet, earn points (drink points + 1pt per £ spent)
// ---------------------------------------------------------------------------

app.post('/api/orders', requireAuth, writeLimiter, (request, response) => {
  const parsed = orderSchema.safeParse(request.body);
  if (!parsed.success) {
    badRequest(response, 'Invalid order payload', parsed.error);
    return;
  }

  const userId = request.userId!;
  const venue = getCatalog<Venue>('venues').find((candidate) => candidate.id === parsed.data.venueId);
  if (!venue) {
    response.status(404).json({ error: 'Venue not found' });
    return;
  }

  // Collapse repeated drink ids so the per-item quantity cap cannot be bypassed
  // by listing the same drink twenty times.
  const quantities = new Map<string, number>();
  for (const item of parsed.data.items) {
    quantities.set(item.drinkId, (quantities.get(item.drinkId) ?? 0) + item.quantity);
  }

  const drinks = getCatalog<Drink>('drinks');
  let totalPence = 0;
  let drinkPoints = 0;
  for (const [drinkId, quantity] of quantities) {
    if (quantity > 12) {
      response.status(400).json({ error: `Quantity for ${drinkId} exceeds the per-order limit` });
      return;
    }
    const drink = drinks.find((candidate) => candidate.id === drinkId);
    if (!drink) {
      response.status(404).json({ error: `Drink not found: ${drinkId}` });
      return;
    }
    // Prices come from our own catalog, never from the request body — the client
    // sends what it wants, not what it costs.
    totalPence += poundsToPence(drink.price) * quantity;
    drinkPoints += drink.points * quantity;
  }

  if (totalPence <= 0) {
    response.status(400).json({ error: 'Order total must be greater than zero' });
    return;
  }

  runIdempotent(request, response, 'orders', () => {
    const remaining = debitWallet(userId, totalPence);
    if (remaining === null) {
      const wallet = getWallet(userId);
      return {
        status: 402,
        body: { error: 'Insufficient wallet balance', balance: wallet.balance, total: penceToPounds(totalPence) },
      };
    }

    // Earn drink points plus 1 point per whole pound spent.
    const pointsEarned = drinkPoints + Math.floor(totalPence / 100);
    const points = pointsEarned > 0 ? addPoints(userId, pointsEarned) : getPoints(userId);
    addTransaction(userId, venue.name, -totalPence);

    const orderId = crypto.randomUUID();
    audit({
      actor: 'user',
      userId,
      action: 'order.created',
      detail: { orderId, venueId: venue.id, totalPence, pointsEarned },
      requestId: request.requestId,
      ip: clientIp(request),
    });

    return {
      status: 201,
      body: {
        orderId,
        pickupWindow: venue.pickupWindow,
        total: penceToPounds(totalPence),
        pointsEarned,
        points,
        walletBalance: penceToPounds(remaining),
      },
    };
  });
});

// ---------------------------------------------------------------------------
// Redeem a reward → issue a voucher the pub can honour
// ---------------------------------------------------------------------------

app.post('/api/redeem', requireAuth, writeLimiter, (request, response) => {
  const parsed = redemptionSchema.safeParse(request.body);
  if (!parsed.success) {
    badRequest(response, 'Invalid redemption payload', parsed.error);
    return;
  }

  const userId = request.userId!;
  const reward = getCatalog<Reward>('rewards').find((candidate) => candidate.id === parsed.data.rewardId);
  if (!reward) {
    response.status(404).json({ error: 'Reward not found' });
    return;
  }

  runIdempotent(request, response, 'redeem', () => {
    // The cost check lives inside the deduction, so two simultaneous redemptions
    // cannot both see a sufficient balance and both issue a voucher.
    const points = spendPoints(userId, reward.points);
    if (points === null) {
      return {
        status: 402,
        body: { error: 'Not enough points', required: reward.points, points: getPoints(userId) },
      };
    }

    const voucher = createVoucher(userId, reward);
    addTransaction(userId, `Redeemed ${reward.title}`, 0);

    audit({
      actor: 'user',
      userId,
      action: 'reward.redeemed',
      detail: { rewardId: reward.id, voucherId: voucher.id, pointsSpent: reward.points },
      requestId: request.requestId,
      ip: clientIp(request),
    });

    return {
      status: 201,
      body: {
        redemptionId: voucher.id,
        reward,
        voucher,
        points,
        expiresAt: voucher.expiresAt,
      },
    };
  });
});

// ---------------------------------------------------------------------------
// Wallet
// ---------------------------------------------------------------------------

app.post('/api/wallet/top-up', requireAuth, writeLimiter, (request, response) => {
  // This endpoint credits a wallet with spendable money. Nothing in this
  // codebase authorises a payment, so in a real deployment it is a mint that any
  // authenticated user can operate. It stays available for local development and
  // is refused unless an operator has explicitly accepted that.
  if (!ALLOW_UNVERIFIED_TOPUPS) {
    response.status(501).json({
      error: 'Top-ups are unavailable: no payment provider is configured for this deployment.',
    });
    return;
  }

  const parsed = topUpSchema.safeParse(request.body);
  if (!parsed.success) {
    badRequest(response, 'Invalid top-up payload', parsed.error);
    return;
  }

  const userId = request.userId!;
  const amountPence = poundsToPence(parsed.data.amount);

  runIdempotent(request, response, 'wallet-top-up', () => {
    const balancePence = creditWallet(userId, amountPence);
    if (balancePence === null) {
      return { status: 409, body: { error: 'That top-up would exceed the maximum wallet balance' } };
    }
    addTransaction(userId, 'Wallet top up', amountPence);
    audit({
      actor: 'user',
      userId,
      action: 'wallet.topup',
      detail: { amountPence, unverified: true },
      requestId: request.requestId,
      ip: clientIp(request),
    });
    return { status: 201, body: { balance: penceToPounds(balancePence), points: getPoints(userId) } };
  });
});

// ---------------------------------------------------------------------------
// Check-ins
// ---------------------------------------------------------------------------

app.post('/api/check-ins', requireAuth, writeLimiter, (request, response) => {
  const parsed = checkInSchema.safeParse(request.body);
  if (!parsed.success) {
    badRequest(response, 'Invalid check-in payload', parsed.error);
    return;
  }

  const venue = getCatalog<Venue>('venues').find((candidate) => candidate.id === parsed.data.venueId);
  if (!venue) {
    response.status(404).json({ error: 'Venue not found' });
    return;
  }

  const userId = request.userId!;
  const result = recordCheckIn(userId, venue.id, 25);

  if (!result.ok) {
    if (result.reason === 'cooldown') {
      const minutes = Math.ceil(result.retryAfterMs / 60_000);
      response.setHeader('Retry-After', String(Math.ceil(result.retryAfterMs / 1000)));
      response.status(429).json({
        error: `You have already checked in here recently. Try again in about ${minutes} minute${minutes === 1 ? '' : 's'}.`,
        points: getPoints(userId),
      });
      return;
    }
    response.status(429).json({
      error: `Daily check-in point limit reached (${CHECK_IN_DAILY_POINT_CAP} points).`,
      points: getPoints(userId),
    });
    return;
  }

  audit({
    actor: 'user',
    userId,
    action: 'checkin.created',
    detail: { venueId: venue.id, pointsAwarded: result.pointsAwarded },
    requestId: request.requestId,
    ip: clientIp(request),
  });

  response.status(201).json({ points: result.points, pointsEarned: result.pointsAwarded, venue });
});

// ---------------------------------------------------------------------------
// Staff: redeem (mark used) a voucher by code. Guarded by a shared staff key.
// ---------------------------------------------------------------------------

/**
 * Authenticates a till.
 *
 * When STAFF_KEYS is configured each venue has its own key, so one leaked till
 * credential cannot redeem vouchers across the whole estate. The venue id is not
 * a secret, so looking the key up by it leaks nothing; the key itself is then
 * compared in constant time.
 */
function authenticateStaff(request: express.Request): { ok: true; venueId: string | null } | { ok: false } {
  const presented = request.header('x-staff-key');
  if (!presented) return { ok: false };

  if (STAFF_KEYS.size > 0) {
    const venueId = request.header('x-venue-id')?.trim();
    if (venueId) {
      const expected = STAFF_KEYS.get(venueId);
      if (expected && secretsMatch(presented, expected)) return { ok: true, venueId };
      return { ok: false };
    }
    // No venue named — accept any configured key, but record which one matched.
    for (const [id, expected] of STAFF_KEYS) {
      if (secretsMatch(presented, expected)) return { ok: true, venueId: id };
    }
    return { ok: false };
  }

  if (STAFF_KEY && secretsMatch(presented, STAFF_KEY)) return { ok: true, venueId: null };
  return { ok: false };
}

app.post('/api/staff/redeem', staffRedeemLimiter, (request, response) => {
  const staff = authenticateStaff(request);
  if (!staff.ok) {
    audit({
      actor: 'staff',
      action: 'staff.auth_failed',
      requestId: request.requestId,
      ip: clientIp(request),
    });
    response.status(401).json({ error: 'Invalid staff key' });
    return;
  }

  const parsed = staffRedeemSchema.safeParse(request.body);
  if (!parsed.success) {
    badRequest(response, 'Invalid payload', parsed.error);
    return;
  }

  const result = redeemVoucherByCode(parsed.data.code);
  if (result.ok) {
    audit({
      actor: 'staff',
      action: 'voucher.redeemed',
      detail: { voucherId: result.voucher.id, venueId: staff.venueId },
      requestId: request.requestId,
      ip: clientIp(request),
    });
    response.json({ ok: true, voucher: result.voucher });
    return;
  }

  audit({
    actor: 'staff',
    action: 'voucher.redeem_rejected',
    detail: { reason: result.reason, venueId: staff.venueId },
    requestId: request.requestId,
    ip: clientIp(request),
  });

  const status = result.reason === 'not_found' ? 404 : 409;
  response.status(status).json({ ok: false, reason: result.reason, voucher: result.voucher });
});

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------

/** Points granted for a first review, and the most a user can farm per day. */
const REVIEW_POINTS = 25;
const REVIEW_DAILY_GRANT_CAP = 4;
/**
 * Most pubs one account may review for the first time per day.
 *
 * Separate from the points cap: even with no bonus on offer, each new pub id
 * adds a row to the unauthenticated GET /api/reviews/ratings response, and pub
 * ids are arbitrary client-supplied strings.
 */
const REVIEW_DAILY_NEW_CAP = 30;

// All pub ratings as a map keyed by pub id — used to annotate the nearby list.
app.get('/api/reviews/ratings', (_request, response) => {
  response.json(getAllRatings());
});

// The signed-in user's own ratings, keyed by pub id.
//
// This used to take the user id from a query parameter, which let anyone read
// anyone else's rating history — effectively a list of which pubs an account has
// visited. The acting user now comes from the session and nothing else.
app.get('/api/reviews/user-ratings', requireAuth, (request, response) => {
  response.json(getUserRatings(request.userId!));
});

// Written reviews for a pub, newest first.
app.get('/api/reviews/:pubId/reviews', optionalAuth, (request, response) => {
  const pubId = idSchema.safeParse(request.params.pubId);
  if (!pubId.success) {
    response.status(400).json({ error: 'Invalid pub id' });
    return;
  }
  response.json(getPubReviews(pubId.data, request.userId ?? null));
});

// Single pub rating summary.
app.get('/api/reviews/:pubId', (request, response) => {
  const pubId = idSchema.safeParse(request.params.pubId);
  if (!pubId.success) {
    response.status(400).json({ error: 'Invalid pub id' });
    return;
  }
  response.json(getRating(pubId.data));
});

// Leave a review for a pub; returns the recomputed average + count. Requires auth
// so the review is tied to the signed-in user and points are awarded to them.
app.post('/api/reviews', requireAuth, writeLimiter, (request, response) => {
  const parsed = reviewSchema.safeParse(request.body);
  if (!parsed.success) {
    badRequest(response, 'Invalid review payload', parsed.error);
    return;
  }

  const userId = request.userId!;

  // Pub ids come from OpenStreetMap, not our catalog, so "one bonus per pub" is
  // not a limit an attacker respects — they can invent ids indefinitely. A daily
  // cap on granted bonuses is what actually bounds the faucet.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const awardPoints = countRecentPointGrants(userId, since) < REVIEW_DAILY_GRANT_CAP;

  const { summary, pointsAwarded, rejected } = addReview(
    parsed.data.pubId,
    userId,
    parsed.data.rating,
    parsed.data.pubName,
    parsed.data.note,
    { awardPoints, maxNewPerDay: REVIEW_DAILY_NEW_CAP },
  );

  if (rejected === 'daily_new_limit') {
    response.status(429).json({
      error: `You can review up to ${REVIEW_DAILY_NEW_CAP} new pubs per day. Try again tomorrow.`,
    });
    return;
  }

  const points = pointsAwarded ? addPoints(userId, REVIEW_POINTS) : getPoints(userId);

  if (pointsAwarded) {
    audit({
      actor: 'user',
      userId,
      action: 'review.points_awarded',
      detail: { pubId: parsed.data.pubId, pointsAwarded: REVIEW_POINTS },
      requestId: request.requestId,
      ip: clientIp(request),
    });
  }

  response.status(201).json({ pubId: parsed.data.pubId, ...summary, points });
});

// ---------------------------------------------------------------------------
// Fallbacks
// ---------------------------------------------------------------------------

app.use((_request, response) => {
  response.status(404).json({ error: 'Route not found' });
});

// Must be last: converts anything thrown above into a safe response.
app.use(errorHandler);

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

const server = app.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`GoodPint API listening on http://${HOST}:${PORT}`);
  // eslint-disable-next-line no-console
  console.log('[config]', describeConfig());
});

// Slow-loris protection: a client cannot hold a connection open indefinitely
// while dribbling out headers.
server.headersTimeout = 20_000;
server.requestTimeout = 30_000;
server.keepAliveTimeout = 10_000;

// Expired sessions and spent idempotency keys accumulate forever otherwise.
const cleanupTimer = setInterval(
  () => {
    try {
      purgeExpiredSessions();
      purgeOldIdempotencyKeys();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[cleanup] failed', error);
    }
  },
  60 * 60 * 1000,
);
cleanupTimer.unref?.();

// A crash mid-request must not leave the process running in an unknown state,
// and a rejected promise must never be silently discarded.
process.on('unhandledRejection', (reason) => {
  // eslint-disable-next-line no-console
  console.error('[fatal] unhandled promise rejection', reason);
});

process.on('uncaughtException', (error) => {
  // eslint-disable-next-line no-console
  console.error('[fatal] uncaught exception', error);
  server.close(() => process.exit(1));
  // Don't wait forever for in-flight requests to drain.
  setTimeout(() => process.exit(1), 5_000).unref();
});

function shutdown(signal: string): void {
  // eslint-disable-next-line no-console
  console.log(`[lifecycle] ${signal} received, shutting down`);
  server.close(() => {
    try {
      sqlite.close();
    } catch {
      // Already closed.
    }
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

if (NODE_ENV !== 'production') {
  // eslint-disable-next-line no-console
  console.log('[config] running in', NODE_ENV, 'mode');
}
