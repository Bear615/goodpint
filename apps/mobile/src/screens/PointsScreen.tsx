import { useEffect, useRef } from 'react';
import { Image, Animated, Easing, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Beer, Gift, MessageSquareText, Star, UserPlus } from 'lucide-react-native';
import { colors, font, formatPoints, radii } from '../theme';
import type { EarningRule, Reward, Tier } from '../types';
import { GoldButton } from '../components/GoldButton';
import { PressableScale } from '../components/Motion';
import { SectionCard } from '../components/SectionCard';

interface PointsScreenProps {
  points: number;
  rewards: Reward[];
  earningRules: EarningRule[];
  tiers: Tier[];
  onOpenRedeem: (rewardId: string) => void;
  onOpenHistory: () => void;
}

const ruleIcons = [Star, Beer, UserPlus, MessageSquareText];

export function PointsScreen({ points, rewards, earningRules, tiers, onOpenRedeem, onOpenHistory }: PointsScreenProps) {
  const progressValue = useRef(new Animated.Value(0)).current;

  // Sort tiers ascending by threshold so current/next logic doesn't depend on prop order.
  const sortedTiers = [...tiers].sort((a, b) => a.points - b.points);
  // Current tier: highest tier whose threshold the user has reached.
  const currentTier = [...sortedTiers].reverse().find((tier) => points >= tier.points) ?? null;
  // Next tier: lowest tier whose threshold the user has not yet reached.
  const nextTier = sortedTiers.find((tier) => tier.points > points) ?? null;
  const atMaxTier = sortedTiers.length > 0 && nextTier === null;
  const topTier = sortedTiers.length > 0 ? sortedTiers[sortedTiers.length - 1] : null;

  const nextTierPoints = nextTier ? Math.max(nextTier.points - points, 0) : 0;
  // Progress toward the next tier, measured from the current tier's threshold.
  const progress = (() => {
    if (!nextTier) return 100;
    const floor = currentTier?.points ?? 0;
    const span = nextTier.points - floor;
    if (span <= 0) return 100;
    return Math.max(0, Math.min(((points - floor) / span) * 100, 100));
  })();
  const progressWidth = progressValue.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  useEffect(() => {
    Animated.timing(progressValue, {
      toValue: progress,
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [progress, progressValue]);

  return (
    <View>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Your Points</Text>
        <PressableScale accessibilityLabel="View history" onPress={onOpenHistory}>
          <Text style={styles.history}>History</Text>
        </PressableScale>
      </View>

      <LinearGradient
        colors={['rgba(255,255,255,0.058)', 'rgba(244,200,74,0.055)', 'rgba(255,255,255,0.026)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.pointsRow}>
          <View>
            <Text style={styles.points}>{formatPoints(points)}</Text>
            <Text style={styles.subtitle}>GoodPint Points</Text>
          </View>
          <View style={styles.coin}>
            <Beer color={colors.gold} size={22} strokeWidth={2.4} />
          </View>
        </View>

        <View style={styles.progressMeta}>
          <Text style={styles.progressText}>
            {atMaxTier
              ? `Max tier reached${currentTier ? ` — ${currentTier.title}` : ''}`
              : nextTier
                ? `${formatPoints(nextTierPoints)} pts until ${nextTier.title}`
                : 'Start earning to reach your first tier'}
          </Text>
          {nextTier ? <Text style={styles.progressText}>{formatPoints(nextTier.points)}</Text> : null}
        </View>
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
        </View>

        <View style={styles.tierRow}>
          {sortedTiers.map((tier) => {
            const active = points >= tier.points;
            return (
              <View key={tier.id} style={[styles.tierItem, active && styles.tierItemActive]}>
                <Star
                  color={active ? colors.gold : colors.textMuted}
                  fill={active ? colors.gold : 'rgba(255,255,255,0.18)'}
                  size={34}
                  strokeWidth={1.8}
                />
                <Text style={styles.tierName}>{tier.title}</Text>
                <Text style={styles.tierPoints}>{formatPoints(tier.points)} pts</Text>
              </View>
            );
          })}
        </View>
      </LinearGradient>

      <Text style={styles.sectionTitle}>Ways to Earn</Text>
      <SectionCard>
        {earningRules.map((rule, index) => {
          const Icon = ruleIcons[index] ?? Star;
          return (
            <View key={rule.id} style={[styles.earningRow, index > 0 && styles.rowDivider]}>
              <View style={styles.ruleIcon}>
                <Icon color={colors.gold} size={18} strokeWidth={2.2} />
              </View>
              <Text style={styles.ruleLabel}>{rule.label}</Text>
              <Text style={styles.rulePoints}>+{rule.points} pts</Text>
            </View>
          );
        })}
      </SectionCard>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Redeem Points</Text>
        <PressableScale accessibilityLabel="View rewards" onPress={() => onOpenRedeem(rewards[0]?.id ?? '')}>
          <Text style={styles.viewAll}>View all</Text>
        </PressableScale>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rewardList}>
        {rewards.map((reward) => (
          <SectionCard key={reward.id} style={styles.rewardShell}>
            <View style={styles.rewardCard}>
              <View style={styles.rewardCopy}>
                <Text style={styles.rewardTitle}>{reward.title}</Text>
                <Text style={styles.rewardPoints}>{formatPoints(reward.points)} pts</Text>
                <GoldButton label="Redeem" compact onPress={() => onOpenRedeem(reward.id)} testID={`reward-${reward.id}`} />
              </View>
              <Image source={{ uri: reward.imageUrl }} style={styles.rewardImage} />
            </View>
          </SectionCard>
        ))}
      </ScrollView>

      <SectionCard>
        <View style={styles.goldBoost}>
          <View style={styles.giftIcon}>
            <Gift color={colors.gold} size={24} strokeWidth={2.4} />
          </View>
          <View style={styles.goldBoostCopy}>
            <Text style={styles.goldBoostTitle}>{topTier ? `${topTier.title} unlocks richer rewards` : 'Top tier unlocks richer rewards'}</Text>
            <Text style={styles.goldBoostText}>Partner upgrades, early event access, and premium happy hour multipliers.</Text>
          </View>
        </View>
      </SectionCard>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    color: colors.text,
    fontFamily: font.medium,
    fontSize: 18,
  },
  history: {
    color: colors.gold,
    fontFamily: font.medium,
    fontSize: 14,
  },
  hero: {
    padding: 18,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  pointsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  points: {
    color: colors.gold,
    fontFamily: font.bold,
    fontSize: 50,
    letterSpacing: 0,
  },
  coin: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: 'rgba(244,200,74,0.08)',
  },
  subtitle: {
    marginTop: -4,
    color: colors.textMuted,
    fontFamily: font.regular,
    fontSize: 16,
  },
  progressMeta: {
    marginTop: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressText: {
    color: colors.textMuted,
    fontFamily: font.regular,
    fontSize: 12,
  },
  progressTrack: {
    height: 7,
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 8,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: colors.gold,
  },
  tierRow: {
    marginTop: 22,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  tierItem: {
    flex: 1,
    minHeight: 92,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.026)',
  },
  tierItemActive: {
    borderColor: 'rgba(255,211,77,0.33)',
    backgroundColor: 'rgba(244,200,74,0.07)',
  },
  tierName: {
    color: colors.text,
    fontFamily: font.regular,
    fontSize: 14,
  },
  tierPoints: {
    color: colors.textMuted,
    fontFamily: font.regular,
    fontSize: 12,
  },
  sectionTitle: {
    marginTop: 26,
    marginBottom: 10,
    color: colors.text,
    fontFamily: font.medium,
    fontSize: 17,
  },
  earningRow: {
    minHeight: 54,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  ruleIcon: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: 'rgba(244,200,74,0.06)',
  },
  ruleLabel: {
    flex: 1,
    color: colors.text,
    fontFamily: font.regular,
    fontSize: 14,
  },
  rulePoints: {
    color: colors.gold,
    fontFamily: font.medium,
    fontSize: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  viewAll: {
    color: colors.gold,
    fontFamily: font.medium,
    fontSize: 14,
  },
  rewardList: {
    gap: 10,
    paddingRight: 20,
    paddingBottom: 6,
  },
  rewardShell: {
    width: 184,
  },
  rewardCard: {
    minHeight: 104,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rewardCopy: {
    flex: 1,
    gap: 4,
  },
  rewardTitle: {
    color: colors.text,
    fontFamily: font.medium,
    fontSize: 13,
  },
  rewardPoints: {
    color: colors.textMuted,
    fontFamily: font.regular,
    fontSize: 12,
  },
  rewardImage: {
    width: 58,
    height: 82,
    borderRadius: 7,
    backgroundColor: colors.panelRaised,
  },
  goldBoost: {
    marginTop: 18,
    padding: 14,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  giftIcon: {
    width: 46,
    height: 46,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: 'rgba(244,200,74,0.06)',
  },
  goldBoostCopy: {
    flex: 1,
  },
  goldBoostTitle: {
    color: colors.text,
    fontFamily: font.medium,
    fontSize: 14,
  },
  goldBoostText: {
    marginTop: 4,
    color: colors.textMuted,
    fontFamily: font.regular,
    fontSize: 12,
    lineHeight: 17,
  },
});
