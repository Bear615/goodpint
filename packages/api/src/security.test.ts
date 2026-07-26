import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { after, describe, it } from 'node:test';

// Must come first: it picks the throwaway database path before db.ts opens its
// connection at module load.
import { cleanupTestDb } from './testEnv';

import { sqlite } from './db';
import {
  createSession,
  createUser,
  deleteAllSessionsForUser,
  deleteSession,
  hashPassword,
  needsRehash,
  passwordProblem,
  purgeExpiredSessions,
  verifyPassword,
} from './auth';
import {
  addPoints,
  createVoucher,
  creditWallet,
  debitWallet,
  findIdempotentResponse,
  getPoints,
  getWallet,
  normalizeCode,
  penceToPounds,
  poundsToPence,
  recordCheckIn,
  redeemVoucherByCode,
  saveIdempotentResponse,
  spendPoints,
} from './store';
import { addReview, getPubReviews } from './reviews';

let counter = 0;
async function makeUser(password = 'correct-horse-battery') {
  counter += 1;
  return createUser(`user${counter}-${crypto.randomUUID()}@example.com`, password, `User ${counter}`);
}

after(() => {
  try {
    sqlite.close();
  } catch {
    // Already closed.
  }
  cleanupTestDb();
});

// ---------------------------------------------------------------------------

describe('password hashing', () => {
  it('accepts the right password and rejects a wrong one', async () => {
    const { hash, salt } = await hashPassword('a-good-password');
    assert.equal(await verifyPassword('a-good-password', hash, salt), true);
    assert.equal(await verifyPassword('a-good-passworD', hash, salt), false);
    assert.equal(await verifyPassword('', hash, salt), false);
  });

  it('salts every hash, so identical passwords do not collide', async () => {
    const first = await hashPassword('same-password-twice');
    const second = await hashPassword('same-password-twice');
    assert.notEqual(first.hash, second.hash);
  });

  it('records its parameters so the cost can be raised later', async () => {
    const { hash } = await hashPassword('parameterised');
    assert.match(hash, /^scrypt\$N=\d+,r=\d+,p=\d+\$[0-9a-f]+\$[0-9a-f]+$/);
    assert.equal(needsRehash(hash), false);
  });

  it('still verifies hashes written in the original format, and flags them for upgrade', async () => {
    // What the previous implementation produced: bare hex, default scrypt cost,
    // salt stored in its own column.
    const salt = crypto.randomBytes(16).toString('hex');
    const legacy = crypto.scryptSync('legacy-password', salt, 64).toString('hex');

    assert.equal(await verifyPassword('legacy-password', legacy, salt), true);
    assert.equal(await verifyPassword('wrong', legacy, salt), false);
    assert.equal(needsRehash(legacy), true);
  });

  it('does not throw on a malformed stored hash', async () => {
    assert.equal(await verifyPassword('x', 'not-a-hash', ''), false);
    assert.equal(await verifyPassword('x', '', ''), false);
  });
});

describe('password policy', () => {
  it('rejects short, common, and self-referential passwords', () => {
    assert.ok(passwordProblem('short', 'sam@example.com', 'Sam'));
    assert.ok(passwordProblem('password123', 'sam@example.com', 'Sam'));
    assert.ok(passwordProblem('sam@example.com-hello', 'sam@example.com', 'Sam'));
    assert.ok(passwordProblem('aaaaaaaaaaaa', 'sam@example.com', 'Sam'));
    assert.equal(passwordProblem('brisk-otter-canyon-42', 'sam@example.com', 'Sam'), null);
  });
});

// ---------------------------------------------------------------------------

describe('sessions', () => {
  it('never stores the bearer token in the clear', async () => {
    const user = await makeUser();
    const token = createSession(user.id);

    const rows = sqlite.prepare('SELECT token FROM sessions WHERE user_id = ?').all(user.id) as Array<{
      token: string;
    }>;
    assert.equal(rows.length, 1);
    assert.notEqual(rows[0].token, token);
    assert.equal(rows[0].token, crypto.createHash('sha256').update(token, 'utf8').digest('hex'));
  });

  it('revokes a single session without touching the others', async () => {
    const user = await makeUser();
    const first = createSession(user.id);
    createSession(user.id);

    deleteSession(first);
    const remaining = sqlite.prepare('SELECT COUNT(*) AS n FROM sessions WHERE user_id = ?').get(user.id) as {
      n: number;
    };
    assert.equal(remaining.n, 1);
  });

  it('revokes every session for an account', async () => {
    const user = await makeUser();
    createSession(user.id);
    createSession(user.id);
    deleteAllSessionsForUser(user.id);

    const remaining = sqlite.prepare('SELECT COUNT(*) AS n FROM sessions WHERE user_id = ?').get(user.id) as {
      n: number;
    };
    assert.equal(remaining.n, 0);
  });

  it('purges expired rows rather than letting them accumulate', async () => {
    const user = await makeUser();
    const token = createSession(user.id);
    const hashed = crypto.createHash('sha256').update(token, 'utf8').digest('hex');
    sqlite
      .prepare('UPDATE sessions SET expires_at = ? WHERE token = ?')
      .run(new Date(Date.now() - 1000).toISOString(), hashed);

    assert.ok(purgeExpiredSessions() >= 1);
    assert.equal(sqlite.prepare('SELECT 1 FROM sessions WHERE token = ?').get(hashed), undefined);
  });
});

