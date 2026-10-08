import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BottomNav } from './src/components/BottomNav';
import { AnimatedScreen } from './src/components/Motion';
import { ScreenFrame } from './src/components/ScreenFrame';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { emptyAppState } from './src/data/goodpint';
import { ClaimSheet } from './src/components/wallet/ClaimSheet';
import { AuthScreen } from './src/screens/AuthScreen';
import { BuyDrinkScreen } from './src/screens/BuyDrinkScreen';
import { ExploreScreen } from './src/screens/ExploreScreen';
import { PlanScreen } from './src/screens/PlanScreen';
import { PointsScreen } from './src/screens/PointsScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { WalletScreen } from './src/screens/WalletScreen';
import {
  ApiError,
  createOrder,
  getAppState,
  getRatings,
  getUserRatings,
  getVouchers,
  newIdempotencyKey,
  redeemReward,
  submitReview,
  topUpWallet,
} from './src/services/api';
import { colors } from './src/theme';
import type {
  AppLoadStatus,
  AppStatePayload,
  CartItem,
  ClaimResult,
  FilterKey,
  OsmPub,
  RatingMap,
  RecentEarn,
  TabKey,
  Transaction,
  Voucher,
  WalletState,
} from './src/types';
import { fetchNearbyPubs } from './src/utils/pubs';
import { crossedReward } from './src/utils/rewards';

type NestedRoute = { name: 'buy'; venueId: string; pubName: string } | null;

// A scan at the bar this recent is still worth celebrating when it is noticed.
const CELEBRATE_WITHIN_MS = 30 * 60_000;

function nowTransaction(title: string, amount: number): Transaction {
  return {
    id: `tx-${Date.now()}-${Math.round(Math.random() * 1000)}`,
    title,
    amount,
    timestamp: 'Just now',
    createdAt: new Date().toISOString(),
  };
}

