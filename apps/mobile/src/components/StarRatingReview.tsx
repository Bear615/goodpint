import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, PanResponder, Platform, StyleSheet, Text, View } from 'react-native';
import { colors, font } from '../theme';
import { STAR_EMPTY, StarGlyph } from './RatingStars';

const useNativeMotion = Platform.OS !== 'web';

export const CONFETTI_COLORS = ['#F4C84A', '#FFD700', '#FF6B35', '#4ECDC4', '#45B7D1', '#FFA500', '#FF69B4', '#A8E6CF'];

// Slot width per star — drives the pixel→star math, so keep it in sync with
// the rendered row. The glyph sits centred inside a slightly smaller box.
const STAR_SIZE = 56;
const GLYPH_SIZE = 46;
const NUM_STARS = 5;
const HALF = STAR_SIZE / 2;

const LABEL: Record<string, string> = {
  '0.5': 'Flat pint',
  '1':   'Poor',
  '1.5': 'Not great',
  '2':   'Okay',
  '2.5': 'Decent',
  '3':   'Good',
  '3.5': 'Really good',
  '4':   'Great',
  '4.5': 'Excellent',
  '5':   'Perfect pint!',
};

function hapticStyle(stars: number): Haptics.ImpactFeedbackStyle {
  if (stars <= 1) return Haptics.ImpactFeedbackStyle.Light;
  if (stars <= 3) return Haptics.ImpactFeedbackStyle.Medium;
  return Haptics.ImpactFeedbackStyle.Heavy;
}

function calcStars(x: number): number {
  // Map pixel position → nearest 0.5 increment, clamped to [0.5, 5].
  const half = Math.ceil(Math.max(0, x) / HALF);
  return Math.min(NUM_STARS * 2, Math.max(1, half)) * 0.5;
}

interface Props {
  initialStars?: number;
  onCelebrate?: () => void;
  onRate?: (stars: number) => void;
}

