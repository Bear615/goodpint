import { Platform } from 'react-native';
import type { AppStatePayload, CartItem, PubRating, PubReview, RatingMap, User, Voucher } from '../types';
import { getToken } from '../utils/authToken';

const runtime = globalThis as typeof globalThis & {
  process?: { env?: Record<string, string | undefined> };
};

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

export const API_BASE_URL =
  runtime.process?.env?.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, '') ?? defaultHost ?? 'http://localhost:4000';

// Thrown for non-2xx responses so callers can branch on status (e.g. 401).
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit & { auth?: boolean }): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string> | undefined),
  };

  // Attach the bearer token unless the caller explicitly opts out.
  if (init?.auth !== false) {
    const token = await getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });

  if (!response.ok) {
    let message = `GoodPint API error ${response.status}`;
    try {
      const body = await response.json();
      if (body?.error) message = body.error;
    } catch {
      // Non-JSON error body — keep the default message.
    }
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
  });
}

export async function redeemReward(payload: { rewardId: string }) {
  return request<{ redemptionId: string; voucher: Voucher; points: number; expiresAt: string | null }>('/api/redeem', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function topUpWallet(payload: { amount: number }) {
  return request<{ balance: number; points: number }>('/api/wallet/top-up', {
    method: 'POST',
    body: JSON.stringify(payload),
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
// Reviews (read endpoints are public; submitting requires auth)
// ---------------------------------------------------------------------------

export async function getRatings() {
  return request<RatingMap>('/api/reviews/ratings', { auth: false });
}

export async function getUserRatings(userId: string) {
  return request<Record<string, number>>(`/api/reviews/user-ratings?userId=${encodeURIComponent(userId)}`, { auth: false });
}

export async function getPubReviews(pubId: string) {
  return request<PubReview[]>(`/api/reviews/${encodeURIComponent(pubId)}/reviews`, { auth: false });
}

export async function submitReview(payload: { pubId: string; rating: number; pubName?: string; note?: string }) {
  return request<PubRating & { pubId: string; points: number }>('/api/reviews', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
