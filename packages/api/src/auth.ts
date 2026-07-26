import crypto from 'node:crypto';
import { promisify } from 'node:util';
import type { NextFunction, Request, Response } from 'express';
import { sqlite } from './db';
import {
  MAX_SESSIONS_PER_USER,
  MIN_PASSWORD_LENGTH,
  SESSION_ABSOLUTE_TTL_MS,
  SESSION_IDLE_TTL_MS,
} from './config';

const scrypt = promisify(crypto.scrypt) as (
  password: crypto.BinaryLike,
  salt: crypto.BinaryLike,
  keylen: number,
  options: crypto.ScryptOptions,
) => Promise<Buffer>;

// ---------------------------------------------------------------------------
// Passwords
//
// scrypt, run asynchronously so hashing happens on the libuv threadpool rather
// than stalling the event loop for every other in-flight request. Parameters
// are stored alongside the digest so they can be raised later without
// invalidating existing passwords.
// ---------------------------------------------------------------------------

const SCRYPT_KEYLEN = 64;
const CURRENT_PARAMS = { N: 32_768, r: 8, p: 1 } as const;
// scrypt needs roughly 128 * N * r bytes; give the call explicit headroom so it
// fails loudly on a memory-starved host instead of silently degrading.
const SCRYPT_MAXMEM = 128 * CURRENT_PARAMS.N * CURRENT_PARAMS.r * 3;

interface ScryptParams {
  N: number;
  r: number;
  p: number;
}

function encodeHash(params: ScryptParams, salt: string, derived: Buffer): string {
  return `scrypt$N=${params.N},r=${params.r},p=${params.p}$${salt}$${derived.toString('hex')}`;
}

interface ParsedHash {
  params: ScryptParams;
  salt: string;
  digest: Buffer;
}

/**
 * Understands both the current self-describing format and the original layout,
 * where the digest was bare hex and the salt lived in its own column.
 */
function parseHash(stored: string, legacySalt: string): ParsedHash | null {
  if (stored.startsWith('scrypt$')) {
    const [, rawParams, salt, hex] = stored.split('$');
    if (!rawParams || !salt || !hex) return null;
    const params: ScryptParams = { N: 0, r: 0, p: 0 };
    for (const pair of rawParams.split(',')) {
      const [key, value] = pair.split('=');
      const parsed = Number(value);
      if (!Number.isInteger(parsed) || parsed <= 0) return null;
      if (key === 'N') params.N = parsed;
      else if (key === 'r') params.r = parsed;
      else if (key === 'p') params.p = parsed;
    }
    if (!params.N || !params.r || !params.p) return null;
    return { params, salt, digest: Buffer.from(hex, 'hex') };
  }

  // Legacy rows: 64-byte digest in hex, default scrypt cost, salt in its column.
  if (!/^[0-9a-f]+$/i.test(stored) || !legacySalt) return null;
  return { params: { N: 16_384, r: 8, p: 1 }, salt: legacySalt, digest: Buffer.from(stored, 'hex') };
}

export async function hashPassword(password: string): Promise<{ hash: string; salt: string }> {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = await scrypt(password, salt, SCRYPT_KEYLEN, { ...CURRENT_PARAMS, maxmem: SCRYPT_MAXMEM });
  return { hash: encodeHash(CURRENT_PARAMS, salt, derived), salt };
}

export async function verifyPassword(password: string, storedHash: string, storedSalt: string): Promise<boolean> {
  const parsed = parseHash(storedHash, storedSalt);
  if (!parsed) return false;

  const maxmem = 128 * parsed.params.N * parsed.params.r * 3;
  let candidate: Buffer;
  try {
    candidate = await scrypt(password, parsed.salt, parsed.digest.length, { ...parsed.params, maxmem });
  } catch {
    return false;
  }

  if (candidate.length !== parsed.digest.length) return false;
  return crypto.timingSafeEqual(candidate, parsed.digest);
}

/** True when a stored hash was produced with weaker parameters than we now use. */
export function needsRehash(storedHash: string): boolean {
  if (!storedHash.startsWith('scrypt$')) return true;
  const parsed = parseHash(storedHash, '');
  if (!parsed) return true;
  return parsed.params.N < CURRENT_PARAMS.N || parsed.params.r < CURRENT_PARAMS.r || parsed.params.p < CURRENT_PARAMS.p;
}

/**
 * Burns the same work as a real verification. Called when no account matches, so
 * response time cannot be used to enumerate which emails are registered.
 */
