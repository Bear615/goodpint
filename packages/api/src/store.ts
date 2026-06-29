import crypto from 'node:crypto';
import { sqlite } from './db';

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

export interface ClientTransaction {
  id: string;
  title: string;
  amount: number;
  timestamp: string;
}

const insertTxStmt = sqlite.prepare(`INSERT INTO transactions (id, user_id, title, amount, created_at) VALUES (?, ?, ?, ?, ?)`);
const listTxStmt = sqlite.prepare(`SELECT id, title, amount, created_at FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`);

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

export function addTransaction(userId: string, title: string, amount: number): void {
  insertTxStmt.run(crypto.randomUUID(), userId, title, amount, new Date().toISOString());
}

export function getTransactions(userId: string): ClientTransaction[] {
  const rows = listTxStmt.all(userId) as Array<{ id: string; title: string; amount: number; created_at: string }>;
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    amount: row.amount,
    timestamp: friendlyTimestamp(row.created_at),
  }));
}

// ---------------------------------------------------------------------------
// Points & wallet
// ---------------------------------------------------------------------------

const addPointsStmt = sqlite.prepare(`UPDATE users SET points = points + ? WHERE id = ?`);
const spendPointsStmt = sqlite.prepare(`UPDATE users SET points = points - ? WHERE id = ?`);
const adjustWalletStmt = sqlite.prepare(`UPDATE users SET wallet_balance = ROUND(wallet_balance + ?, 2) WHERE id = ?`);
const pointsStmt = sqlite.prepare(`SELECT points FROM users WHERE id = ?`);
const walletStmt = sqlite.prepare(`SELECT wallet_balance, card_last4 FROM users WHERE id = ?`);

export function getPoints(userId: string): number {
  const row = pointsStmt.get(userId) as { points: number } | undefined;
  return row?.points ?? 0;
}

export function addPoints(userId: string, delta: number): number {
  addPointsStmt.run(delta, userId);
  return getPoints(userId);
}

export function spendPoints(userId: string, amount: number): number {
  spendPointsStmt.run(amount, userId);
  return getPoints(userId);
}

export function getWallet(userId: string): { balance: number; cardLast4: string } {
  const row = walletStmt.get(userId) as { wallet_balance: number; card_last4: string | null } | undefined;
  return { balance: row?.wallet_balance ?? 0, cardLast4: row?.card_last4 ?? '' };
}

export function adjustWallet(userId: string, delta: number): number {
  adjustWalletStmt.run(delta, userId);
  return getWallet(userId).balance;
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
const redeemVoucherStmt = sqlite.prepare(`UPDATE vouchers SET status = 'redeemed', redeemed_at = ? WHERE code = ? AND status = 'active'`);

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

// Short, human-readable, hard-to-mistype code (no 0/O/1/I).
function generateCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(8);
  let out = '';
  for (let i = 0; i < 8; i += 1) out += alphabet[bytes[i] % alphabet.length];
  return `${out.slice(0, 4)}-${out.slice(4)}`;
}

const VOUCHER_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days to use a redeemed reward

export function createVoucher(userId: string, reward: { id: string; title: string; points: number }): Voucher {
  const now = Date.now();
  // Retry on the astronomically unlikely code collision.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateCode();
    if (findVoucherByCodeStmt.get(code)) continue;
    const id = crypto.randomUUID();
    insertVoucherStmt.run(
      id,
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
  const row = findVoucherByCodeStmt.get(code.toUpperCase()) as unknown as VoucherRow | undefined;
  return row ? toVoucher(row) : undefined;
}

// Staff-side redemption: marks an active voucher used. Returns the updated
// voucher, or a reason it could not be redeemed.
export function redeemVoucherByCode(code: string):
  | { ok: true; voucher: Voucher }
  | { ok: false; reason: 'not_found' | 'already_redeemed' | 'expired'; voucher?: Voucher } {
  const normalized = code.toUpperCase();
  const existing = findVoucherByCode(normalized);
  if (!existing) return { ok: false, reason: 'not_found' };
  if (existing.status === 'redeemed') return { ok: false, reason: 'already_redeemed', voucher: existing };
  if (existing.expiresAt && new Date(existing.expiresAt).getTime() < Date.now()) {
    return { ok: false, reason: 'expired', voucher: existing };
  }
  redeemVoucherStmt.run(new Date().toISOString(), normalized);
  return { ok: true, voucher: findVoucherByCode(normalized)! };
}
