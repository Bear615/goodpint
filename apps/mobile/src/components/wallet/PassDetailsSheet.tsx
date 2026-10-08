import { StyleSheet, Text, View } from 'react-native';
import { CircleCheck, Clock3, Ticket } from 'lucide-react-native';
import { colors, font, formatPoints } from '../../theme';
import type { Voucher } from '../../types';
import { clockTime, longDate, voucherEvent } from '../../utils/rewards';
import { BottomSheet } from '../BottomSheet';
import { GoldButton } from '../GoldButton';
import { QRCodeGrid } from '../QRCodeGrid';
import { voucherPayload } from './VoucherPass';

interface PassDetailsSheetProps {
  voucher: Voucher | null;
  // The reward's catalogue description, when it is still in the catalogue.
  description?: string;
  visible: boolean;
  onClose: () => void;
}

const STATUS = {
  live: { label: 'Ready', color: colors.gold, background: colors.goldSoft, Icon: Ticket },
  redeemed: { label: 'Used', color: colors.success, background: 'rgba(110,231,167,0.12)', Icon: CircleCheck },
  expired: { label: 'Expired', color: colors.textMuted, background: colors.panelSoft, Icon: Clock3 },
} as const;

export function PassDetailsSheet({ description, onClose, visible, voucher }: PassDetailsSheetProps) {
  if (!voucher) return null;

  const event = voucherEvent(voucher);
  const status = STATUS[event.kind];
  const rows: Array<[string, string]> = [];
  if (event.kind !== 'live') rows.push(['Code', voucher.code]);
  rows.push(['Points used', `${formatPoints(voucher.pointsSpent)} pts`]);
  rows.push(['Added', longDate(voucher.createdAt)]);
  if (event.kind === 'live' && voucher.expiresAt) rows.push(['Valid until', longDate(voucher.expiresAt)]);
  if (event.kind === 'redeemed') rows.push(['Used', `${longDate(event.at)}, ${clockTime(event.at)}`]);
  if (event.kind === 'expired') rows.push(['Expired', longDate(event.at)]);

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={styles.head}>
        <View style={[styles.icon, { backgroundColor: status.background }]}>
          <status.Icon color={status.color} size={26} strokeWidth={2} />
        </View>
        <Text style={styles.title}>{voucher.title}</Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
        <View style={[styles.pill, { backgroundColor: status.background }]}>
          <Text style={[styles.pillText, { color: status.color }]}>{status.label}</Text>
        </View>
      </View>

      {event.kind === 'live' ? (
        <View style={styles.scan}>
          <QRCodeGrid value={voucherPayload(voucher.code)} size={160} />
          <Text style={styles.code}>{voucher.code}</Text>
        </View>
      ) : null}

      <View style={styles.rows}>
        {rows.map(([label, value], index) => (
          <View key={label} style={[styles.row, index > 0 && styles.rowDivider]}>
            <Text style={styles.rowLabel}>{label}</Text>
            <Text style={styles.rowValue} numberOfLines={1}>{value}</Text>
          </View>
        ))}
      </View>

      <GoldButton label="Done" onPress={onClose} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  head: {
    alignItems: 'center',
  },
  icon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    marginTop: 12,
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
  pill: {
    marginTop: 10,
    height: 26,
    paddingHorizontal: 10,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillText: {
    fontFamily: font.semibold,
    fontSize: 12,
  },
  scan: {
    marginTop: 20,
    alignItems: 'center',
  },
  code: {
    marginTop: 14,
    color: colors.gold,
    fontFamily: font.bold,
    fontSize: 22,
    letterSpacing: 3,
  },
  rows: {
    marginTop: 20,
    marginBottom: 18,
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
  },
});
