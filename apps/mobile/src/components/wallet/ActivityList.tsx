import * as Haptics from 'expo-haptics';
import { useMemo, useState } from 'react';
import { LayoutAnimation, Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowDownLeft, CircleCheck, Gift, Receipt } from 'lucide-react-native';
import { colors, font } from '../../theme';
import type { Transaction } from '../../types';
import {
  formatAmount,
  groupByDay,
  kindLabels,
  monogram,
  monogramTint,
  transactionFullDate,
  transactionKind,
  transactionTime,
} from '../../utils/wallet';
import { BottomSheet } from '../BottomSheet';
import { GoldButton } from '../GoldButton';
import { PressableScale } from '../Motion';
import { SectionCard } from '../SectionCard';

interface ActivityListProps {
  transactions: Transaction[];
  // How many rows show before "See all".
  previewCount?: number;
}

export function ActivityList({ previewCount = 6, transactions }: ActivityListProps) {
  const [expanded, setExpanded] = useState(false);
  const [receipt, setReceipt] = useState<Transaction | null>(null);
  // Held separately so the sheet keeps its content while it animates away.
  const [receiptOpen, setReceiptOpen] = useState(false);

  const visible = expanded ? transactions : transactions.slice(0, previewCount);
  const groups = useMemo(() => groupByDay(visible), [visible]);

  const openReceipt = (transaction: Transaction) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setReceipt(transaction);
    setReceiptOpen(true);
  };

  return (
    <View>
      {groups.length === 0 ? (
        <SectionCard style={styles.emptyCard}>
          <View style={styles.empty}>
            <Receipt color={colors.textSubtle} size={26} strokeWidth={1.6} />
            <Text style={styles.emptyTitle}>No balance activity yet</Text>
            <Text style={styles.emptyText}>Top-ups and drinks orders show up here.</Text>
          </View>
        </SectionCard>
      ) : (
        groups.map((group, groupIndex) => (
          <View key={`${group.label}-${groupIndex}`} style={styles.group}>
            <Text style={styles.groupLabel}>{group.label}</Text>
            <SectionCard>
              {group.items.map((transaction, index) => (
                <PressableScale
                  key={transaction.id}
                  accessibilityLabel={`${transaction.title}, ${formatAmount(transaction.amount)}`}
                  onPress={() => openReceipt(transaction)}
                  pressedScale={0.985}
                >
                  <View style={[styles.row, index > 0 && styles.rowDivider]}>
                    <TransactionAvatar transaction={transaction} />
                    <View style={styles.rowCopy}>
                      <Text style={styles.rowTitle} numberOfLines={1}>{transaction.title}</Text>
                      <Text style={styles.rowMeta} numberOfLines={1}>
                        {transactionTime(transaction)} · {kindLabels[transactionKind(transaction)]}
                      </Text>
                    </View>
                    <AmountText transaction={transaction} />
                  </View>
                </PressableScale>
              ))}
            </SectionCard>
          </View>
        ))
      )}

      {transactions.length > previewCount ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            LayoutAnimation.configureNext(LayoutAnimation.create(240, 'easeInEaseOut', 'opacity'));
            setExpanded((value) => !value);
          }}
          style={styles.more}
        >
          <Text style={styles.moreText}>{expanded ? 'Show less' : `See all ${transactions.length} transactions`}</Text>
        </Pressable>
      ) : null}

      <ReceiptSheet transaction={receipt} visible={receiptOpen} onClose={() => setReceiptOpen(false)} />
    </View>
  );
}

function AmountText({ large, transaction }: { transaction: Transaction; large?: boolean }) {
  const kind = transactionKind(transaction);
  if (kind === 'reward') {
    return <Text style={[styles.amount, styles.amountReward, large && styles.amountLarge]}>Reward</Text>;
  }
  return (
    <Text style={[styles.amount, kind === 'topup' && styles.amountIn, large && styles.amountLarge]}>
      {formatAmount(transaction.amount)}
    </Text>
  );
}

function TransactionAvatar({ size = 42, transaction }: { transaction: Transaction; size?: number }) {
  const kind = transactionKind(transaction);
  const frame = { width: size, height: size, borderRadius: size / 2 };
  const iconSize = Math.round(size * 0.45);

  if (kind === 'topup') {
    return (
      <View style={[styles.avatar, frame, { backgroundColor: 'rgba(110,231,167,0.12)' }]}>
        <ArrowDownLeft color={colors.success} size={iconSize} strokeWidth={2.4} />
      </View>
    );
  }
  if (kind === 'reward') {
    return (
      <View style={[styles.avatar, frame, { backgroundColor: colors.goldSoft }]}>
        <Gift color={colors.gold} size={iconSize} strokeWidth={2} />
      </View>
    );
  }

  // Pubs have no logos, so they get a monogram in a colour of their own.
  const tint = monogramTint(transaction.title);
  return (
    <View style={[styles.avatar, frame, { backgroundColor: `${tint}22`, borderColor: `${tint}44`, borderWidth: 1 }]}>
      <Text style={[styles.monogram, { color: tint, fontSize: size * 0.4 }]}>
        {monogram(transaction.title)}
      </Text>
    </View>
  );
}

