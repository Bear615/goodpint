import crypto from 'node:crypto';
import { sqlite, withTransaction } from './db';
import { CHECK_IN_COOLDOWN_MS, CHECK_IN_DAILY_POINT_CAP } from './config';

// ---------------------------------------------------------------------------
// Money
//
// Every internal amount is an integer number of pence. Floating point cannot
// represent most decimal money values exactly, so a REAL balance drifts as it is
// credited and debited, and a comparison like "balance >= total" can disagree
// with the figure the user was shown. The HTTP layer still speaks pounds.
// ---------------------------------------------------------------------------

/** Largest balance or single amount we will represent, in pence (£1,000,000). */
const MAX_PENCE = 100_000_000;

export function poundsToPence(pounds: number): number {
  if (!Number.isFinite(pounds)) throw new RangeError('Amount must be a finite number');
  const pence = Math.round(pounds * 100);
  if (!Number.isSafeInteger(pence)) throw new RangeError('Amount is out of range');
  return pence;
}

export function penceToPounds(pence: number): number {
  return Math.round(pence) / 100;
}

// ---------------------------------------------------------------------------
// Transaction history
// ---------------------------------------------------------------------------

export interface ClientTransaction {
  id: string;
  title: string;
  amount: number;
  timestamp: string;
}

const insertTxStmt = sqlite.prepare(
  `INSERT INTO transactions (id, user_id, title, amount, amount_pence, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
);
const listTxStmt = sqlite.prepare(
  `SELECT id, title, amount_pence, created_at FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`,
);

function friendlyTimestamp(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const time = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(date);
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) return `Today, ${time}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return `Yesterday, ${time}`;
  const day = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: '2-digit', month: 'short' }).format(date);
  return `${day}, ${time}`;
}

export function addTransaction(userId: string, title: string, amountPence: number): void {
  // `amount` is kept in sync for any reader still on the pounds column.
  insertTxStmt.run(
    crypto.randomUUID(),
    userId,
    title,
    penceToPounds(amountPence),
    amountPence,
    new Date().toISOString(),
  );
}

export function getTransactions(userId: string): ClientTransaction[] {
  const rows = listTxStmt.all(userId) as Array<{
    id: string;
    title: string;
    amount_pence: number;
    created_at: string;
  }>;
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    amount: penceToPounds(row.amount_pence),
    timestamp: friendlyTimestamp(row.created_at),
  }));
}

// ---------------------------------------------------------------------------
// Points & wallet
//
// Every mutation is a single conditional UPDATE whose WHERE clause carries the
// invariant, and every caller checks the affected-row count. A balance can
// therefore never be driven negative, and no read-then-write window exists for
// two concurrent requests to slip through.
// ---------------------------------------------------------------------------

const addPointsStmt = sqlite.prepare(`UPDATE users SET points = points + ? WHERE id = ?`);
const spendPointsStmt = sqlite.prepare(`UPDATE users SET points = points - ? WHERE id = ? AND points >= ?`);
const creditWalletStmt = sqlite.prepare(
  `UPDATE users SET wallet_balance_pence = wallet_balance_pence + ?, wallet_balance = ROUND((wallet_balance_pence + ?) / 100.0, 2) WHERE id = ? AND wallet_balance_pence + ? <= ?`,
);
const debitWalletStmt = sqlite.prepare(
  `UPDATE users SET wallet_balance_pence = wallet_balance_pence - ?, wallet_balance = ROUND((wallet_balance_pence - ?) / 100.0, 2) WHERE id = ? AND wallet_balance_pence >= ?`,
);
const pointsStmt = sqlite.prepare(`SELECT points FROM users WHERE id = ?`);
const walletStmt = sqlite.prepare(`SELECT wallet_balance_pence, card_last4 FROM users WHERE id = ?`);

function changed(result: { changes?: number | bigint }): boolean {
  return Number(result.changes ?? 0) > 0;
}

export function getPoints(userId: string): number {
  const row = pointsStmt.get(userId) as { points: number } | undefined;
  return row?.points ?? 0;
}

