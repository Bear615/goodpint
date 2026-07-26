import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Imported for its side effects, and imported *first* by every test file:
// db.ts opens its connection at module load, so the database path has to be
// chosen before anything pulls that module in.
export const TEST_DB_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'goodpint-test-'));

process.env.NODE_ENV = 'test';
process.env.GOODPINT_DB_PATH = path.join(TEST_DB_DIR, 'test.db');

export function cleanupTestDb(): void {
  fs.rmSync(TEST_DB_DIR, { recursive: true, force: true });
}
