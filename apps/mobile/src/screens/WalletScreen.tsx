import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, StyleSheet, Text, View } from 'react-native';
import { CircleAlert, Gift, Ticket } from 'lucide-react-native';
import { colors, font, formatPoints, radii } from '../theme';
import type {
  AppLoadStatus,
  Drink,
  RecentEarn,
  Reward,
  Tier,
  Transaction,
  Venue,
  Voucher,
  WalletState,
} from '../types';
import { GoldButton } from '../components/GoldButton';
import { PressableScale } from '../components/Motion';
import { SectionCard } from '../components/SectionCard';
import { BalanceRow } from '../components/wallet/BalanceRow';
import { MembershipPass } from '../components/wallet/MembershipPass';
import { PassDetailsSheet } from '../components/wallet/PassDetailsSheet';
import { passAnimation } from '../components/wallet/passMetrics';
import { PassStack } from '../components/wallet/PassStack';
import { RewardHistory } from '../components/wallet/RewardHistory';
import { VoucherPass } from '../components/wallet/VoucherPass';
import {
  byExpiry,
  currentTier,
  defaultOpenId,
  isVoucherLive,
  lastOrderedVenue,
  MEMBER_PASS_ID,
  rewardProgress,
} from '../utils/rewards';
import { useReducedMotion } from '../utils/useReducedMotion';

// While a voucher's QR is open, check now and then whether the bar has scanned
// it, so the pass can celebrate. Bounded so a forgotten phone stops asking.
const POLL_INTERVAL_MS = 15_000;
const POLL_WINDOW_MS = 5 * 60_000;

interface WalletScreenProps {
  status: AppLoadStatus;
  wallet: WalletState;
  points: number;
  tiers: Tier[];
  rewards: Reward[];
  drinks: Drink[];
  venues: Venue[];
  holderName: string;
  memberSince: string;
  vouchers: Voucher[];
  transactions: Transaction[];
  // Moments App tracks while the user is on this tab.
  freshVoucherId: string | null;
  justRedeemedId: string | null;
  recentEarn: RecentEarn | null;
  onClaim: (rewardId: string) => void;
  onBrowseRewards: () => void;
  onOrderAgain: (venueId: string, pubName: string) => void;
  onFindDrink: () => void;
  onRefreshVouchers: () => Promise<void>;
  onDismissRedeemed: () => void;
  onRetry: () => void;
  /** Resolves true once the server has credited the wallet. */
  onTopUp: (amount: number) => Promise<boolean>;
}