// Top-level: provide auth and gate the rest of the app behind sign-in.
export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  // Hold on the plain background until Inter is ready so text never reflows
  // from the system font. If loading fails, carry on with the fallback.
  if (!fontsLoaded && !fontError) {
    return <View style={styles.loading} />;
  }

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
  // Guards the value-moving flows against a double tap sending two orders.
  const [isSubmitting, setIsSubmitting] = useState(false);
  // One key per checkout, held across retries. If the first attempt actually
  // reached the server but the reply was lost, retrying with the same key
  // replays that result instead of placing a second order; a fresh key per
  // attempt would defeat the whole mechanism.
  const orderKeyRef = useRef<string | null>(null);
  // Until the first load lands, the seeded empty state is not the user's real
  // wallet, so screens that would show "0 pts" or "no vouchers" wait for this.
  const [appStatus, setAppStatus] = useState<AppLoadStatus>('loading');
  // Kept after closing so the sheet's content survives its exit animation.
  const [claim, setClaim] = useState<{ rewardId: string; open: boolean } | null>(null);
  // Wallet moments: a voucher just claimed, a voucher just scanned at the bar,
  // points just earned. Cleared when the user leaves the Wallet tab.
  const [freshVoucherId, setFreshVoucherId] = useState<string | null>(null);
  const [justRedeemedId, setJustRedeemedId] = useState<string | null>(null);
  const [recentEarn, setRecentEarn] = useState<RecentEarn | null>(null);
  // Held across a retry of the same reward only after a failure that may have
  // landed, so the server replays the first success instead of spending twice.
  const redeemKeyRef = useRef<{ rewardId: string; key: string } | null>(null);
  // Bumped by every successful claim, so a voucher refresh already in flight
  // cannot overwrite the list with one that lacks the new voucher.
  const voucherWriteSeq = useRef(0);
  const vouchersRef = useRef(data.vouchers);
  const mountedRef = useRef(true);
  useEffect(() => { vouchersRef.current = data.vouchers; }, [data.vouchers]);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const reloadAppState = useCallback(async () => {
    setAppStatus('loading');
    try {
      const remoteState = await getAppState();
      if (!mountedRef.current) return;
      setData(remoteState);
      setPoints(remoteState.points);
      setWallet(remoteState.wallet);
      setTransactions(remoteState.transactions);
      if (remoteState.drinks[0]) {
        setCart([{ drinkId: remoteState.drinks[0].id, quantity: 1 }]);
      }
      setAppStatus('ready');
    } catch {
      if (mountedRef.current) setAppStatus('error');
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    void reloadAppState();

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
  }, [user, reloadAppState]);

  const handleSubmitReview = async (pubId: string, rating: number, pubName: string, note?: string) => {
    const prevUserRating = userRatings[pubId];
    const previousRating = ratings[pubId] ?? { average: 0, count: 0 };

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

    // An optimistic rating is fine — it is display state, not money — but a
    // rejection has to be undone rather than swallowed. Submissions can now be
    // refused (the daily new-pub cap, or the write rate limit), and leaving the
    // optimistic value in place would show a rating that was never saved.
    try {
      const result = await submitReview({ pubId, rating, pubName, note });
      setRatings((current) => ({ ...current, [pubId]: { average: result.average, count: result.count } }));
      setPoints(result.points);
    } catch (error) {
      setUserRatings((current) => {
        const reverted = { ...current };
        if (prevUserRating === undefined) delete reverted[pubId];
        else reverted[pubId] = prevUserRating;
        return reverted;
      });
      setRatings((current) => ({ ...current, [pubId]: previousRating }));
      Alert.alert(
        'Review not saved',
        error instanceof ApiError ? error.message : 'Something went wrong. Please try again.',
      );
    }
  };

  const loadPubs = useCallback(async (lat: number, lon: number, isMounted: () => boolean = () => true) => {
    setPubsLoading(true);
    setPubsError(false);
    try {
      const pubs = await fetchNearbyPubs(lat, lon, lat, lon);
      if (!isMounted()) return;
      setOsmPubs(pubs);
    } catch (err) {
      console.error('[pubs] fetchNearbyPubs failed:', err);
      if (isMounted()) setPubsError(true);
    } finally {
      if (isMounted()) setPubsLoading(false);
    }
  }, []);

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
      await loadPubs(lat, lon, () => mounted);
    })();

    return () => { mounted = false; };
  }, [loadPubs]);

  const retryPubs = () => {
    if (userCoords) void loadPubs(userCoords.lat, userCoords.lon);
  };

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

  // Re-reads vouchers, quietly: a failure keeps what is on screen. A voucher
  // that has just gone from active to redeemed was scanned at the bar, and the
  // Wallet celebrates it if the user is looking.
  const refreshVouchers = useCallback(async () => {
    const seq = voucherWriteSeq.current;
    let list: Voucher[];
    try {
      list = await getVouchers();
    } catch {
      return;
    }
    if (!mountedRef.current || seq !== voucherWriteSeq.current) return;

    const before = new Map(vouchersRef.current.map((voucher) => [voucher.id, voucher.status]));
    const now = Date.now();
    const justUsed = list
      .filter(
        (voucher) =>
          voucher.status === 'redeemed' &&
          before.get(voucher.id) === 'active' &&
          voucher.redeemedAt !== null &&
          now - Date.parse(voucher.redeemedAt) < CELEBRATE_WITHIN_MS,
      )
      .sort((a, b) => (b.redeemedAt ?? '').localeCompare(a.redeemedAt ?? ''))[0];

    setData((current) => ({ ...current, vouchers: list }));
    if (justUsed && activeTabRef.current === 'wallet') {
      setJustRedeemedId(justUsed.id);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, []);

  // Refreshed here rather than in the Wallet screen, which mounts more than
  // once during a tab slide.
  useEffect(() => {
    if (activeTab === 'wallet' && appStatus === 'ready') void refreshVouchers();
  }, [activeTab, appStatus, refreshVouchers]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && activeTabRef.current === 'wallet') void refreshVouchers();
    });
    // react-native-web returns nothing when the visibility API is unavailable.
    return () => subscription?.remove();
  }, [refreshVouchers]);

  useEffect(() => {
    if (activeTab === 'wallet') return;
    setFreshVoucherId(null);
    setRecentEarn(null);
    setJustRedeemedId(null);
  }, [activeTab]);

  const requestClaim = (rewardId: string) => {
    if (!data.rewards.some((reward) => reward.id === rewardId)) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setClaim({ rewardId, open: true });
  };

  // Always resolves, so the claim sheet can show a refusal inline.
  const confirmClaim = async (rewardId: string): Promise<ClaimResult> => {
    if (isSubmitting) {
      return { ok: false, message: 'Another payment is still going through. Try again in a moment.' };
    }

    const key = redeemKeyRef.current?.rewardId === rewardId ? redeemKeyRef.current.key : newIdempotencyKey();
    redeemKeyRef.current = { rewardId, key };

    setIsSubmitting(true);
    try {
      const result = await redeemReward({ rewardId }, key);
      redeemKeyRef.current = null;
      voucherWriteSeq.current += 1;
      setPoints(result.points);
      setData((current) => ({
        ...current,
        vouchers: [result.voucher, ...current.vouchers.filter((voucher) => voucher.id !== result.voucher.id)],
      }));
      setFreshVoucherId(result.voucher.id);
      // The claim is now the latest moment; an earlier scan or order gives way.
      setJustRedeemedId(null);
      setRecentEarn(null);
      setClaim((current) => current && { ...current, open: false });
      if (activeTabRef.current !== 'wallet') changeTab('wallet');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return { ok: true };
    } catch (error) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
        // The server stores refusals against the key too, so a retry needs a
        // fresh one or it would only replay the same refusal.
        redeemKeyRef.current = null;
        const serverPoints = error.details?.points;
        if (error.status === 402 && typeof serverPoints === 'number') setPoints(serverPoints);
      }
      return {
        ok: false,
        message: error instanceof ApiError ? error.message : 'Couldn’t add this reward. Your points haven’t been spent.',
      };
    } finally {
      setIsSubmitting(false);
    }
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

  // Money moves only once the server says it did.
  //
  // These flows used to update the local balance, announce success, and *then*
  // fire the request with its rejection swallowed. Anything the server refused —
  // a stale balance, a rate limit, a pub that came from the map rather than our
  // catalog — left the user looking at a confirmation and a debited balance for
  // an order that did not exist. The server is the only authority on a balance,
  // so nothing is shown until it has answered.
  const payForOrder = async () => {
    if (isSubmitting) return;

    if (cartTotal <= 0) {
      Alert.alert('Add a drink', 'Choose at least one drink before paying.');
      return;
    }

    // A courtesy check so the common case fails fast and locally; the server
    // enforces the real one against the authoritative balance.
    if (wallet.balance < cartTotal) {
      Alert.alert('Top up wallet', 'Add money to your GoodPint balance in the Wallet tab before placing this order.');
      return;
    }

    if (!orderKeyRef.current) orderKeyRef.current = newIdempotencyKey();

    setIsSubmitting(true);
    try {
      const result = await createOrder({ venueId: selectedVenue.id, items: cart }, orderKeyRef.current);
      orderKeyRef.current = null;

      setPoints(result.points);
      setWallet((currentWallet) => ({ ...currentWallet, balance: result.walletBalance }));
      setTransactions((currentTransactions) => [
        nowTransaction(selectedVenue.name, -cartTotal),
        ...currentTransactions,
      ]);
      // The membership pass confirms the order and counts the points up, in
      // place of an Alert (which react-native-web never shows).
      setRecentEarn(
        result.pointsEarned > 0
          ? {
              points: result.pointsEarned,
              venueName: selectedVenue.name,
              unlockedRewardId: crossedReward(result.points - result.pointsEarned, result.points, data.rewards)?.id ?? null,
            }
          : null,
      );
      setSwipeDirection(null);
      setRoute(null);
      setActiveTab('wallet');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        'Order not placed',
        error instanceof ApiError ? error.message : 'Something went wrong. Your card has not been charged.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Resolves true once the server has credited the wallet, so the top-up sheet
  // only celebrates money that actually arrived.
  const topUp = async (amount: number): Promise<boolean> => {
    if (isSubmitting) return false;

    setIsSubmitting(true);
    try {
      const result = await topUpWallet({ amount }, newIdempotencyKey());
      setWallet((currentWallet) => ({ ...currentWallet, balance: result.balance }));
      setTransactions((currentTransactions) => [nowTransaction('Wallet top up', amount), ...currentTransactions]);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return true;
    } catch (error) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        'Top up failed',
        error instanceof ApiError ? error.message : 'Something went wrong. Your card has not been charged.',
      );
      return false;
    } finally {
      setIsSubmitting(false);
    }
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

  if (route?.name === 'buy') {
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
        onClaimReward={requestClaim}
        onOpenVouchers={() => changeTab('wallet')}
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
        status={appStatus}
        wallet={wallet}
        points={points}
        tiers={data.tiers}
        rewards={data.rewards}
        drinks={data.drinks}
        venues={data.venues}
        holderName={data.profile.name}
        memberSince={data.profile.joinedLabel}
        vouchers={data.vouchers}
        transactions={transactions}
        freshVoucherId={freshVoucherId}
        justRedeemedId={justRedeemedId}
        recentEarn={recentEarn}
        onClaim={requestClaim}
        onBrowseRewards={() => changeTab('points')}
        onOrderAgain={openBuy}
        onFindDrink={() => changeTab('explore')}
        onRefreshVouchers={refreshVouchers}
        onDismissRedeemed={() => setJustRedeemedId(null)}
        onRetry={() => void reloadAppState()}
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
        onOpenRewards={() => changeTab('points')}
        locationStatus={locationStatus}
        userCoords={userCoords}
        osmPubs={osmPubs}
        pubsLoading={pubsLoading}
        pubsError={pubsError}
        onRetryPubs={retryPubs}
        points={points}
        ratings={ratings}
        userRatings={userRatings}
        onSubmitReview={handleSubmitReview}
        onOpenBuy={openBuy}
      />
    );
  }

  const animationKey = route ? `buy-${route.venueId}` : activeTab;

  const swipeLeft = route ? undefined : () => {
    const idx = TAB_ORDER.indexOf(activeTabRef.current);
    if (idx < TAB_ORDER.length - 1) changeTab(TAB_ORDER[idx + 1]);
  };

  const swipeRight = route ? undefined : () => {
    const idx = TAB_ORDER.indexOf(activeTabRef.current);
    if (idx > 0) changeTab(TAB_ORDER[idx - 1]);
  };

  return (
    <>
      <ScreenFrame bottomNav={bottomNav} scrollKey={animationKey} onSwipeLeft={swipeLeft} onSwipeRight={swipeRight}>
        <AnimatedScreen animationKey={animationKey} variant={route ? 'push' : 'tab'} direction={route ? null : swipeDirection}>{content}</AnimatedScreen>
      </ScreenFrame>
      {/* Hosted here so both the Points and Wallet tabs share it and tab
          animations never remount it mid-claim. */}
      <ClaimSheet
        visible={!!claim?.open}
        reward={data.rewards.find((reward) => reward.id === claim?.rewardId) ?? null}
        points={points}
        onClose={() => setClaim((current) => current && { ...current, open: false })}
        onConfirm={confirmClaim}
      />
    </>
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
