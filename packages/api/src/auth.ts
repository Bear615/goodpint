import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { sqlite } from './db';

// ---------------------------------------------------------------------------
// Passwords — scrypt with a per-user random salt. No external deps.
// ---------------------------------------------------------------------------

export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const candidate = crypto.scryptSync(password, salt, 64);
  const stored = Buffer.from(hash, 'hex');
  // timingSafeEqual throws if lengths differ — guard first.
  if (candidate.length !== stored.length) return false;
  return crypto.timingSafeEqual(candidate, stored);
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

export function createUser(email: string, password: string, name: string): UserRow {
  const normalizedEmail = email.toLowerCase();
  const { hash, salt } = hashPassword(password);
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

// ---------------------------------------------------------------------------
// Sessions — opaque random bearer tokens stored in SQLite.
// ---------------------------------------------------------------------------

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const insertSessionStmt = sqlite.prepare(`INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)`);
const findSessionStmt = sqlite.prepare(`SELECT user_id, expires_at FROM sessions WHERE token = ?`);
const deleteSessionStmt = sqlite.prepare(`DELETE FROM sessions WHERE token = ?`);

export function createSession(userId: string): string {
  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  insertSessionStmt.run(token, userId, new Date(now).toISOString(), new Date(now + SESSION_TTL_MS).toISOString());
  return token;
}

export function deleteSession(token: string): void {
  deleteSessionStmt.run(token);
}

function userIdForToken(token: string): string | null {
  const row = findSessionStmt.get(token) as { user_id: string; expires_at: string } | undefined;
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    deleteSession(token);
    return null;
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

function bearerToken(request: Request): string | null {
  const header = request.header('authorization');
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match ? match[1] : null;
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
