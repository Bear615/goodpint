import { sqlite } from './db';

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS reviews (
    id         TEXT PRIMARY KEY,
    pub_id     TEXT NOT NULL,
    pub_name   TEXT,
    rating     INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_reviews_pub ON reviews (pub_id);
`);

// Migration 1: add user_id column if missing.
try {
  sqlite.exec(`ALTER TABLE reviews ADD COLUMN user_id TEXT`);
  sqlite.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_user_pub ON reviews (pub_id, user_id) WHERE user_id IS NOT NULL`);
} catch {
  // Column already exists — nothing to do.
}

// Migration 2: upgrade rating column to REAL and allow half-stars (0.5 minimum).
const schemaSql = (sqlite.prepare(
  `SELECT sql FROM sqlite_master WHERE type='table' AND name='reviews'`,
).get() as { sql: string } | undefined)?.sql ?? '';
if (schemaSql.includes('BETWEEN 1 AND 5')) {
  sqlite.exec(`
    BEGIN;
    CREATE TABLE reviews_new (
      id         TEXT PRIMARY KEY,
      pub_id     TEXT NOT NULL,
      user_id    TEXT,
      pub_name   TEXT,
      rating     REAL NOT NULL CHECK (rating BETWEEN 0.5 AND 5),
      created_at TEXT NOT NULL
    );
    INSERT INTO reviews_new SELECT id, pub_id, user_id, pub_name, CAST(rating AS REAL), created_at FROM reviews;
    DROP TABLE reviews;
    ALTER TABLE reviews_new RENAME TO reviews;
    CREATE INDEX IF NOT EXISTS idx_reviews_pub ON reviews (pub_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_user_pub ON reviews (pub_id, user_id) WHERE user_id IS NOT NULL;
    COMMIT;
  `);
}

// Migration 3: add note column for written reviews if missing.
try {
  sqlite.exec(`ALTER TABLE reviews ADD COLUMN note TEXT`);
} catch {
  // Column already exists — nothing to do.
}

const existsStmt = sqlite.prepare(
  `SELECT id FROM reviews WHERE pub_id = ? AND user_id = ? LIMIT 1`,
);
const insertStmt = sqlite.prepare(
  `INSERT INTO reviews (id, pub_id, user_id, pub_name, rating, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
);
const updateStmt = sqlite.prepare(
  `UPDATE reviews SET rating = ?, pub_name = COALESCE(?, pub_name), note = ?, created_at = ? WHERE pub_id = ? AND user_id = ?`,
);
const pubReviewsStmt = sqlite.prepare(
  `SELECT id, user_id, pub_name, rating, note, created_at FROM reviews WHERE pub_id = ? ORDER BY created_at DESC`,
);
const summaryStmt = sqlite.prepare(
  `SELECT COUNT(*) AS count, AVG(rating) AS average FROM reviews WHERE pub_id = ?`,
);
const allSummaryStmt = sqlite.prepare(
  `SELECT pub_id, COUNT(*) AS count, AVG(rating) AS average FROM reviews GROUP BY pub_id`,
);
const userRatingsStmt = sqlite.prepare(
  `SELECT pub_id, rating FROM reviews WHERE user_id = ?`,
);

export interface RatingSummary {
  average: number;
  count: number;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function addReview(
  pubId: string,
  userId: string,
  rating: number,
  pubName?: string,
  note?: string,
): { summary: RatingSummary; isNew: boolean } {
  const existing = existsStmt.get(pubId, userId) as { id: string } | undefined;
  const isNew = !existing;

  if (isNew) {
    insertStmt.run(crypto.randomUUID(), pubId, userId, pubName ?? null, rating, note ?? null, new Date().toISOString());
  } else {
    updateStmt.run(rating, pubName ?? null, note ?? null, new Date().toISOString(), pubId, userId);
  }

  return { summary: getRating(pubId), isNew };
}

export interface PubReview {
  id: string;
  userId: string | null;
  pubName: string | null;
  rating: number;
  note: string | null;
  createdAt: string;
}

export function getPubReviews(pubId: string): PubReview[] {
  const rows = pubReviewsStmt.all(pubId) as Array<{
    id: string;
    user_id: string | null;
    pub_name: string | null;
    rating: number;
    note: string | null;
    created_at: string;
  }>;
  return rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    pubName: row.pub_name,
    rating: row.rating,
    note: row.note,
    createdAt: row.created_at,
  }));
}

export function getRating(pubId: string): RatingSummary {
  const row = summaryStmt.get(pubId) as { count: number; average: number | null };
  return {
    count: row.count,
    average: row.average == null ? 0 : round1(row.average),
  };
}

export function getAllRatings(): Record<string, RatingSummary> {
  const rows = allSummaryStmt.all() as Array<{ pub_id: string; count: number; average: number | null }>;
  const map: Record<string, RatingSummary> = {};
  for (const row of rows) {
    map[row.pub_id] = { count: row.count, average: row.average == null ? 0 : round1(row.average) };
  }
  return map;
}

export function getUserRatings(userId: string): Record<string, number> {
  const rows = userRatingsStmt.all(userId) as Array<{ pub_id: string; rating: number }>;
  const map: Record<string, number> = {};
  for (const row of rows) {
    map[row.pub_id] = row.rating;
  }
  return map;
}
