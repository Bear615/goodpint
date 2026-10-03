import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { colors, font, radii } from '../theme';
import { StarGlyph, StarRow, ratingVerdict } from './RatingStars';
import type { PubRating, PubReview } from '../types';

interface Props {
  rating?: PubRating;
  reviews: PubReview[];
}

// Headline score card for a pub: big average, verdict, fractional stars, and a
// 5→1 breakdown built from the loaded reviews.
export function RatingSummary({ rating, reviews }: Props) {
  const count = rating?.count ?? 0;
  const average = rating?.average ?? 0;

  const buckets = useMemo(() => {
    const tally = [0, 0, 0, 0, 0];
    for (const r of reviews) {
      // Half stars round up (4.5 → 5, 0.5 → 1).
      const bucket = Math.min(5, Math.max(1, Math.round(r.rating)));
      tally[bucket - 1] += 1;
    }
    return tally;
  }, [reviews]);
  const bucketTotal = buckets.reduce((sum, n) => sum + n, 0);

  const grow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    grow.setValue(0);
    Animated.timing(grow, {
      toValue: 1,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [grow, bucketTotal]);

  if (count === 0) {
    return (
      <View style={[styles.card, styles.emptyCard]}>
        <StarRow value={0} size={22} gap={4} />
        <View style={styles.emptyCopy}>
          <Text style={styles.emptyTitle}>No ratings yet</Text>
          <Text style={styles.emptySub}>Be the first to rate this pub.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.scoreCol}>
        <Text style={styles.score}>{average.toFixed(1)}</Text>
        <StarRow value={average} size={15} gap={2} />
        <Text style={styles.verdict}>{ratingVerdict(average)}</Text>
        <Text style={styles.countText}>
          {count} {count === 1 ? 'rating' : 'ratings'}
        </Text>
      </View>

      <View style={styles.bars}>
        {[5, 4, 3, 2, 1].map((stars) => {
          const n = buckets[stars - 1];
          const pct = bucketTotal > 0 ? n / bucketTotal : 0;
          return (
            <View key={stars} style={styles.barRow}>
              <Text style={styles.barLabel}>{stars}</Text>
              <StarGlyph size={10} color={colors.textSubtle} />
              <View style={styles.track}>
                <Animated.View
                  style={[
                    styles.fill,
                    {
                      width: grow.interpolate({ inputRange: [0, 1], outputRange: ['0%', `${pct * 100}%`] }),
                      opacity: n > 0 ? 1 : 0,
                    },
                  ]}
                />
              </View>
              <Text style={styles.barCount}>{n}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    padding: 18,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(244,200,74,0.18)',
    backgroundColor: 'rgba(244,200,74,0.05)',
  },
  scoreCol: {
    alignItems: 'center',
    gap: 5,
    minWidth: 96,
  },
  score: {
    color: colors.text,
    fontFamily: font.medium,
    fontSize: 44,
    lineHeight: 48,
    letterSpacing: -1,
  },
  verdict: {
    marginTop: 2,
    color: colors.gold,
    fontFamily: font.medium,
    fontSize: 13,
  },
  countText: {
    color: colors.textSubtle,
    fontFamily: font.regular,
    fontSize: 11,
  },
  bars: {
    flex: 1,
    gap: 7,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  barLabel: {
    width: 9,
    color: colors.textMuted,
    fontFamily: font.medium,
    fontSize: 11,
    textAlign: 'right',
  },
  track: {
    flex: 1,
    height: 6,
    marginLeft: 3,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: colors.gold,
  },
  barCount: {
    width: 20,
    color: colors.textSubtle,
    fontFamily: font.regular,
    fontSize: 11,
    textAlign: 'right',
  },
  emptyCard: {
    gap: 16,
    borderColor: colors.border,
    backgroundColor: colors.panelSoft,
  },
  emptyCopy: {
    flex: 1,
    gap: 3,
  },
  emptyTitle: {
    color: colors.text,
    fontFamily: font.medium,
    fontSize: 15,
  },
  emptySub: {
    color: colors.textMuted,
    fontFamily: font.regular,
    fontSize: 12,
  },
});
