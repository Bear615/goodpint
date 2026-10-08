import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { colors, font, formatPoints } from '../../theme';
import type { ClaimResult, Reward } from '../../types';
import { ptsLabel } from '../../utils/rewards';
import { BottomSheet } from '../BottomSheet';
import { GoldButton } from '../GoldButton';

type Phase = 'confirm' | 'sending' | 'error';

interface ClaimSheetProps {
  visible: boolean;
  reward: Reward | null;
  points: number;
  onClose: () => void;
  onConfirm: (rewardId: string) => Promise<ClaimResult>;
}

/**
 * Confirms spending points on a reward. On success App closes the sheet and
 * opens the new pass in the Wallet; a refusal is shown here, inline.
 */
export function ClaimSheet({ onClose, onConfirm, points, reward, visible }: ClaimSheetProps) {
  const [phase, setPhase] = useState<Phase>('confirm');
  const [error, setError] = useState<string | null>(null);
  // While sending, and as the sheet closes after success, keep showing the
  // balance the user confirmed against rather than the one after the spend.
  const [pointsAtSend, setPointsAtSend] = useState(points);

  useEffect(() => {
    if (!visible) return;
    setPhase('confirm');
    setError(null);
  }, [visible]);

  if (!reward) return null;

  const shownPoints = phase === 'sending' ? pointsAtSend : points;
  const shortfall = reward.points - shownPoints;
  const insufficient = shortfall > 0 && phase !== 'sending';

  const submit = async () => {
    if (insufficient || phase === 'sending') return;
    setPointsAtSend(points);
    setPhase('sending');
    setError(null);
    const result = await onConfirm(reward.id);
    if (!result.ok) {
      setError(result.message);
      setPhase('error');
    }
  };

  const label = insufficient
    ? `Need ${ptsLabel(shortfall)} more`
    : phase === 'sending'
      ? 'Adding…'
      : phase === 'error'
        ? 'Try again'
        : `Add to Wallet · ${formatPoints(reward.points)} pts`;

  return (
    <BottomSheet visible={visible} onClose={onClose} dismissable={phase !== 'sending'}>
      <View style={styles.head}>
        <Image source={{ uri: reward.imageUrl }} style={styles.image} />
        <Text style={styles.title}>Add {reward.title} to your Wallet</Text>
        {reward.description ? <Text style={styles.description}>{reward.description}</Text> : null}
      </View>

      <View style={styles.rows}>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Cost</Text>
          <Text style={styles.rowValue}>{formatPoints(reward.points)} pts</Text>
        </View>
        <View style={[styles.row, styles.rowDivider]}>
          <Text style={styles.rowLabel}>Your points</Text>
          {shortfall > 0 ? (
            <Text style={[styles.rowValue, { color: colors.coral }]}>
              {formatPoints(shownPoints)} · need {formatPoints(shortfall)} more
            </Text>
          ) : (
            <Text style={styles.rowValue}>
              {formatPoints(shownPoints)} → {formatPoints(shownPoints - reward.points)}
            </Text>
          )}
        </View>
      </View>

      {phase === 'error' && error ? <Text style={styles.error}>{error}</Text> : null}

      <GoldButton
        label={label}
        onPress={() => void submit()}
        disabled={insufficient || phase === 'sending'}
        testID="confirm-claim"
      />
      <Text style={styles.footnote}>
        Points are spent when you add it and can’t be swapped back. The pass shows its expiry date.
      </Text>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  head: {
    alignItems: 'center',
  },
  image: {
    width: 72,
    height: 72,
    borderRadius: 14,
    backgroundColor: colors.panel,
  },
  title: {
    marginTop: 14,
    color: colors.text,
    fontFamily: font.semibold,
    fontSize: 20,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  description: {
    marginTop: 4,
    color: colors.textMuted,
    fontFamily: font.regular,
    fontSize: 13,
    textAlign: 'center',
  },
  rows: {
    marginTop: 20,
    marginBottom: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  row: {
    minHeight: 48,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rowLabel: {
    color: colors.textMuted,
    fontFamily: font.regular,
    fontSize: 14,
  },
  rowValue: {
    flexShrink: 1,
    color: colors.text,
    fontFamily: font.medium,
    fontSize: 14,
    fontVariant: ['tabular-nums'],
  },
  error: {
    marginBottom: 12,
    color: colors.danger,
    fontFamily: font.medium,
    fontSize: 13,
    textAlign: 'center',
  },
  footnote: {
    marginTop: 12,
    color: colors.textSubtle,
    fontFamily: font.regular,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
  },
});
