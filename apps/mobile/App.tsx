import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BottomNav } from './src/components/BottomNav';
import { AnimatedScreen } from './src/components/Motion';
import { ScreenFrame } from './src/components/ScreenFrame';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { emptyAppState } from './src/data/goodpint';
import { AuthScreen } from './src/screens/AuthScreen';
import { BuyDrinkScreen } from './src/screens/BuyDrinkScreen';
import { ExploreScreen } from './src/screens/ExploreScreen';
import { PlanScreen } from './src/screens/PlanScreen';
import { PointsScreen } from './src/screens/PointsScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { RedeemScreen } from './src/screens/RedeemScreen';
import { WalletScreen } from './src/screens/WalletScreen';
import { createOrder, getAppState, getRatings, getUserRatings, redeemReward, submitReview, topUpWallet } from './src/services/api';
import { colors } from './src/theme';
import type { AppStatePayload, CartItem, FilterKey, OsmPub, RatingMap, TabKey, Transaction, Voucher, WalletState } from './src/types';
import { fetchNearbyPubs } from './src/utils/pubs';

type NestedRoute = { name: 'redeem'; rewardId: string } | { name: 'buy'; venueId: string; pubName: string } | null;

function nowTransaction(title: string, amount: number): Transaction {
  return {
    id: `tx-${Date.now()}-${Math.round(Math.random() * 1000)}`,
    title,
    amount,
    timestamp: 'Just now',
  };
}

// Top-level: provide auth and gate the rest of the app behind sign-in.
export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <Root />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

function Root() {
  const { status } = useAuth();

  if (status === 'loading') {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.gold} size="large" />
      </View>
    );
  }

  if (status === 'unauthenticated') {
    return <AuthScreen />;
  }

  return <MainApp />;
}

