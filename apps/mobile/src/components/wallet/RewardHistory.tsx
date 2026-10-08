import { useMemo, useState } from 'react';
import { LayoutAnimation, Pressable, StyleSheet, Text, View } from 'react-native';
import { CircleCheck, Clock3, Ticket } from 'lucide-react-native';
import { colors, font, formatPoints } from '../../theme';
import type { Voucher } from '../../types';
import { voucherEvent, type VoucherEventKind } from '../../utils/rewards';
import { PressableScale } from '../Motion';
import { SectionCard } from '../SectionCard';

const PREVIEW_COUNT = 5;

const ICONS: Record<VoucherEventKind, { Icon: typeof Ticket; color: string; background: string }> = {
  live: { Icon: Ticket, color: colors.gold, background: colors.goldSoft },
  redeemed: { Icon: CircleCheck, color: colors.success, background: 'rgba(110,231,167,0.12)' },
  expired: { Icon: Clock3, color: colors.textSubtle, background: colors.panelSoft },
};

interface RewardHistoryProps {
  vouchers: Voucher[];
  onOpen: (voucher: Voucher) => void;
}

/**
 * Every reward the user has claimed, newest event first. Built from vouchers,
 * so it is a record of points spent; there is no client-side record of points
 * earned, and none is invented here.
 */
export function RewardHistory({ onOpen, vouchers }: RewardHistoryProps) {
  const [showAll, setShowAll] = useState(false);

  const rows = useMemo(() => {
    const now = Date.now();
    return vouchers
      .map((voucher) => ({ voucher, event: voucherEvent(voucher, now) }))
      .sort((a, b) => b.event.at.localeCompare(a.event.at));
  }, [vouchers]);

  const used = vouchers.filter((voucher) => voucher.status === 'redeemed').length;
  const visible = showAll ? rows : rows.slice(0, PREVIEW_COUNT);

  return (
    <View>
      <Text style={styles.meta}>
        {vouchers.length} claimed · {used} used at the bar
      </Text>
      <SectionCard>
        {visible.map(({ event, voucher }, index) => {
          const { Icon, background, color } = ICONS[event.kind];
          return (
            <PressableScale
              key={voucher.id}
              accessibilityLabel={`${voucher.title}, ${event.label}, ${formatPoints(voucher.pointsSpent)} points`}
              onPress={() => onOpen(voucher)}
              pressedScale={0.985}
            >
              <View style={[styles.row, index > 0 && styles.rowDivider]}>
                <View style={[styles.icon, { backgroundColor: background }]}>
                  <Icon color={color} size={18} strokeWidth={2} />
                </View>
                <View style={styles.copy}>
                  <Text style={styles.title} numberOfLines={1}>{voucher.title}</Text>
                  <Text style={styles.label} numberOfLines={1}>{event.label}</Text>
                </View>
                <Text style={styles.cost}>−{formatPoints(voucher.pointsSpent)} pts</Text>
              </View>
            </PressableScale>
          );
        })}
      </SectionCard>

      {rows.length > PREVIEW_COUNT ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            LayoutAnimation.configureNext(LayoutAnimation.create(240, 'easeInEaseOut', 'opacity'));
            setShowAll((value) => !value);
          }}
          style={styles.more}
        >
          <Text style={styles.moreText}>{showAll ? 'Show less' : `Show all ${rows.length}`}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  meta: {
    marginTop: -4,
    marginBottom: 12,
    marginLeft: 4,
    color: colors.textSubtle,
    fontFamily: font.regular,
    fontSize: 12,
  },
  row: {
    minHeight: 64,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  icon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
  },
  title: {
    color: colors.text,
    fontFamily: font.medium,
    fontSize: 15,
  },
  label: {
    marginTop: 3,
    color: colors.textSubtle,
    fontFamily: font.regular,
    fontSize: 12,
  },
  cost: {
    color: colors.textMuted,
    fontFamily: font.medium,
    fontSize: 14,
    fontVariant: ['tabular-nums'],
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
});
