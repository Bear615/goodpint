# GoodPint security notes

GoodPint holds things worth stealing: a wallet balance in real money, loyalty
points, and vouchers a pub will exchange for a drink. This document records the
threat model, the controls that exist, and — importantly — what is still missing.

## Reporting a vulnerability

Please report suspected vulnerabilities privately rather than opening a public
issue. Include the affected endpoint, a reproduction, and what an attacker gains.

## Before you deploy

The API refuses to start in production without its secrets, but two settings
still need a deliberate decision:

1. **`ALLOW_UNVERIFIED_TOPUPS` must stay `false`.** `POST /api/wallet/top-up`
   credits a wallet with spendable money and nothing in this codebase authorises
   a payment. With the flag on, any signed-in user can mint unlimited funds in a
   loop. The endpoint returns `501 Not Implemented` while the flag is off. This
   is a placeholder for a real payment integration, not a feature.
2. **`TRUST_PROXY_HOPS` must match your topology.** Set it too high and a client
   can forge `X-Forwarded-For` and shed every per-IP rate limit; too low and all
   users share one bucket. It defaults to `0` (no proxy).

See `packages/api/.env.example` for the full list.

## What is protected, and how

### Authentication

- Passwords are hashed with **scrypt** (N=32768, r=8, p=1, 64-byte output) and a
  per-user random salt. Hashing runs **asynchronously** so it cannot stall the
  event loop for every other in-flight request.
- The parameters are stored **alongside** each digest, so the cost can be raised
  later without invalidating existing passwords. Hashes in the original format
  still verify and are transparently upgraded on the next successful sign-in.
- Verification is **constant-time**.
- A sign-in attempt for an unknown account performs an equivalent dummy hash, so
  response time does not reveal which emails are registered.
- Password policy is length plus a blocklist (per current NIST guidance) rather
  than composition rules: minimum 10 characters, no very common passwords, and
  nothing containing the user's own email or name.

### Sessions

- Tokens are 256 bits from a CSPRNG, shown to the client once.
- **Only the SHA-256 of a token is stored.** A leaked database — a stray backup,
  a copied file — yields no usable session. A plain hash is the right tool here
  precisely because the token is already uniformly random and has nothing to
  brute-force; a slow KDF would add cost without adding security.
- Sessions expire both **absolutely** (default 30 days) and on **inactivity**
  (default 14 days), are capped per account, and expired rows are purged hourly.
- `POST /api/auth/logout-all` revokes every session for an account.

### Authorisation

- The acting user is always taken from the session, never from the request body,
  a query parameter, or a path segment.
- `GET /api/reviews/user-ratings` previously read its target user id from a query
  parameter on an unauthenticated route, which let anyone enumerate which pubs
  any account had visited. It now requires auth and ignores client input.
- The public reviews endpoint no longer returns author ids. It returns a single
  `isMine` flag, computed server-side, which is all the client ever needed.

### Economic integrity

This is the part that matters most, and the part that generic hardening misses.

- **Money is integer pence end to end.** Binary floating point cannot represent
  most decimal money values exactly, so a `REAL` balance drifts as it is credited
  and debited. The HTTP contract still speaks pounds.
- **Every balance change is a single conditional `UPDATE`** carrying its own
  invariant (`WHERE ... AND wallet_balance_pence >= ?`), and every caller checks
  the affected-row count. A balance cannot be driven negative, and there is no
  read-then-write window for two concurrent requests to slip through. Database
  triggers back this up as a last line of defence.
- **Vouchers are redeemed at most once.** The status check lives in the `UPDATE`'s
  `WHERE` clause and success is decided by the affected-row count. The previous
  code read the row, checked the status, updated, and then reported success
  without looking at whether the update matched anything — so two tills could
  both honour the same voucher.
- **Point faucets are throttled.** Check-ins have a per-venue cooldown and a
  per-user daily cap. Review bonuses have a daily cap — pub ids come from
  OpenStreetMap rather than our own catalog, so "one bonus per pub" is not a
  limit an attacker respects when they can invent pub ids indefinitely.
