import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Beer, Eye, EyeOff, Nfc, RotateCcw } from 'lucide-react-native';
import { colors, font, formatCurrency, formatPoints } from '../../theme';
import { PressableScale } from '../Motion';

const useNativeMotion = Platform.OS !== 'web';

/**
 * Eases a displayed number towards its target, the way banking apps roll a
 * balance up after a top-up. An interrupted roll continues from wherever the
 * figure on screen currently is.
 */
function useCountUp(target: number, duration = 750) {
  const [display, setDisplay] = useState(target);
  const current = useRef(target);

  useEffect(() => {
    const from = current.current;
    if (from === target) return;

    const start = Date.now();
    let frame = 0;
    const tick = () => {
      const progress = Math.min((Date.now() - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      current.current = from + (target - from) * eased;
      setDisplay(current.current);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return display;
}

interface WalletCardProps {
  balance: number;
  cardLast4: string;
  holderName: string;
  points: number;
  hidden: boolean;
  flipped: boolean;
  onToggleHidden: () => void;
  onFlip: () => void;
}

export function WalletCard({ balance, cardLast4, holderName, points, hidden, flipped, onToggleHidden, onFlip }: WalletCardProps) {
  const shownBalance = useCountUp(balance);
  const flip = useRef(new Animated.Value(flipped ? 1 : 0)).current;
  const sheen = useRef(new Animated.Value(0)).current;
  const [width, setWidth] = useState(0);

  useEffect(() => {
    Animated.spring(flip, {
      toValue: flipped ? 1 : 0,
      tension: 46,
      friction: 9,
      useNativeDriver: useNativeMotion,
    }).start();
  }, [flipped, flip]);

  // A slow band of light that crosses the card every few seconds.
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(2600),
        Animated.timing(sheen, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.quad), useNativeDriver: useNativeMotion }),
        Animated.timing(sheen, { toValue: 0, duration: 0, useNativeDriver: useNativeMotion }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [sheen]);

  const frontRotate = flip.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  const backRotate = flip.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] });
  // Swap faces at the halfway point; backfaceVisibility alone is unreliable on Android.
  const frontOpacity = flip.interpolate({ inputRange: [0, 0.5, 0.501, 1], outputRange: [1, 1, 0, 0] });
  const backOpacity = flip.interpolate({ inputRange: [0, 0.5, 0.501, 1], outputRange: [0, 0, 1, 1] });
  const sheenX = sheen.interpolate({ inputRange: [0, 1], outputRange: [-width * 0.7, width * 1.2] });

  // Scales with the card so the balance keeps its breathing room on small phones.
  const balanceSize = width > 0 ? Math.min(36, Math.round(width * 0.095)) : 36;
  const hasCard = cardLast4.length > 0;
  const name = holderName.trim() || 'GoodPint Member';

  return (
    <PressableScale
      accessibilityLabel={flipped ? 'Show card front' : 'Show card details'}
      onPress={onFlip}
      pressedScale={0.975}
    >
      <View style={styles.frame} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
        <Animated.View
          pointerEvents={flipped ? 'none' : 'auto'}
          style={[styles.face, { opacity: frontOpacity, transform: [{ perspective: 1200 }, { rotateY: frontRotate }] }]}
        >
          <CardSurface />
          <Animated.View pointerEvents="none" style={[styles.sheen, { transform: [{ translateX: sheenX }, { rotate: '18deg' }] }]}>
            <LinearGradient
              colors={['rgba(255,255,255,0)', 'rgba(255,240,200,0.13)', 'rgba(255,255,255,0)']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>

          <View style={styles.content}>
            <View>
              <View style={styles.topRow}>
                <View style={styles.brand}>
                  <Beer color={colors.gold} size={19} strokeWidth={2.2} />
                  <Text style={styles.brandText}>GoodPint</Text>
                </View>
                <Nfc color="rgba(255,255,255,0.55)" size={22} strokeWidth={1.8} />
              </View>
              <Chip />
            </View>

            <View>
              <Text style={styles.balanceLabel}>Balance</Text>
              <View style={styles.balanceRow}>
                <Text style={[styles.balance, { fontSize: balanceSize }]} numberOfLines={1} adjustsFontSizeToFit>
                  {hidden ? '£ • • • •' : formatCurrency(shownBalance)}
                </Text>
                {/* A switch rather than a button: it is a toggle, and on web a
                    button would nest inside the card's own button. */}
                <Pressable
                  accessibilityRole="switch"
                  accessibilityState={{ checked: hidden }}
                  accessibilityLabel="Hide balance"
                  hitSlop={12}
                  onPress={onToggleHidden}
                  style={styles.eye}
                >
                  {hidden ? <EyeOff color={colors.textMuted} size={18} /> : <Eye color={colors.textMuted} size={18} />}
                </Pressable>
              </View>
            </View>

            <View style={styles.bottomRow}>
              <Text style={styles.holder} numberOfLines={1}>{name.toUpperCase()}</Text>
              <Text style={styles.digits}>{hasCard ? `•••• ${cardLast4}` : 'No card linked'}</Text>
            </View>
          </View>
        </Animated.View>

        <Animated.View
          pointerEvents="none"
          style={[styles.face, { opacity: backOpacity, transform: [{ perspective: 1200 }, { rotateY: backRotate }] }]}
        >
          <CardSurface />
          <View style={styles.stripe} />
          <View style={styles.backContent}>
            <View style={styles.detailGrid}>
              <Detail label="Card holder" value={name} />
              <Detail label="Points" value={`${formatPoints(points)} pts`} gold />
              <Detail label="Card number" value={hasCard ? `•••• •••• •••• ${cardLast4}` : 'Not linked yet'} />
              <Detail label="Rewards" value="1 pt per £1 spent" />
            </View>
            <View style={styles.flipHint}>
              <RotateCcw color={colors.textSubtle} size={13} />
              <Text style={styles.flipHintText}>Tap to flip back</Text>
            </View>
          </View>
        </Animated.View>
      </View>
    </PressableScale>
  );
}

function CardSurface() {
  return (
    <>
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
          pointerEvents="none"
          style={[styles.ring, { width: size, height: size, borderRadius: size / 2, top: -size / 2.4, right: -size / 3.2 }]}
        />
      ))}
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(244,200,74,0.16)', 'rgba(244,200,74,0)']}
        start={{ x: 1, y: 0 }}
        end={{ x: 0.3, y: 0.8 }}
        style={StyleSheet.absoluteFill}
      />
    </>
  );
}

