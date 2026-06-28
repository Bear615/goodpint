import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BottomNav } from './src/components/BottomNav';
import { AnimatedScreen } from './src/components/Motion';
import { ScreenFrame } from './src/components/ScreenFrame';
import { initialAppState } from './src/data/goodpint';
import { BuyDrinkScreen } from './src/screens/BuyDrinkScreen';
import { ExploreScreen } from './src/screens/ExploreScreen';
import { PlanScreen } from './src/screens/PlanScreen';
import { PointsScreen } from './src/screens/PointsScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { RedeemScreen } from './src/screens/RedeemScreen';
import { WalletScreen } from './src/screens/WalletScreen';
import { createOrder, getAppState, getRatings, getUserRatings, submitReview, topUpWallet } from './src/services/api';
import { getUserId } from './src/utils/userId';
import type { AppStatePayload, CartItem, FilterKey, OsmPub, RatingMap, TabKey, Transaction, WalletState } from './src/types';
import { fetchNearbyPubs } from './src/utils/pubs';

type NestedRoute = { name: 'redeem'; rewardId: string } | { name: 'buy'; venueId: string } | null;

function nowTransaction(title: string, amount: number): Transaction {
  return {
    id: `tx-${Date.now()}-${Math.round(Math.random() * 1000)}`,
    title,
    amount,
    timestamp: 'Just now',
  };
}

export default function App() {
  const [data, setData] = useState<AppStatePayload>(initialAppState);
  const [points, setPoints] = useState(initialAppState.points);
  const [wallet, setWallet] = useState<WalletState>(initialAppState.wallet);
  const [transactions, setTransactions] = useState(initialAppState.transactions);
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
  const [cart, setCart] = useState<CartItem[]>([{ drinkId: initialAppState.drinks[0].id, quantity: 1 }]);
  const [secondsRemaining, setSecondsRemaining] = useState(299);

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
        setCart([{ drinkId: remoteState.drinks[0]?.id ?? 'goodpint-lager', quantity: 1 }]);
      })
      .catch(() => {
        // The mobile app is intentionally useful without the local API running.
      });

    getRatings()
      .then((remoteRatings) => {
        if (mounted) setRatings(remoteRatings);
      })
      .catch(() => undefined);

    getUserId()
      .then((userId) => getUserRatings(userId))
      .then((remoteUserRatings) => {
        if (mounted) setUserRatings(remoteUserRatings);
      })
      .catch(() => undefined);

    return () => {
      mounted = false;
    };
  }, []);

  const handleSubmitReview = async (pubId: string, rating: number, pubName: string) => {
    const userId = await getUserId();
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

    submitReview({ pubId, userId, rating, pubName })
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
  const selectedVenue = route?.name === 'buy' ? data.venues.find((venue) => venue.id === route.venueId) ?? data.venues[0] : data.venues[0];

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

  const openRedeem = (rewardId?: string) => {
    const nextRewardId = rewardId || data.rewards[0]?.id || 'free-drink';

    setSwipeDirection(null);
    setActiveTab('points');
    setRoute({ name: 'redeem', rewardId: nextRewardId });
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const openBuy = (venueId: string) => {
    setSwipeDirection(null);
    setActiveTab('explore');
    setCart([{ drinkId: data.drinks[0]?.id ?? 'goodpint-lager', quantity: 1 }]);
    setRoute({ name: 'buy', venueId });
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

    void createOrder({ venueId: selectedVenue.id, items: cart }).catch(() => undefined);
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
    void topUpWallet({ amount }).catch(() => undefined);
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
      />
    );
  } else if (activeTab === 'plan') {
    content = <PlanScreen trips={data.trips} venues={data.venues} onInviteFriends={inviteFriends} />;
  } else if (activeTab === 'wallet') {
    content = <WalletScreen wallet={wallet} passes={data.passes} transactions={transactions} onTopUp={topUp} />;
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
    <SafeAreaProvider>
      <ScreenFrame bottomNav={bottomNav} scrollKey={animationKey} onSwipeLeft={swipeLeft} onSwipeRight={swipeRight}>
        <AnimatedScreen animationKey={animationKey} variant={route ? 'push' : 'tab'} direction={route ? null : swipeDirection}>{content}</AnimatedScreen>
      </ScreenFrame>
    </SafeAreaProvider>
  );
}
