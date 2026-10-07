import { formatCurrency } from '../theme';
import type { Transaction } from '../types';

// Transactions carry no explicit type, but the sign is unambiguous: money in is
// a top-up, money out is an order, and a zero-value line is a redeemed reward.
export type TransactionKind = 'topup' | 'purchase' | 'reward';

export function transactionKind(transaction: Transaction): TransactionKind {
  if (transaction.amount > 0) return 'topup';
  if (transaction.amount < 0) return 'purchase';
  return 'reward';
}

export const kindLabels: Record<TransactionKind, string> = {
  topup: 'Top up',
  purchase: 'Drinks order',
  reward: 'Reward',
};

/** Incoming money gets a plus; spend is shown bare, the way banking apps do. */
export function formatAmount(amount: number): string {
  if (amount > 0) return `+${formatCurrency(amount)}`;
  return formatCurrency(Math.abs(amount));
}

const DAY_MS = 86_400_000;

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

// Monday, matching the en-GB week the rest of the app formats in.
function startOfWeek(date: Date): Date {
  const day = startOfDay(date);
  day.setDate(day.getDate() - ((day.getDay() + 6) % 7));
  return day;
}

// Rounded rather than floored so a daylight-saving shift can't turn one day
// into 0.96 of one.
function daysBetween(later: Date, earlier: Date): number {
  return Math.round((startOfDay(later).getTime() - startOfDay(earlier).getTime()) / DAY_MS);
}

export function transactionDate(transaction: Transaction): Date | null {
  if (!transaction.createdAt) return null;
  const date = new Date(transaction.createdAt);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function transactionTime(transaction: Transaction): string {
  const date = transactionDate(transaction);
  if (date) return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return transaction.timestamp.match(/\d{1,2}:\d{2}$/)?.[0] ?? transaction.timestamp;
}

export function transactionFullDate(transaction: Transaction): string {
  const date = transactionDate(transaction);
  if (!date) return transaction.timestamp;
  return date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function dayLabel(date: Date, now: Date): string {
  const diff = daysBetween(now, date);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff > 1 && diff < 7) return date.toLocaleDateString('en-GB', { weekday: 'long' });
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
  });
}

// Without an ISO time, fall back to the server's friendly label minus its clock
// ("Mon, 05 Oct, 14:32" -> "Mon, 05 Oct").
function fallbackDayLabel(transaction: Transaction): string {
  if (transaction.timestamp === 'Just now') return 'Today';
  return transaction.timestamp.replace(/,\s*\d{1,2}:\d{2}$/, '') || 'Earlier';
}

export interface TransactionGroup {
  label: string;
  items: Transaction[];
}

/** Groups transactions by day, preserving their (newest-first) order. */
export function groupByDay(transactions: Transaction[], now = new Date()): TransactionGroup[] {
  const groups: TransactionGroup[] = [];
  for (const transaction of transactions) {
    const date = transactionDate(transaction);
    const label = date ? dayLabel(date, now) : fallbackDayLabel(transaction);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(transaction);
    else groups.push({ label, items: [transaction] });
  }
  return groups;
}

export interface WeekDay {
  label: string;
  spent: number;
  isToday: boolean;
  isFuture: boolean;
}

export interface WeeklySummary {
  days: WeekDay[];
  spent: number;
  added: number;
  orders: number;
  lastWeekSpent: number;
}

const WEEKDAY_INITIALS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export function weeklySummary(transactions: Transaction[], now = new Date()): WeeklySummary {
  const weekStart = startOfWeek(now);
  const todayIndex = daysBetween(now, weekStart);
  const days: WeekDay[] = WEEKDAY_INITIALS.map((label, index) => ({
    label,
    spent: 0,
    isToday: index === todayIndex,
    isFuture: index > todayIndex,
  }));

  let added = 0;
  let orders = 0;
  let lastWeekSpent = 0;

  for (const transaction of transactions) {
    const date = transactionDate(transaction);
    if (!date) continue;
    const index = daysBetween(date, weekStart);

    if (index >= -7 && index < 0 && transaction.amount < 0) {
      lastWeekSpent += -transaction.amount;
    }
    if (index < 0 || index > 6) continue;

    if (transaction.amount < 0) {
      days[index].spent += -transaction.amount;
      orders += 1;
    } else if (transaction.amount > 0) {
      added += transaction.amount;
    }
  }

  const spent = days.reduce((total, day) => total + day.spent, 0);
  return { days, spent, added, orders, lastWeekSpent };
}

export type VoucherTiming = { label: string; urgent: boolean };

export function expiryLabel(expiresAt: string | null, now = new Date()): VoucherTiming | null {
  if (!expiresAt) return null;
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) return null;

  const hours = (date.getTime() - now.getTime()) / 3_600_000;
  if (hours <= 0) return { label: 'Expired', urgent: true };
  if (hours < 24) return { label: `Expires in ${Math.max(1, Math.round(hours))}h`, urgent: true };
  const days = daysBetween(date, now);
  if (days < 7) return { label: `Expires in ${days}d`, urgent: days <= 2 };
  return {
    label: `Valid until ${date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`,
    urgent: false,
  };
}

/** "The Pour House" -> "P": the article would make half the pubs look alike. */
export function monogram(name: string): string {
  const significant = name.trim().replace(/^the\s+/i, '');
  return (significant.charAt(0) || name.trim().charAt(0) || '£').toUpperCase();
}

/** A stable tint for a merchant monogram, so the same pub always looks the same. */
const MONOGRAM_TINTS = ['#F4C84A', '#E59F5B', '#8FB8DE', '#B49BE0', '#7FD1AE', '#E58F8F'];

export function monogramTint(name: string): string {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) | 0;
  }
  return MONOGRAM_TINTS[Math.abs(hash) % MONOGRAM_TINTS.length];
}
