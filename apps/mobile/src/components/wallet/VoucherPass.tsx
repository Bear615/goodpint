import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Check, Clock3, Info, QrCode, Ticket } from 'lucide-react-native';
import { colors, font } from '../../theme';
import type { Voucher } from '../../types';
import { clockTime } from '../../utils/rewards';
import { expiryLabel } from '../../utils/wallet';
import { GoldButton } from '../GoldButton';
import { QRCodeGrid } from '../QRCodeGrid';
import { PassFrame, passStyles, Perforation, PERFORATION_HEIGHT } from './PassFrame';
import { COLLAPSED_HEIGHT, PEEK } from './passMetrics';
import type { PassLayout } from './PassStack';

interface VoucherPassProps extends PassLayout {
  voucher: Voucher;
  // Just added to the wallet.
  isFresh: boolean;
  // Just scanned at the bar: the pass celebrates instead of showing its QR.
  isCelebrating: boolean;
  onToggle: () => void;
  onShowDetails: (voucher: Voucher) => void;
  onDismissRedeemed: () => void;
}

/** What staff scan: the same payload the till's /api/staff/redeem expects. */
export function voucherPayload(code: string) {
  return JSON.stringify({ type: 'goodpint.voucher', code });
}

export function VoucherPass({
  covered,
  isCelebrating,
  isFresh,
  onDismissRedeemed,
  onShowDetails,
  onToggle,
  open,
  style,
  voucher,
}: VoucherPassProps) {
  const timing = isCelebrating ? null : expiryLabel(voucher.expiresAt);
  const usedAt = voucher.redeemedAt ? clockTime(voucher.redeemedAt) : '';

  const detail = isCelebrating ? 'Used at the bar' : (timing?.label ?? 'Ready to scan');
  const pill = isCelebrating
    ? { label: 'Used', color: colors.success, background: 'rgba(110,231,167,0.12)' }
    : isFresh
      ? { label: 'New', color: colors.goldBright, background: 'rgba(244,200,74,0.14)' }
      : { label: 'Ready', color: colors.gold, background: 'rgba(244,200,74,0.14)' };

  const strip = (
    <>
      <View style={[passStyles.ring, { borderColor: 'rgba(244,200,74,0.35)' }]}>
        <Ticket color={colors.gold} size={19} strokeWidth={2} />
      </View>
      <View style={passStyles.copy}>
        <Text style={passStyles.title} numberOfLines={1}>{voucher.title}</Text>
        <Text
          style={[passStyles.detail, timing?.urgent && { color: colors.coral }, isCelebrating && { color: colors.success }]}
          numberOfLines={1}
        >
          {detail}
        </Text>
      </View>
      <View style={[passStyles.pill, { backgroundColor: pill.background }]}>
        <Text style={[passStyles.pillText, { color: pill.color }]}>{pill.label}</Text>
      </View>
    </>
  );

  const closedBody = (
    <>
      <Perforation covered={covered} />
      <View style={styles.footer}>
        {/* Two rows, so a long code never collides with the hint on narrow phones. */}
        <View style={styles.footerRow}>
          <Text style={passStyles.eyebrow}>Code</Text>
          {isCelebrating ? (
            <Text style={[styles.footerHint, { color: colors.success }]}>{usedAt ? `Used ${usedAt}` : 'Used'}</Text>
          ) : timing ? (
            <Text style={[styles.footerHint, timing.urgent && { color: colors.coral }]}>{timing.label}</Text>
          ) : null}
        </View>
        <View style={styles.footerRow}>
          <Text style={[styles.code, isCelebrating && { color: colors.textMuted }]} numberOfLines={1}>
            {voucher.code}
          </Text>
          {isCelebrating ? null : <QrCode color={colors.gold} size={22} />}
        </View>
      </View>
    </>
  );

  const openBody = isCelebrating ? (
    <>
      <Perforation covered={false} />
      <View style={styles.celebrate}>
        <View style={styles.successBadge}>
          <Check color="#06210F" size={36} strokeWidth={3} />
        </View>
        <Text style={styles.celebrateTitle}>Enjoy your {voucher.title}</Text>
        {usedAt ? <Text style={styles.celebrateText}>Redeemed at {usedAt}</Text> : null}
        <GoldButton label="Done" compact onPress={onDismissRedeemed} style={styles.done} />
      </View>
    </>
  ) : (
    <>
      <Perforation covered={false} />
      <View style={styles.scan}>
        <QRCodeGrid value={voucherPayload(voucher.code)} size={200} />
        <Text style={styles.bigCode} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
          {voucher.code}
        </Text>
        <Text style={styles.instruction}>Show this at the bar — staff scan it or type the code</Text>
        {timing ? (
          <View style={styles.timingRow}>
            <Clock3 color={timing.urgent ? colors.coral : colors.textMuted} size={14} />
            <Text style={[styles.timingText, timing.urgent && { color: colors.coral }]}>{timing.label}</Text>
          </View>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${voucher.title} pass details`}
          onPress={() => onShowDetails(voucher)}
          style={styles.detailsLink}
        >
          <Info color={colors.textMuted} size={14} />
          <Text style={styles.detailsText}>Pass details</Text>
        </Pressable>
      </View>
    </>
  );

  return (
    <PassFrame
      open={open}
      accessibilityLabel={`${voucher.title} voucher, ${pill.label}, ${detail}`}
      onToggle={onToggle}
      background={
        <>
          <LinearGradient colors={['#3B2D0C', '#1A1509']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <View pointerEvents="none" style={styles.glow} />
        </>
      }
      strip={strip}
      closedBody={closedBody}
      openBody={openBody}
      style={style}
    />
  );
}

const styles = StyleSheet.create({
  glow: {
    position: 'absolute',
    top: -120,
    right: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(244,200,74,0.07)',
  },
  footer: {
    height: COLLAPSED_HEIGHT - PEEK - PERFORATION_HEIGHT,
    paddingHorizontal: 16,
    justifyContent: 'center',
    gap: 4,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  footerHint: {
    color: colors.textMuted,
    fontFamily: font.medium,
    fontSize: 12,
  },
  code: {
    flexShrink: 1,
    color: colors.text,
    fontFamily: font.semibold,
    fontSize: 15,
    letterSpacing: 1.4,
  },
  scan: {
    paddingTop: 18,
    paddingBottom: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  bigCode: {
    marginTop: 18,
    color: colors.gold,
    fontFamily: font.bold,
    fontSize: 22,
    letterSpacing: 2,
    textAlign: 'center',
  },
  instruction: {
    marginTop: 6,
    color: colors.textMuted,
    fontFamily: font.regular,
    fontSize: 12,
    textAlign: 'center',
  },
  timingRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timingText: {
    color: colors.textMuted,
    fontFamily: font.medium,
    fontSize: 12,
  },
  detailsLink: {
    marginTop: 4,
    minHeight: 44,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailsText: {
    color: colors.textMuted,
    fontFamily: font.medium,
    fontSize: 13,
  },
  celebrate: {
    paddingTop: 22,
    paddingBottom: 22,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  successBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.success,
  },
  celebrateTitle: {
    marginTop: 16,
    color: colors.text,
    fontFamily: font.semibold,
    fontSize: 20,
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  celebrateText: {
    marginTop: 4,
    color: colors.textMuted,
    fontFamily: font.regular,
    fontSize: 13,
  },
  done: {
    marginTop: 16,
  },
});
