import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, font } from '../theme';

// Rounded five-point star on a 24×24 grid.
const STAR_PATH =
  'M12 2.4c.38 0 .73.22.9.56l2.5 5.07 5.6.81c.84.12 1.18 1.16.57 1.75l-4.05 3.95.96 5.58c.14.84-.74 1.48-1.5 1.08L12 18.57l-5.01 2.63c-.75.4-1.63-.24-1.49-1.08l.96-5.58-4.05-3.95c-.61-.6-.27-1.63.57-1.75l5.6-.81 2.5-5.07c.17-.34.52-.56.9-.56z';

export const STAR_EMPTY = 'rgba(255,255,255,0.14)';

interface StarGlyphProps {
  size: number;
  color?: string;
}

export function StarGlyph({ size, color = colors.gold }: StarGlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={STAR_PATH} fill={color} />
    </Svg>
  );
}

interface FractionalStarProps {
  size: number;
  // 0 → empty, 1 → full; anything between is clipped from the left.
  fill: number;
  color?: string;
  emptyColor?: string;
}

export function FractionalStar({ size, fill, color = colors.gold, emptyColor = STAR_EMPTY }: FractionalStarProps) {
  const portion = Math.max(0, Math.min(1, fill));
  return (
    <View style={{ width: size, height: size }}>
      <StarGlyph size={size} color={emptyColor} />
      {portion > 0 ? (
        <View style={[styles.clip, { width: size * portion, height: size }]}>
          <StarGlyph size={size} color={color} />
        </View>
      ) : null}
    </View>
  );
}

interface StarRowProps {
  value: number;
  size?: number;
  gap?: number;
  color?: string;
  emptyColor?: string;
}

// Read-only row of five stars filled to an exact fractional value (4.3 fills
// the fifth star 30%), so averages read true rather than rounding to halves.
export function StarRow({ value, size = 14, gap = 2, color, emptyColor }: StarRowProps) {
  return (
    <View style={[styles.row, { gap }]} accessibilityLabel={`${value.toFixed(1)} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, i) => (
        <FractionalStar key={i} size={size} fill={value - i} color={color} emptyColor={emptyColor} />
      ))}
    </View>
  );
}

/** Short verdict for an average score. */
export function ratingVerdict(average: number): string {
  if (average >= 4.6) return 'Exceptional';
  if (average >= 4.1) return 'Excellent';
  if (average >= 3.6) return 'Very good';
  if (average >= 3) return 'Good';
  if (average >= 2) return 'Mixed';
  return 'Poor';
}

interface Props {
  average: number;
  count: number;
  size?: number;
  showCount?: boolean;
}

// Compact read-only rating pill: ★ average · count. Renders a quiet "New" pill
// when there are no reviews yet.
export function RatingStars({ average, count, size = 13, showCount = true }: Props) {
  if (count === 0) {
    return (
      <View style={[styles.pill, styles.pillEmpty]}>
        <StarGlyph size={size - 2} color={colors.textSubtle} />
        <Text style={[styles.empty, { fontSize: size - 2 }]}>No reviews yet</Text>
      </View>
    );
  }

  return (
    <View style={styles.pill} accessibilityLabel={`Rated ${average.toFixed(1)} from ${count} reviews`}>
      <StarGlyph size={size} />
      <Text style={[styles.value, { fontSize: size }]}>{average.toFixed(1)}</Text>
      {showCount ? (
        <Text style={[styles.count, { fontSize: size - 2 }]}>
          ({count})
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  clip: {
    position: 'absolute',
    top: 0,
    left: 0,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: 6,
    paddingRight: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: colors.goldSoft,
    borderWidth: 1,
    borderColor: 'rgba(244,200,74,0.22)',
  },
  pillEmpty: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.08)',
  },
  value: {
    color: colors.goldBright,
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