function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive whole number`);
  }
}

export function addPoints(userId: string, delta: number): number {
  assertPositiveInteger(delta, 'Points');
  addPointsStmt.run(delta, userId);
  return getPoints(userId);
}

/**
 * Deducts points only if the balance covers them. Returns null when it does not,
 * so the caller must handle the shortfall rather than silently going negative.
 */
export function spendPoints(userId: string, amount: number): number | null {
  assertPositiveInteger(amount, 'Points');
  const result = spendPointsStmt.run(amount, userId, amount);
  return changed(result) ? getPoints(userId) : null;
}

export function getWallet(userId: string): { balancePence: number; balance: number; cardLast4: string } {
  const row = walletStmt.get(userId) as { wallet_balance_pence: number; card_last4: string | null } | undefined;
  const balancePence = row?.wallet_balance_pence ?? 0;
  return { balancePence, balance: penceToPounds(balancePence), cardLast4: row?.card_last4 ?? '' };
}

/** Adds funds. Returns null if the credit would exceed the maximum balance. */
export function creditWallet(userId: string, pence: number): number | null {
  assertPositiveInteger(pence, 'Amount');
  const result = creditWalletStmt.run(pence, pence, userId, pence, MAX_PENCE);
  return changed(result) ? getWallet(userId).balancePence : null;
}

/** Removes funds only if the balance covers them. Returns null if it does not. */
export function debitWallet(userId: string, pence: number): number | null {
  assertPositiveInteger(pence, 'Amount');
  const result = debitWalletStmt.run(pence, pence, userId, pence);
  return changed(result) ? getWallet(userId).balancePence : null;
}

// ---------------------------------------------------------------------------
// Vouchers (redeemed rewards a pub can honour)
// ---------------------------------------------------------------------------

export interface Voucher {
  id: string;
  rewardId: string;
  title: string;
  code: string;
  pointsSpent: number;
  status: 'active' | 'redeemed' | 'expired';
  createdAt: string;
  expiresAt: string | null;
  redeemedAt: string | null;
}

const insertVoucherStmt = sqlite.prepare(`
  INSERT INTO vouchers (id, user_id, reward_id, title, code, points_spent, status, created_at, expires_at, redeemed_at)
  VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, NULL)
`);
const listVouchersStmt = sqlite.prepare(`SELECT * FROM vouchers WHERE user_id = ? ORDER BY created_at DESC`);
const findVoucherByCodeStmt = sqlite.prepare(`SELECT * FROM vouchers WHERE code = ?`);
const redeemVoucherStmt = sqlite.prepare(`
  UPDATE vouchers SET status = 'redeemed', redeemed_at = ?
  WHERE code = ? AND status = 'active' AND (expires_at IS NULL OR expires_at > ?)
