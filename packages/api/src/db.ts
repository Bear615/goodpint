import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { drinks, earningRules, rewards, tiers, venues } from './data';
import { DB_PATH } from './config';

// Single shared SQLite connection for the whole API process. Other modules
// (reviews.ts, auth.ts, store.ts, index.ts) import `sqlite` from here rather
// than opening their own handle, so everything reads/writes the same file.
export const sqlite = new DatabaseSync(DB_PATH);

// Enforce declared foreign keys and use a write-ahead log so a reader never
// observes a half-applied money transfer.
sqlite.exec(`PRAGMA foreign_keys = ON;`);
sqlite.exec(`PRAGMA journal_mode = WAL;`);
// Wait rather than fail when another process holds the write lock.
sqlite.exec(`PRAGMA busy_timeout = 5000;`);

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    email         TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    name          TEXT NOT NULL,
    handle        TEXT,
    avatar_url    TEXT,
    favorite_style TEXT,
    home_area     TEXT,
    points        INTEGER NOT NULL DEFAULT 0,
    wallet_balance REAL NOT NULL DEFAULT 0,
    card_last4    TEXT,
    joined_at     TEXT NOT NULL,
    created_at    TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token      TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id);

  CREATE TABLE IF NOT EXISTS transactions (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL,
    title      TEXT NOT NULL,
    amount     REAL NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions (user_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS vouchers (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL,
    reward_id   TEXT NOT NULL,
    title       TEXT NOT NULL,
    code        TEXT UNIQUE NOT NULL,
    points_spent INTEGER NOT NULL,
    status      TEXT NOT NULL DEFAULT 'active',
    created_at  TEXT NOT NULL,
    expires_at  TEXT,
    redeemed_at TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_vouchers_user ON vouchers (user_id, created_at DESC);

  -- Catalog tables. Each row stores its full record as JSON in the data column,
  -- with sort_order preserving the seed ordering for stable list rendering.
  CREATE TABLE IF NOT EXISTS venues       (id TEXT PRIMARY KEY, sort_order INTEGER NOT NULL, data TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS drinks       (id TEXT PRIMARY KEY, sort_order INTEGER NOT NULL, data TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS rewards      (id TEXT PRIMARY KEY, sort_order INTEGER NOT NULL, data TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS earning_rules(id TEXT PRIMARY KEY, sort_order INTEGER NOT NULL, data TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS tiers        (id TEXT PRIMARY KEY, sort_order INTEGER NOT NULL, data TEXT NOT NULL);

  -- Check-ins are a points faucet, so each one is recorded and rate limited
  -- against history rather than trusted to be occasional.
  CREATE TABLE IF NOT EXISTS check_ins (
    id             TEXT PRIMARY KEY,
    user_id        TEXT NOT NULL,
    venue_id       TEXT NOT NULL,
    points_awarded INTEGER NOT NULL,
    created_at     TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_check_ins_user_venue ON check_ins (user_id, venue_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_check_ins_user_time ON check_ins (user_id, created_at DESC);

  -- Replayed requests (a retry over a flaky mobile connection) must not charge
  -- or credit twice, so the first response is stored and replayed verbatim.
  CREATE TABLE IF NOT EXISTS idempotency_keys (
    user_id     TEXT NOT NULL,
    endpoint    TEXT NOT NULL,
    key         TEXT NOT NULL,
    status_code INTEGER NOT NULL,
    response    TEXT NOT NULL,
    created_at  TEXT NOT NULL,
    PRIMARY KEY (user_id, endpoint, key)
  );
  CREATE INDEX IF NOT EXISTS idx_idempotency_created ON idempotency_keys (created_at);

  -- Append-only trail for every movement of points or money. Without this there
  -- is no way to answer "where did this balance come from" after an incident.
  CREATE TABLE IF NOT EXISTS audit_log (
    id         TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    actor      TEXT NOT NULL,
    user_id    TEXT,
    action     TEXT NOT NULL,
    detail     TEXT,
    request_id TEXT,
    ip         TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_audit_user_time ON audit_log (user_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_audit_action_time ON audit_log (action, created_at DESC);
`);

// ---------------------------------------------------------------------------
// Migrations
// ---------------------------------------------------------------------------

function columnNames(table: string): Set<string> {
  const rows = sqlite.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return new Set(rows.map((row) => row.name));
}

function addColumn(table: string, definition: string, column: string): boolean {
  if (columnNames(table).has(column)) return false;
  sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
  return true;
}

// Migration: track session activity so idle sessions can expire, not just old ones.
addColumn('sessions', 'last_used_at TEXT', 'last_used_at');

// Migration: session tokens are now stored as SHA-256 digests rather than in the
// clear. The original plaintext rows cannot be converted without re-reading
// secrets we deliberately no longer keep, and any token that was stored in the
// clear must be treated as disclosed — so they are dropped and those clients
// sign in again. A token is 64 hex chars either way; the marker row below
// records that the migration has run.
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    name       TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL
  );
`);

function runOnce(name: string, migrate: () => void): void {
  const done = sqlite.prepare(`SELECT 1 FROM schema_migrations WHERE name = ?`).get(name);
  if (done) return;
  migrate();
  sqlite.prepare(`INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)`).run(name, new Date().toISOString());
}

runOnce('2024-sessions-hashed-tokens', () => {
  sqlite.exec(`DELETE FROM sessions`);
});

// Migration: money moves to integer pence.
//
// Binary floating point cannot represent most decimal money values exactly, so
// repeated credits and debits accumulate drift and comparisons like
// "balance >= total" can disagree with what the user was shown. Every amount is
// now an integer number of pence internally; the HTTP layer still speaks
// pounds, so the client contract is unchanged.
runOnce('2024-money-in-pence', () => {
  if (!columnNames('users').has('wallet_balance_pence')) {
    sqlite.exec(`ALTER TABLE users ADD COLUMN wallet_balance_pence INTEGER NOT NULL DEFAULT 0`);
    sqlite.exec(`UPDATE users SET wallet_balance_pence = CAST(ROUND(wallet_balance * 100) AS INTEGER)`);
  }
  if (!columnNames('transactions').has('amount_pence')) {
    sqlite.exec(`ALTER TABLE transactions ADD COLUMN amount_pence INTEGER NOT NULL DEFAULT 0`);
    sqlite.exec(`UPDATE transactions SET amount_pence = CAST(ROUND(amount * 100) AS INTEGER)`);
  }
});

// Defensive: if the marker table was created on a database that already had the
// columns added by a prior boot, make sure they exist regardless.
addColumn('users', 'wallet_balance_pence INTEGER NOT NULL DEFAULT 0', 'wallet_balance_pence');
addColumn('transactions', 'amount_pence INTEGER NOT NULL DEFAULT 0', 'amount_pence');

// A balance is never allowed below zero. SQLite cannot add a CHECK constraint to
// an existing table, so the invariant is enforced by the conditional UPDATE in
// store.ts; this trigger is the backstop that catches any future code path that
// tries to bypass it.
sqlite.exec(`
  CREATE TRIGGER IF NOT EXISTS trg_users_no_negative_balance
  BEFORE UPDATE OF wallet_balance_pence ON users
  FOR EACH ROW WHEN NEW.wallet_balance_pence < 0
  BEGIN
    SELECT RAISE(ABORT, 'wallet balance may not go negative');
  END;

  CREATE TRIGGER IF NOT EXISTS trg_users_no_negative_points
  BEFORE UPDATE OF points ON users
  FOR EACH ROW WHEN NEW.points < 0
  BEGIN
    SELECT RAISE(ABORT, 'points may not go negative');
  END;
`);

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

/**
 * Runs `work` inside an immediate write transaction.
 *
 * node:sqlite is synchronous, so a handler that never awaits between reading a
 * balance and writing it is already safe from interleaving within this process.
 * That is an easy invariant to break by accident — one added `await` reopens the
 * window — and it does not hold at all once a second process shares the file.
 * Wrapping the critical section makes the guarantee explicit and durable, and
 * BEGIN IMMEDIATE takes the write lock up front so two writers cannot both read,
 * both decide they can afford it, and then fight over the commit.
 *
 * `work` must stay synchronous; that is what makes the section indivisible.
 */
export function withTransaction<T>(work: () => T): T {
  sqlite.exec('BEGIN IMMEDIATE');
  try {
    const result = work();
    sqlite.exec('COMMIT');
    return result;
  } catch (error) {
    try {
      sqlite.exec('ROLLBACK');
    } catch {
      // Rollback can fail if the transaction already ended; the original error
      // is the one worth surfacing.
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

// Seed catalog tables once. INSERT OR IGNORE keeps this idempotent across reboots
// and never clobbers edits a pub might make to their own catalog rows later.
const CATALOG_TABLES = ['venues', 'drinks', 'rewards', 'earning_rules', 'tiers'] as const;
export type CatalogTable = (typeof CATALOG_TABLES)[number];

function assertCatalogTable(table: string): asserts table is CatalogTable {
  if (!(CATALOG_TABLES as readonly string[]).includes(table)) {
    throw new Error(`Unknown catalog table: ${table}`);
  }
}

function seedCatalog(table: CatalogTable, rows: Array<{ id: string }>): void {
  assertCatalogTable(table);
  const stmt = sqlite.prepare(`INSERT OR IGNORE INTO ${table} (id, sort_order, data) VALUES (?, ?, ?)`);
  rows.forEach((row, index) => {
    stmt.run(row.id, index, JSON.stringify(row));
  });
}

seedCatalog('venues', venues);
seedCatalog('drinks', drinks);
seedCatalog('rewards', rewards);
seedCatalog('earning_rules', earningRules);
seedCatalog('tiers', tiers);

const catalogStmts = new Map<string, ReturnType<typeof sqlite.prepare>>();

function catalogStmt(table: CatalogTable): ReturnType<typeof sqlite.prepare> {
  // The table name is interpolated rather than bound — SQLite cannot bind an
  // identifier — so it is checked against the fixed allowlist first. Every
  // current caller passes a literal, but the assertion is what guarantees a
  // future caller cannot turn this into SQL injection.
  assertCatalogTable(table);
  let stmt = catalogStmts.get(table);
  if (!stmt) {
    stmt = sqlite.prepare(`SELECT data FROM ${table} ORDER BY sort_order ASC`);
    catalogStmts.set(table, stmt);
  }
  return stmt;
}

// Read a catalog table back as typed records.
export function getCatalog<T>(table: CatalogTable): T[] {
  const rows = catalogStmt(table).all() as Array<{ data: string }>;
  return rows.map((row) => JSON.parse(row.data) as T);
}

// ---------------------------------------------------------------------------
// Audit trail
// ---------------------------------------------------------------------------

const insertAuditStmt = sqlite.prepare(
  `INSERT INTO audit_log (id, created_at, actor, user_id, action, detail, request_id, ip) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
);

export interface AuditEntry {
  actor: 'user' | 'staff' | 'system';
  userId?: string | null;
  action: string;
  detail?: Record<string, unknown>;
  requestId?: string | null;
  ip?: string | null;
}

/** Records a value-affecting event. Never throws into the request path. */
export function audit(entry: AuditEntry): void {
  try {
    insertAuditStmt.run(
      crypto.randomUUID(),
      new Date().toISOString(),
      entry.actor,
      entry.userId ?? null,
      entry.action,
      entry.detail ? JSON.stringify(entry.detail) : null,
      entry.requestId ?? null,
      entry.ip ?? null,
    );
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[audit] failed to record entry', entry.action, error);
  }
}