export function WalletScreen({
  status,
  wallet,
  points,
  tiers,
  rewards,
  drinks,
  venues,
  holderName,
  memberSince,
  vouchers,
  transactions,
  freshVoucherId,
  justRedeemedId,
  recentEarn,
  onClaim,
  onBrowseRewards,
  onOrderAgain,
  onFindDrink,
  onRefreshVouchers,
  onDismissRedeemed,
  onRetry,
  onTopUp,
}: WalletScreenProps) {
  const reducedMotion = useReducedMotion();
  // undefined means "whatever the default rule picks"; null means all closed.
  const [openId, setOpenId] = useState<string | null | undefined>(undefined);
  const [detailsVoucher, setDetailsVoucher] = useState<Voucher | null>(null);
  // Held separately so the sheet keeps its content while it animates away.
  const [detailsOpen, setDetailsOpen] = useState(false);

  const now = Date.now();
  const liveVouchers = vouchers.filter((voucher) => isVoucherLive(voucher, now)).sort(byExpiry);
  const celebrating = justRedeemedId ? vouchers.find((voucher) => voucher.id === justRedeemedId) : undefined;
  // A voucher just scanned at the bar stays in the stack to celebrate.
  const stackVouchers =
    celebrating && !liveVouchers.includes(celebrating) ? [...liveVouchers, celebrating].sort(byExpiry) : liveVouchers;
  const ids = [MEMBER_PASS_ID, ...stackVouchers.map((voucher) => voucher.id)];

  const effectiveOpenId =
    openId === undefined || (openId !== null && !ids.includes(openId))
      ? defaultOpenId({ stack: stackVouchers, justRedeemedId, freshVoucherId, recentEarn })
      : openId;

  // A new voucher or a scan at the bar takes over the stack. Compared against
  // the previous value so a remount does not replay it.
  const lastFresh = useRef(freshVoucherId);
  useEffect(() => {
    if (freshVoucherId && freshVoucherId !== lastFresh.current) {
      passAnimation();
      setOpenId(freshVoucherId);
    }
    lastFresh.current = freshVoucherId;
  }, [freshVoucherId]);

  const lastRedeemed = useRef(justRedeemedId);
  useEffect(() => {
    if (justRedeemedId && justRedeemedId !== lastRedeemed.current) {
      passAnimation();
      setOpenId(justRedeemedId);
    }
    lastRedeemed.current = justRedeemedId;
  }, [justRedeemedId]);

  // Only while a live voucher's QR is open, only in the foreground, and only
  // for a few minutes. App already refreshed on the way in, so no fetch here
  // on start: the screen remounts during a tab slide.
  const pollId = stackVouchers.some((voucher) => voucher.id === effectiveOpenId && isVoucherLive(voucher, now))
    ? effectiveOpenId
    : null;
  useEffect(() => {
    if (!pollId) return;
    const started = Date.now();
    const timer = setInterval(() => {
      if (Date.now() - started > POLL_WINDOW_MS) {
        clearInterval(timer);
        return;
      }
      if (AppState.currentState !== 'active') return;
      void onRefreshVouchers();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [pollId, onRefreshVouchers]);

  // Re-read from the live list so a scan at the bar while the sheet is open
  // flips it to Used; the stored copy only bridges the closing animation.
  const shownDetails = (detailsVoucher && vouchers.find((voucher) => voucher.id === detailsVoucher.id)) ?? detailsVoucher;

  const balanceTransactions = useMemo(() => transactions.filter((tx) => tx.amount !== 0), [transactions]);
  const { affordable } = rewardProgress(points, rewards);
  const pointsUsed = vouchers.reduce((total, voucher) => total + voucher.pointsSpent, 0);

  const toggle = (id: string) => {
    passAnimation();
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setOpenId(effectiveOpenId === id ? null : id);
  };

  const showDetails = (voucher: Voucher) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDetailsVoucher(voucher);
    setDetailsOpen(true);
  };

  const empty = (() => {
    if (vouchers.length > 0) return { title: 'All poured', body: 'Your next voucher will land here.' };
    if (rewards.length === 0) return { title: 'No vouchers in your wallet', body: 'Your vouchers will appear here.' };
    if (affordable.length > 0) {
      return { title: 'No vouchers in your wallet', body: 'Claim a reward above — it lands here, ready to scan at the bar.' };
    }
    return { title: 'No vouchers in your wallet', body: 'Earn points, claim a reward, and it lands here ready to scan at the bar.' };
  })();

  return (
    <View>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Wallet</Text>
          {status === 'ready' && liveVouchers.length > 0 ? (
            <View style={styles.readyPill}>
              <Text style={styles.readyText}>{liveVouchers.length} ready</Text>
            </View>
          ) : null}
        </View>
        <PressableScale accessibilityLabel="Browse rewards" onPress={onBrowseRewards} style={styles.browse} pressedScale={0.92}>
          <View style={styles.browseInner}>
            <Gift color={colors.text} size={18} />
          </View>
        </PressableScale>
      </View>

      {status !== 'ready' ? (
        <SectionCard>
          <View style={styles.placeholder}>
            {status === 'loading' ? (
              <>
                <ActivityIndicator color={colors.gold} />
                <Text style={styles.placeholderText}>Loading your rewards…</Text>
              </>
            ) : (
              <>
                <CircleAlert color={colors.textSubtle} size={26} />
                <Text style={styles.placeholderTitle}>Couldn’t load your wallet</Text>
                <Text style={styles.placeholderText}>Check your connection and try again.</Text>
                <GoldButton label="Try again" compact onPress={onRetry} style={styles.retry} />
              </>
            )}
          </View>
        </SectionCard>
      ) : (
        <>
          <PassStack
            ids={ids}
            openId={effectiveOpenId}
            renderPass={(id, layout) => {
              if (id === MEMBER_PASS_ID) {
                return (
                  <MembershipPass
                    {...layout}
                    points={points}
                    tier={currentTier(points, tiers)}
                    rewards={rewards}
                    houseDrink={drinks[0] ?? null}
                    lastVenue={lastOrderedVenue(transactions, venues)}
                    holderName={holderName}
                    memberSince={memberSince}
                    recentEarn={recentEarn}
                    reducedMotion={reducedMotion}
                    onToggle={() => toggle(id)}
                    onClaim={onClaim}
                    onBrowseRewards={onBrowseRewards}
                    onOrderAgain={onOrderAgain}
                    onFindDrink={onFindDrink}
                  />
                );
              }
              const voucher = stackVouchers.find((candidate) => candidate.id === id);
              if (!voucher) return null;
              return (
                <VoucherPass
                  {...layout}
                  voucher={voucher}
                  isFresh={id === freshVoucherId}
                  isCelebrating={id === justRedeemedId}
                  onToggle={() => toggle(id)}
                  onShowDetails={showDetails}
                  onDismissRedeemed={() => {
                    passAnimation();
                    onDismissRedeemed();
                  }}
                />
              );
            }}
          />

          {stackVouchers.length === 0 ? (
            <View style={styles.emptySlot}>
              <View style={styles.emptyIcon}>
                <Ticket color={colors.gold} size={20} />
              </View>
              <View style={styles.emptyCopy}>
                <Text style={styles.emptyTitle}>{empty.title}</Text>
                <Text style={styles.emptyBody}>{empty.body}</Text>
              </View>
            </View>
          ) : null}

          <View style={styles.balance}>
            <BalanceRow
              balance={wallet.balance}
              cardLast4={wallet.cardLast4}
              transactions={balanceTransactions}
              onTopUp={onTopUp}
            />
          </View>

          {vouchers.length > 0 ? (
            <>
              <SectionHeader
                title="Reward history"
                accessory={<Text style={styles.accessory}>{formatPoints(pointsUsed)} pts used</Text>}
              />
              <RewardHistory vouchers={vouchers} onOpen={showDetails} />
            </>
          ) : null}
        </>
      )}

      <PassDetailsSheet
        voucher={shownDetails}
        description={rewards.find((reward) => reward.id === shownDetails?.rewardId)?.description}
        visible={detailsOpen}
        onClose={() => setDetailsOpen(false)}
      />
    </View>
  );
}

function SectionHeader({ accessory, title }: { title: string; accessory?: ReactNode }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {accessory}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 62,
    marginBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    color: colors.text,
    fontFamily: font.semibold,
    fontSize: 24,
    letterSpacing: -0.6,
  },
  readyPill: {
    height: 24,
    paddingHorizontal: 10,
    borderRadius: 12,
    justifyContent: 'center',
    backgroundColor: colors.goldSoft,
  },
  readyText: {
    color: colors.gold,
    fontFamily: font.semibold,
    fontSize: 12,
  },
  browse: {
    borderRadius: 18,
  },
  browseInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  placeholder: {
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  placeholderTitle: {
    marginTop: 4,
    color: colors.text,
    fontFamily: font.semibold,
    fontSize: 16,
  },
  placeholderText: {
    color: colors.textMuted,
    fontFamily: font.regular,
    fontSize: 13,
    textAlign: 'center',
  },
  retry: {
    marginTop: 8,
  },
  emptySlot: {
    marginTop: 12,
    minHeight: 96,
    padding: 16,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(244,200,74,0.3)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  emptyIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.goldSoft,
  },
  emptyCopy: {
    flex: 1,
  },
  emptyTitle: {
    color: colors.text,
    fontFamily: font.semibold,
    fontSize: 15,
  },
  emptyBody: {
    marginTop: 3,
    color: colors.textMuted,
    fontFamily: font.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  balance: {
    marginTop: 28,
  },
  sectionHeader: {
    marginTop: 30,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: colors.text,
    fontFamily: font.semibold,
    fontSize: 18,
    letterSpacing: -0.3,
  },
  accessory: {
    color: colors.textMuted,
    fontFamily: font.medium,
    fontSize: 13,
  },
});