// ---------------------------------------------------------------------------

describe('wallet', () => {
  it('converts pounds to whole pence', () => {
    assert.equal(poundsToPence(12.34), 1234);
    assert.equal(poundsToPence(0.1), 10);
    assert.equal(penceToPounds(1234), 12.34);
  });

  it('does not drift over many small movements', async () => {
    const user = await makeUser();
    for (let i = 0; i < 100; i += 1) creditWallet(user.id, 10); // 100 x 10p
    assert.equal(getWallet(user.id).balancePence, 1000);
    assert.equal(getWallet(user.id).balance, 10);
  });

  it('refuses a debit larger than the balance and leaves it untouched', async () => {
    const user = await makeUser();
    creditWallet(user.id, 500);

    assert.equal(debitWallet(user.id, 501), null);
    assert.equal(getWallet(user.id).balancePence, 500);

    assert.equal(debitWallet(user.id, 500), 0);
    assert.equal(getWallet(user.id).balancePence, 0);
  });

  it('cannot be driven negative by repeated debits', async () => {
    const user = await makeUser();
    creditWallet(user.id, 100);
    // Only the first can succeed; the rest must all be refused.
    const results = Array.from({ length: 5 }, () => debitWallet(user.id, 100));
    assert.equal(results.filter((value) => value !== null).length, 1);
    assert.equal(getWallet(user.id).balancePence, 0);
  });

  it('rejects a nonsensical amount instead of corrupting the balance', async () => {
    const user = await makeUser();
    assert.throws(() => debitWallet(user.id, -100), RangeError);
    assert.throws(() => creditWallet(user.id, Number.NaN), RangeError);
    assert.throws(() => poundsToPence(Number.POSITIVE_INFINITY), RangeError);
  });
});

describe('points', () => {
  it('refuses to spend more than the balance', async () => {
    const user = await makeUser();
    addPoints(user.id, 50);

    assert.equal(spendPoints(user.id, 51), null);
    assert.equal(getPoints(user.id), 50);

    assert.equal(spendPoints(user.id, 50), 0);
    assert.equal(getPoints(user.id), 0);
  });

  it('cannot go negative through repeated spends', async () => {
    const user = await makeUser();
    addPoints(user.id, 30);
    const results = Array.from({ length: 4 }, () => spendPoints(user.id, 30));
    assert.equal(results.filter((value) => value !== null).length, 1);
    assert.equal(getPoints(user.id), 0);
  });
});

// ---------------------------------------------------------------------------

describe('vouchers', () => {
  it('issues high-entropy codes', async () => {
    const user = await makeUser();
    const seen = new Set<string>();
    for (let i = 0; i < 25; i += 1) {
      const voucher = createVoucher(user.id, { id: 'r1', title: 'Free pint', points: 100 });
      assert.match(voucher.code, /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
      assert.equal(seen.has(voucher.code), false);
      seen.add(voucher.code);
    }
  });

  it('honours a voucher exactly once', async () => {
    const user = await makeUser();
    const voucher = createVoucher(user.id, { id: 'r1', title: 'Free pint', points: 100 });

    const first = redeemVoucherByCode(voucher.code);
    assert.equal(first.ok, true);

    // The bug this guards: the old code checked the status, then updated, then
    // reported success without looking at whether the update matched a row — so
    // a second till could redeem the same voucher again.
    const second = redeemVoucherByCode(voucher.code);
    assert.equal(second.ok, false);
    assert.equal(second.ok === false && second.reason, 'already_redeemed');
  });

  it('refuses an expired voucher', async () => {
    const user = await makeUser();
    const voucher = createVoucher(user.id, { id: 'r1', title: 'Free pint', points: 100 });
    sqlite
      .prepare('UPDATE vouchers SET expires_at = ? WHERE code = ?')
      .run(new Date(Date.now() - 1000).toISOString(), voucher.code);

    const result = redeemVoucherByCode(voucher.code);
    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.reason, 'expired');
  });

  it('reports an unknown code as not found', () => {
    const result = redeemVoucherByCode('ZZZZ-ZZZZ-ZZZZ');
    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.reason, 'not_found');
  });

  it('accepts a code however the till types it', async () => {
    const user = await makeUser();
    const voucher = createVoucher(user.id, { id: 'r1', title: 'Free pint', points: 100 });
    const bare = voucher.code.replace(/-/g, '').toLowerCase();
    assert.equal(normalizeCode(bare), voucher.code);
    assert.equal(redeemVoucherByCode(bare).ok, true);
  });
});

