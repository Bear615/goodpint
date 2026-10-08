import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Check, CreditCard, Delete, Zap } from 'lucide-react-native';
import { colors, font, formatCurrency } from '../../theme';
import { BottomSheet } from '../BottomSheet';
import { GoldButton } from '../GoldButton';

const useNativeMotion = Platform.OS !== 'web';

// Mirrors the server's per-top-up ceiling, so the keypad refuses what the API
// would reject instead of letting the user find out after tapping Add.
const MAX_TOP_UP = 500;
const PRESETS = [10, 20, 50, 100];
const DEFAULT_INPUT = '25';
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'back'] as const;

type Key = (typeof KEYS)[number];
type Phase = 'enter' | 'sending' | 'done';

interface TopUpSheetProps {
  visible: boolean;
  balance: number;
  cardLast4: string;
  onClose: () => void;
  /** Resolves true once the server has credited the wallet. */
  onConfirm: (amount: number) => Promise<boolean>;
}

function nextInput(current: string, key: Key): string | null {
  if (key === 'back') return current.slice(0, -1);
  if (key === '.') {
    if (current.includes('.')) return null;
    return current === '' ? '0.' : `${current}.`;
  }
  const [, pence] = current.split('.');
  if (pence !== undefined && pence.length >= 2) return null;
  const next = current === '0' ? key : `${current}${key}`;
  return Number(next) > MAX_TOP_UP ? null : next;
}

