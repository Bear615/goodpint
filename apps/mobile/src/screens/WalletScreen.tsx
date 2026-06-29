import { Alert, StyleSheet, Text, View } from 'react-native';
import { ChevronRight, Gift, History, Plus, Star, Ticket, WalletCards } from 'lucide-react-native';
import React from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, font, formatCurrency, radii } from '../theme';
import type { Pass, Transaction, Voucher, WalletState } from '../types';
import { PressableScale } from '../components/Motion';
import { SectionCard } from '../components/SectionCard';

interface WalletScreenProps {
  wallet: WalletState;
  passes: Pass[];
  // Redeemed rewards the user can present at a pub.
  vouchers?: Voucher[];
  transactions: Transaction[];
  onTopUp: () => void;
}

export function WalletScreen({ wallet, passes, vouchers = [], transactions, onTopUp }: WalletScreenProps) {
  const [showAll, setShowAll] = React.useState(false);
  const visibleTx = showAll ? transactions : transactions.slice(0, 3);
  const hasCard = wallet.cardLast4.length > 0;
  return (
    <View>
      <Text style={styles.title}>Wallet</Text>

      <LinearGradient colors={['rgba(255,255,255,0.06)', 'rgba(244,200,74,0.065)']} style={styles.walletCard}>
        <View style={styles.cardTop}>
          <Text style={styles.cardTitle}>GoodPint Card</Text>
          <Text style={styles.cardDigits}>{hasCard ? `.... ${wallet.cardLast4}` : '•••• ••••'}</Text>
        </View>
        <Text style={styles.balance}>{formatCurrency(wallet.balance)}</Text>
        <View style={styles.cardBottom}>
          <Text style={styles.tapText}>{hasCard ? 'Tap to add funds' : 'Add a card to get started'}</Text>
          <PressableScale accessibilityLabel="Add funds" onPress={onTopUp} style={styles.addButton} pressedScale={0.9}>
            <Plus color="#1A1200" size={25} strokeWidth={2.6} />
          </PressableScale>
        </View>
      </LinearGradient>

      <Text style={styles.sectionTitle}>Your Passes</Text>
      <View style={styles.passList}>
        {passes.map((pass, index) => (
          <SectionCard key={pass.id}>
            <View style={styles.passRow}>
              <View style={styles.passIcon}>{index === 0 ? <Star color={colors.gold} size={23} fill={colors.gold} /> : <Gift color={colors.gold} size={23} />}</View>
              <View style={styles.passCopy}>
                <Text style={styles.passTitle}>{pass.title}</Text>
                <Text style={styles.passSubtitle}>{pass.subtitle}</Text>
              </View>
              <View style={styles.statusBadge}>
                <Text style={styles.statusText}>{pass.status}</Text>
              </View>
            </View>
          </SectionCard>
        ))}
        {vouchers.map((voucher) => (
          <SectionCard key={voucher.id}>
            <View style={styles.passRow}>
              <View style={styles.passIcon}>
                <Ticket color={colors.gold} size={23} />
              </View>
              <View style={styles.passCopy}>
                <Text style={styles.passTitle}>{voucher.title}</Text>
                <Text style={styles.passSubtitle}>Code {voucher.code}</Text>
              </View>
              <View style={styles.statusBadge}>
                <Text style={styles.statusText}>{voucher.status}</Text>
              </View>
            </View>
          </SectionCard>
        ))}
        {passes.length === 0 && vouchers.length === 0 ? (
          <SectionCard>
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No vouchers yet — redeem points in Points.</Text>
            </View>
          </SectionCard>
        ) : null}
      </View>

      <SectionCard>
        <PressableScale onPress={() => Alert.alert('Payment Methods', 'Card management coming soon.')}>
          <View style={styles.menuRow}>
            <WalletCards color={colors.text} size={23} />
            <Text style={styles.menuText}>Payment Methods</Text>
            <ChevronRight color={colors.text} size={22} />
          </View>
        </PressableScale>
        <View style={styles.menuDivider} />
        <PressableScale onPress={() => setShowAll((v) => !v)}>
          <View style={styles.menuRow}>
            <History color={colors.text} size={23} />
            <Text style={styles.menuText}>Transaction History</Text>
            <ChevronRight color={colors.text} size={22} />
          </View>
        </PressableScale>
      </SectionCard>

      <Text style={styles.sectionTitle}>{showAll ? 'All Transactions' : 'Recent'}</Text>
      <View style={styles.transactionList}>
        {visibleTx.map((transaction) => (
          <View key={transaction.id} style={styles.transactionRow}>
            <View>
              <Text style={styles.transactionTitle}>{transaction.title}</Text>
              <Text style={styles.transactionTime}>{transaction.timestamp}</Text>
            </View>
            <Text style={[styles.transactionAmount, transaction.amount > 0 && styles.transactionPositive]}>
              {transaction.amount === 0 ? 'Reward' : formatCurrency(transaction.amount)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    marginTop: 16,
    marginBottom: 16,
    color: colors.text,
    fontFamily: font.medium,
    fontSize: 24,
  },
  walletCard: {
    minHeight: 170,
    borderRadius: radii.sm,
    padding: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    color: colors.text,
    fontFamily: font.regular,
    fontSize: 16,
  },
  cardDigits: {
    color: colors.text,
    fontFamily: font.medium,
    fontSize: 16,
  },
  balance: {
    marginTop: 28,
    color: colors.gold,
    fontFamily: font.medium,
    fontSize: 30,
  },
  cardBottom: {
    marginTop: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tapText: {
    color: colors.textMuted,
    fontFamily: font.regular,
    fontSize: 15,
  },
  addButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gold,
  },
  sectionTitle: {
    marginTop: 28,
    marginBottom: 12,
    color: colors.text,
    fontFamily: font.medium,
    fontSize: 18,
  },
  passList: {
    gap: 10,
  },
  passRow: {
    minHeight: 80,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  passIcon: {
    width: 36,
    alignItems: 'center',
  },
  passCopy: {
    flex: 1,
  },
  passTitle: {
    color: colors.text,
    fontFamily: font.medium,
    fontSize: 15,
  },
  passSubtitle: {
    marginTop: 6,
    color: colors.textMuted,
    fontFamily: font.regular,
    fontSize: 12,
  },
  statusBadge: {
    height: 32,
    paddingHorizontal: 10,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.goldSoft,
  },
  statusText: {
    color: colors.gold,
    fontFamily: font.medium,
    fontSize: 12,
    textTransform: 'capitalize',
  },
  emptyState: {
    minHeight: 64,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  emptyText: {
    color: colors.textMuted,
    fontFamily: font.regular,
    fontSize: 14,
  },
  menuRow: {
    minHeight: 64,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  menuText: {
    flex: 1,
    color: colors.text,
    fontFamily: font.regular,
    fontSize: 15,
  },
  menuDivider: {
    height: 1,
    backgroundColor: colors.border,
  },
  transactionList: {
    gap: 12,
  },
  transactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  transactionTitle: {
    color: colors.text,
    fontFamily: font.medium,
    fontSize: 14,
  },
  transactionTime: {
    marginTop: 5,
    color: colors.textSubtle,
    fontFamily: font.regular,
    fontSize: 12,
  },
  transactionAmount: {
    color: colors.text,
    fontFamily: font.medium,
    fontSize: 14,
  },
  transactionPositive: {
    color: colors.success,
  },
});
