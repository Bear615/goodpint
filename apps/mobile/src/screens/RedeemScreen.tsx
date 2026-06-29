import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ArrowLeft, Clock3, ShieldCheck } from 'lucide-react-native';
import { colors, font, formatPoints, radii } from '../theme';
import type { Reward, Voucher } from '../types';
import { PressableScale } from '../components/Motion';
import { QRCodeGrid } from '../components/QRCodeGrid';
import { SectionCard } from '../components/SectionCard';

interface RedeemScreenProps {
  points: number;
  reward?: Reward;
  // The server-issued voucher for this redemption (preferred source of the code/QR).
  voucher?: Voucher | null;
  secondsRemaining: number;
  onBack: () => void;
}

function stableCode(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (Math.imul(31, h) + id.charCodeAt(i)) >>> 0;
  return String(h % 1_000_000).padStart(6, '0');
}

export function RedeemScreen({ points, reward, secondsRemaining, onBack }: RedeemScreenProps) {
  const [activeTab, setActiveTab] = useState<'scan' | 'code'>('scan');

  const minutes = Math.floor(secondsRemaining / 60).toString().padStart(2, '0');
  const seconds = (secondsRemaining % 60).toString().padStart(2, '0');
  const payload = JSON.stringify({
    type: 'goodpint.reward',
    rewardId: reward?.id ?? 'free-drink',
    points,
    issuedAt: new Date().toISOString().slice(0, 10),
  });
  const code = stableCode(reward?.id ?? 'free-drink');

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
        <PressableScale style={[styles.tab, activeTab === 'scan' && styles.activeTab]} onPress={() => setActiveTab('scan')}>
          <Text style={[styles.tabText, activeTab === 'scan' && styles.activeTabText]}>Scan</Text>
        </PressableScale>
        <PressableScale style={[styles.tab, activeTab === 'code' && styles.activeTab]} onPress={() => setActiveTab('code')}>
          <Text style={[styles.tabText, activeTab === 'code' && styles.activeTabText]}>Code</Text>
        </PressableScale>
      </View>

      <Text style={styles.instruction}>
        {activeTab === 'scan' ? 'Show this QR to redeem' : 'Read this code to the bartender'}
      </Text>
      <Text style={styles.rewardName}>{reward?.title ?? 'Free Drink'}</Text>

      {activeTab === 'scan' ? (
        <View style={styles.qrWrap}>
          <QRCodeGrid value={payload} />
        </View>
      ) : (
        <View style={styles.codeWrap}>
          <Text style={styles.code}>{code.slice(0, 3)} {code.slice(3)}</Text>
          <Text style={styles.codeHint}>Give this 6-digit code to your bartender</Text>
        </View>
      )}

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
          {(activeTab === 'scan'
            ? ['Show this QR code to the bartender', 'They scan it to redeem your reward', 'Enjoy']
            : ['Read the 6-digit code to the bartender', 'They enter it to redeem your reward', 'Enjoy']
          ).map((copy, index) => (
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
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: colors.gold,
  },
  tabText: {
    color: colors.textMuted,
    fontFamily: font.regular,
    fontSize: 14,
  },
  activeTabText: {
    color: colors.gold,
    fontFamily: font.medium,
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
  codeWrap: {
    marginTop: 28,
    alignItems: 'center',
    paddingVertical: 32,
  },
  code: {
    color: colors.gold,
    fontFamily: font.bold,
    fontSize: 48,
    letterSpacing: 6,
  },
  codeHint: {
    marginTop: 14,
    color: colors.textMuted,
    fontFamily: font.regular,
    fontSize: 13,
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