export function TopUpSheet({ balance, cardLast4, onClose, onConfirm, visible }: TopUpSheetProps) {
  const [input, setInput] = useState(DEFAULT_INPUT);
  const [phase, setPhase] = useState<Phase>('enter');
  const [credited, setCredited] = useState(0);
  const shake = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0)).current;
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!visible) return;
    setInput(DEFAULT_INPUT);
    setPhase('enter');
  }, [visible]);

  useEffect(() => {
    if (phase !== 'done') return;
    pop.setValue(0);
    Animated.spring(pop, { toValue: 1, tension: 120, friction: 7, useNativeDriver: useNativeMotion }).start();
    const timer = setTimeout(() => onCloseRef.current(), 1500);
    return () => clearTimeout(timer);
  }, [phase, pop]);

  const amount = Number(input || '0');
  const canSubmit = phase === 'enter' && amount > 0 && amount <= MAX_TOP_UP;

  const reject = () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    shake.setValue(0);
    Animated.sequence(
      [10, -8, 6, -4, 0].map((toValue) =>
        Animated.timing(shake, { toValue, duration: 55, useNativeDriver: useNativeMotion }),
      ),
    ).start();
  };

  const press = (key: Key) => {
    const next = nextInput(input, key);
    if (next === null) {
      reject();
      return;
    }
    void Haptics.selectionAsync();
    setInput(next);
  };

  const submit = async () => {
    if (!canSubmit) return;
    const value = Math.round(amount * 100) / 100;
    setPhase('sending');
    const ok = await onConfirm(value);
    if (ok) {
      setCredited(value);
      setPhase('done');
    } else {
      setPhase('enter');
    }
  };

  const display = input === '' ? '0' : input;
  const amountSize = display.length > 5 ? 50 : 64;

  return (
    <BottomSheet visible={visible} onClose={onClose} dismissable={phase !== 'sending'}>
      {phase === 'done' ? (
        <View style={styles.success}>
          <Animated.View style={[styles.successBadge, { transform: [{ scale: pop }] }]}>
            <Check color="#062414" size={38} strokeWidth={3} />
          </Animated.View>
          <Text style={styles.successTitle}>{formatCurrency(credited)} added</Text>
          <Text style={styles.successSubtitle}>New balance {formatCurrency(balance)}</Text>
        </View>
      ) : (
        <>
          <Text style={styles.title}>Add money</Text>
          <Text style={styles.subtitle}>Balance {formatCurrency(balance)}</Text>

          <Animated.View style={[styles.amountRow, { transform: [{ translateX: shake }] }]}>
            <Text style={[styles.currency, { fontSize: amountSize * 0.55 }]}>£</Text>
            <Text style={[styles.amount, { fontSize: amountSize }]} numberOfLines={1}>{display}</Text>
          </Animated.View>
          <Text style={styles.limit}>Up to {formatCurrency(MAX_TOP_UP)} per top-up</Text>

          <View style={styles.presets}>
            {PRESETS.map((preset) => {
              const selected = amount === preset;
              return (
                <Pressable
                  key={preset}
                  accessibilityRole="button"
                  accessibilityLabel={`Add £${preset}`}
                  onPress={() => {
                    void Haptics.selectionAsync();
                    setInput(String(preset));
                  }}
                  style={[styles.preset, selected && styles.presetSelected]}
                >
                  <Text style={[styles.presetText, selected && styles.presetTextSelected]}>£{preset}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.keypad}>
            {KEYS.map((key) => (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityLabel={key === 'back' ? 'Delete' : key}
                onPress={() => press(key)}
                style={({ pressed }) => [styles.key, pressed && styles.keyPressed]}
              >
                {key === 'back' ? (
                  <Delete color={colors.text} size={24} strokeWidth={1.8} />
                ) : (
                  <Text style={styles.keyText}>{key}</Text>
                )}
              </Pressable>
            ))}
          </View>

          <View style={styles.source}>
            {cardLast4 ? <CreditCard color={colors.textMuted} size={16} /> : <Zap color={colors.textMuted} size={16} />}
            <Text style={styles.sourceText}>
              {cardLast4 ? `Paying with card •••• ${cardLast4}` : 'Added to your balance instantly'}
            </Text>
          </View>

          <GoldButton
            label={phase === 'sending' ? 'Adding…' : `Add ${formatCurrency(amount)}`}
            onPress={() => void submit()}
            disabled={!canSubmit}
            testID="confirm-top-up"
          />
        </>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.text,
    fontFamily: font.semibold,
    fontSize: 20,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 4,
    color: colors.textMuted,
    fontFamily: font.regular,
    fontSize: 13,
    textAlign: 'center',
  },
  amountRow: {
    marginTop: 22,
    height: 78,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  currency: {
    marginRight: 2,
    marginTop: 6,
    color: colors.gold,
    fontFamily: font.semibold,
  },
  amount: {
    color: colors.text,
    fontFamily: font.semibold,
    letterSpacing: -2.5,
    fontVariant: ['tabular-nums'],
  },
  limit: {
    color: colors.textSubtle,
    fontFamily: font.regular,
    fontSize: 12,
    textAlign: 'center',
  },
  presets: {
    marginTop: 18,
    flexDirection: 'row',
    gap: 8,
  },
  preset: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  presetSelected: {
    borderColor: colors.borderStrong,
    backgroundColor: colors.goldSoft,
  },
  presetText: {
    color: colors.text,
    fontFamily: font.medium,
    fontSize: 14,
  },
  presetTextSelected: {
    color: colors.gold,
  },
  keypad: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  key: {
    width: '33.333%',
    height: 58,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyPressed: {
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  keyText: {
    color: colors.text,
    fontFamily: font.medium,
    fontSize: 26,
  },
  source: {
    marginTop: 8,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  sourceText: {
    color: colors.textMuted,
    fontFamily: font.regular,
    fontSize: 13,
  },
  success: {
    paddingTop: 28,
    paddingBottom: 40,
    alignItems: 'center',
  },
  successBadge: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.success,
  },
  successTitle: {
    marginTop: 22,
    color: colors.text,
    fontFamily: font.semibold,
    fontSize: 24,
    letterSpacing: -0.6,
  },
  successSubtitle: {
    marginTop: 6,
    color: colors.textMuted,
    fontFamily: font.regular,
    fontSize: 14,
  },
});
