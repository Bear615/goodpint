import { StyleSheet, Text, View } from 'react-native';
import { colors, font } from '../theme';

interface Props {
  average: number;
  count: number;
  size?: number;
  showCount?: boolean;
}

// Compact read-only rating: ★ average (count). Renders an "unrated" hint when
// there are no reviews yet.
export function RatingStars({ average, count, size = 13, showCount = true }: Props) {
  if (count === 0) {
    return <Text style={[styles.empty, { fontSize: size - 1 }]}>No reviews yet</Text>;
  }

  return (
    <View style={styles.row}>
      <Text style={[styles.star, { fontSize: size }]}>★</Text>
      <Text style={[styles.value, { fontSize: size }]}>{average.toFixed(1)}</Text>
      {showCount ? (
        <Text style={[styles.count, { fontSize: size - 1 }]}>
          ({count})
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  star: {
    color: colors.gold,
  },
  value: {
    color: colors.text,
    fontFamily: font.medium,
  },
  count: {
    color: colors.textMuted,
    fontFamily: font.regular,
  },
  empty: {
    color: colors.textSubtle,
    fontFamily: font.regular,
  },
});
