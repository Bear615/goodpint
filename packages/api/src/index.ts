import crypto from 'node:crypto';
import cors from 'cors';
import express from 'express';
import { z } from 'zod';
import type { Drink, EarningRule, Reward, Tier, Venue } from './data';
import { getCatalog } from './db';
import {
  createSession,
  createUser,
  deleteSession,
  findUserByEmail,
  findUserById,
  requireAuth,
  toPublicUser,
  verifyPassword,
} from './auth';
import {
  addPoints,
  addTransaction,
  adjustWallet,
  createVoucher,
  getPoints,
  getTransactions,
  getVouchers,
  getWallet,
  redeemVoucherByCode,
  spendPoints,
} from './store';
import { addReview, getAllRatings, getPubReviews, getRating, getUserRatings } from './reviews';

const app = express();
const port = Number(process.env.PORT ?? 4000);
// Shared secret a pub's till/staff app presents to redeem vouchers. Override in prod.
const STAFF_KEY = process.env.STAFF_KEY ?? 'goodpint-staff-dev';

app.use(cors());
app.use(express.json());

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(200),
  name: z.string().min(1).max(120),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(200),
});

const cartItemSchema = z.object({
  drinkId: z.string().min(1),
  quantity: z.number().int().positive().max(12),
});

const orderSchema = z.object({
  venueId: z.string().min(1),
  items: z.array(cartItemSchema).min(1),
});

const redemptionSchema = z.object({
  rewardId: z.string().min(1),
});

const topUpSchema = z.object({
  amount: z.number().positive().max(500),
});

const checkInSchema = z.object({
  venueId: z.string().min(1),
});

const staffRedeemSchema = z.object({
  code: z.string().min(1).max(40),
});

const reviewSchema = z.object({
  pubId: z.string().min(1),
  rating: z.number().min(0.5).max(5).refine((v) => Math.round(v * 2) === v * 2, 'Must be a multiple of 0.5'),
  pubName: z.string().min(1).max(200).optional(),
  note: z.string().max(280).optional(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

app.post('/api/auth/signup', (request, response) => {
  const parsed = signupSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: 'Invalid signup payload', details: parsed.error.flatten() });
    return;
  }

  if (findUserByEmail(parsed.data.email)) {
    response.status(409).json({ error: 'An account with that email already exists' });
    return;
  }

  const user = createUser(parsed.data.email, parsed.data.password, parsed.data.name);
  const token = createSession(user.id);
  response.status(201).json({ token, user: toPublicUser(user) });
});

app.post('/api/auth/login', (request, response) => {
  const parsed = loginSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: 'Invalid login payload', details: parsed.error.flatten() });
    return;
  }

  const user = findUserByEmail(parsed.data.email);
  if (!user || !verifyPassword(parsed.data.password, user.password_hash, user.password_salt)) {
    response.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  const token = createSession(user.id);
  response.json({ token, user: toPublicUser(user) });
});

app.post('/api/auth/logout', requireAuth, (request, response) => {
  const header = request.header('authorization');
  const token = header ? /^Bearer\s+(.+)$/i.exec(header)?.[1] : undefined;
  if (token) deleteSession(token);
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

app.post('/api/orders', requireAuth, (request, response) => {
  const parsed = orderSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: 'Invalid order payload', details: parsed.error.flatten() });
    return;
  }

  const userId = request.userId!;
  const venue = getCatalog<Venue>('venues').find((candidate) => candidate.id === parsed.data.venueId);
  if (!venue) {
    response.status(404).json({ error: 'Venue not found' });
    return;
  }

  const drinks = getCatalog<Drink>('drinks');
  let total = 0;
  let drinkPoints = 0;
  for (const item of parsed.data.items) {
    const drink = drinks.find((candidate) => candidate.id === item.drinkId);
    if (!drink) {
      response.status(404).json({ error: `Drink not found: ${item.drinkId}` });
      return;
    }
    total += drink.price * item.quantity;
    drinkPoints += drink.points * item.quantity;
  }
  total = Number(total.toFixed(2));

  const wallet = getWallet(userId);
  if (wallet.balance < total) {
    response.status(402).json({ error: 'Insufficient wallet balance', balance: wallet.balance, total });
    return;
  }

  // Earn drink points plus 1 point per whole pound spent.
  const pointsEarned = drinkPoints + Math.floor(total);
  const walletBalance = adjustWallet(userId, -total);
  const points = addPoints(userId, pointsEarned);
  addTransaction(userId, venue.name, -total);

  response.status(201).json({
    orderId: crypto.randomUUID(),
    pickupWindow: venue.pickupWindow,
    total,
    pointsEarned,
    points,
    walletBalance,
  });
});

