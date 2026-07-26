import crypto from 'node:crypto';
import { sqlite, withTransaction } from './db';

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

// Migration 4: record when a review earned points.
//
// A review's created_at is bumped whenever the review is edited, so it cannot
// tell us how many points a user has actually been granted recently. This
// column is written once, on the grant, and is what the daily cap counts.
try {
  sqlite.exec(`ALTER TABLE reviews ADD COLUMN points_awarded_at TEXT`);
  // Existing rows earned their points at creation time.
  sqlite.exec(`UPDATE reviews SET points_awarded_at = created_at WHERE points_awarded_at IS NULL`);
} catch {
  // Column already exists — nothing to do.
}

const existsStmt = sqlite.prepare(
  `SELECT id FROM reviews WHERE pub_id = ? AND user_id = ? LIMIT 1`,
);
const insertStmt = sqlite.prepare(
  `INSERT INTO reviews (id, pub_id, user_id, pub_name, rating, note, created_at, points_awarded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
);
const updateStmt = sqlite.prepare(
  `UPDATE reviews SET rating = ?, pub_name = COALESCE(?, pub_name), note = ?, created_at = ? WHERE pub_id = ? AND user_id = ?`,
);
const pubReviewsStmt = sqlite.prepare(
  `SELECT id, user_id, pub_name, rating, note, created_at FROM reviews WHERE pub_id = ? ORDER BY created_at DESC LIMIT 200`,
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
const recentGrantsStmt = sqlite.prepare(
  `SELECT COUNT(*) AS count FROM reviews WHERE user_id = ? AND points_awarded_at IS NOT NULL AND points_awarded_at > ?`,
);

export interface RatingSummary {
  average: number;
  count: number;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Number of reviews that have earned this user points since `since`.
 *
 * A pub id is just a string the client supplies (they come from OpenStreetMap,
 * not our catalog), so "one bonus per pub" is not a real limit — an attacker can
 * invent unlimited pub ids. This is what the daily cap is counted against.
 */
export function countRecentPointGrants(userId: string, sinceIso: string): number {
  const row = recentGrantsStmt.get(userId, sinceIso) as { count: number };
  return row.count;
}

export function addReview(
  pubId: string,
  userId: string,
  rating: number,
  pubName?: string,
  note?: string,
  options: { awardPoints?: boolean } = {},
): { summary: RatingSummary; isNew: boolean; pointsAwarded: boolean } {
  // The existence check and the write that depends on it are one unit: two
  // concurrent submissions must not both conclude "this is your first review
  // here" and both collect the bonus.
  return withTransaction(() => {
    const existing = existsStmt.get(pubId, userId) as { id: string } | undefined;
    const isNew = !existing;
    const now = new Date().toISOString();
    const pointsAwarded = isNew && options.awardPoints !== false;

    if (isNew) {
      insertStmt.run(
        crypto.randomUUID(),
        pubId,
        userId,
        pubName ?? null,
        rating,
        note ?? null,
        now,
        pointsAwarded ? now : null,
      );
    } else {
      updateStmt.run(rating, pubName ?? null, note ?? null, now, pubId, userId);
    }

    return { summary: getRating(pubId), isNew, pointsAwarded };
  });
}

export interface PubReview {
  id: string;
  pubName: string | null;
  rating: number;
  note: string | null;
  createdAt: string;
  /** True when this review belongs to the caller. */
  isMine: boolean;
}

/**
 * Reviews for a pub.
 *
 * Author identifiers are deliberately not returned. Emitting the raw user id on
 * a public endpoint would let anyone enumerate which pubs a given account has
 * visited and when — a location history. The client only ever needed to know
 * which review was its own, so that is the single bit we expose.
 */
export function getPubReviews(pubId: string, viewerId?: string | null): PubReview[] {
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
    pubName: row.pub_name,
    rating: row.rating,
    note: row.note,
    createdAt: row.created_at,
    isMine: viewerId != null && row.user_id === viewerId,
  }));
}

export function getRating(pubId: string): RatingSummary {
  const row = summaryStmt.get(pubId) as { count: number; average: number | null };
  return {
    count: row.count,
    average: row.average == null ? 0 : round1(row.average),
  };
}

// Pub ids are attacker-controlled strings used as keys here. On a plain object
// literal, assigning the key "__proto__" invokes the prototype setter instead of
// adding a property — the entry silently vanishes and the object's prototype is
// replaced. A null-prototype object has no such setter, so every id is stored as
// an ordinary key. JSON.stringify serialises these identically.
export function getAllRatings(): Record<string, RatingSummary> {
  const rows = allSummaryStmt.all() as Array<{ pub_id: string; count: number; average: number | null }>;
  const map = Object.create(null) as Record<string, RatingSummary>;
  for (const row of rows) {
    map[row.pub_id] = { count: row.count, average: row.average == null ? 0 : round1(row.average) };
  }
  return map;
}

export function getUserRatings(userId: string): Record<string, number> {
  const rows = userRatingsStmt.all(userId) as Array<{ pub_id: string; rating: number }>;
  const map = Object.create(null) as Record<string, number>;
  for (const row of rows) {
    map[row.pub_id] = row.rating;
  }
  return map;
}
