import type { AppStatePayload } from '../types';

// Static UI config — the discovery filter chips. This is presentation config,
// not user data, so it stays in the app.
export const filters = [
  { id: 'nearby', label: 'Nearby' },
  { id: 'top-rated', label: 'Top Rated' },
  { id: 'happy-hour', label: 'Happy Hour' },
  { id: 'live-music', label: 'Live Music' },
] as const;

// The app holds no fabricated user data anymore. Everything (profile, points,
// wallet, transactions, vouchers, and the venue/drink/reward catalog) is loaded
// from the API via getAppState() once the user is signed in. This empty state
// is only the initial value before that first load resolves.
export const emptyAppState: AppStatePayload = {
  user: { id: '', email: '' },
  points: 0,
  wallet: { cardLast4: '', balance: 0 },
  venues: [],
  drinks: [],
  rewards: [],
  earningRules: [],
  tiers: [],
  passes: [],
  transactions: [],
  trips: [],
  vouchers: [],
  profile: {
    name: '',
    handle: '',
    joinedLabel: '',
    avatarUrl: '',
    favoriteStyle: '',
    homeArea: '',
  },
};
