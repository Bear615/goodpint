import { Platform } from 'react-native';
import type { AppStatePayload, CartItem, PubRating, RatingMap } from '../types';

const runtime = globalThis as typeof globalThis & {
  process?: { env?: Record<string, string | undefined> };
};

const defaultHost = Platform.select({
  android: 'http://10.0.2.2:4000',
  default: 'http://localhost:4000',
});

export const API_BASE_URL =
  runtime.process?.env?.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, '') ?? defaultHost ?? 'http://localhost:4000';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `GoodPint API error ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function getAppState() {
  return request<AppStatePayload>('/api/app-state');
}

export async function createOrder(payload: { venueId: string; items: CartItem[] }) {
  return request<{ orderId: string; pointsEarned: number; walletBalance: number }>('/api/orders', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function redeemReward(payload: { rewardId: string; points: number }) {
  return request<{ redemptionId: string; expiresAt: string }>('/api/redeem', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function topUpWallet(payload: { amount: number }) {
  return request<{ balance: number }>('/api/wallet/top-up', {
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

export async function getRatings() {
  return request<RatingMap>('/api/reviews/ratings');
}

export async function getUserRatings(userId: string) {
  return request<Record<string, number>>(`/api/reviews/user-ratings?userId=${encodeURIComponent(userId)}`);
}

export async function submitReview(payload: { pubId: string; userId: string; rating: number; pubName?: string }) {
  return request<PubRating & { pubId: string; points: number }>('/api/reviews', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
