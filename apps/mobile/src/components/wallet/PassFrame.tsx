import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors, font, radii } from '../../theme';
import { COLLAPSED_HEIGHT, PEEK } from './passMetrics';

interface PassFrameProps {
  open: boolean;
  accessibilityLabel: string;
  onToggle: () => void;
  background: ReactNode;
  // Contents of the header strip, which stays visible when the pass is stacked.
  strip: ReactNode;
  closedBody: ReactNode;
  openBody: ReactNode;
  style: { marginTop: number };
  borderColor?: string;
}

/**
 * The shell every pass shares.
 *
 * The strip is the pass's one button, in the same place whether the pass is
 * open or closed, so focus survives a toggle and the expanded state is read
 * out. Controls in an open body sit beside the strip rather than inside it: on
 * web a role="button" renders a real <button>, and buttons cannot nest. A
 * closed body is still tappable, as a plain touch target hidden from
 * assistive tech.
 */
export function PassFrame({
  accessibilityLabel,
  background,
  borderColor,
  closedBody,
  onToggle,
  open,
  openBody,
  strip,
  style,
}: PassFrameProps) {
  return (
    <View style={[styles.card, borderColor ? { borderColor } : null, !open && styles.closed, style]}>
      {background}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ expanded: open }}
        onPress={onToggle}
        style={passStyles.strip}
      >
        {strip}
      </Pressable>
      {open ? (
        openBody
      ) : (
        <Pressable
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          aria-hidden
          tabIndex={-1}
          onPress={onToggle}
          style={styles.closedTarget}
        >
          {closedBody}
        </Pressable>
      )}
    </View>
  );
}

/** A ticket's tear line. The notches would peek past the next card's corners when covered. */
export function Perforation({ covered }: { covered: boolean }) {
  return (
    <View style={styles.perforation}>
      {covered ? null : <View style={[styles.notch, styles.notchLeft]} />}
      <View style={styles.dashes} />
      {covered ? null : <View style={[styles.notch, styles.notchRight]} />}
    </View>
  );
}

export const PERFORATION_HEIGHT = 14;

export const passStyles = StyleSheet.create({
  strip: {
    height: PEEK,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  ring: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    backgroundColor: 'rgba(0,0,0,0.22)',
  },
  copy: {
    flex: 1,
  },
  title: {
    color: colors.text,
    fontFamily: font.semibold,
    fontSize: 15,
    letterSpacing: -0.2,
  },
  detail: {
    marginTop: 2,
    color: colors.textMuted,
    fontFamily: font.regular,
    fontSize: 12,
  },
  pill: {
    height: 26,
    paddingHorizontal: 10,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillText: {
    fontFamily: font.semibold,
    fontSize: 11,
    letterSpacing: 0.4,
  },
  eyebrow: {
    color: 'rgba(255,255,255,0.55)',
    fontFamily: font.medium,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
});

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
  // A closed pass is a fixed height so the stack's overlap maths is exact.
  closed: {
    height: COLLAPSED_HEIGHT,
  },
  closedTarget: {
    flex: 1,
  },
  perforation: {
    height: PERFORATION_HEIGHT,
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
});
