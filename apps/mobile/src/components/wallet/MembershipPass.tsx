import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Beer, ChevronRight, CircleCheck, Ticket } from 'lucide-react-native';
import { colors, font, formatPoints, tierAccent } from '../../theme';
import type { Drink, RecentEarn, Reward, Tier, Venue } from '../../types';
import { crossedReward, pointsForSingleDrink, rewardProgress } from '../../utils/rewards';
import { useCountUp } from '../../utils/useCountUp';
import { PressableScale } from '../Motion';
import { PassFrame, passStyles } from './PassFrame';
import { COLLAPSED_HEIGHT, PEEK } from './passMetrics';
import type { PassLayout } from './PassStack';

const useNativeMotion = Platform.OS !== 'web';

interface MembershipPassProps extends PassLayout {
  points: number;
  tier: Tier | null;
  rewards: Reward[];
  // The house pint, used for the one suggested next step.
  houseDrink: Drink | null;
  lastVenue: Venue | null;
  holderName: string;
  memberSince: string;
  recentEarn: RecentEarn | null;
  reducedMotion: boolean;
  onToggle: () => void;
  onClaim: (rewardId: string) => void;
  onBrowseRewards: () => void;
  onOrderAgain: (venueId: string, pubName: string) => void;
  onFindDrink: () => void;
}

