import { useEffect, useRef, useState } from 'react';
import { Image, Animated, Easing, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Beer, Gift, MessageSquareText, Star, UserPlus } from 'lucide-react-native';
import { colors, font, formatPoints, radii } from '../theme';
import type { EarningRule, Reward, Tier } from '../types';
import { GoldButton } from '../components/GoldButton';
import { MembershipCard, MembershipPill } from '../components/MembershipCard';
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
  const [cardOpen, setCardOpen] = useState(false);

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
      <LinearGradient
        colors={[colors.brandBright, colors.brand, colors.brandDeep]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.6, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.headerRow}>
          <Text style={styles.title}>Rewards</Text>
          <MembershipPill onPress={() => setCardOpen(true)} />
        </View>

        <View style={styles.pointsRow}>
          <View>
            <Text style={styles.points}>{formatPoints(points)}</Text>
            <Text style={styles.subtitle}>points to spend</Text>
          </View>
          <PressableScale accessibilityLabel="View history" onPress={onOpenHistory}>
            <Text style={styles.history}>History</Text>
          </PressableScale>
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
                  color={active ? colors.gold : 'rgba(243,235,221,0.55)'}
                  fill={active ? colors.gold : 'rgba(243,235,221,0.14)'}
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

      <Text style={styles.sectionTitle}>Ways to earn</Text>
      <SectionCard>
        {earningRules.map((rule, index) => {
          const Icon = ruleIcons[index] ?? Star;
          return (
            <View key={rule.id} style={[styles.earningRow, index > 0 && styles.rowDivider]}>
              <View style={styles.ruleIcon}>
                <Icon color={colors.gold} size={20} strokeWidth={2} />
              </View>
              <Text style={styles.ruleLabel}>{rule.label}</Text>
              <Text style={styles.rulePoints}>+{rule.points} pts</Text>
            </View>
          );
        })}
      </SectionCard>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Spend your points</Text>
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
            <Gift color={colors.gold} size={28} strokeWidth={2} />
          </View>
          <View style={styles.goldBoostCopy}>
            <Text style={styles.goldBoostTitle}>{topTier ? `${topTier.title} unlocks richer rewards` : 'Top tier unlocks richer rewards'}</Text>
            <Text style={styles.goldBoostText}>Partner upgrades, early event access, and premium happy hour multipliers.</Text>
          </View>
        </View>
      </SectionCard>

      <MembershipCard visible={cardOpen} onClose={() => setCardOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  // Bleeds past ScreenFrame's padding to the screen edges, with a deep curve
  // underneath, so the screen opens on solid brand colour instead of a card.
  hero: {
    marginHorizontal: -22,
    marginTop: -14,
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 26,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    overflow: 'hidden',
  },
  headerRow: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    color: colors.cream,
    fontFamily: font.bold,
    fontSize: 26,
    letterSpacing: -0.8,
  },
  history: {
    color: colors.cream,
    fontFamily: font.medium,
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  pointsRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 10,
  },
  points: {
    color: colors.cream,
    fontFamily: font.bold,
    fontSize: 56,
    letterSpacing: -2.4,
  },
  subtitle: {
    marginTop: -4,
    color: colors.cream,
    opacity: 0.75,
    fontFamily: font.regular,
    fontSize: 15,
  },
  progressMeta: {
    marginTop: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressText: {
    color: colors.cream,
    opacity: 0.8,
    fontFamily: font.regular,
    fontSize: 12,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 8,
    backgroundColor: 'rgba(8,16,13,0.35)',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: colors.gold,
  },
  tierRow: {
    marginTop: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  tierItem: {
    flex: 1,
    minHeight: 88,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: radii.md,
    backgroundColor: 'rgba(8,16,13,0.22)',
  },
  tierItemActive: {
    backgroundColor: 'rgba(8,16,13,0.42)',
  },
  tierName: {
    color: colors.cream,
    fontFamily: font.medium,
    fontSize: 14,
  },
  tierPoints: {
    color: colors.cream,
    opacity: 0.7,
    fontFamily: font.regular,
    fontSize: 12,
  },
  sectionTitle: {
    marginTop: 28,
    marginBottom: 10,
    color: colors.text,
    fontFamily: font.semibold,
    fontSize: 17,
    letterSpacing: -0.3,
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
    alignItems: 'center',
    justifyContent: 'center',
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
    alignItems: 'center',
    justifyContent: 'center',
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
