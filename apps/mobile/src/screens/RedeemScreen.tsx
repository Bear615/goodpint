import { StyleSheet, Text, View } from 'react-native';
import { ArrowLeft, Clock3, ShieldCheck } from 'lucide-react-native';
import { colors, font, formatPoints, radii } from '../theme';
import type { Reward } from '../types';
import { PressableScale } from '../components/Motion';
import { QRCodeGrid } from '../components/QRCodeGrid';
import { SectionCard } from '../components/SectionCard';

interface RedeemScreenProps {
  points: number;
  reward?: Reward;
  secondsRemaining: number;
  onBack: () => void;
}

export function RedeemScreen({ points, reward, secondsRemaining, onBack }: RedeemScreenProps) {
  const minutes = Math.floor(secondsRemaining / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (secondsRemaining % 60).toString().padStart(2, '0');
  const payload = JSON.stringify({
    type: 'goodpint.reward',
    rewardId: reward?.id ?? 'free-drink',
    points,
    issuedAt: new Date().toISOString().slice(0, 10),
  });

  return (
    <View>
      <View style={styles.header}>
        <PressableScale accessibilityLabel="Back" onPress={onBack} style={styles.backButton}>
          <ArrowLeft color={colors.text} size={24} />
        </PressableScale>
        <Text style={styles.title}>Redeem</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.tabRow}>
        <View style={styles.activeTab}>
          <Text style={styles.activeTabText}>Scan</Text>
        </View>
        <View style={styles.tab}>
          <Text style={styles.tabText}>Code</Text>
        </View>
      </View>

      <Text style={styles.instruction}>Show this QR to redeem</Text>
      <Text style={styles.rewardName}>{reward?.title ?? 'Free Drink'}</Text>

      <View style={styles.qrWrap}>
        <QRCodeGrid value={payload} />
      </View>

      <View style={styles.pointsRow}>
        <Text style={styles.points}>{formatPoints(points)} pts</Text>
        <ShieldCheck color={colors.gold} size={23} fill={colors.gold} />
      </View>

      <View style={styles.expiryRow}>
        <Clock3 color={colors.textMuted} size={17} />
        <Text style={styles.expiry}>Expires in {minutes}:{seconds}</Text>
      </View>

      <SectionCard>
        <View style={styles.howCard}>
          <Text style={styles.howTitle}>How it works</Text>
          {['Show this QR code to the bartender', 'They scan it to redeem your reward', 'Enjoy'].map((copy, index) => (
            <View key={copy} style={styles.howRow}>
              <View style={styles.stepCircle}>
                <Text style={styles.stepText}>{index + 1}</Text>
              </View>
              <Text style={styles.howText}>{copy}</Text>
            </View>
          ))}
        </View>
      </SectionCard>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 62,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: colors.text,
    fontFamily: font.medium,
    fontSize: 18,
  },
  headerSpacer: {
    width: 42,
  },
  tabRow: {
    height: 52,
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  activeTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: colors.gold,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTabText: {
    color: colors.gold,
    fontFamily: font.medium,
    fontSize: 14,
  },
  tabText: {
    color: colors.textMuted,
    fontFamily: font.regular,
    fontSize: 14,
  },
  instruction: {
    marginTop: 38,
    color: colors.text,
    fontFamily: font.regular,
    fontSize: 16,
    textAlign: 'center',
  },
  rewardName: {
    marginTop: 8,
    color: colors.textMuted,
    fontFamily: font.regular,
    fontSize: 13,
    textAlign: 'center',
  },
  qrWrap: {
    marginTop: 28,
    alignItems: 'center',
  },
  pointsRow: {
    marginTop: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  points: {
    color: colors.gold,
    fontFamily: font.medium,
    fontSize: 23,
  },
  expiryRow: {
    marginTop: 14,
    marginBottom: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  expiry: {
    color: colors.textMuted,
    fontFamily: font.regular,
    fontSize: 15,
  },
  howCard: {
    padding: 16,
  },
  howTitle: {
    color: colors.text,
    fontFamily: font.medium,
    fontSize: 14,
    marginBottom: 14,
  },
  howRow: {
    minHeight: 31,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.gold,
  },
  stepText: {
    color: colors.gold,
    fontFamily: font.medium,
    fontSize: 10,
  },
  howText: {
    flex: 1,
    color: colors.textMuted,
    fontFamily: font.regular,
    fontSize: 13,
  },
});
