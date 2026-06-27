import type {
  AppStatePayload,
  Drink,
  EarningRule,
  MemberProfile,
  Pass,
  Reward,
  Tier,
  Transaction,
  Trip,
  Venue,
  WalletState,
} from '../types';

export const filters = [
  { id: 'nearby', label: 'Nearby' },
  { id: 'top-rated', label: 'Top Rated' },
  { id: 'happy-hour', label: 'Happy Hour' },
  { id: 'live-music', label: 'Live Music' },
] as const;

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
  { id: 'invite', label: 'Invite a friend', points: 100 },
  { id: 'review', label: 'Leave a review', points: 25 },
];

export const tiers: Tier[] = [
  { id: 'bronze', title: 'Bronze', points: 0 },
  { id: 'silver', title: 'Silver', points: 1000 },
  { id: 'gold', title: 'Gold', points: 3000 },
];

export const wallet: WalletState = {
  cardLast4: '4242',
  balance: 25,
};

export const passes: Pass[] = [
  { id: 'vip-pass', title: 'VIP Night', subtitle: 'Valid until 31 May 2027', status: 'Active' },
  { id: 'birthday', title: 'Birthday Drink', subtitle: 'Valid until 15 Jun 2027', status: 'Active' },
];

export const transactions: Transaction[] = [
  { id: 'tx-1', title: 'The Pour House', amount: -6.5, timestamp: 'Today, 7:02 PM' },
  { id: 'tx-2', title: 'Wallet top up', amount: 25, timestamp: 'Yesterday, 3:31 PM' },
  { id: 'tx-3', title: 'Reward redeemed', amount: 0, timestamp: 'Mon, 8:15 PM' },
];

export const trips: Trip[] = [
  {
    id: 'austin-weekend',
    title: 'Austin Weekend',
    dates: 'May 24 - May 26',
    guests: 6,
    stops: [
      { id: 'stop-1', venueId: 'roosevelt-room', time: 'Fri, May 24 - 7:00 PM' },
      { id: 'stop-2', venueId: 'barbarella', time: 'Fri, May 24 - 9:30 PM' },
      { id: 'stop-3', venueId: 'haymaker', time: 'Fri, May 24 - 11:30 PM' },
    ],
  },
];

export const profile: MemberProfile = {
  name: 'Maya Hart',
  handle: '@maya.goodpint',
  joinedLabel: 'Member since 2024',
  avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=300&q=80',
  favoriteStyle: 'Crisp lager',
  homeArea: 'River North',
};

export const initialAppState: AppStatePayload = {
  points: 2450,
  wallet,
  venues,
  drinks,
  rewards,
  earningRules,
  tiers,
  passes,
  transactions,
  trips,
  profile,
};
