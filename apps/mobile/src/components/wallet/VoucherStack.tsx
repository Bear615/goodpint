import * as Haptics from 'expo-haptics';
import { useMemo, useState } from 'react';
import { LayoutAnimation, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronDown, ChevronUp, Clock3, Gift, QrCode, Star, Ticket } from 'lucide-react-native';
import { colors, font, radii } from '../../theme';
import type { Pass, Voucher } from '../../types';
import { expiryLabel } from '../../utils/wallet';
import { GoldButton } from '../GoldButton';
import { QRCodeGrid } from '../QRCodeGrid';
import { SectionCard } from '../SectionCard';

// How much of each card's header shows above the next one in the stack.
const PEEK = 66;
const COLLAPSED_HEIGHT = 146;

interface StackEntry {
  id: string;
  kind: 'voucher' | 'pass';
  title: string;
  detail: string;
  code: string | null;
  live: boolean;
  status: string;
  expiresAt: string | null;
  redeemedAt: string | null;
  createdAt: string | null;
}

function fromVoucher(voucher: Voucher, now: Date): StackEntry {
  // The server only flips a voucher to expired when someone touches it, so an
  // "active" voucher past its expiry is treated as expired here.
  const lapsed = voucher.expiresAt !== null && new Date(voucher.expiresAt).getTime() <= now.getTime();
  const live = voucher.status === 'active' && !lapsed;
  return {
    id: voucher.id,
    kind: 'voucher',
    title: voucher.title,
    detail: `${voucher.pointsSpent.toLocaleString('en-GB')} pts reward`,
    code: voucher.code,
    live,
    status: live ? 'Ready' : voucher.status === 'redeemed' ? 'Redeemed' : 'Expired',
    expiresAt: voucher.expiresAt,
    redeemedAt: voucher.redeemedAt,
    createdAt: voucher.createdAt,
  };
}

function fromPass(pass: Pass): StackEntry {
  return {
    id: pass.id,
    kind: 'pass',
    title: pass.title,
    detail: pass.subtitle,
    code: null,
    live: pass.status !== 'Used',
    status: pass.status,
    expiresAt: null,
    redeemedAt: null,
    createdAt: null,
  };
}

function byExpiry(a: StackEntry, b: StackEntry) {
  if (a.expiresAt === b.expiresAt) return 0;
  if (a.expiresAt === null) return 1;
  if (b.expiresAt === null) return -1;
  return a.expiresAt.localeCompare(b.expiresAt);
}

function shortDate(iso: string | null) {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

interface VoucherStackProps {
  vouchers: Voucher[];
  passes: Pass[];
  onBrowseRewards: () => void;
}

export function VoucherStack({ onBrowseRewards, passes, vouchers }: VoucherStackProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showPast, setShowPast] = useState(false);

  const { live, past } = useMemo(() => {
    const now = new Date();
    const entries = [...passes.map(fromPass), ...vouchers.map((voucher) => fromVoucher(voucher, now))];
    return {
      live: entries.filter((entry) => entry.live).sort(byExpiry),
      past: entries
        .filter((entry) => !entry.live)
        .sort((a, b) => (b.redeemedAt ?? b.createdAt ?? '').localeCompare(a.redeemedAt ?? a.createdAt ?? '')),
    };
  }, [passes, vouchers]);

  const animate = () => LayoutAnimation.configureNext(LayoutAnimation.create(260, 'easeInEaseOut', 'opacity'));

  const toggle = (id: string) => {
    animate();
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedId((current) => (current === id ? null : id));
  };

  if (live.length === 0 && past.length === 0) {
    return (
      <SectionCard>
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Ticket color={colors.gold} size={26} strokeWidth={1.8} />
          </View>
          <Text style={styles.emptyTitle}>No vouchers yet</Text>
          <Text style={styles.emptyText}>Swap points for free pints and they’ll live here, ready to scan at the bar.</Text>
          <GoldButton label="Browse rewards" compact onPress={onBrowseRewards} style={styles.emptyButton} />
        </View>
      </SectionCard>
    );
  }

  const shown = showPast ? [...live, ...past] : live;

  return (
    <View>
      {shown.length > 0 ? (
        <View>
          {shown.map((entry, index) => {
            const previousExpanded = index > 0 && shown[index - 1].id === expandedId;
            const marginTop = index === 0 ? 0 : previousExpanded ? 12 : PEEK - COLLAPSED_HEIGHT;
            const expanded = entry.id === expandedId;
            return (
              <PassCard
                key={entry.id}
                entry={entry}
                expanded={expanded}
                covered={!expanded && index < shown.length - 1}
                onPress={() => toggle(entry.id)}
                style={{ marginTop }}
              />
            );
          })}
        </View>
      ) : (
        <SectionCard>
          <View style={styles.allUsed}>
            <Text style={styles.emptyText}>Everything’s been poured. Redeem more points for your next round.</Text>
          </View>
        </SectionCard>
      )}

      {past.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            animate();
            setShowPast((value) => !value);
          }}
          style={styles.pastToggle}
        >
          <Text style={styles.pastToggleText}>
            {showPast ? 'Hide past vouchers' : `Show ${past.length} past voucher${past.length === 1 ? '' : 's'}`}
          </Text>
          {showPast ? <ChevronUp color={colors.textMuted} size={16} /> : <ChevronDown color={colors.textMuted} size={16} />}
        </Pressable>
      ) : null}
    </View>
  );
}