function Chip() {
  return (
    <LinearGradient
      colors={['#F8E29A', '#C99A2E', '#EFCB63']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.chip}
    >
      <View style={styles.chipLineH} />
      <View style={[styles.chipLineV, { left: 13 }]} />
      <View style={[styles.chipLineV, { right: 13 }]} />
      <View style={styles.chipCore} />
    </LinearGradient>
  );
}

function Detail({ gold, label, value }: { label: string; value: string; gold?: boolean }) {
  return (
    <View style={styles.detail}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, gold && styles.detailGold]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    aspectRatio: 1.586,
  },
  face: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(244,200,74,0.24)',
    backfaceVisibility: 'hidden',
    backgroundColor: '#100E09',
  },
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
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'space-between',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  brandText: {
    color: colors.text,
    fontFamily: font.semibold,
    fontSize: 17,
    letterSpacing: -0.4,
  },
  chip: {
    marginTop: 12,
    width: 40,
    height: 30,
    borderRadius: 7,
    overflow: 'hidden',
  },
  chipLineH: {
    position: 'absolute',
    top: 14.5,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(80,55,0,0.35)',
  },
  chipLineV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(80,55,0,0.35)',
  },
  chipCore: {
    position: 'absolute',
    top: 8,
    left: 13,
    width: 14,
    height: 14,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(80,55,0,0.35)',
  },
  balanceLabel: {
    color: 'rgba(255,255,255,0.55)',
    fontFamily: font.medium,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  balanceRow: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  balance: {
    flexShrink: 1,
    color: colors.text,
    fontFamily: font.semibold,
    letterSpacing: -1.2,
    fontVariant: ['tabular-nums'],
  },
  eye: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  bottomRow: {
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
  digits: {
    color: 'rgba(255,255,255,0.78)',
    fontFamily: font.medium,
    fontSize: 13,
    letterSpacing: 1,
  },
  stripe: {
    marginTop: 22,
    height: 40,
    backgroundColor: '#050403',
  },
  backContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 16,
    justifyContent: 'space-between',
  },
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 12,
  },
  detail: {
    width: '50%',
    paddingRight: 10,
  },
  detailLabel: {
    color: colors.textSubtle,
    fontFamily: font.medium,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  detailValue: {
    marginTop: 3,
    color: colors.text,
    fontFamily: font.medium,
    fontSize: 14,
  },
  detailGold: {
    color: colors.gold,
  },
  flipHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  flipHintText: {
    color: colors.textSubtle,
    fontFamily: font.regular,
    fontSize: 11,
  },
});
