import type { Drink, RecentEarn, Reward, Tier, Transaction, Venue, Voucher } from '../types';
import { formatPoints } from '../theme';
import { expiryLabel } from './wallet';

// The server only flips a voucher to expired when someone touches it, so an
// "active" voucher past its expiry is treated as expired here.
export function isVoucherLive(voucher: Voucher, now = Date.now()): boolean {
  if (voucher.status !== 'active') return false;
  if (voucher.expiresAt === null) return true;
  const expires = Date.parse(voucher.expiresAt);
  // An unparsable expiry is treated as none rather than hiding a voucher the user holds.
  return Number.isNaN(expires) || expires > now;
}

/** Soonest expiry first; vouchers that never expire go last. */
export function byExpiry(a: Voucher, b: Voucher): number {
  if (a.expiresAt === b.expiresAt) return 0;
  if (a.expiresAt === null) return 1;
  if (b.expiresAt === null) return -1;
  return a.expiresAt.localeCompare(b.expiresAt);
}

/** The highest tier reached. Same rule as the Points tab, so the two never disagree. */
export function currentTier(points: number, tiers: Tier[]): Tier | null {
  return [...tiers].sort((a, b) => b.points - a.points).find((tier) => points >= tier.points) ?? null;
}

export interface RewardProgress {
  // Everything the balance covers, cheapest first.
  affordable: Reward[];
  // The cheapest reward still out of reach.
  next: Reward | null;
}

export function rewardProgress(points: number, rewards: Reward[]): RewardProgress {
  const sorted = [...rewards].sort((a, b) => a.points - b.points);
  return {
    affordable: sorted.filter((reward) => reward.points <= points),
    next: sorted.find((reward) => reward.points > points) ?? null,
  };
}

/** The best reward a points change has just made affordable, if any. */
export function crossedReward(from: number, to: number, rewards: Reward[]): Reward | null {
  return (
    rewards
      .filter((reward) => from < reward.points && reward.points <= to)
      .sort((a, b) => b.points - a.points)[0] ?? null
  );
}

export function ptsLabel(points: number): string {
  return `${formatPoints(points)} ${points === 1 ? 'pt' : 'pts'}`;
}

export function shortDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function longDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function clockTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export type VoucherEventKind = 'live' | 'redeemed' | 'expired';

export interface VoucherEvent {
  kind: VoucherEventKind;
  // When the voucher last changed state, for ordering the history newest first.
  at: string;
  label: string;
}

export function voucherEvent(voucher: Voucher, now = Date.now()): VoucherEvent {
  if (voucher.status === 'redeemed') {
    const at = voucher.redeemedAt ?? voucher.createdAt;
    return { kind: 'redeemed', at, label: `Used ${shortDate(at)}, ${clockTime(at)}` };
  }
  if (isVoucherLive(voucher, now)) {
    const timing = expiryLabel(voucher.expiresAt, new Date(now));
    return { kind: 'live', at: voucher.createdAt, label: timing ? `In wallet · ${timing.label}` : 'In wallet' };
  }
  const at = voucher.expiresAt ?? voucher.createdAt;
  return { kind: 'expired', at, label: `Expired ${shortDate(at)}` };
}

/**
 * The catalogue venue of the most recent order. Orders only succeed for
 * catalogue venues and are recorded under the venue's name.
 */
export function lastOrderedVenue(transactions: Transaction[], venues: Venue[]): Venue | null {
  for (const transaction of transactions) {
    if (transaction.amount >= 0) continue;
    const venue = venues.find((candidate) => candidate.name === transaction.title);
    if (venue) return venue;
  }
  return null;
}

/** Mirrors the server: drink points plus one point per whole pound spent. */
export function pointsForSingleDrink(drink: Drink): number {
  return drink.points + Math.floor(drink.price);
}

export const MEMBER_PASS_ID = 'member';

/**
 * Which pass starts open. Something that just happened wins (a scan at the
 * bar, a claim, an order); otherwise a held voucher is open so it can be shown
 * at the bar without a tap; otherwise the membership pass is.
 */
export function defaultOpenId({
  freshVoucherId,
  justRedeemedId,
  recentEarn,
  stack,
}: {
  stack: Voucher[];
  justRedeemedId: string | null;
  freshVoucherId: string | null;
  recentEarn: RecentEarn | null;
}): string {
  const inStack = (id: string | null) => id !== null && stack.some((voucher) => voucher.id === id);
  if (inStack(justRedeemedId)) return justRedeemedId as string;
  if (inStack(freshVoucherId)) return freshVoucherId as string;
  if (recentEarn) return MEMBER_PASS_ID;
  return stack[0]?.id ?? MEMBER_PASS_ID;
}
