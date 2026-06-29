// Seed data for the GoodPint catalog. These are the shared reference records
// (venues, drinks, rewards, earning rules, tiers) that every user sees. They are
// seeded into SQLite once on first boot (see db.ts). Per-user data (points,
// wallet, transactions, vouchers, profile) lives in the users/transactions/
// vouchers tables and is NOT defined here — new users start empty.

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

export interface Transaction {
  id: string;
  title: string;
  amount: number;
  timestamp: string;
}

export const venues: Venue[] = [
  {
    id: 'pour-house',
    name: 'The Pour House',
    area: 'River North',
    distanceMiles: 0.2,
    priceTier: '£££',
    rating: 4.6,
    reviewCount: 342,
    tags: ['Happy Hour', 'Top Rated'],
    imageUrl: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=700&q=80',
    mapPosition: { top: '21%', left: '67%' },
    pickupWindow: '5 min',
  },
  {
    id: 'roosevelt-room',
    name: 'The Roosevelt Room',
    area: 'Old Town',
    distanceMiles: 0.4,
    priceTier: '££',
    rating: 4.8,
    reviewCount: 611,
    tags: ['Top Rated', 'Live Music'],
    imageUrl: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=700&q=80',
    mapPosition: { top: '31%', left: '21%' },
    pickupWindow: '8 min',
  },
  {
    id: 'barbarella',
    name: 'Barbarella',
    area: 'Streeterville',
    distanceMiles: 0.6,
    priceTier: '££',
    rating: 4.5,
    reviewCount: 205,
    tags: ['Happy Hour'],
    imageUrl: 'https://images.unsplash.com/photo-1572116469696-31de0f17cc34?auto=format&fit=crop&w=700&q=80',
    mapPosition: { top: '53%', left: '82%' },
    pickupWindow: '10 min',
  },
  {
    id: 'haymaker',
    name: 'Haymaker',
    area: 'Gold Coast',
    distanceMiles: 0.8,
    priceTier: '£££',
    rating: 4.7,
    reviewCount: 198,
    tags: ['Live Music'],
    imageUrl: 'https://images.unsplash.com/photo-1544148103-0773bf10d330?auto=format&fit=crop&w=700&q=80',
    mapPosition: { top: '79%', left: '70%' },
    pickupWindow: '12 min',
  },
  {
    id: 'river-tap',
    name: 'River Tap',
    area: 'River West',
    distanceMiles: 0.5,
    priceTier: '£',
    rating: 4.3,
    reviewCount: 121,
    tags: ['Nearby'],
    imageUrl: 'https://images.unsplash.com/photo-1525268323446-0505b6fe7778?auto=format&fit=crop&w=700&q=80',
    mapPosition: { top: '62%', left: '30%' },
    pickupWindow: '7 min',
  },
];

export const drinks: Drink[] = [
  {
    id: 'goodpint-lager',
    name: 'GoodPint Lager',
    price: 6.5,
    imageUrl: 'https://images.unsplash.com/photo-1608270586620-248524c67de9?auto=format&fit=crop&w=500&q=80',
    category: 'beer',
    points: 50,
  },
  {
    id: 'old-fashioned',
    name: 'Old Fashioned',
    price: 10,
    imageUrl: 'https://images.unsplash.com/photo-1470337458703-46ad1756a187?auto=format&fit=crop&w=500&q=80',
    category: 'cocktail',
    points: 80,
  },
  {
    id: 'margarita',
    name: 'Margarita',
    price: 9,
    imageUrl: 'https://images.unsplash.com/photo-1556855810-ac404aa91e85?auto=format&fit=crop&w=500&q=80',
    category: 'cocktail',
    points: 70,
  },
];

export const rewards: Reward[] = [
  {
    id: 'free-drink',
    title: 'Free Drink',
    points: 500,
    imageUrl: 'https://images.unsplash.com/photo-1535958636474-b021ee887b13?auto=format&fit=crop&w=500&q=80',
    description: 'One house pint or selected cocktail',
  },
  {
    id: 'five-off',
    title: '£5 Off Tab',
    points: 750,
    imageUrl: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=500&q=80',
    description: 'Apply to your next GoodPint order',
  },
  {
    id: 'vip-night',
    title: 'VIP Night',
    points: 1500,
    imageUrl: 'https://images.unsplash.com/photo-1566417713940-fe7c737a9ef2?auto=format&fit=crop&w=500&q=80',
    description: 'Skip the queue at partner venues',
  },
];

export const earningRules: EarningRule[] = [
  { id: 'check-in', label: 'Check in at a bar', points: 25 },
  { id: 'buy-drink', label: 'Buy a drink', points: 50 },
  { id: 'spend', label: 'Earn 1 point per £1 spent', points: 1 },
  { id: 'review', label: 'Leave a review', points: 25 },
];

export const tiers: Tier[] = [
  { id: 'bronze', title: 'Bronze', points: 0 },
  { id: 'silver', title: 'Silver', points: 1000 },
  { id: 'gold', title: 'Gold', points: 3000 },
];

export function timestampLabel() {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: 'short',
  }).format(new Date());
}
