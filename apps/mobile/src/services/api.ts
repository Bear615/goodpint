import { Platform } from 'react-native';
import type { AppStatePayload, CartItem, PubRating, PubReview, RatingMap, User, Voucher } from '../types';
import { getToken } from '../utils/authToken';

const runtime = globalThis as typeof globalThis & {
  process?: { env?: Record<string, string | undefined> };
  __DEV__?: boolean;
};

const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : runtime.__DEV__ !== false;

// Dev machine's LAN IP — lets a physical phone on the same Wi-Fi reach the API.
// Override anytime with EXPO_PUBLIC_API_BASE_URL (e.g. a different network or a
// deployed server). Update this if your machine's LAN IP changes.
const LAN_HOST = 'http://192.168.1.11:4000';

const defaultHost = Platform.select({
  // Web runs in the browser on the same machine as the API.
  web: 'http://localhost:4000',
  // Native (physical device or simulator) reaches the API over the LAN.
  default: LAN_HOST,
});

const configuredBaseUrl =
  runtime.process?.env?.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, '') ?? defaultHost ?? 'http://localhost:4000';

/**
 * Every request carries the session bearer token, so a plaintext base URL hands
 * that token to anyone on the network path. Cleartext is tolerated only for
 * local development; a release build refuses to start against one rather than
 * silently leaking credentials over the air.
 */
function resolveBaseUrl(url: string): string {
  if (url.startsWith('https://')) return url;

  const host = url.replace(/^https?:\/\//, '').split(/[:/]/)[0] ?? '';
  const isLoopback = host === 'localhost' || host === '127.0.0.1' || host === '10.0.2.2';

  if (!isDev) {
    throw new Error(
      `Refusing to use an insecure API base URL in a release build: ${url}. ` +
        'Set EXPO_PUBLIC_API_BASE_URL to an https:// endpoint.',
    );
  }
  if (!isLoopback) {
    // eslint-disable-next-line no-console
    console.warn(
      `[api] Talking to ${url} over plaintext HTTP. Session tokens are readable by anyone on this network. ` +
        'This is allowed in development only.',
    );
  }
  return url;
}

export const API_BASE_URL = resolveBaseUrl(configuredBaseUrl);

/** Give up rather than hang forever on a dead network. */
const REQUEST_TIMEOUT_MS = 15_000;

// Thrown for non-2xx responses so callers can branch on status (e.g. 401).
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

// Notified when the server rejects our token, so the app can drop straight to
// the sign-in screen instead of retrying with a credential that will never work.
type UnauthorizedHandler = () => void;
let onUnauthorized: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  onUnauthorized = handler;
}

/**
 * A per-request key so a retry cannot be mistaken for a second order.
 *
 * Uniqueness is all that is required: the server scopes keys to the calling
 * account, so knowing or guessing someone else's key gains an attacker nothing.
 * That is why the non-cryptographic fallback is acceptable here, and would not
 * be for a token or an identifier.
 */
function idempotencyKey(): string {
  const webCrypto = (globalThis as { crypto?: Crypto }).crypto;
  if (typeof webCrypto?.randomUUID === 'function') return webCrypto.randomUUID();
  if (typeof webCrypto?.getRandomValues === 'function') {
    const bytes = webCrypto.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}-${Math.random().toString(36).slice(2, 12)}`;
}

interface RequestOptions extends RequestInit {
  auth?: boolean;
  /** Send an idempotency key so a retried write is applied at most once. */
  idempotent?: boolean;
}

async function request<T>(path: string, init?: RequestOptions): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(init?.headers as Record<string, string> | undefined),
  };

  // Attach the bearer token unless the caller explicitly opts out.
  if (init?.auth !== false) {
    const token = await getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  if (init?.idempotent) headers['X-Idempotency-Key'] = idempotencyKey();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers, signal: controller.signal });
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') {
      throw new ApiError(0, 'The request timed out. Please check your connection and try again.');
    }
    throw new ApiError(0, 'Could not reach GoodPint. Please check your connection and try again.');
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    let message = `GoodPint API error ${response.status}`;
    try {
      const body = await response.json();
      if (typeof body?.error === 'string') message = body.error;
    } catch {
      // Non-JSON error body — keep the default message.
    }
    if (response.status === 401 && init?.auth !== false) onUnauthorized?.();
    throw new ApiError(response.status, message);
  }

  return (await response.json()) as T;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export async function signup(payload: { email: string; password: string; name: string }) {
  return request<{ token: string; user: User }>('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify(payload),
    auth: false,
  });
}

export async function login(payload: { email: string; password: string }) {
  return request<{ token: string; user: User }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
    auth: false,
  });
}

export async function logout() {
  return request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' });
}

/** Ends every session for this account, not just the one on this device. */
export async function logoutEverywhere() {
  return request<{ ok: boolean }>('/api/auth/logout-all', { method: 'POST' });
}

export async function getMe() {
  return request<{ user: User }>('/api/auth/me');
}

// ---------------------------------------------------------------------------
// App state + actions (all authenticated)
// ---------------------------------------------------------------------------

export async function getAppState() {
  return request<AppStatePayload>('/api/app-state');
}

export async function createOrder(payload: { venueId: string; items: CartItem[] }) {
  return request<{ orderId: string; pointsEarned: number; points: number; walletBalance: number }>('/api/orders', {
    method: 'POST',
    body: JSON.stringify(payload),
    idempotent: true,
  });
}

export async function redeemReward(payload: { rewardId: string }) {
  return request<{ redemptionId: string; voucher: Voucher; points: number; expiresAt: string | null }>('/api/redeem', {
    method: 'POST',
    body: JSON.stringify(payload),
    idempotent: true,
  });
}

export async function topUpWallet(payload: { amount: number }) {
  return request<{ balance: number; points: number }>('/api/wallet/top-up', {
    method: 'POST',
    body: JSON.stringify(payload),
    idempotent: true,
  });
}

export async function checkIn(payload: { venueId: string }) {
  return request<{ points: number; pointsEarned: number }>('/api/check-ins', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getVouchers() {
  return request<Voucher[]>('/api/vouchers');
}

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------

export async function getRatings() {
  return request<RatingMap>('/api/reviews/ratings', { auth: false });
}

/**
 * The signed-in user's own ratings.
 *
 * This used to pass the target user id as a query parameter on an
 * unauthenticated endpoint, which meant anyone could read anyone's history. The
 * server now derives the user from the session, so there is nothing to pass.
 */
export async function getUserRatings() {
  return request<Record<string, number>>('/api/reviews/user-ratings');
}

// Sent authenticated so the server can flag which review is the caller's own;
// it still works signed out, just without that flag.
export async function getPubReviews(pubId: string) {
  return request<PubReview[]>(`/api/reviews/${encodeURIComponent(pubId)}/reviews`);
}

export async function submitReview(payload: { pubId: string; rating: number; pubName?: string; note?: string }) {
  return request<PubRating & { pubId: string; points: number }>('/api/reviews', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