// ---------------------------------------------------------------------------

describe('check-ins', () => {
  it('awards points the first time', async () => {
    const user = await makeUser();
    const result = recordCheckIn(user.id, 'venue-1', 25);
    assert.equal(result.ok, true);
    assert.equal(getPoints(user.id), 25);
  });

  it('refuses a second check-in at the same venue inside the cooldown', async () => {
    const user = await makeUser();
    assert.equal(recordCheckIn(user.id, 'venue-1', 25).ok, true);

    const second = recordCheckIn(user.id, 'venue-1', 25);
    assert.equal(second.ok, false);
    assert.equal(second.ok === false && second.reason, 'cooldown');
    // The whole point: looping this request must not keep minting points.
    assert.equal(getPoints(user.id), 25);
  });

  it('caps the points a user can farm per day across venues', async () => {
    const user = await makeUser();
    const outcomes = Array.from({ length: 10 }, (_, i) => recordCheckIn(user.id, `venue-${i}`, 25));
    const granted = outcomes.filter((outcome) => outcome.ok).length;

    assert.ok(granted < 10, 'daily cap should stop unlimited farming');
    assert.equal(getPoints(user.id), granted * 25);
    assert.ok(getPoints(user.id) <= 100);
  });
});

// ---------------------------------------------------------------------------

describe('idempotency', () => {
  it('replays the first response for a repeated key', async () => {
    const user = await makeUser();
    assert.equal(findIdempotentResponse(user.id, 'orders', 'key-1'), undefined);

    saveIdempotentResponse(user.id, 'orders', 'key-1', 201, { orderId: 'abc' });
    assert.deepEqual(findIdempotentResponse(user.id, 'orders', 'key-1'), {
      status: 201,
      body: { orderId: 'abc' },
    });

    // A second write under the same key must not overwrite the recorded result.
    saveIdempotentResponse(user.id, 'orders', 'key-1', 500, { error: 'nope' });
    assert.deepEqual(findIdempotentResponse(user.id, 'orders', 'key-1'), {
      status: 201,
      body: { orderId: 'abc' },
    });
  });

  it('scopes keys to a user, so one account cannot read another response', async () => {
    const alice = await makeUser();
    const bob = await makeUser();
    saveIdempotentResponse(alice.id, 'orders', 'shared-key', 201, { orderId: 'alice' });
    assert.equal(findIdempotentResponse(bob.id, 'orders', 'shared-key'), undefined);
  });
});

// ---------------------------------------------------------------------------

describe('reviews', () => {
  it('awards the first-review bonus once, not on every edit', async () => {
    const user = await makeUser();
    const first = addReview('pub-1', user.id, 5, 'The Bell', 'Great');
    assert.equal(first.isNew, true);
    assert.equal(first.pointsAwarded, true);

    const second = addReview('pub-1', user.id, 4, 'The Bell', 'Still good');
    assert.equal(second.isNew, false);
    assert.equal(second.pointsAwarded, false);
    assert.equal(second.summary.count, 1);
  });

  it('withholds the bonus once the daily cap is reached', async () => {
    const user = await makeUser();
    const result = addReview('pub-capped', user.id, 5, 'The Bell', undefined, { awardPoints: false });
    assert.equal(result.isNew, true);
    assert.equal(result.pointsAwarded, false);
  });

  it('does not expose author ids on the public endpoint', async () => {
    const user = await makeUser();
    addReview('pub-2', user.id, 5, 'The Crown', 'Lovely');

    const anonymous = getPubReviews('pub-2');
    assert.equal(anonymous.length, 1);
    assert.equal('userId' in anonymous[0], false);
    assert.equal(anonymous[0].isMine, false);

    // The caller still learns which review is theirs — and only that.
    const asAuthor = getPubReviews('pub-2', user.id);
    assert.equal(asAuthor[0].isMine, true);
  });
});
