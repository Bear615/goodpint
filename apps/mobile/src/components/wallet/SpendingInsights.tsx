import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowDownLeft, Beer, TrendingDown, TrendingUp } from 'lucide-react-native';
import { colors, font, formatCurrency } from '../../theme';
import type { Transaction } from '../../types';
import { weeklySummary } from '../../utils/wallet';
import { SectionCard } from '../SectionCard';

const CHART_HEIGHT = 92;
const MIN_BAR = 6;
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MASK = '£ • • •';

interface SpendingInsightsProps {
  transactions: Transaction[];
  hidden: boolean;
}

export function SpendingInsights({ hidden, transactions }: SpendingInsightsProps) {
  const summary = useMemo(() => weeklySummary(transactions), [transactions]);
  const [selected, setSelected] = useState<number | null>(null);
  const grow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    grow.setValue(0);
    Animated.timing(grow, {
      toValue: 1,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [summary.spent, grow]);

  const peak = Math.max(...summary.days.map((day) => day.spent), 0);
  const selectedDay = selected === null ? null : summary.days[selected];
  const headline = selectedDay ? selectedDay.spent : summary.spent;
  const money = (value: number) => (hidden ? MASK : formatCurrency(value));

  let trend: { label: string; down: boolean } | null = null;
  if (!selectedDay && summary.lastWeekSpent > 0) {
    const change = Math.round(((summary.spent - summary.lastWeekSpent) / summary.lastWeekSpent) * 100);
    trend = change <= 0
      ? { label: `${Math.abs(change)}% less than last week`, down: true }
      : { label: `${change}% more than last week`, down: false };
  }

  return (
    <SectionCard>
      <View style={styles.body}>
        <Text style={styles.eyebrow}>
          {selected === null ? 'Spent this week' : `Spent on ${DAY_NAMES[selected]}`}
        </Text>
        <Text style={styles.headline}>{money(headline)}</Text>
        {trend ? (
          <View style={styles.trendRow}>
            {trend.down ? (
              <TrendingDown color={colors.success} size={15} />
            ) : (
              <TrendingUp color={colors.coral} size={15} />
            )}
            <Text style={[styles.trendText, { color: trend.down ? colors.success : colors.coral }]}>{trend.label}</Text>
          </View>
        ) : (
          <Text style={styles.trendMuted}>
            {selectedDay
              ? 'Tap the bar again to see the whole week'
              : summary.spent > 0
                ? 'Nothing spent last week to compare'
                : 'Nothing spent yet this week'}
          </Text>
        )}

        <View style={styles.chart}>
          {summary.days.map((day, index) => {
            const target = peak > 0 && day.spent > 0
              ? Math.max((day.spent / peak) * CHART_HEIGHT, MIN_BAR)
              : MIN_BAR;
            const active = selected === null ? day.isToday : selected === index;
            const barColor = day.isFuture
              ? 'rgba(255,255,255,0.06)'
              : active
                ? colors.gold
                : day.spent > 0
                  ? 'rgba(244,200,74,0.34)'
                  : 'rgba(255,255,255,0.1)';

            return (
              <Pressable
                key={`${day.label}-${index}`}
                accessibilityRole="button"
                accessibilityLabel={`${DAY_NAMES[index]}, ${formatCurrency(day.spent)}`}
                disabled={day.isFuture}
                onPress={() => setSelected((current) => (current === index ? null : index))}
                style={styles.column}
              >
                <View style={styles.track}>
                  <Animated.View
                    style={[
                      styles.bar,
                      { backgroundColor: barColor, height: grow.interpolate({ inputRange: [0, 1], outputRange: [MIN_BAR, target] }) },
                    ]}
                  />
                </View>
                <Text style={[styles.dayLabel, active && styles.dayLabelActive]}>{day.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.stats}>
        <View style={styles.stat}>
          <View style={[styles.statIcon, { backgroundColor: 'rgba(110,231,167,0.12)' }]}>
            <ArrowDownLeft color={colors.success} size={16} strokeWidth={2.4} />
          </View>
          <View>
            <Text style={styles.statValue}>{money(summary.added)}</Text>
            <Text style={styles.statLabel}>Added this week</Text>
          </View>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <View style={[styles.statIcon, { backgroundColor: colors.goldSoft }]}>
            <Beer color={colors.gold} size={16} strokeWidth={2.2} />
          </View>
          <View>
            <Text style={styles.statValue}>{summary.orders}</Text>
            <Text style={styles.statLabel}>{summary.orders === 1 ? 'Order' : 'Orders'} this week</Text>
          </View>
        </View>
      </View>
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  body: {
    padding: 18,
    paddingBottom: 14,
  },
  eyebrow: {
    color: colors.textMuted,
    fontFamily: font.medium,
    fontSize: 13,
  },
  headline: {
    marginTop: 4,
    color: colors.text,
    fontFamily: font.semibold,
    fontSize: 30,
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  trendRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trendText: {
    fontFamily: font.medium,
    fontSize: 12,
  },
  trendMuted: {
    marginTop: 6,
    color: colors.textSubtle,
    fontFamily: font.regular,
    fontSize: 12,
  },
  chart: {
    marginTop: 18,
    flexDirection: 'row',
    gap: 8,
  },
  column: {
    flex: 1,
    alignItems: 'center',
  },
  track: {
    width: '100%',
    height: CHART_HEIGHT,
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    borderRadius: 7,
  },
  dayLabel: {
    marginTop: 8,
    color: colors.textSubtle,
    fontFamily: font.medium,
    fontSize: 11,
  },
  dayLabelActive: {
    color: colors.gold,
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  stat: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    color: colors.text,
    fontFamily: font.semibold,
    fontSize: 15,
  },
  statLabel: {
    marginTop: 1,
    color: colors.textSubtle,
    fontFamily: font.regular,
    fontSize: 11,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.border,
  },
});