interface ReceiptSheetProps {
  transaction: Transaction | null;
  visible: boolean;
  onClose: () => void;
}

function ReceiptSheet({ onClose, transaction, visible }: ReceiptSheetProps) {
  if (!transaction) return null;
  const kind = transactionKind(transaction);
  const reference = transaction.id.replace(/[^a-zA-Z0-9]/g, '').slice(-10).toUpperCase();
  const rows: Array<[string, string]> = [
    ['Date', transactionFullDate(transaction)],
    ['Time', transactionTime(transaction)],
    ['Type', kindLabels[kind]],
    kind === 'topup'
      ? ['Added to', 'GoodPint balance']
      : ['Paid with', kind === 'reward' ? 'GoodPint Points' : 'GoodPint balance'],
    ['Reference', reference],
  ];

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={styles.receiptHead}>
        <TransactionAvatar transaction={transaction} size={64} />
        <Text style={styles.receiptTitle} numberOfLines={2}>{transaction.title}</Text>
        <AmountText transaction={transaction} large />
        <View style={styles.receiptStatus}>
          <CircleCheck color={colors.success} size={14} />
          <Text style={styles.receiptStatusText}>Completed</Text>
        </View>
      </View>

      <View style={styles.receiptCard}>
        {rows.map(([label, value], index) => (
          <View key={label} style={[styles.receiptRow, index > 0 && styles.rowDivider]}>
            <Text style={styles.receiptLabel}>{label}</Text>
            <Text style={styles.receiptValue} numberOfLines={1}>{value}</Text>
          </View>
        ))}
      </View>

      <GoldButton label="Done" onPress={onClose} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  group: {
    marginTop: 16,
  },
  groupLabel: {
    marginBottom: 8,
    marginLeft: 4,
    color: colors.textSubtle,
    fontFamily: font.medium,
    fontSize: 12,
    letterSpacing: 0.3,
  },
  row: {
    minHeight: 68,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  monogram: {
    fontFamily: font.semibold,
  },
  rowCopy: {
    flex: 1,
  },
  rowTitle: {
    color: colors.text,
    fontFamily: font.medium,
    fontSize: 15,
  },
  rowMeta: {
    marginTop: 3,
    color: colors.textSubtle,
    fontFamily: font.regular,
    fontSize: 12,
  },
  amount: {
    color: colors.text,
    fontFamily: font.semibold,
    fontSize: 15,
    fontVariant: ['tabular-nums'],
  },
  amountIn: {
    color: colors.success,
  },
  amountReward: {
    color: colors.gold,
    fontSize: 13,
  },
  amountLarge: {
    marginTop: 6,
    fontSize: 38,
    letterSpacing: -1.2,
  },
  emptyCard: {
    marginTop: 12,
  },
  empty: {
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  emptyTitle: {
    marginTop: 12,
    color: colors.text,
    fontFamily: font.semibold,
    fontSize: 15,
  },
  emptyText: {
    marginTop: 4,
    color: colors.textMuted,
    fontFamily: font.regular,
    fontSize: 13,
    textAlign: 'center',
  },
  more: {
    marginTop: 12,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  moreText: {
    color: colors.text,
    fontFamily: font.medium,
    fontSize: 14,
  },
  receiptHead: {
    paddingTop: 6,
    alignItems: 'center',
  },
  receiptTitle: {
    marginTop: 14,
    color: colors.textMuted,
    fontFamily: font.medium,
    fontSize: 15,
    textAlign: 'center',
  },
  receiptStatus: {
    marginTop: 10,
    height: 26,
    paddingHorizontal: 10,
    borderRadius: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(110,231,167,0.1)',
  },
  receiptStatusText: {
    color: colors.success,
    fontFamily: font.medium,
    fontSize: 12,
  },
  receiptCard: {
    marginTop: 22,
    marginBottom: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  receiptRow: {
    minHeight: 48,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  receiptLabel: {
    color: colors.textMuted,
    fontFamily: font.regular,
    fontSize: 14,
  },
  receiptValue: {
    flexShrink: 1,
    color: colors.text,
    fontFamily: font.medium,
    fontSize: 14,
  },
});
