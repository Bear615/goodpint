import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { colors, font, radii } from '../theme';
import { PressableScale } from './Motion';

interface GoldButtonProps {
  label: string;
  onPress: () => void;
  iconRight?: ReactNode;
  style?: ViewStyle;
  compact?: boolean;
  testID?: string;
}

export function GoldButton({ label, onPress, iconRight, style, compact, testID }: GoldButtonProps) {
  return (
    <PressableScale onPress={onPress} style={style} pressedScale={0.975} testID={testID}>
      <View style={[styles.fill, !compact && styles.full, compact && styles.compact]}>
        <Text style={[styles.label, compact && styles.compactLabel]} numberOfLines={1}>
          {label}
        </Text>
        {iconRight}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  fill: {
    minHeight: 58,
    paddingHorizontal: 20,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    overflow: 'hidden',
    backgroundColor: colors.gold,
  },
  compact: {
    minHeight: 36,
    paddingHorizontal: 12,
  },
  full: {
    alignSelf: 'stretch',
  },
  label: {
    color: '#080808',
    fontFamily: font.semibold,
    fontSize: 16,
    letterSpacing: -0.2,
  },
  compactLabel: {
    fontSize: 12,
    letterSpacing: 0.2,
  },
});