interface PassCardProps {
  entry: StackEntry;
  expanded: boolean;
  // Tucked under the next card, so only its header shows.
  covered: boolean;
  onPress: () => void;
  style: { marginTop: number };
}

function PassCard({ covered, entry, expanded, onPress, style }: PassCardProps) {
  const timing = entry.live ? expiryLabel(entry.expiresAt) : null;
  const Icon = entry.kind === 'pass' ? (entry.live ? Star : Gift) : Ticket;
  const gradient: [string, string] = !entry.live
    ? ['#1C1C1F', '#121214']
    : entry.kind === 'pass'
      ? ['#1E2733', '#11161D']
      : ['#3B2D0C', '#1A1509'];
  const accent = entry.live ? colors.gold : colors.textSubtle;
  const payload = entry.code ? JSON.stringify({ type: 'goodpint.voucher', code: entry.code }) : null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${entry.title}, ${entry.status}`}
      accessibilityState={{ expanded }}
      onPress={onPress}
      style={[styles.card, !entry.live && styles.cardPast, style]}
    >
      <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      {entry.live ? <View pointerEvents="none" style={styles.cardGlow} /> : null}

      <View style={styles.header}>
        <View style={[styles.icon, { borderColor: entry.live ? 'rgba(244,200,74,0.35)' : colors.border }]}>
          <Icon color={accent} size={19} strokeWidth={2} fill={entry.kind === 'pass' && entry.live ? colors.gold : 'transparent'} />
        </View>
        <View style={styles.headerCopy}>
          <Text style={[styles.title, !entry.live && styles.titlePast]} numberOfLines={1}>{entry.title}</Text>
          <Text style={styles.detail} numberOfLines={1}>{entry.detail}</Text>
        </View>
        <View style={[styles.status, entry.live ? styles.statusLive : styles.statusPast]}>
          <Text style={[styles.statusText, { color: entry.live ? colors.gold : colors.textMuted }]}>{entry.status}</Text>
        </View>
      </View>

      {/* The notches would peek out past the next card's rounded corners. */}
      <View style={styles.perforation}>
        {covered ? null : <View style={[styles.notch, styles.notchLeft]} />}
        <View style={styles.dashes} />
        {covered ? null : <View style={[styles.notch, styles.notchRight]} />}
      </View>

      {expanded && entry.live && payload ? (
        <View style={styles.expanded}>
          <QRCodeGrid value={payload} size={200} />
          <Text style={styles.bigCode}>{entry.code}</Text>
          <Text style={styles.instruction}>Show this at the bar — staff scan it or type the code</Text>
          {timing ? (
            <View style={styles.timingRow}>
              <Clock3 color={timing.urgent ? colors.coral : colors.textMuted} size={14} />
              <Text style={[styles.timingText, timing.urgent && { color: colors.coral }]}>{timing.label}</Text>
            </View>
          ) : null}
        </View>
      ) : (
        <View style={styles.footer}>
          {/* Two rows, so a long code never collides with the hint on narrow phones. */}
          <View style={styles.footerRow}>
            <Text style={styles.footerLabel}>{entry.code ? 'Code' : 'Status'}</Text>
            {entry.live ? (
              timing ? (
                <Text style={[styles.footerHintText, timing.urgent && { color: colors.coral }]}>{timing.label}</Text>
              ) : null
            ) : (
              <Text style={styles.footerHintText}>
                {entry.status === 'Redeemed' && shortDate(entry.redeemedAt)
                  ? `Redeemed ${shortDate(entry.redeemedAt)}`
                  : entry.status}
              </Text>
            )}
          </View>
          <View style={styles.footerRow}>
            <Text style={[styles.footerValue, !entry.live && styles.titlePast]} numberOfLines={1}>
              {entry.code ?? entry.status}
            </Text>
            {entry.live && payload ? <QrCode color={colors.gold} size={22} /> : null}
          </View>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: COLLAPSED_HEIGHT,
    borderRadius: radii.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(244,200,74,0.22)',
    backgroundColor: '#15120A',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 6,
  },
  cardPast: {
    borderColor: colors.border,
    backgroundColor: '#141416',
  },
  cardGlow: {
    position: 'absolute',
    top: -120,
    right: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(244,200,74,0.07)',
  },
  header: {
    height: PEEK,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  icon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    backgroundColor: 'rgba(0,0,0,0.22)',
  },
  headerCopy: {
    flex: 1,
  },
  title: {
    color: colors.text,
    fontFamily: font.semibold,
    fontSize: 15,
    letterSpacing: -0.2,
  },
  titlePast: {
    color: colors.textMuted,
  },
  detail: {
    marginTop: 2,
    color: colors.textMuted,
    fontFamily: font.regular,
    fontSize: 12,
  },
  status: {
    height: 26,
    paddingHorizontal: 10,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusLive: {
    backgroundColor: 'rgba(244,200,74,0.14)',
  },
  statusPast: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  statusText: {
    fontFamily: font.semibold,
    fontSize: 11,
    letterSpacing: 0.3,
  },
  perforation: {
    height: 14,
    justifyContent: 'center',
  },
  dashes: {
    marginHorizontal: 18,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.14)',
  },
  notch: {
    position: 'absolute',
    top: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.background,
  },
  notchLeft: {
    left: -7,
  },
  notchRight: {
    right: -7,
  },
  footer: {
    height: COLLAPSED_HEIGHT - PEEK - 14,
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
  footerLabel: {
    color: colors.textSubtle,
    fontFamily: font.medium,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  footerValue: {
    flexShrink: 1,
    color: colors.text,
    fontFamily: font.semibold,
    fontSize: 15,
    letterSpacing: 1.4,
  },
  footerHintText: {
    color: colors.textMuted,
    fontFamily: font.medium,
    fontSize: 12,
  },
  expanded: {
    paddingTop: 18,
    paddingBottom: 22,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  bigCode: {
    marginTop: 18,
    color: colors.gold,
    fontFamily: font.bold,
    fontSize: 26,
    letterSpacing: 4,
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
  pastToggle: {
    marginTop: 12,
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  pastToggleText: {
    color: colors.textMuted,
    fontFamily: font.medium,
    fontSize: 13,
  },
  empty: {
    paddingVertical: 26,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.goldSoft,
  },
  emptyTitle: {
    marginTop: 14,
    color: colors.text,
    fontFamily: font.semibold,
    fontSize: 16,
  },
  emptyText: {
    marginTop: 6,
    color: colors.textMuted,
    fontFamily: font.regular,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  emptyButton: {
    marginTop: 16,
  },
  allUsed: {
    paddingVertical: 18,
    paddingHorizontal: 20,
  },
});