export async function dummyVerify(password: string): Promise<void> {
  try {
    await scrypt(password, 'timing-equalisation-salt', SCRYPT_KEYLEN, {
      ...CURRENT_PARAMS,
      maxmem: SCRYPT_MAXMEM,
    });
  } catch {
    // Nothing to report — this call exists only to consume time.
  }
}

// ---------------------------------------------------------------------------
// Password policy
// ---------------------------------------------------------------------------

// Passwords that show up at the top of every breach corpus. A full blocklist
// belongs in a data file (or a k-anonymity lookup against a breach API); this
// catches the worst offenders without a network dependency.
const BANNED_PASSWORDS = new Set([
  'password', 'password1', 'password123', '12345678', '123456789', '1234567890',
  'qwertyuiop', 'letmein123', 'iloveyou', 'admin123', 'welcome1', 'welcome123',
  'football', 'baseball', 'sunshine', 'princess', 'passw0rd', 'trustno1',
  'goodpint', 'goodpint1', 'goodpint123', 'changeme', 'secret123',
]);

export function passwordProblem(password: string, email: string, name: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  const normalized = password.toLowerCase();
  if (BANNED_PASSWORDS.has(normalized)) {
    return 'That password is too common. Please choose something less guessable.';
  }
  const localPart = email.split('@')[0]?.toLowerCase() ?? '';
  if (localPart.length >= 3 && normalized.includes(localPart)) {
    return 'Password must not contain your email address.';
  }
  const trimmedName = name.trim().toLowerCase();
  if (trimmedName.length >= 3 && normalized.includes(trimmedName)) {
    return 'Password must not contain your name.';
  }
  if (/^(.)\1+$/.test(password)) {
    return 'Password must not be a single repeated character.';
  }
  return null;
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  password_salt: string;
  name: string;
  handle: string | null;
  avatar_url: string | null;
  favorite_style: string | null;
  home_area: string | null;
  points: number;
  wallet_balance: number;
  card_last4: string | null;
  joined_at: string;
  created_at: string;
}

// The user shape returned to clients — never includes the password hash/salt.
export interface PublicUser {
  id: string;
  email: string;
  name: string;
  handle: string;
  joinedLabel: string;
  avatarUrl: string;
  favoriteStyle: string;
  homeArea: string;
}

export function toPublicUser(row: UserRow): PublicUser {
  const joinedYear = new Date(row.joined_at).getFullYear();
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    handle: row.handle ?? '',
    joinedLabel: Number.isFinite(joinedYear) ? `Member since ${joinedYear}` : 'Member',
    avatarUrl: row.avatar_url ?? '',
    favoriteStyle: row.favorite_style ?? '',
    homeArea: row.home_area ?? '',
  };
}

const insertUserStmt = sqlite.prepare(`
  INSERT INTO users (id, email, password_hash, password_salt, name, handle, avatar_url, favorite_style, home_area, points, wallet_balance, card_last4, joined_at, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, NULL, ?, ?)
`);
const findByEmailStmt = sqlite.prepare(`SELECT * FROM users WHERE email = ?`);
const findByIdStmt = sqlite.prepare(`SELECT * FROM users WHERE id = ?`);
const updateCredentialsStmt = sqlite.prepare(`UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?`);

export function findUserByEmail(email: string): UserRow | undefined {
  return findByEmailStmt.get(email.toLowerCase()) as UserRow | undefined;
}

export function findUserById(id: string): UserRow | undefined {
  return findByIdStmt.get(id) as UserRow | undefined;
}

// Default avatar so new profiles aren't blank; derived deterministically from email.
function defaultAvatar(email: string): string {
  const seed = encodeURIComponent(email.split('@')[0] || 'pint');
  return `https://api.dicebear.com/7.x/initials/png?seed=${seed}`;
}

function defaultHandle(email: string): string {
  const local = (email.split('@')[0] || 'member').replace(/[^a-z0-9._-]/gi, '');
  return `@${local.toLowerCase()}`;
}

export async function createUser(email: string, password: string, name: string): Promise<UserRow> {
  const normalizedEmail = email.toLowerCase();
  const { hash, salt } = await hashPassword(password);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  insertUserStmt.run(
    id,
    normalizedEmail,
    hash,
    salt,
    name,
    defaultHandle(normalizedEmail),
    defaultAvatar(normalizedEmail),
    null,
    null,
    now,
    now,
  );
  return findUserById(id)!;
}

/** Re-hashes a valid password under current parameters after a successful sign-in. */
export async function upgradePasswordHash(userId: string, password: string): Promise<void> {
  const { hash, salt } = await hashPassword(password);
  updateCredentialsStmt.run(hash, salt, userId);
}