export function StarRatingReview({ initialStars = 0, onCelebrate, onRate }: Props) {
  const [currentStar, setCurrentStar] = useState(initialStars);
  const currentStarRef = useRef(initialStars);
  const containerX = useRef(0);
  const containerRef = useRef<View>(null);
  const celebratedRef = useRef(initialStars >= NUM_STARS);

  // Per-star "pop" as the fill reaches it, plus a readout bump on each change.
  const starScales = useRef(Array.from({ length: NUM_STARS }, () => new Animated.Value(1))).current;
  const readoutScale = useRef(new Animated.Value(1)).current;
  const prevStarRef = useRef(initialStars);
  useEffect(() => {
    const prev = prevStarRef.current;
    prevStarRef.current = currentStar;
    if (prev === currentStar) return;
    const idx = Math.ceil(currentStar) - 1;
    if (currentStar > prev && idx >= 0) {
      starScales[idx].setValue(1.28);
      Animated.spring(starScales[idx], {
        toValue: 1,
        friction: 4,
        tension: 160,
        useNativeDriver: useNativeMotion,
      }).start();
    }
    readoutScale.setValue(1.12);
    Animated.timing(readoutScale, {
      toValue: 1,
      duration: 180,
      easing: Easing.out(Easing.quad),
      useNativeDriver: useNativeMotion,
    }).start();
  }, [currentStar, starScales, readoutScale]);

  // Re-measure the row's window origin on each gesture start. The widget lives
  // inside a sliding modal, so a single onLayout measure can capture a stale
  // offset mid-animation — measuring on grant keeps the math accurate.
  const measureOrigin = useCallback(() => {
    containerRef.current?.measureInWindow((pageX) => {
      containerX.current = pageX;
    });
  }, []);

  const updateStar = useCallback((x: number) => {
    const stars = calcStars(x);
    if (stars !== currentStarRef.current) {
      currentStarRef.current = stars;
      setCurrentStar(stars);
      void Haptics.impactAsync(hapticStyle(stars));
    }
    return stars;
  }, []);

  // Pixel offset into the stars row at the moment the gesture started. Move
  // deltas (gestureState.dx) are added to this — dx is the only PanResponder
  // field that reliably tracks the finger across the whole row on every
  // platform, where per-event pageX could stall after the first star.
  const startX = useRef(0);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      // Hold the gesture against ancestors. ScreenFrame mounts a swipe
      // PanResponder with onMoveShouldSetPanResponderCapture for tab swipes;
      // once the finger moves >15px horizontally it tries to capture, which
      // would yank the rating drag away after ~half a star. Refusing
      // termination keeps the whole drag ours.
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: (e) => {
        measureOrigin();
        startX.current = e.nativeEvent.pageX - containerX.current;
        const stars = calcStars(startX.current);
        currentStarRef.current = stars;
        setCurrentStar(stars);
        void Haptics.impactAsync(hapticStyle(stars));
      },
      onPanResponderMove: (_e, gesture) => {
        updateStar(startX.current + gesture.dx);
      },
      onPanResponderRelease: () => {
        const stars = currentStarRef.current;
        if (stars >= NUM_STARS && !celebratedRef.current) {
          celebratedRef.current = true;
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          onCelebrate?.();
        }
        onRate?.(stars);
      },
      onPanResponderTerminate: () => undefined,
    }),
  ).current;

  const label = currentStar === 0
    ? (initialStars > 0 ? 'Drag to update' : 'Tap or drag across the stars')
    : LABEL[currentStar.toString()] ?? currentStar.toFixed(1);

  return (
    <View style={styles.wrapper}>
      <Animated.View style={[styles.readout, { transform: [{ scale: readoutScale }] }]}>
        <Text style={[styles.readoutValue, currentStar === 0 && styles.readoutIdle]}>
          {currentStar === 0 ? '–' : currentStar.toFixed(1)}
        </Text>
        <Text style={styles.readoutOutOf}>/ 5</Text>
      </Animated.View>

      {/* Large invisible hitbox owns the gesture so dragging off the stars
          (above/below/past either end) keeps tracking. The inner row is what
          gets measured, so the pixel→star math stays anchored to the stars. */}
      <View style={styles.hitbox} {...panResponder.panHandlers}>
      <View
        ref={containerRef}
        onLayout={measureOrigin}
        style={styles.starsRow}
      >
        {Array.from({ length: NUM_STARS }, (_, i) => {
          const portion = Math.max(0, Math.min(1, currentStar - i));
          const fillWidth = portion === 0 ? 0 : portion <= 0.5 ? GLYPH_SIZE / 2 : GLYPH_SIZE;
          return (
            <View key={i} style={styles.starWrap}>
              <Animated.View style={[styles.glyphBox, { transform: [{ scale: starScales[i] }] }]}>
                {/* empty base */}
                <StarGlyph size={GLYPH_SIZE} color={STAR_EMPTY} />
                {/* gold fill, clipped from left */}
                {fillWidth > 0 ? (
                  <View style={[styles.starFillClip, { width: fillWidth }]}>
                    <StarGlyph size={GLYPH_SIZE} color={colors.gold} />
                  </View>
                ) : null}
              </Animated.View>
            </View>
          );
        })}
      </View>
      {/* progress track under the stars */}
      <View style={styles.track}>
        <View style={[styles.trackFill, { width: `${(currentStar / NUM_STARS) * 100}%` }]} />
      </View>
      </View>
      <View style={[styles.labelChip, currentStar === 0 && styles.labelChipIdle]}>
        <Text style={[styles.labelText, currentStar === 0 && styles.labelTextIdle]}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  readout: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  readoutValue: {
    color: colors.text,
    fontFamily: font.medium,
    fontSize: 56,
    lineHeight: 62,
    letterSpacing: -1.5,
  },
  readoutIdle: {
    color: 'rgba(255,255,255,0.18)',
  },
  readoutOutOf: {
    color: colors.textSubtle,
    fontFamily: font.regular,
    fontSize: 18,
    marginBottom: 10,
  },
  hitbox: {
    // Generous padding = invisible drag area extending well past the stars.
    paddingHorizontal: 32,
    paddingTop: 14,
    paddingBottom: 18,
  },
  starsRow: {
    flexDirection: 'row',
  },
  starWrap: {
    width: STAR_SIZE,
    height: STAR_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyphBox: {
    width: GLYPH_SIZE,
    height: GLYPH_SIZE,
  },
  starFillClip: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: GLYPH_SIZE,
    overflow: 'hidden',
  },
  track: {
    height: 4,
    marginTop: 12,
    marginHorizontal: (STAR_SIZE - GLYPH_SIZE) / 2,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden',
  },
  trackFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: colors.gold,
  },
  labelChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.goldSoft,
    borderWidth: 1,
    borderColor: 'rgba(244,200,74,0.3)',
  },
  labelChipIdle: {
    backgroundColor: 'transparent',
    borderColor: 'rgba(255,255,255,0.08)',
  },
  labelText: {
    color: colors.goldBright,
    fontFamily: font.medium,
    fontSize: 14,
    letterSpacing: 0.2,
  },
  labelTextIdle: {
    color: colors.textSubtle,
    fontFamily: font.regular,
    fontSize: 13,
  },
});