export function MembershipPass({
  holderName,
  houseDrink,
  lastVenue,
  memberSince,
  onBrowseRewards,
  onClaim,
  onFindDrink,
  onOrderAgain,
  onToggle,
  open,
  points,
  recentEarn,
  reducedMotion,
  rewards,
  style,
  tier,
}: MembershipPassProps) {
  // After an order the figure climbs from where it was to where it is now.
  const shown = useCountUp(points, {
    from: recentEarn ? points - recentEarn.points : points,
    delayMs: 350,
    disabled: reducedMotion,
  });

  const { affordable, next } = rewardProgress(points, rewards);
  const crossed = recentEarn ? crossedReward(points - recentEarn.points, points, rewards) : null;
  const accent = tier ? tierAccent[tier.id] : colors.gold;
  const name = holderName.trim() || 'GoodPint Member';
  const toNext = next ? next.points - points : 0;
  const progress = next ? Math.min(points / next.points, 1) : 1;

  let detail: { text: string; color: string };
  if (recentEarn && crossed) {
    detail = { text: `+${formatPoints(recentEarn.points)} pts · ${crossed.title} unlocked`, color: colors.success };
  } else if (recentEarn) {
    detail = { text: `+${formatPoints(recentEarn.points)} pts · ${recentEarn.venueName}`, color: colors.success };
  } else if (affordable.length === 1) {
    detail = { text: `${affordable[0].title} ready to claim`, color: colors.gold };
  } else if (affordable.length > 1) {
    detail = { text: `${affordable.length} rewards ready to claim`, color: colors.gold };
  } else if (next) {
    detail = { text: `${next.title} in ${formatPoints(toNext)} pts`, color: colors.textMuted };
  } else if (tier) {
    detail = { text: `${tier.title} member`, color: colors.textMuted };
  } else {
    detail = { text: memberSince, color: colors.textMuted };
  }

  const spoken = [
    'GoodPint membership',
    tier?.title,
    `${formatPoints(points)} points`,
    affordable.length > 1
      ? `${affordable.length} rewards ready to claim`
      : affordable.length === 1
        ? `${affordable[0].title} ready to claim`
        : next
          ? `${next.title} in ${formatPoints(toNext)} points`
          : undefined,
  ]
    .filter(Boolean)
    .join('. ');

  const perDrink = houseDrink ? pointsForSingleDrink(houseDrink) : 0;

  const strip = (
    <>
      <View style={[passStyles.ring, { borderColor: `${accent}59` }]}>
        <Beer color={accent} size={19} strokeWidth={2.1} />
      </View>
      <View style={passStyles.copy}>
        <Text style={passStyles.title} numberOfLines={1}>GoodPint Member</Text>
        {detail.text ? (
          <Text style={[passStyles.detail, { color: detail.color }]} numberOfLines={1}>{detail.text}</Text>
        ) : null}
      </View>
      {open ? (
        tier ? (
          <View style={[passStyles.pill, { backgroundColor: `${accent}24` }]}>
            <Text style={[passStyles.pillText, { color: accent }]}>{tier.title.toUpperCase()}</Text>
          </View>
        ) : null
      ) : (
        <Text style={styles.stripPoints}>{formatPoints(Math.round(shown))} pts</Text>
      )}
    </>
  );

  const footer = (
    <View style={styles.footer}>
      <Text style={styles.holder} numberOfLines={1}>{name.toUpperCase()}</Text>
      {memberSince ? <Text style={styles.since}>{memberSince}</Text> : null}
    </View>
  );

  const progressBar = next ? (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${progress * 100}%` }]} />
    </View>
  ) : null;

  const closedBody = (
    <View style={styles.closedBody}>
      {progressBar}
      {footer}
    </View>
  );

  const openBody = (
    <View style={styles.openBody}>
      <Text style={passStyles.eyebrow}>Points</Text>
      <View style={styles.pointsRow}>
        <Text style={styles.points}>{formatPoints(Math.round(shown))}</Text>
        <Text style={styles.pointsUnit}>pts</Text>
      </View>

      {recentEarn ? (
        <View style={styles.earnRow}>
          <CircleCheck color={colors.success} size={14} />
          <Text style={styles.earnText} numberOfLines={1}>Drink booked at {recentEarn.venueName}</Text>
          <Text style={styles.earnPoints}>+{formatPoints(recentEarn.points)} pts</Text>
        </View>
      ) : null}

      {affordable.length > 0 ? (
        <View style={styles.block}>
          <Text style={passStyles.eyebrow}>Ready to claim</Text>
          <View style={styles.chips}>
            {affordable.map((reward) => {
              const unlocked = crossed?.id === reward.id;
              return (
                <PressableScale
                  key={reward.id}
                  accessibilityLabel={`Claim ${reward.title} for ${formatPoints(reward.points)} points`}
                  onPress={() => onClaim(reward.id)}
                  pressedScale={0.95}
                >
                  <View style={[styles.chip, unlocked && styles.chipUnlocked]}>
                    <Ticket color={unlocked ? '#080808' : colors.gold} size={14} />
                    <Text style={[styles.chipText, unlocked && styles.chipTextUnlocked]}>
                      {reward.title} · {formatPoints(reward.points)}
                    </Text>
                  </View>
                </PressableScale>
              );
            })}
          </View>
        </View>
      ) : null}

      {next ? (
        <View style={styles.block}>
          <View style={styles.progressMeta}>
            <Text style={styles.progressText}>{next.title} in {formatPoints(toNext)} pts</Text>
            <Text style={styles.progressText}>{formatPoints(next.points)} pts</Text>
          </View>
          {progressBar}
        </View>
      ) : null}

      {affordable.length === 0 && next && houseDrink ? (
        <PressableScale
          accessibilityLabel={lastVenue ? `Order again at ${lastVenue.name}` : `Order a ${houseDrink.name}`}
          onPress={() => (lastVenue ? onOrderAgain(lastVenue.id, lastVenue.name) : onFindDrink())}
          pressedScale={0.98}
          style={styles.block}
        >
          <View style={styles.nextStep}>
            <View style={styles.nextIcon}>
              <Beer color={colors.gold} size={16} />
            </View>
            <View style={styles.nextCopy}>
              <Text style={styles.nextTitle} numberOfLines={1}>
                {lastVenue ? `Order again at ${lastVenue.name}` : `Order a ${houseDrink.name}`}
              </Text>
              <Text style={styles.nextText} numberOfLines={1}>
                {houseDrink.name} · +{perDrink} pts
              </Text>
            </View>
            <ChevronRight color={colors.textMuted} size={16} />
          </View>
        </PressableScale>
      ) : null}

      {affordable.length === 0 ? (
        <Pressable accessibilityRole="button" onPress={onBrowseRewards} style={styles.waysLink}>
          <Text style={styles.waysText}>Ways to earn</Text>
        </Pressable>
      ) : null}

      <View style={styles.openFooter}>{footer}</View>
    </View>
  );

  return (
    <PassFrame
      open={open}
      accessibilityLabel={spoken}
      onToggle={onToggle}
      background={<CardSurface reducedMotion={reducedMotion} />}
      borderColor="rgba(244,200,74,0.24)"
      strip={strip}
      closedBody={closedBody}
      openBody={openBody}
      style={style}
    />
  );
}

function CardSurface({ reducedMotion }: { reducedMotion: boolean }) {
  const sheen = useRef(new Animated.Value(0)).current;
  const [width, setWidth] = useState(0);

  // A slow band of light that crosses the card every few seconds.
  useEffect(() => {
    if (reducedMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(2600),
        Animated.timing(sheen, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.quad), useNativeDriver: useNativeMotion }),
        Animated.timing(sheen, { toValue: 0, duration: 0, useNativeDriver: useNativeMotion }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [sheen, reducedMotion]);

  const sheenX = sheen.interpolate({ inputRange: [0, 1], outputRange: [-width * 0.7, width * 1.2] });

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      <LinearGradient
        colors={['#2A2315', '#121009', '#1B170D']}
        locations={[0, 0.55, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Concentric hairlines, like the guilloché on a metal card. */}
      {[300, 230, 160].map((size) => (
        <View
          key={size}
          style={[styles.ring, { width: size, height: size, borderRadius: size / 2, top: -size / 2.4, right: -size / 3.2 }]}
        />
      ))}
      <LinearGradient
        colors={['rgba(244,200,74,0.16)', 'rgba(244,200,74,0)']}
        start={{ x: 1, y: 0 }}
        end={{ x: 0.3, y: 0.8 }}
        style={StyleSheet.absoluteFill}
      />
      {reducedMotion || width === 0 ? null : (
        <Animated.View style={[styles.sheen, { transform: [{ translateX: sheenX }, { rotate: '18deg' }] }]}>
          <LinearGradient
            colors={['rgba(255,255,255,0)', 'rgba(255,240,200,0.13)', 'rgba(255,255,255,0)']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(244,200,74,0.10)',
  },
  sheen: {
    position: 'absolute',
    top: '-40%',
    width: 110,
    height: '180%',
  },
  stripPoints: {
    color: colors.gold,
    fontFamily: font.semibold,
    fontSize: 15,
    fontVariant: ['tabular-nums'],
  },
  closedBody: {
    height: COLLAPSED_HEIGHT - PEEK,
    paddingHorizontal: 20,
    justifyContent: 'center',
    gap: 14,
  },
  track: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: colors.gold,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  holder: {
    flex: 1,
    color: 'rgba(255,255,255,0.78)',
    fontFamily: font.medium,
    fontSize: 12,
    letterSpacing: 1.4,
  },
  since: {
    color: colors.textSubtle,
    fontFamily: font.regular,
    fontSize: 12,
  },
  openBody: {
    paddingTop: 4,
    paddingHorizontal: 20,
    paddingBottom: 18,
  },
  pointsRow: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  points: {
    color: colors.gold,
    fontFamily: font.bold,
    fontSize: 44,
    letterSpacing: -1.6,
    fontVariant: ['tabular-nums'],
  },
  pointsUnit: {
    color: colors.textMuted,
    fontFamily: font.medium,
    fontSize: 15,
  },
  earnRow: {
    marginTop: 10,
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(110,231,167,0.08)',
  },
  earnText: {
    flex: 1,
    color: colors.text,
    fontFamily: font.medium,
    fontSize: 13,
  },
  earnPoints: {
    color: colors.success,
    fontFamily: font.semibold,
    fontSize: 13,
  },
  block: {
    marginTop: 18,
  },
  chips: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 1,
    borderColor: colors.gold,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  chipUnlocked: {
    backgroundColor: colors.gold,
  },
  chipText: {
    color: colors.gold,
    fontFamily: font.semibold,
    fontSize: 13,
  },
  chipTextUnlocked: {
    color: '#080808',
  },
  progressMeta: {
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  progressText: {
    color: colors.textMuted,
    fontFamily: font.regular,
    fontSize: 12,
  },
  nextStep: {
    minHeight: 56,
    padding: 12,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(0,0,0,0.22)',
  },
  nextIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.goldSoft,
  },
  nextCopy: {
    flex: 1,
  },
  nextTitle: {
    color: colors.text,
    fontFamily: font.medium,
    fontSize: 14,
  },
  nextText: {
    marginTop: 2,
    color: colors.textMuted,
    fontFamily: font.regular,
    fontSize: 12,
  },
  waysLink: {
    marginTop: 6,
    minHeight: 44,
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  waysText: {
    color: colors.gold,
    fontFamily: font.medium,
    fontSize: 13,
  },
  openFooter: {
    marginTop: 14,
  },
});
