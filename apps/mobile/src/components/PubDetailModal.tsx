import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { MapPin, Navigation, Star, X } from 'lucide-react-native';
import { colors, font, radii } from '../theme';
import { StarRatingReview, CONFETTI_COLORS } from './StarRatingReview';
import type { OsmPub, PubRating } from '../types';

const NUM_PARTICLES = 30;

function buildParticles() {
  return Array.from({ length: NUM_PARTICLES }, (_, i) => ({
    id: i,
    translateY: new Animated.Value(-80),
    translateX: new Animated.Value(((i % 7) - 3) * 20),
    rotation: new Animated.Value(0),
    opacity: new Animated.Value(0),
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    size: 7 + (i % 5) * 2,
  }));
}

interface Props {
  pub: OsmPub | null;
  rating?: PubRating;
  userRating?: number;
  onClose: () => void;
  onSubmitReview: (pubId: string, rating: number, pubName: string) => void;
}

export function PubDetailModal({ pub, rating, userRating, onClose, onSubmitReview }: Props) {
  const { width } = useWindowDimensions();
  const slideAnim = useRef(new Animated.Value(700)).current;
  const [showYay, setShowYay] = useState(false);
  const [submittedStars, setSubmittedStars] = useState(0);
  const particles = useRef(buildParticles()).current;

  useEffect(() => {
    if (pub) {
      setSubmittedStars(userRating ?? 0);
      slideAnim.setValue(700);
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 68,
        friction: 12,
        useNativeDriver: true,
      }).start();
    }
  }, [pub, slideAnim]);

  const handleRate = useCallback(
    (stars: number) => {
      if (!pub) return;
      setSubmittedStars(stars);
      onSubmitReview(pub.id, stars, pub.name);
    },
    [pub, onSubmitReview],
  );

  const close = useCallback(() => {
    Animated.timing(slideAnim, {
      toValue: 700,
      duration: 260,
      useNativeDriver: true,
    }).start(onClose);
  }, [slideAnim, onClose]);

  const fireConfetti = useCallback(() => {
    setShowYay(true);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    particles.forEach((p, i) => {
      const spread = (i / NUM_PARTICLES) * width;
      p.translateY.setValue(-80);
      p.translateX.setValue(((i % 7) - 3) * 20);
      p.rotation.setValue(0);
      p.opacity.setValue(1);

      Animated.parallel([
        Animated.timing(p.translateY, {
          toValue: 700 + Math.random() * 200,
          duration: 1600 + i * 25,
          useNativeDriver: true,
        }),
        Animated.timing(p.translateX, {
          toValue: spread - width / 2 + ((i % 5) - 2) * 55,
          duration: 1700 + i * 20,
          useNativeDriver: true,
        }),
        Animated.timing(p.rotation, {
          toValue: 1,
          duration: 1800,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(1300 + i * 15),
          Animated.timing(p.opacity, { toValue: 0, duration: 350, useNativeDriver: true }),
        ]),
      ]).start();
    });

    setTimeout(() => setShowYay(false), 2400);
  }, [particles, width]);

  if (!pub) return null;

  const milesText =
    pub.distanceMiles < 0.1
      ? `${Math.round(pub.distanceMiles * 1760)} yds away`
      : `${pub.distanceMiles.toFixed(1)} mi away`;

  return (
    <Modal visible transparent animationType="none" onRequestClose={close}>
      <View style={styles.overlay}>
        {/* confetti layer — full screen, above backdrop */}
        <View style={[styles.confettiLayer, { left: width / 2 }]} pointerEvents="none">
          {particles.map((p) => (
            <Animated.View
              key={p.id}
              style={[
                styles.confettiPiece,
                {
                  width: p.size,
                  height: p.size,
                  backgroundColor: p.color,
                  opacity: p.opacity,
                  transform: [
                    { translateY: p.translateY },
                    { translateX: p.translateX },
                    {
                      rotate: p.rotation.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0deg', '720deg'],
                      }),
                    },
                  ],
                },
              ]}
            />
          ))}
        </View>

        <Pressable style={styles.backdrop} onPress={close} />

        <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.pubName} numberOfLines={2}>{pub.name}</Text>
              <View style={styles.metaRow}>
                <Star size={13} color={colors.gold} fill={rating && rating.count > 0 ? colors.gold : 'transparent'} />
                <Text style={styles.metaText}>
                  {rating && rating.count > 0
                    ? `${rating.average.toFixed(1)} · ${rating.count} ${rating.count === 1 ? 'review' : 'reviews'}`
                    : 'No reviews yet'}
                </Text>
              </View>
              <View style={styles.metaRow}>
                <Navigation size={13} color={colors.gold} />
                <Text style={styles.metaText}>{milesText}</Text>
              </View>
              {pub.address ? (
                <View style={styles.metaRow}>
                  <MapPin size={13} color={colors.textMuted} />
                  <Text style={styles.metaText} numberOfLines={1}>{pub.address}</Text>
                </View>
              ) : null}
            </View>
            <Pressable onPress={close} style={styles.closeBtn} hitSlop={12}>
              <X size={20} color={colors.textMuted} />
            </Pressable>
          </View>

          <View style={styles.divider} />

          <View style={styles.reviewArea}>
            {showYay ? (
              <Text style={styles.yay}>Yay!</Text>
            ) : submittedStars > 0 && submittedStars !== userRating ? (
              <Text style={styles.thanks}>Thanks for rating!</Text>
            ) : userRating ? (
              <Text style={styles.reviewLabel}>Your rating · drag to update</Text>
            ) : (
              <Text style={styles.reviewLabel}>Rate this pub</Text>
            )}
            <StarRatingReview key={pub.id} initialStars={userRating ?? 0} onCelebrate={fireConfetti} onRate={handleRate} />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  confettiLayer: {
    position: 'absolute',
    top: 0,
    zIndex: 20,
    pointerEvents: 'none',
  },
  confettiPiece: {
    position: 'absolute',
    top: 0,
    borderRadius: 2,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.68)',
  },
  sheet: {
    backgroundColor: '#0D0F11',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 24,
    paddingBottom: 52,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignSelf: 'center',
    marginTop: 14,
    marginBottom: 22,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  headerCopy: {
    flex: 1,
    gap: 7,
  },
  pubName: {
    color: colors.text,
    fontFamily: font.medium,
    fontSize: 26,
    lineHeight: 32,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    color: colors.textMuted,
    fontFamily: font.regular,
    fontSize: 13,
    flexShrink: 1,
  },
  closeBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    marginVertical: 22,
  },
  reviewArea: {
    alignItems: 'center',
    minHeight: 110,
  },
  reviewLabel: {
    color: colors.textSubtle,
    fontFamily: font.regular,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.3,
    marginBottom: 4,
  },
  yay: {
    color: colors.success,
    fontFamily: font.medium,
    fontSize: 30,
    letterSpacing: 2,
    marginBottom: 4,
  },
  thanks: {
    color: colors.success,
    fontFamily: font.medium,
    fontSize: 15,
    marginBottom: 4,
  },
});