// ---------------------------------------------------------------------------
// Sessions
//
// The bearer token is 256 bits of randomness and is shown to the client exactly
// once. Only its SHA-256 is persisted, so a leaked database file — a backup, a
// stray copy, an injection read primitive — yields no usable session. Because
// the token is uniformly random there is nothing to brute-force, so a plain
// hash (rather than a slow KDF) is the right tool here.
// ---------------------------------------------------------------------------

const insertSessionStmt = sqlite.prepare(
  `INSERT INTO sessions (token, user_id, created_at, expires_at, last_used_at) VALUES (?, ?, ?, ?, ?)`,
);
const findSessionStmt = sqlite.prepare(
  `SELECT user_id, expires_at, last_used_at FROM sessions WHERE token = ?`,
);
const deleteSessionStmt = sqlite.prepare(`DELETE FROM sessions WHERE token = ?`);
const deleteUserSessionsStmt = sqlite.prepare(`DELETE FROM sessions WHERE user_id = ?`);
const touchSessionStmt = sqlite.prepare(`UPDATE sessions SET last_used_at = ? WHERE token = ?`);
const purgeExpiredStmt = sqlite.prepare(`DELETE FROM sessions WHERE expires_at < ?`);
const trimUserSessionsStmt = sqlite.prepare(`
  DELETE FROM sessions
  WHERE user_id = ?
    AND token NOT IN (SELECT token FROM sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?)
`);

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

export function createSession(userId: string): string {
  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  insertSessionStmt.run(
    hashToken(token),
    userId,
    new Date(now).toISOString(),
    new Date(now + SESSION_ABSOLUTE_TTL_MS).toISOString(),
    new Date(now).toISOString(),
  );
  // Keep a bounded number of live sessions per account so an attacker who
  // briefly held credentials cannot leave an unbounded set of footholds.
  trimUserSessionsStmt.run(userId, userId, MAX_SESSIONS_PER_USER);
  return token;
}

export function deleteSession(token: string): void {
  deleteSessionStmt.run(hashToken(token));
}

/** Signs the account out everywhere. Use after a credential change. */
export function deleteAllSessionsForUser(userId: string): void {
  deleteUserSessionsStmt.run(userId);
}

export function purgeExpiredSessions(): number {
  const result = purgeExpiredStmt.run(new Date().toISOString());
  return Number(result.changes ?? 0);
}

// Writing last_used_at on every request would be a write per API call; a coarse
// threshold keeps idle-expiry accurate to within a few minutes at a fraction of
// the write volume.
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

function userIdForToken(token: string): string | null {
  const tokenHash = hashToken(token);
  const row = findSessionStmt.get(tokenHash) as
    | { user_id: string; expires_at: string; last_used_at: string | null }
    | undefined;
  if (!row) return null;

  const now = Date.now();

  // Absolute expiry: the session is simply too old.
  if (new Date(row.expires_at).getTime() < now) {
    deleteSessionStmt.run(tokenHash);
    return null;
  }

  // Idle expiry: unused long enough that an abandoned device stops being a risk.
  const lastUsed = row.last_used_at ? new Date(row.last_used_at).getTime() : now;
  if (Number.isFinite(lastUsed) && now - lastUsed > SESSION_IDLE_TTL_MS) {
    deleteSessionStmt.run(tokenHash);
    return null;
  }

  if (!Number.isFinite(lastUsed) || now - lastUsed > TOUCH_INTERVAL_MS) {
    touchSessionStmt.run(new Date(now).toISOString(), tokenHash);
  }

  return row.user_id;
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

/**
 * Pulls the bearer token out of the Authorization header. The token is fixed
 * length hex, so anything else is rejected before it reaches the database.
 */
export function bearerToken(request: Request): string | null {
  const header = request.header('authorization');
  if (!header) return null;
  const match = /^Bearer\s+([0-9a-f]{64})\s*$/i.exec(header);
  return match ? match[1].toLowerCase() : null;
}

export function requireAuth(request: Request, response: Response, next: NextFunction): void {
  const token = bearerToken(request);
  const userId = token ? userIdForToken(token) : null;
  if (!userId) {
    response.status(401).json({ error: 'Authentication required' });
    return;
  }
  request.userId = userId;
  next();
}

/**
 * Populates request.userId when a valid token is present but never rejects.
 * Lets a public endpoint tailor its response to the caller — for example,
 * marking which review is their own — without exposing identifiers to everyone.
 */
export function optionalAuth(request: Request, _response: Response, next: NextFunction): void {
  const token = bearerToken(request);
  const userId = token ? userIdForToken(token) : null;
  if (userId) request.userId = userId;
  next();
}
