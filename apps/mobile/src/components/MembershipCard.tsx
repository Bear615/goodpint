import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Beer, Check, Copy, QrCode, X } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { colors, font, radii } from '../theme';
import { PressableScale } from './Motion';
import { QRCodeGrid } from './QRCodeGrid';

// A short, readable ID derived from the account's UUID, e.g. GP-3F9A1-C07B2.
// Stable for the account, and short enough to read out at the bar.
export function membershipId(userId: string) {
  const hex = userId.replace(/[^0-9a-f]/gi, '').toUpperCase().padEnd(10, '0');
  return `GP-${hex.slice(0, 5)}-${hex.slice(5, 10)}`;
}

// The pill that opens the card. Gold with dark text, like the app's other
// primary actions, so it stands out on the header.
export function MembershipPill({ onPress }: { onPress: () => void }) {
  return (
    <PressableScale accessibilityLabel="Show my membership card" onPress={onPress} pressedScale={0.95}>
      <View style={styles.pill}>
        <Text style={styles.pillText}>My membership ID</Text>
        <QrCode color="#141006" size={16} strokeWidth={2.2} />
      </View>
    </PressableScale>
  );
}

interface MembershipCardProps {
  visible: boolean;
  onClose: () => void;
}

export function MembershipCard({ visible, onClose }: MembershipCardProps) {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const id = user ? membershipId(user.id) : 'GP-00000-00000';
  const payload = JSON.stringify({ type: 'goodpint.member', id });
  const canCopy = Platform.OS === 'web' && typeof navigator !== 'undefined' && !!navigator.clipboard;

  const copy = () => {
    if (!canCopy) return;
    void navigator.clipboard.writeText(id).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <View style={styles.sheet}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Scan before paying at the bar</Text>
          <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close" style={styles.close}>
            <X color={colors.text} size={18} strokeWidth={2.2} />
          </Pressable>
        </View>

        <LinearGradient colors={[colors.brandBright, colors.brand, colors.brandDeep]} style={styles.card}>
          <Text style={styles.label}>My membership ID</Text>
          <Pressable onPress={copy} disabled={!canCopy} style={styles.idRow} accessibilityLabel={`Membership ID ${id}`}>
            <Text selectable style={styles.id}>{id}</Text>
            {canCopy ? (
              copied ? <Check color={colors.cream} size={16} strokeWidth={2.4} /> : <Copy color={colors.cream} size={16} strokeWidth={2} />
            ) : null}
          </Pressable>
          <View style={styles.rule} />
          <QRCodeGrid value={payload} size={208} plain />
          <View style={styles.crest}>
            <Beer color={colors.cream} size={18} strokeWidth={2} />
            <Text style={styles.crestText}>GOODPINT</Text>
          </View>
          {user?.name ? <Text style={styles.member}>{user.name}</Text> : null}
        </LinearGradient>

        <Text style={styles.hint}>Show this when you order and your points land on your account. Never miss a reward.</Text>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  pill: {
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 17,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: colors.gold,
  },
  pillText: {
    color: '#141006',
    fontFamily: font.semibold,
    fontSize: 13,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignSelf: 'center',
    width: '100%',
    maxWidth: 460,
    paddingHorizontal: 22,
    paddingBottom: 36,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: colors.panel,
  },
  header: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: colors.text,
    fontFamily: font.semibold,
    fontSize: 16,
  },
  close: {
    position: 'absolute',
    right: 0,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.panelSoft,
  },
  card: {
    marginTop: 8,
    alignSelf: 'center',
    width: '100%',
    maxWidth: 320,
    paddingTop: 18,
    paddingBottom: 20,
    borderRadius: radii.xl,
    alignItems: 'center',
    overflow: 'hidden',
  },
  label: {
    color: colors.cream,
    opacity: 0.8,
    fontFamily: font.medium,
    fontSize: 13,
  },
  idRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  id: {
    color: colors.cream,
    fontFamily: font.semibold,
    fontSize: 17,
    letterSpacing: 0.6,
  },
  rule: {
    alignSelf: 'stretch',
    height: 1,
    marginTop: 16,
    marginBottom: 20,
    backgroundColor: 'rgba(243,235,221,0.22)',
  },
  crest: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  crestText: {
    color: colors.cream,
    fontFamily: font.bold,
    fontSize: 13,
    letterSpacing: 3,
  },
  member: {
    marginTop: 4,
    color: colors.cream,
    opacity: 0.7,
    fontFamily: font.regular,
    fontSize: 12,
  },
  hint: {
    marginTop: 18,
    color: colors.textMuted,
    fontFamily: font.regular,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
});
