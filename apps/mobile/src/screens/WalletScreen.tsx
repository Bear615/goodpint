import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Beer, ChevronRight, CreditCard, Gift, Plus, Star, type LucideIcon } from 'lucide-react-native';
import { colors, font, formatPoints } from '../theme';
import type { Pass, Transaction, Voucher, WalletState } from '../types';
import { PressableScale } from '../components/Motion';
import { SectionCard } from '../components/SectionCard';
import { ActivityList } from '../components/wallet/ActivityList';
import { SpendingInsights } from '../components/wallet/SpendingInsights';
import { TopUpSheet } from '../components/wallet/TopUpSheet';
import { VoucherStack } from '../components/wallet/VoucherStack';
import { WalletCard } from '../components/wallet/WalletCard';

interface WalletScreenProps {
  wallet: WalletState;
  points: number;
  holderName: string;
  passes: Pass[];
  // Redeemed rewards the user can present at a pub.
  vouchers?: Voucher[];
  transactions: Transaction[];
  /** Resolves true once the server has credited the wallet. */
  onTopUp: (amount: number) => Promise<boolean>;
  onOpenRewards: () => void;
  onOpenExplore: () => void;
}

export function WalletScreen({
  wallet,
  points,
  holderName,
  passes,
  vouchers = [],
  transactions,
  onTopUp,
  onOpenRewards,
  onOpenExplore,
}: WalletScreenProps) {
  const [hidden, setHidden] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const closeTopUp = useCallback(() => setTopUpOpen(false), []);

  const hasCard = wallet.cardLast4.length > 0;
  const now = Date.now();
  const readyCount =
    passes.filter((pass) => pass.status !== 'Used').length +
    vouchers.filter(
      (voucher) => voucher.status === 'active' && (!voucher.expiresAt || new Date(voucher.expiresAt).getTime() > now),
    ).length;

  const flip = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFlipped((value) => !value);
  };

  const toggleHidden = () => {
    void Haptics.selectionAsync();
    setHidden((value) => !value);
  };

  const openTopUp = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTopUpOpen(true);
  };

  return (
    <View>
      <View style={styles.header}>
        <Text style={styles.title}>Wallet</Text>
        <PressableScale accessibilityLabel="View rewards" onPress={onOpenRewards} style={styles.pointsPill} pressedScale={0.94}>
          <View style={styles.pointsPillInner}>
            <Star color={colors.gold} fill={colors.gold} size={14} />
            <Text style={styles.pointsText}>{formatPoints(points)} pts</Text>
          </View>
        </PressableScale>
      </View>

      <WalletCard
        balance={wallet.balance}
        cardLast4={wallet.cardLast4}
        holderName={holderName}
        points={points}
        hidden={hidden}
        flipped={flipped}
        onToggleHidden={toggleHidden}
        onFlip={flip}
      />

      <View style={styles.actions}>
        <QuickAction label="Add money" Icon={Plus} primary onPress={openTopUp} />
        <QuickAction label="Buy a drink" Icon={Beer} onPress={onOpenExplore} />
        <QuickAction label="Rewards" Icon={Gift} onPress={onOpenRewards} />
        <QuickAction label={flipped ? 'Card front' : 'Card details'} Icon={CreditCard} onPress={flip} />
      </View>

      <SectionHeader title="This week" />
      <SpendingInsights transactions={transactions} hidden={hidden} />

      <SectionHeader
        title="Passes & vouchers"
        accessory={readyCount > 0 ? <Text style={styles.readyBadge}>{readyCount} ready</Text> : null}
      />
      <VoucherStack vouchers={vouchers} passes={passes} onBrowseRewards={onOpenRewards} />

      <SectionHeader title="Activity" />
      <ActivityList transactions={transactions} hidden={hidden} />

      <SectionCard style={styles.manage}>
        <PressableScale
          accessibilityLabel="Payment methods"
          onPress={() => Alert.alert('Payment Methods', 'Card management coming soon.')}
          pressedScale={0.985}
        >
          <View style={styles.manageRow}>
            <View style={styles.manageIcon}>
              <CreditCard color={colors.text} size={19} />
            </View>
            <View style={styles.manageCopy}>
              <Text style={styles.manageTitle}>Payment methods</Text>
              <Text style={styles.manageSubtitle}>{hasCard ? `Card ending ${wallet.cardLast4}` : 'No card added yet'}</Text>
            </View>
            <ChevronRight color={colors.textMuted} size={20} />
          </View>
        </PressableScale>
      </SectionCard>

      <TopUpSheet
        visible={topUpOpen}
        balance={wallet.balance}
        cardLast4={wallet.cardLast4}
        onClose={closeTopUp}
        onConfirm={onTopUp}
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

interface QuickActionProps {
  label: string;
  Icon: LucideIcon;
  onPress: () => void;
  primary?: boolean;
}

function QuickAction({ Icon, label, onPress, primary }: QuickActionProps) {
  return (
    <PressableScale accessibilityLabel={label} onPress={onPress} pressedScale={0.92} style={styles.action}>
      <View style={styles.actionInner}>
        <View style={[styles.actionIcon, primary && styles.actionIconPrimary]}>
          <Icon color={primary ? '#1A1200' : colors.text} size={22} strokeWidth={primary ? 2.6 : 2} />
        </View>
        <Text style={styles.actionLabel} numberOfLines={1}>{label}</Text>
      </View>
    </PressableScale>
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
  title: {
    color: colors.text,
    fontFamily: font.semibold,
    fontSize: 24,
    letterSpacing: -0.6,
  },
  pointsPill: {
    borderRadius: 18,
  },
  pointsPillInner: {
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  pointsText: {
    color: colors.text,
    fontFamily: font.semibold,
    fontSize: 13,
  },
  actions: {
    marginTop: 20,
    flexDirection: 'row',
  },
  action: {
    flex: 1,
  },
  actionInner: {
    alignItems: 'center',
    gap: 8,
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panelRaised,
  },
  actionIconPrimary: {
    borderColor: colors.gold,
    backgroundColor: colors.gold,
  },
  actionLabel: {
    color: colors.textMuted,
    fontFamily: font.medium,
    fontSize: 12,
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
  readyBadge: {
    color: colors.gold,
    fontFamily: font.medium,
    fontSize: 13,
  },
  manage: {
    marginTop: 28,
  },
  manageRow: {
    minHeight: 68,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  manageIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  manageCopy: {
    flex: 1,
  },
  manageTitle: {
    color: colors.text,
    fontFamily: font.medium,
    fontSize: 15,
  },
  manageSubtitle: {
    marginTop: 2,
    color: colors.textSubtle,
    fontFamily: font.regular,
    fontSize: 12,
  },
});