- **Value-moving endpoints accept an idempotency key** (`X-Idempotency-Key`), so
  a retry over a flaky mobile connection cannot place a second order.
- **Prices always come from the server's catalog**, never from the request body.
- Every movement of money or points is written to an append-only `audit_log`.
- **The client no longer decides that a payment succeeded.** It used to debit the
  local balance, announce "Drink booked", and then fire the request with its
  rejection swallowed — so anything the server refused (a stale balance, a rate
  limit, a pub discovered on the map rather than in our catalog) left the user
  holding a confirmation for an order that did not exist. Nothing is shown until
  the server has answered, and the balance shown is the one it returned.
- **Voucher expiry is derived on read.** Nothing ever wrote the `expired` status,
  so a lapsed voucher kept presenting itself as usable in the wallet and sent
  people to a till that would refuse it.

A note on concurrency: `node:sqlite` is synchronous, so a handler that never
awaits between reading a balance and writing it was already safe from
interleaving *within a single process*. That is an invariant one added `await`
would silently break, and it does not hold at all once a second process shares
the database file. The conditional updates make the guarantee explicit instead of
incidental.

### Transport and HTTP

- Strict CORS allowlist, no wildcard, no credentials. Requests with no `Origin`
  (native apps) pass through — CORS is a browser control, not an authorisation
  one, and pretending otherwise would break the mobile client for no gain.
- Security response headers on every response: `nosniff`, `X-Frame-Options: DENY`,
  a `default-src 'none'` CSP, `Referrer-Policy: no-referrer`, `Cache-Control:
  no-store`, and HSTS when TLS is enforced.
- JSON bodies are capped at 16 KB and must declare `application/json`.
- A global error handler converts anything thrown into a bare 500; stack traces
  and driver messages never reach a client.
- Validation errors report a field path and a reason, never the submitted value —
  the previous handler echoed the raw parse result, which could include the
  password that was just rejected.
- Rate limits: global per IP, tight on sign-in (per IP *and* per account, counting
  failures only), on signup, on voucher redemption, and on value-moving writes.
- Slow-loris timeouts, graceful shutdown, and handlers for unhandled rejections.

### Mobile client

- Session tokens live in `expo-secure-store` on native.
- Release builds **refuse** a plaintext `http://` API base URL; development warns.
- Android cleartext traffic is disabled and iOS ATS exceptions are not granted.
- The map runs in a genuinely sandboxed frame. It is driven by **structured
  messages, not evaluated JavaScript**, which is what allows the web build to drop
  `allow-same-origin` — a sandbox with both `allow-scripts` and `allow-same-origin`
  can reach out and remove its own sandbox attribute, so it was never a sandbox.
- Leaflet is pinned by version **and subresource integrity hash**, so a
  compromised CDN cannot substitute a different script.
- The frame addresses `postMessage` to one specific origin instead of `*`.

## Known gaps

Honest list of what is *not* solved:

- **No payment provider.** Wallet top-ups are a placeholder; see above.
- **No email verification and no password reset.** An account cannot currently be
  recovered, and email addresses are unproven.
- **No multi-factor authentication.**
- **Rate limit state is per process.** Correct for the current single-process
  deployment; running several instances behind a load balancer means each
  enforces its own share, and counters would need a shared store.
- **Web token storage.** On web the token lives in `localStorage`, so any XSS on
  the origin can exfiltrate it. Moving to an httpOnly, SameSite cookie would fix
  this properly but requires a CSRF strategy and a change to how the native and
  web clients authenticate.
- **Vouchers are not venue-scoped.** Per-venue till keys (`STAFF_KEYS`) limit
  which till can redeem, but any valid till key can redeem any voucher. Binding a
  voucher to the venue that issued it would be stronger.
- **Signup reveals whether an email is registered.** A signup form has to tell the
  user their address is taken; the rate limiter is the mitigation.
- **No automated dependency scanning** in CI.
