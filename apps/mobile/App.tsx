import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
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
import { createOrder, getAppState, topUpWallet } from './src/services/api';
import type { AppStatePayload, CartItem, FilterKey, TabKey, Transaction, WalletState } from './src/types';

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

    return () => {
      mounted = false;
    };
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
  };

  const openRedeem = (rewardId?: string) => {
    const nextRewardId = rewardId || data.rewards[0]?.id || 'free-drink';

    setSwipeDirection(null);
    setActiveTab('points');
    setRoute({ name: 'redeem', rewardId: nextRewardId });
  };

  const openBuy = (venueId: string) => {
    setSwipeDirection(null);
    setActiveTab('explore');
    setCart([{ drinkId: data.drinks[0]?.id ?? 'goodpint-lager', quantity: 1 }]);
    setRoute({ name: 'buy', venueId });
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
    void topUpWallet({ amount }).catch(() => undefined);
  };

  const inviteFriends = () => {
    Alert.alert('Invite ready', 'A GoodPint trip invite has been prepared for your group.');
  };

  const bottomNav = <BottomNav activeTab={activeTab} onTabChange={changeTab} />;

  let content;

  if (route?.name === 'redeem') {
    content = (
      <RedeemScreen
        points={points}
        reward={selectedReward}
        secondsRemaining={secondsRemaining}
        onBack={() => setRoute(null)}
      />
    );
  } else if (route?.name === 'buy') {
    content = (
      <BuyDrinkScreen
        venue={selectedVenue}
        drinks={data.drinks}
        cart={cart}
        total={cartTotal}
        onBack={() => setRoute(null)}
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
        venues={data.venues}
        selectedFilter={selectedFilter}
        onFilterChange={setSelectedFilter}
        onOpenBuy={openBuy}
        onOpenRedeem={() => openRedeem()}
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
