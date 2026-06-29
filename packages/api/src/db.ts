import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { drinks, earningRules, rewards, tiers, venues } from './data';

// Single shared SQLite connection for the whole API process. Other modules
// (reviews.ts, auth.ts, index.ts) import `sqlite` from here rather than opening
// their own handle, so everything reads/writes the same file.
const dbPath = process.env.GOODPINT_DB_PATH ?? path.join(process.cwd(), 'goodpint.db');

export const sqlite = new DatabaseSync(dbPath);

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
`);

// Seed catalog tables once. INSERT OR IGNORE keeps this idempotent across reboots
// and never clobbers edits a pub might make to their own catalog rows later.
function seedCatalog(table: string, rows: Array<{ id: string }>): void {
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

function catalogStmt(table: string): ReturnType<typeof sqlite.prepare> {
  let stmt = catalogStmts.get(table);
  if (!stmt) {
    stmt = sqlite.prepare(`SELECT data FROM ${table} ORDER BY sort_order ASC`);
    catalogStmts.set(table, stmt);
  }
  return stmt;
}

// Read a catalog table back as typed records.
export function getCatalog<T>(table: 'venues' | 'drinks' | 'rewards' | 'earning_rules' | 'tiers'): T[] {
  const rows = catalogStmt(table).all() as Array<{ data: string }>;
  return rows.map((row) => JSON.parse(row.data) as T);
}
