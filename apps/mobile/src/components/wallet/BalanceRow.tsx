import * as Haptics from 'expo-haptics';
import { useCallback, useState } from 'react';
import { LayoutAnimation, Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronDown, ChevronUp, Plus, Wallet } from 'lucide-react-native';
import { colors, font, formatCurrency } from '../../theme';
import type { Transaction } from '../../types';
import { PressableScale } from '../Motion';
import { SectionCard } from '../SectionCard';
import { ActivityList } from './ActivityList';
import { TopUpSheet } from './TopUpSheet';

interface BalanceRowProps {
  balance: number;
  cardLast4: string;
  // Money movements only; redemptions live in the reward history.
  transactions: Transaction[];
  onTopUp: (amount: number) => Promise<boolean>;
}

/**
 * The money side of the wallet, kept to one row: the balance that pays for
 * drinks, a way to add to it, and its activity on demand.
 */
export function BalanceRow({ balance, cardLast4, onTopUp, transactions }: BalanceRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const closeTopUp = useCallback(() => setTopUpOpen(false), []);

  const toggle = () => {
    void Haptics.selectionAsync();
    LayoutAnimation.configureNext(LayoutAnimation.create(220, 'easeInEaseOut', 'opacity'));
    setExpanded((value) => !value);
  };

  return (
    <View>
      <Text style={styles.label}>Balance</Text>
      <SectionCard>
        <View style={styles.row}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`GoodPint balance ${formatCurrency(balance)}, ${expanded ? 'hide' : 'show'} activity`}
            accessibilityState={{ expanded }}
            onPress={toggle}
            style={styles.main}
          >
            <View style={styles.icon}>
              <Wallet color={colors.text} size={19} />
            </View>
            <View style={styles.copy}>
              <Text style={styles.amount} numberOfLines={1}>{formatCurrency(balance)}</Text>
              <Text style={styles.subtitle} numberOfLines={1}>GoodPint balance</Text>
            </View>
            {expanded ? (
              <ChevronUp color={colors.textMuted} size={18} />
            ) : (
              <ChevronDown color={colors.textMuted} size={18} />
            )}
          </Pressable>
          <PressableScale
            accessibilityLabel="Add money"
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setTopUpOpen(true);
            }}
            pressedScale={0.94}
          >
            <View style={styles.add}>
              <Plus color={colors.gold} size={14} strokeWidth={2.6} />
              <Text style={styles.addText}>Add</Text>
            </View>
          </PressableScale>
        </View>
      </SectionCard>

      {expanded ? <ActivityList transactions={transactions} previewCount={5} /> : null}

      <TopUpSheet visible={topUpOpen} balance={balance} cardLast4={cardLast4} onClose={closeTopUp} onConfirm={onTopUp} />
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    marginBottom: 8,
    marginLeft: 4,
    color: colors.textSubtle,
    fontFamily: font.medium,
    fontSize: 12,
  },
  row: {
    minHeight: 64,
    paddingRight: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  main: {
    flex: 1,
    minHeight: 64,
    paddingLeft: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  copy: {
    flex: 1,
  },
  subtitle: {
    marginTop: 2,
    color: colors.textSubtle,
    fontFamily: font.regular,
    fontSize: 12,
  },
  amount: {
    color: colors.text,
    fontFamily: font.semibold,
    fontSize: 17,
    letterSpacing: -0.3,
    fontVariant: ['tabular-nums'],
  },
  add: {
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 17,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: colors.gold,
  },
  addText: {
    color: colors.gold,
    fontFamily: font.semibold,
    fontSize: 13,
  },
});
