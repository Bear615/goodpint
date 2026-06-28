import * as Haptics from 'expo-haptics';
import { useCallback, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';
import { font } from '../theme';

export const CONFETTI_COLORS = ['#F4C84A', '#FFD700', '#FF6B35', '#4ECDC4', '#45B7D1', '#FFA500', '#FF69B4', '#A8E6CF'];

const STAR_SIZE = 52;
const NUM_STARS = 5;
const HALF = STAR_SIZE / 2;

const LABEL: Record<string, string> = {
  '0.5': 'Meh',
  '1':   'Poor',
  '1.5': 'Hmm',
  '2':   'Okay',
  '2.5': 'Decent',
  '3':   'Good',
  '3.5': 'Good+',
  '4':   'Great',
  '4.5': 'Excellent',
  '5':   'Perfect!',
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

  return (
    <View style={styles.wrapper}>
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
          const fillWidth = portion === 0 ? 0 : portion <= 0.5 ? HALF : STAR_SIZE;
          return (
            <View key={i} style={styles.starWrap}>
              {/* empty base */}
              <Text style={styles.starEmpty}>★</Text>
              {/* gold fill, clipped from left */}
              {fillWidth > 0 ? (
                <View style={[styles.starFillClip, { width: fillWidth }]}>
                  <View style={styles.starFillAlign}>
                    <Text style={styles.starGold}>★</Text>
                  </View>
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
      </View>
      <Text style={styles.hint}>
        {currentStar === 0
          ? (initialStars > 0 ? 'Drag to update' : 'Hold & drag to rate')
          : LABEL[currentStar.toString()] ?? currentStar.toFixed(1)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  hitbox: {
    // Generous padding = invisible drag area extending well past the stars.
    paddingHorizontal: 48,
    paddingVertical: 28,
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
  starEmpty: {
    fontSize: 38,
    lineHeight: STAR_SIZE,
    color: 'rgba(255,255,255,0.15)',
  },
  starFillClip: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: STAR_SIZE,
    overflow: 'hidden',
  },
  starFillAlign: {
    width: STAR_SIZE,
    height: STAR_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  starGold: {
    fontSize: 38,
    lineHeight: STAR_SIZE,
    color: '#F4C84A',
  },
  hint: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.4)',
    fontFamily: font.regular,
    fontSize: 13,
    letterSpacing: 0.3,
  },
});
