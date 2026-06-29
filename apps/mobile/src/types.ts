export type TabKey = 'explore' | 'points' | 'plan' | 'wallet' | 'profile';

export type FilterKey = 'nearby' | 'top-rated' | 'happy-hour' | 'live-music';

export interface Venue {
  id: string;
  name: string;
  area: string;
  distanceMiles: number;
  priceTier: string;
  rating: number;
  reviewCount: number;
  tags: string[];
  imageUrl: string;
  mapPosition: { top: `${number}%`; left: `${number}%` };
  pickupWindow: string;
}

export interface Drink {
  id: string;
  name: string;
  price: number;
  imageUrl: string;
  category: 'beer' | 'cocktail' | 'wine' | 'zero';
  points: number;
}

export interface Reward {
  id: string;
  title: string;
  points: number;
  imageUrl: string;
  description: string;
}

export interface EarningRule {
  id: string;
  label: string;
  points: number;
}

export interface Tier {
  id: 'bronze' | 'silver' | 'gold';
  title: string;
  points: number;
}

export interface WalletState {
  cardLast4: string;
  balance: number;
}

export interface Pass {
  id: string;
  title: string;
  subtitle: string;
  status: 'Active' | 'Ready' | 'Used';
}

export interface Transaction {
  id: string;
  title: string;
  amount: number;
  timestamp: string;
}

export interface TripStop {
  id: string;
  venueId: string;
  time: string;
}

export interface Trip {
  id: string;
  title: string;
  dates: string;
  guests: number;
  stops: TripStop[];
}

export interface MemberProfile {
  name: string;
  handle: string;
  joinedLabel: string;
  avatarUrl: string;
  favoriteStyle: string;
  homeArea: string;
}

export interface OsmPub {
  id: string;
  name: string;
  lat: number;
  lon: number;
  address: string;
  distanceMiles: number;
}

export interface PubRating {
  average: number;
  count: number;
}

export type RatingMap = Record<string, PubRating>;

export interface PubReview {
  id: string;
  userId: string | null;
  pubName: string | null;
  rating: number;
  note: string | null;
  createdAt: string;
}

export interface CartItem {
  drinkId: string;
  quantity: number;
}

// The signed-in account. Extends the display profile with identity fields.
export interface User extends MemberProfile {
  id: string;
  email: string;
}

export type VoucherStatus = 'active' | 'redeemed' | 'expired';

// A redeemed reward the user can present at a pub. The `code` is what staff scan/enter.
export interface Voucher {
  id: string;
  rewardId: string;
  title: string;
  code: string;
  pointsSpent: number;
  status: VoucherStatus;
  createdAt: string;
  expiresAt: string | null;
  redeemedAt: string | null;
}

export interface AppStatePayload {
  user: { id: string; email: string };
  points: number;
  wallet: WalletState;
  venues: Venue[];
  drinks: Drink[];
  rewards: Reward[];
  earningRules: EarningRule[];
  tiers: Tier[];
  passes: Pass[];
  transactions: Transaction[];
  trips: Trip[];
  vouchers: Voucher[];
  profile: MemberProfile;
}