`);

interface VoucherRow {
  id: string;
  user_id: string;
  reward_id: string;
  title: string;
  code: string;
  points_spent: number;
  status: 'active' | 'redeemed' | 'expired';
  created_at: string;
  expires_at: string | null;
  redeemed_at: string | null;
}

function toVoucher(row: VoucherRow): Voucher {
  return {
    id: row.id,
    rewardId: row.reward_id,
    title: row.title,
    code: row.code,
    pointsSpent: row.points_spent,
    status: row.status,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    redeemedAt: row.redeemed_at,
  };
}

// Short, human-readable, hard-to-mistype code (no 0/O/1/I). Twelve characters
// from a 32-symbol alphabet is 60 bits of entropy: guessing one at the till is
// not a realistic attack even before the endpoint's rate limit applies.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 12;

function generateCode(): string {
  let out = '';
  // Rejection sampling keeps every symbol equally likely; taking a raw byte
  // modulo 32 happens to be uniform here, but the guard means the alphabet can
  // change later without quietly biasing the codes.
  while (out.length < CODE_LENGTH) {
    for (const byte of crypto.randomBytes(CODE_LENGTH)) {
      if (byte >= 256 - (256 % CODE_ALPHABET.length)) continue;
      out += CODE_ALPHABET[byte % CODE_ALPHABET.length];
      if (out.length === CODE_LENGTH) break;
    }
  }
  return `${out.slice(0, 4)}-${out.slice(4, 8)}-${out.slice(8)}`;
}

/** Accepts a code as typed: any case, stray spaces, dashes optional. */
export function normalizeCode(code: string): string {
  const bare = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (bare.length === CODE_LENGTH) return `${bare.slice(0, 4)}-${bare.slice(4, 8)}-${bare.slice(8)}`;
  // Legacy 8-character codes issued before the length increase.
  if (bare.length === 8) return `${bare.slice(0, 4)}-${bare.slice(4)}`;
  return code.trim().toUpperCase();
}

const VOUCHER_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days to use a redeemed reward

export function createVoucher(userId: string, reward: { id: string; title: string; points: number }): Voucher {
  const now = Date.now();
  // Retry on the astronomically unlikely code collision.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateCode();
    if (findVoucherByCodeStmt.get(code)) continue;
    insertVoucherStmt.run(
      crypto.randomUUID(),
      userId,
      reward.id,
      reward.title,
      code,
      reward.points,
      new Date(now).toISOString(),
      new Date(now + VOUCHER_TTL_MS).toISOString(),
    );
    return toVoucher(findVoucherByCodeStmt.get(code) as unknown as VoucherRow);
  }
  throw new Error('Could not generate a unique voucher code');
}

export function getVouchers(userId: string): Voucher[] {
  return (listVouchersStmt.all(userId) as unknown as VoucherRow[]).map(toVoucher);
}

export function findVoucherByCode(code: string): Voucher | undefined {
  const row = findVoucherByCodeStmt.get(normalizeCode(code)) as unknown as VoucherRow | undefined;
  return row ? toVoucher(row) : undefined;
}

/**
 * Staff-side redemption: marks an active voucher used.
 *
 * The status check lives in the UPDATE's WHERE clause and success is decided by
 * the affected-row count, so exactly one caller can ever win. Reading the row
 * first and then updating would let two tills both see "active" and both hand
 * over a free drink.
 */
export function redeemVoucherByCode(code: string):
  | { ok: true; voucher: Voucher }
  | { ok: false; reason: 'not_found' | 'already_redeemed' | 'expired'; voucher?: Voucher } {
  const normalized = normalizeCode(code);

  return withTransaction(() => {
    const result = redeemVoucherStmt.run(new Date().toISOString(), normalized, new Date().toISOString());
    if (changed(result)) {
      return { ok: true as const, voucher: findVoucherByCode(normalized)! };
    }

    // Nothing was updated — work out why, for the message shown at the till.
    const existing = findVoucherByCode(normalized);
    if (!existing) return { ok: false as const, reason: 'not_found' as const };
    if (existing.status === 'redeemed') {
      return { ok: false as const, reason: 'already_redeemed' as const, voucher: existing };
    }
    return { ok: false as const, reason: 'expired' as const, voucher: existing };
  });
}

// ---------------------------------------------------------------------------
// Check-ins
//
// Check-ins mint points from nothing, so they are recorded and throttled against
// history. Without this an attacker loops one request and converts unlimited
// points into real rewards.
// ---------------------------------------------------------------------------

const lastCheckInStmt = sqlite.prepare(
  `SELECT created_at FROM check_ins WHERE user_id = ? AND venue_id = ? ORDER BY created_at DESC LIMIT 1`,
);
const dailyCheckInPointsStmt = sqlite.prepare(
  `SELECT COALESCE(SUM(points_awarded), 0) AS total FROM check_ins WHERE user_id = ? AND created_at > ?`,
);
const insertCheckInStmt = sqlite.prepare(
  `INSERT INTO check_ins (id, user_id, venue_id, points_awarded, created_at) VALUES (?, ?, ?, ?, ?)`,
);

export type CheckInResult =
  | { ok: true; points: number; pointsAwarded: number }
  | { ok: false; reason: 'cooldown'; retryAfterMs: number }
  | { ok: false; reason: 'daily_cap' };

export function recordCheckIn(userId: string, venueId: string, pointsAwarded: number): CheckInResult {
  return withTransaction(() => {
    const now = Date.now();

    const last = lastCheckInStmt.get(userId, venueId) as { created_at: string } | undefined;
    if (last) {
      const elapsed = now - new Date(last.created_at).getTime();
      if (Number.isFinite(elapsed) && elapsed < CHECK_IN_COOLDOWN_MS) {
        return { ok: false as const, reason: 'cooldown' as const, retryAfterMs: CHECK_IN_COOLDOWN_MS - elapsed };
      }
    }

    const since = new Date(now - 24 * 60 * 60 * 1000).toISOString();
    const { total } = dailyCheckInPointsStmt.get(userId, since) as { total: number };
    if (total + pointsAwarded > CHECK_IN_DAILY_POINT_CAP) {
      return { ok: false as const, reason: 'daily_cap' as const };
    }

    insertCheckInStmt.run(crypto.randomUUID(), userId, venueId, pointsAwarded, new Date(now).toISOString());
    const points = addPoints(userId, pointsAwarded);
    return { ok: true as const, points, pointsAwarded };
  });
}

// ---------------------------------------------------------------------------
// Idempotency
//
// A retry on a flaky mobile connection must not place a second order or take a
// second payment. The first response for a key is replayed verbatim.
// ---------------------------------------------------------------------------

const findIdempotencyStmt = sqlite.prepare(
  `SELECT status_code, response FROM idempotency_keys WHERE user_id = ? AND endpoint = ? AND key = ?`,
);
const insertIdempotencyStmt = sqlite.prepare(
  `INSERT OR IGNORE INTO idempotency_keys (user_id, endpoint, key, status_code, response, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
);
const purgeIdempotencyStmt = sqlite.prepare(`DELETE FROM idempotency_keys WHERE created_at < ?`);

export function findIdempotentResponse(
  userId: string,
  endpoint: string,
  key: string,
): { status: number; body: unknown } | undefined {
  const row = findIdempotencyStmt.get(userId, endpoint, key) as
    | { status_code: number; response: string }
    | undefined;
  if (!row) return undefined;
  try {
    return { status: row.status_code, body: JSON.parse(row.response) };
  } catch {
    return undefined;
  }
}

export function saveIdempotentResponse(
  userId: string,
  endpoint: string,
  key: string,
  status: number,
  body: unknown,
): void {
  insertIdempotencyStmt.run(userId, endpoint, key, status, JSON.stringify(body), new Date().toISOString());
}

/** Drops replay records older than the retention window. */
export function purgeOldIdempotencyKeys(maxAgeMs = 24 * 60 * 60 * 1000): number {
  const result = purgeIdempotencyStmt.run(new Date(Date.now() - maxAgeMs).toISOString());
  return Number(result.changes ?? 0);
}