function MainApp() {
  const { user } = useAuth();
  // Seed the profile from the authenticated user so the UI never flashes blank
  // before the full app-state loads.
  const seededState: AppStatePayload = user
    ? { ...emptyAppState, user: { id: user.id, email: user.email }, profile: user }
    : emptyAppState;

  const [data, setData] = useState<AppStatePayload>(seededState);
  const [points, setPoints] = useState(seededState.points);
  const [wallet, setWallet] = useState<WalletState>(seededState.wallet);
  const [transactions, setTransactions] = useState(seededState.transactions);
  const [activeTab, setActiveTab] = useState<TabKey>('explore');
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<FilterKey>('nearby');
  const [locationStatus, setLocationStatus] = useState<'pending' | 'granted' | 'denied'>('pending');
  const [userCoords, setUserCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [osmPubs, setOsmPubs] = useState<OsmPub[]>([]);
  const [pubsLoading, setPubsLoading] = useState(false);
  const [pubsError, setPubsError] = useState(false);
  const [ratings, setRatings] = useState<RatingMap>({});
  const [userRatings, setUserRatings] = useState<Record<string, number>>({});
  const [route, setRoute] = useState<NestedRoute>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [secondsRemaining, setSecondsRemaining] = useState(299);
  const [activeVoucher, setActiveVoucher] = useState<Voucher | null>(null);

  useEffect(() => {
    let mounted = true;

    getAppState()
      .then((remoteState) => {
        if (!mounted) {
          return;
        }

        setData(remoteState);
        setPoints(remoteState.points);
        setWallet(remoteState.wallet);
        setTransactions(remoteState.transactions);
        if (remoteState.drinks[0]) {
          setCart([{ drinkId: remoteState.drinks[0].id, quantity: 1 }]);
        }
      })
      .catch(() => {
        // Leave the seeded empty state in place if the API is unreachable.
      });

    getRatings()
      .then((remoteRatings) => {
        if (mounted) setRatings(remoteRatings);
      })
      .catch(() => undefined);

    if (user) {
      getUserRatings()
        .then((remoteUserRatings) => {
          if (mounted) setUserRatings(remoteUserRatings);
        })
        .catch(() => undefined);
    }

    return () => {
      mounted = false;
    };
  }, [user]);

  const handleSubmitReview = async (pubId: string, rating: number, pubName: string, note?: string) => {
    const prevUserRating = userRatings[pubId];

    // Optimistic update: if new review add to count, if update keep count.
    setUserRatings((current) => ({ ...current, [pubId]: rating }));
    setRatings((current) => {
      const prev = current[pubId] ?? { average: 0, count: 0 };
      if (prevUserRating) {
        // Updating existing: replace old rating in the average.
        const average = Number(((prev.average * prev.count - prevUserRating + rating) / prev.count).toFixed(1));
        return { ...current, [pubId]: { average, count: prev.count } };
      }
      const count = prev.count + 1;
      const average = Number(((prev.average * prev.count + rating) / count).toFixed(1));
      return { ...current, [pubId]: { average, count } };
    });

    submitReview({ pubId, rating, pubName, note })
      .then((result) => {
        setRatings((current) => ({ ...current, [pubId]: { average: result.average, count: result.count } }));
        setPoints(result.points);
      })
      .catch(() => undefined);
  };

  useEffect(() => {
    let mounted = true;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (!mounted) return;

      if (status !== 'granted') {
        setLocationStatus('denied');
        return;
      }

      setLocationStatus('granted');
      console.log('[location] permission granted, getting position...');
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      if (!mounted) return;

      const { latitude: lat, longitude: lon } = pos.coords;
      console.log('[location] got coords', lat, lon);
      setUserCoords({ lat, lon });
      setPubsLoading(true);

      try {
        const pubs = await fetchNearbyPubs(lat, lon, lat, lon);
        if (!mounted) return;
        setOsmPubs(pubs);
      } catch (err) {
        console.error('[pubs] fetchNearbyPubs failed:', err);
        if (mounted) setPubsError(true);
      } finally {
        if (mounted) setPubsLoading(false);
      }
    })();

    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (route?.name !== 'redeem') {
      return;
    }

    setSecondsRemaining(299);
    const timer = setInterval(() => {
      setSecondsRemaining((current) => Math.max(current - 1, 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [route]);

  const selectedReward = route?.name === 'redeem' ? data.rewards.find((reward) => reward.id === route.rewardId) : undefined;
  const selectedVenue = route?.name === 'buy'
    ? (data.venues.find((venue) => venue.id === route.venueId) ?? { ...data.venues[0], id: route.venueId, name: route.pubName })
    : data.venues[0];

  const cartTotal = useMemo(
    () =>
      cart.reduce((total, item) => {
        const drink = data.drinks.find((candidate) => candidate.id === item.drinkId);
        return total + (drink?.price ?? 0) * item.quantity;
      }, 0),
    [cart, data.drinks],
  );

  const activeTabRef = useRef(activeTab);
  const routeRef = useRef(route);
  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);
  useEffect(() => { routeRef.current = route; }, [route]);

  const TAB_ORDER: TabKey[] = ['explore', 'points', 'plan', 'wallet', 'profile'];

  const changeTab = (tab: TabKey) => {
    const currentIdx = TAB_ORDER.indexOf(activeTabRef.current);
    const nextIdx = TAB_ORDER.indexOf(tab);
    setSwipeDirection(nextIdx > currentIdx ? 'right' : nextIdx < currentIdx ? 'left' : null);
    setActiveTab(tab);
    setRoute(null);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // Redeem a reward against the server, then show the issued voucher.
  const openRedeem = async (rewardId?: string) => {
    const nextRewardId = rewardId || data.rewards[0]?.id;
    if (!nextRewardId) {
      return;
    }

    const reward = data.rewards.find((candidate) => candidate.id === nextRewardId);
    if (reward && points < reward.points) {
      Alert.alert('Not enough points', `You need ${reward.points} points to redeem ${reward.title}.`);
      return;
    }

    try {
      const result = await redeemReward({ rewardId: nextRewardId });
      setPoints(result.points);
      setActiveVoucher(result.voucher);
      setData((current) => ({ ...current, vouchers: [result.voucher, ...current.vouchers] }));
    } catch {
      Alert.alert('Could not redeem', 'Something went wrong redeeming that reward. Please try again.');
      return;
    }

    setSwipeDirection(null);
    setActiveTab('points');
    setRoute({ name: 'redeem', rewardId: nextRewardId });
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const openBuy = (venueId: string, pubName: string) => {
    setSwipeDirection(null);
    setActiveTab('explore');
    setCart([{ drinkId: data.drinks[0]?.id ?? 'goodpint-lager', quantity: 1 }]);
    setRoute({ name: 'buy', venueId, pubName });
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const changeQuantity = (drinkId: string, delta: number) => {
    setCart((currentCart) => {
      const existing = currentCart.find((item) => item.drinkId === drinkId);
      const nextQuantity = Math.max((existing?.quantity ?? 0) + delta, 0);
      const withoutDrink = currentCart.filter((item) => item.drinkId !== drinkId);

      if (nextQuantity === 0) {
        return withoutDrink;
      }

      return [...withoutDrink, { drinkId, quantity: nextQuantity }];
    });
  };

  const payForOrder = () => {
    if (cartTotal <= 0) {
      Alert.alert('Add a drink', 'Choose at least one drink before paying.');
      return;
    }

    if (wallet.balance < cartTotal) {
      Alert.alert('Top up wallet', 'Add funds to your GoodPint Card before placing this order.');
      return;
    }

    const pointsEarned = cart.reduce((total, item) => {
      const drink = data.drinks.find((candidate) => candidate.id === item.drinkId);
      return total + (drink?.points ?? 0) * item.quantity;
    }, 0);

    setWallet((currentWallet) => ({
      ...currentWallet,
      balance: Number((currentWallet.balance - cartTotal).toFixed(2)),
    }));
    setPoints((currentPoints) => currentPoints + pointsEarned);
    setTransactions((currentTransactions) => [
      nowTransaction(selectedVenue.name, -cartTotal),
      ...currentTransactions,
    ]);
    setSwipeDirection(null);
    setRoute(null);
    setActiveTab('wallet');
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Reconcile with the server's authoritative points/wallet totals.
    createOrder({ venueId: selectedVenue.id, items: cart })
      .then((result) => {
        setPoints(result.points);
        setWallet((currentWallet) => ({ ...currentWallet, balance: result.walletBalance }));
      })
      .catch(() => undefined);
    Alert.alert('Drink booked', `Your order at ${selectedVenue.name} is ready for pickup soon.`);
  };

  const topUp = () => {
    const amount = 25;

    setWallet((currentWallet) => ({
      ...currentWallet,
      balance: Number((currentWallet.balance + amount).toFixed(2)),
    }));
    setTransactions((currentTransactions) => [nowTransaction('Wallet top up', amount), ...currentTransactions]);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    topUpWallet({ amount })
      .then((result) => setWallet((currentWallet) => ({ ...currentWallet, balance: result.balance })))
      .catch(() => undefined);
  };

  const inviteFriends = () => {
    Alert.alert('Invite ready', 'A GoodPint trip invite has been prepared for your group.');
  };

  const bottomNav = <BottomNav activeTab={activeTab} onTabChange={changeTab} />;

  const goBack = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRoute(null);
  };

  let content;

  if (route?.name === 'redeem') {
    content = (
      <RedeemScreen
        points={points}
        reward={selectedReward}
        voucher={activeVoucher}
        secondsRemaining={secondsRemaining}
        onBack={goBack}
      />
    );
  } else if (route?.name === 'buy') {
    content = (
      <BuyDrinkScreen
        venue={selectedVenue}
        drinks={data.drinks}
        cart={cart}
        total={cartTotal}
        onBack={goBack}
        onChangeQuantity={changeQuantity}
        onPay={payForOrder}
      />
    );
  } else if (activeTab === 'points') {
    content = (
      <PointsScreen
        points={points}
        rewards={data.rewards}
        earningRules={data.earningRules}
        tiers={data.tiers}
        onOpenRedeem={openRedeem}
        onOpenHistory={() => changeTab('wallet')}
      />
    );
  } else if (activeTab === 'plan') {
    content = (
      <PlanScreen
        trips={data.trips}
        venues={data.venues}
        onInviteFriends={inviteFriends}
        onAddStop={() => changeTab('explore')}
        onOpenBuy={openBuy}
      />
    );
  } else if (activeTab === 'wallet') {
    content = (
      <WalletScreen
        wallet={wallet}
        passes={data.passes}
        vouchers={data.vouchers}
        transactions={transactions}
        onTopUp={topUp}
      />
    );
  } else if (activeTab === 'profile') {
    content = (
      <ProfileScreen
        profile={data.profile}
        points={points}
        wallet={wallet}
        favoriteVenue={data.venues[0]}
      />
    );
  } else {
    content = (
      <ExploreScreen
        selectedFilter={selectedFilter}
        onFilterChange={setSelectedFilter}
        onOpenRedeem={() => openRedeem()}
        locationStatus={locationStatus}
        userCoords={userCoords}
        osmPubs={osmPubs}
        pubsLoading={pubsLoading}
        pubsError={pubsError}
        ratings={ratings}
        userRatings={userRatings}
        onSubmitReview={handleSubmitReview}
        onOpenBuy={openBuy}
      />
    );
  }

  const animationKey = route ? `${route.name}-${route.name === 'buy' ? route.venueId : route.rewardId}` : activeTab;

  const swipeLeft = route ? undefined : () => {
    const idx = TAB_ORDER.indexOf(activeTabRef.current);
    if (idx < TAB_ORDER.length - 1) changeTab(TAB_ORDER[idx + 1]);
  };

  const swipeRight = route ? undefined : () => {
    const idx = TAB_ORDER.indexOf(activeTabRef.current);
    if (idx > 0) changeTab(TAB_ORDER[idx - 1]);
  };

  return (
    <ScreenFrame bottomNav={bottomNav} scrollKey={animationKey} onSwipeLeft={swipeLeft} onSwipeRight={swipeRight}>
      <AnimatedScreen animationKey={animationKey} variant={route ? 'push' : 'tab'} direction={route ? null : swipeDirection}>{content}</AnimatedScreen>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