// ---------------------------------------------------------------------------
// Redeem a reward → issue a voucher the pub can honour
// ---------------------------------------------------------------------------

app.post('/api/redeem', requireAuth, (request, response) => {
  const parsed = redemptionSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: 'Invalid redemption payload', details: parsed.error.flatten() });
    return;
  }

  const userId = request.userId!;
  const reward = getCatalog<Reward>('rewards').find((candidate) => candidate.id === parsed.data.rewardId);
  if (!reward) {
    response.status(404).json({ error: 'Reward not found' });
    return;
  }

  if (getPoints(userId) < reward.points) {
    response.status(402).json({ error: 'Not enough points', required: reward.points, points: getPoints(userId) });
    return;
  }

  const points = spendPoints(userId, reward.points);
  const voucher = createVoucher(userId, reward);
  addTransaction(userId, `Redeemed ${reward.title}`, 0);

  response.status(201).json({
    redemptionId: voucher.id,
    reward,
    voucher,
    points,
    expiresAt: voucher.expiresAt,
  });
});

app.post('/api/wallet/top-up', requireAuth, (request, response) => {
  const parsed = topUpSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: 'Invalid top-up payload', details: parsed.error.flatten() });
    return;
  }

  const userId = request.userId!;
  const balance = adjustWallet(userId, parsed.data.amount);
  addTransaction(userId, 'Wallet top up', parsed.data.amount);
  response.status(201).json({ balance, points: getPoints(userId) });
});

app.post('/api/check-ins', requireAuth, (request, response) => {
  const parsed = checkInSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: 'Invalid check-in payload', details: parsed.error.flatten() });
    return;
  }

  const venue = getCatalog<Venue>('venues').find((candidate) => candidate.id === parsed.data.venueId);
  if (!venue) {
    response.status(404).json({ error: 'Venue not found' });
    return;
  }

  const pointsEarned = 25;
  const points = addPoints(request.userId!, pointsEarned);
  response.status(201).json({ points, pointsEarned, venue });
});

// ---------------------------------------------------------------------------
// Staff: redeem (mark used) a voucher by code. Guarded by a shared staff key.
// ---------------------------------------------------------------------------

app.post('/api/staff/redeem', (request, response) => {
  if (request.header('x-staff-key') !== STAFF_KEY) {
    response.status(401).json({ error: 'Invalid staff key' });
    return;
  }

  const parsed = staffRedeemSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
    return;
  }

  const result = redeemVoucherByCode(parsed.data.code);
  if (result.ok) {
    response.json({ ok: true, voucher: result.voucher });
    return;
  }

  const status = result.reason === 'not_found' ? 404 : 409;
  response.status(status).json({ ok: false, reason: result.reason, voucher: result.voucher });
});

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------

// All pub ratings as a map keyed by pub id — used to annotate the nearby list.
app.get('/api/reviews/ratings', (_request, response) => {
  response.json(getAllRatings());
});

// This user's ratings — keyed by pub id, value is their star count.
app.get('/api/reviews/user-ratings', (request, response) => {
  const userId = request.query['userId'];
  if (typeof userId !== 'string' || !userId) {
    response.status(400).json({ error: 'userId query param required' });
    return;
  }
  response.json(getUserRatings(userId));
});

// Written reviews for a pub, newest first.
app.get('/api/reviews/:pubId/reviews', (request, response) => {
  response.json(getPubReviews(request.params.pubId));
});

// Single pub rating summary.
app.get('/api/reviews/:pubId', (request, response) => {
  response.json(getRating(request.params.pubId));
});

// Leave a review for a pub; returns the recomputed average + count. Requires auth
// so the review is tied to the signed-in user and points are awarded to them.
app.post('/api/reviews', requireAuth, (request, response) => {
  const parsed = reviewSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: 'Invalid review payload', details: parsed.error.flatten() });
    return;
  }

  const userId = request.userId!;
  const { summary, isNew } = addReview(parsed.data.pubId, userId, parsed.data.rating, parsed.data.pubName, parsed.data.note);
  const points = isNew ? addPoints(userId, 25) : getPoints(userId); // points only on first review

  response.status(201).json({ pubId: parsed.data.pubId, ...summary, points });
});

app.use((_request, response) => {
  response.status(404).json({ error: 'Route not found' });
});

app.listen(port, () => {
  console.log(`GoodPint API listening on http://localhost:${port}`);
});
