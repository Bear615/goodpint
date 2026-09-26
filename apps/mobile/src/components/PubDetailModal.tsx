import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated, Modal, Pressable, ScrollView, StyleSheet,
  Text, TextInput, useWindowDimensions, View,
} from 'react-native';
import { ArrowLeft, Beer, MapPin, Navigation, PenLine, X } from 'lucide-react-native';
import { colors, font, radii } from '../theme';
import { StarRatingReview, CONFETTI_COLORS } from './StarRatingReview';
import { RatingSummary } from './RatingSummary';
import { StarGlyph, StarRow } from './RatingStars';
import { getPubReviews } from '../services/api';
import { useAuth } from '../context/AuthContext';
import type { OsmPub, PubRating, PubReview } from '../types';

const NUM_PARTICLES = 30;

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const secs = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (secs < 45) return 'just now';
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.round(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

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
  onSubmitReview: (pubId: string, rating: number, pubName: string, note?: string) => void;
  onOpenBuy: (venueId: string, pubName: string) => void;
}

export function PubDetailModal({ pub, rating, userRating, onClose, onSubmitReview, onOpenBuy }: Props) {
  const { width, height } = useWindowDimensions();
  const slideAnim = useRef(new Animated.Value(700)).current;
  const [showYay, setShowYay] = useState(false);
  const [pendingStars, setPendingStars] = useState(0);
  const [hasJustRated, setHasJustRated] = useState(false);
  const [note, setNote] = useState('');
  const [phase, setPhase] = useState<'reviews' | 'rate'>('reviews');
  const [submitted, setSubmitted] = useState(false);
  const [reviews, setReviews] = useState<PubReview[]>([]);
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const particles = useRef(buildParticles()).current;

  const refreshReviews = useCallback((pubId: string) => {
    getPubReviews(pubId)
      .then((list) => setReviews(list))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (pub) {
      setPendingStars(userRating ?? 0);
      setHasJustRated(false);
      setNote('');
      setPhase('reviews');
      setSubmitted(false);
      setReviews([]);
      refreshReviews(pub.id);
      slideAnim.setValue(700);
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 68,
        friction: 12,
        useNativeDriver: true,
      }).start();
    }
  }, [pub, slideAnim, refreshReviews]);

  const openRatePhase = useCallback(() => {
    setPhase('rate');
  }, []);

  const backToReviews = useCallback(() => {
    setHasJustRated(false);
    setNote('');
    setPhase('reviews');
  }, []);

  const handleRate = useCallback((stars: number) => {
    setPendingStars(stars);
    setHasJustRated(true);
  }, []);

  const handleSubmit = useCallback(() => {
    if (!pub || pendingStars === 0) return;
    const trimmedNote = note.trim() || undefined;
    onSubmitReview(pub.id, pendingStars, pub.name, trimmedNote);
    setSubmitted(true);

    // Optimistically show the user's own review immediately, then reconcile
    // with the server once the write lands.
    setReviews((current) => {
      const own: PubReview = {
        id: `local-${pub.id}`,
        pubName: pub.name,
        rating: pendingStars,
        note: trimmedNote ?? null,
        createdAt: new Date().toISOString(),
        isMine: true,
      };
      const others = current.filter((r) => !r.isMine);
      return [own, ...others];
    });
    const pubId = pub.id;
    setTimeout(() => refreshReviews(pubId), 600);
    // slide down → back to reviews
    Animated.timing(slideAnim, {
      toValue: 700,
      duration: 260,
      useNativeDriver: true,
    }).start(() => {
      setHasJustRated(false);
      setNote('');
      setPhase('reviews');
      slideAnim.setValue(700);
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 68,
        friction: 12,
        useNativeDriver: true,
      }).start();
    });
  }, [pub, pendingStars, note, onSubmitReview, slideAnim, userId, refreshReviews]);

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
        Animated.timing(p.translateY, { toValue: 700 + Math.random() * 200, duration: 1600 + i * 25, useNativeDriver: true }),
        Animated.timing(p.translateX, { toValue: spread - width / 2 + ((i % 5) - 2) * 55, duration: 1700 + i * 20, useNativeDriver: true }),
        Animated.timing(p.rotation, { toValue: 1, duration: 1800, useNativeDriver: true }),
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
        {/* confetti */}
        <View style={[styles.confettiLayer, { left: width / 2 }]} pointerEvents="none">
          {particles.map((p) => (
            <Animated.View
              key={p.id}
              style={[styles.confettiPiece, {
                width: p.size, height: p.size, backgroundColor: p.color, opacity: p.opacity,
                transform: [
                  { translateY: p.translateY }, { translateX: p.translateX },
                  { rotate: p.rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '720deg'] }) },
                ],
              }]}
            />
          ))}
        </View>

        <Pressable style={styles.backdrop} onPress={close} />

        <Animated.View style={[styles.sheet, { height: height * 0.82, transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.handle} />

          {phase === 'reviews' ? (
            <>
              {/* Pub header */}
              <View style={styles.header}>
                <View style={styles.headerCopy}>
                  <Text style={styles.pubName} numberOfLines={2}>{pub.name}</Text>
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

              <View style={styles.summaryWrap}>
                <RatingSummary rating={rating} reviews={reviews} />
              </View>

              {/* CTAs */}
              <View style={styles.ctaRow}>
                <Pressable style={styles.reviewCta} onPress={openRatePhase}>
                  <PenLine size={16} color={colors.gold} strokeWidth={2} />
                  <Text style={styles.reviewCtaText}>
                    {userRating ? 'Update your review' : 'Rate this pub'}
                  </Text>
                  {userRating ? (
                    <View style={styles.yourChip}>
                      <StarGlyph size={11} />
                      <Text style={styles.yourChipText}>{userRating.toFixed(1)}</Text>
                    </View>
                  ) : null}
                </Pressable>
                <Pressable style={styles.orderCta} onPress={() => { close(); onOpenBuy(pub.id, pub.name); }}>
                  <Beer size={15} color={colors.textMuted} strokeWidth={2} />
                  <Text style={styles.orderCtaText}>Order a drink</Text>
                </Pressable>
              </View>

              <View style={styles.sectionHead}>
                <Text style={styles.sectionTitle}>Reviews</Text>
                {reviews.length > 0 ? <Text style={styles.sectionCount}>{reviews.length}</Text> : null}
              </View>

              {/* Reviews list */}
              <ScrollView
                style={styles.reviewsList}
                contentContainerStyle={styles.reviewsListContent}
                showsVerticalScrollIndicator={false}
              >
                {submitted ? (
                  <View style={styles.submittedBanner}>
                    <Text style={styles.submittedText}>Cheers — your review is up.</Text>
                    {rating && rating.count > 1 ? (
                      <Text style={styles.submittedSub}>
                        It now sits alongside {rating.count - 1} other {rating.count - 1 === 1 ? 'regular' : 'regulars'}.
                      </Text>
                    ) : (
                      <Text style={styles.submittedSub}>You're the first one in for this place.</Text>
                    )}
                  </View>
                ) : null}

                {reviews.length > 0 ? (
                  reviews
                    .slice()
                    .sort((a, b) => {
                      const aOwn = a.isMine ? 0 : 1;
                      const bOwn = b.isMine ? 0 : 1;
                      return aOwn - bOwn;
                    })
                    .map((r) => {
                      const isOwn = r.isMine;
                      return (
                        <View key={r.id} style={[styles.reviewItem, isOwn && styles.reviewItemOwn]}>
                          <View style={styles.reviewItemHead}>
                            <View style={[styles.avatar, isOwn && styles.avatarOwn]}>
                              {isOwn
                                ? <Text style={styles.avatarText}>You</Text>
                                : <Beer size={15} color={colors.textMuted} strokeWidth={2} />}
                            </View>
                            <View style={styles.reviewMeta}>
                              <Text style={styles.reviewAuthor}>{isOwn ? 'Your review' : 'A regular'}</Text>
                              <Text style={styles.reviewTime}>{relativeTime(r.createdAt)}</Text>
                            </View>
                            <View style={styles.reviewScore}>
                              <StarRow value={r.rating} size={12} gap={1.5} />
                              <Text style={styles.reviewScoreText}>{r.rating.toFixed(1)}</Text>
                            </View>
                          </View>
                          {r.note ? <Text style={styles.reviewNote}>{r.note}</Text> : null}
                        </View>
                      );
                    })
                ) : (
                  <View style={styles.emptyReviews}>
                    <Text style={styles.emptyText}>No written reviews yet</Text>
                    <Text style={styles.emptyHint}>If you've had a pint here, leave a few words.</Text>
                  </View>
                )}
              </ScrollView>
            </>
          ) : (
            <>
              {/* Rate phase header */}
              <View style={styles.rateHeader}>
                <Pressable onPress={backToReviews} style={styles.backBtn} hitSlop={12}>
                  <ArrowLeft size={20} color={colors.textMuted} />
                </Pressable>
                <Text style={styles.rateTitle} numberOfLines={1}>{pub.name}</Text>
                <Pressable onPress={close} style={styles.closeBtn} hitSlop={12}>
                  <X size={20} color={colors.textMuted} />
                </Pressable>
              </View>

              <View style={styles.reviewArea}>
                <Text style={[styles.reviewLabel, showYay && styles.yay]}>
                  {showYay
                    ? 'Top marks!'
                    : userRating ? 'Update your rating' : 'How was your pint?'}
                </Text>
                <StarRatingReview
                  key={pub.id}
                  initialStars={userRating ?? 0}
                  onCelebrate={fireConfetti}
                  onRate={handleRate}
                />
              </View>

              {hasJustRated ? (
                <View style={styles.noteArea}>
                  <View style={styles.noteHead}>
                    <Text style={styles.noteLabel}>Add a note</Text>
                    <Text style={styles.noteCounter}>{note.length}/280</Text>
                  </View>
                  <TextInput
                    style={styles.noteInput}
                    value={note}
                    onChangeText={setNote}
                    placeholder="What stood out? The pour, the vibe, the staff… (optional)"
                    placeholderTextColor={colors.textSubtle}
                    multiline
                    maxLength={280}
                    selectionColor={colors.gold}
                  />
                  <Pressable style={styles.submitBtn} onPress={handleSubmit}>
                    <Text style={styles.submitText}>{userRating ? 'Update review' : 'Post review'}</Text>
                  </Pressable>
                </View>
              ) : null}
            </>
          )}
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
    top: 0, left: 0, right: 0, bottom: 0,
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
  // reviews phase
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
    marginTop: 2,
  },
  summaryWrap: {
    marginTop: 18,
  },
  ctaRow: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 10,
  },
  reviewCta: {
    flex: 1.4,
    height: 48,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: 'rgba(244,200,74,0.07)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  reviewCtaText: {
    color: colors.gold,
    fontFamily: font.medium,
    fontSize: 14,
  },
  yourChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(244,200,74,0.16)',
  },
  yourChipText: {
    color: colors.goldBright,
    fontFamily: font.medium,
    fontSize: 11,
  },
  orderCta: {
    flex: 1,
    height: 48,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  orderCtaText: {
    color: colors.textMuted,
    fontFamily: font.regular,
    fontSize: 14,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
    marginBottom: 12,
  },
  sectionTitle: {
    color: colors.textSubtle,
    fontFamily: font.medium,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.3,
  },
  sectionCount: {
    color: colors.textSubtle,
    fontFamily: font.regular,
    fontSize: 12,
  },
  reviewsList: {
    flex: 1,
  },
  reviewsListContent: {
    gap: 10,
    paddingBottom: 8,
  },
  submittedBanner: {
    padding: 16,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: 'rgba(110,231,167,0.3)',
    backgroundColor: 'rgba(110,231,167,0.06)',
    gap: 6,
  },
  submittedText: {
    color: colors.success,
    fontFamily: font.medium,
    fontSize: 15,
  },
  submittedSub: {
    color: colors.textMuted,
    fontFamily: font.regular,
    fontSize: 13,
  },
  reviewItem: {
    padding: 14,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: colors.panelSoft,
    gap: 10,
  },
  reviewItemOwn: {
    borderColor: 'rgba(244,200,74,0.28)',
    backgroundColor: 'rgba(244,200,74,0.05)',
  },
  reviewItemHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  avatarOwn: {
    backgroundColor: colors.gold,
  },
  avatarText: {
    color: '#080808',
    fontFamily: font.medium,
    fontSize: 11,
  },
  reviewMeta: {
    flex: 1,
    gap: 2,
  },
  reviewAuthor: {
    color: colors.text,
    fontFamily: font.medium,
    fontSize: 14,
  },
  reviewScore: {
    alignItems: 'flex-end',
    gap: 3,
  },
  reviewScoreText: {
    color: colors.textMuted,
    fontFamily: font.medium,
    fontSize: 11,
  },
  reviewTime: {
    color: colors.textSubtle,
    fontFamily: font.regular,
    fontSize: 12,
  },
  reviewNote: {
    color: colors.text,
    fontFamily: font.regular,
    fontSize: 14,
    lineHeight: 21,
  },
  emptyReviews: {
    paddingVertical: 32,
    alignItems: 'center',
    gap: 6,
  },
  emptyText: {
    color: colors.textMuted,
    fontFamily: font.medium,
    fontSize: 15,
  },
  emptyHint: {
    color: colors.textSubtle,
    fontFamily: font.regular,
    fontSize: 13,
  },
  // rate phase
  rateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  backBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
  },
  rateTitle: {
    flex: 1,
    color: colors.text,
    fontFamily: font.medium,
    fontSize: 18,
  },
  reviewArea: {
    alignItems: 'center',
    marginTop: 28,
  },
  reviewLabel: {
    color: colors.textSubtle,
    fontFamily: font.medium,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.3,
    marginBottom: 8,
  },
  yay: {
    color: colors.success,
  },
  noteArea: {
    marginTop: 22,
    gap: 10,
  },
  noteHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  noteLabel: {
    color: colors.textMuted,
    fontFamily: font.medium,
    fontSize: 13,
  },
  noteCounter: {
    color: colors.textSubtle,
    fontFamily: font.regular,
    fontSize: 12,
  },
  noteInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    backgroundColor: colors.panelGlass,
    color: colors.text,
    fontFamily: font.regular,
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 88,
    textAlignVertical: 'top',
  },
  submitBtn: {
    height: 52,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: {
    color: colors.gold,
    fontFamily: font.medium,
    fontSize: 16,
    letterSpacing: 0.3,
  },
});
