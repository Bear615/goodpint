import type { ComponentType } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Beer, MapPinned, Route, UserRound, WalletMinimal } from 'lucide-react-native';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, font } from '../theme';
import type { TabKey } from '../types';

type IconComponent = ComponentType<{ color?: string; size?: number; strokeWidth?: number }>;

const tabs: Array<{ id: TabKey; label: string; Icon: IconComponent }> = [
  { id: 'explore', label: 'Explore', Icon: MapPinned },
  { id: 'points', label: 'Points', Icon: Beer },
  { id: 'plan', label: 'Plan', Icon: Route },
  { id: 'wallet', label: 'Wallet', Icon: WalletMinimal },
  { id: 'profile', label: 'You', Icon: UserRound },
];

export const NAV_HEIGHT = 64;
export const NAV_RADIUS = NAV_HEIGHT / 2;
// Gap between the pill and the screen edges, and how much scroll content must
// leave free at the bottom so the last card can clear the floating bar.
export const NAV_INSET = 14;
export const NAV_CLEARANCE = NAV_HEIGHT + NAV_INSET * 2;

// The bubble is a smaller glass pill that slides behind whichever tab is
// active, the way iOS tab bars lift the selected item.
const BUBBLE_INSET = 5;

export interface NavTabsProps {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
}

export function NavTabs({ activeTab, onTabChange }: NavTabsProps) {
  const [tabWidth, setTabWidth] = useState(0);
  const activeIndex = Math.max(tabs.findIndex((tab) => tab.id === activeTab), 0);
  const position = useRef(new Animated.Value(activeIndex)).current;

  useEffect(() => {
    Animated.spring(position, {
      toValue: activeIndex,
      speed: 16,
      bounciness: 7,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [activeIndex, position]);

  const bubbleX = Animated.multiply(position, tabWidth);

  return (
    <View
      accessibilityRole="tablist"
      style={styles.row}
      onLayout={(event) => setTabWidth(event.nativeEvent.layout.width / tabs.length)}
    >
      {tabWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.bubble,
            { left: BUBBLE_INSET, width: tabWidth - BUBBLE_INSET * 2, transform: [{ translateX: bubbleX }] },
          ]}
        />
      ) : null}

      {tabs.map(({ id, label, Icon }) => {
        const active = id === activeTab;
        const tint = active ? colors.gold : colors.textMuted;

        return (
          <Pressable
            key={id}
            accessibilityLabel={label}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onTabChange(id)}
            style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
            testID={`tab-${id}`}
          >
            <Icon color={tint} size={20} strokeWidth={active ? 2.1 : 1.7} />
            <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    height: NAV_HEIGHT,
    width: '100%',
  },
  bubble: {
    position: 'absolute',
    top: BUBBLE_INSET,
    bottom: BUBBLE_INSET,
    borderRadius: NAV_RADIUS - BUBBLE_INSET,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.55,
    transform: [{ scale: 0.94 }],
  },
  label: {
    marginTop: 3,
    fontFamily: font.medium,
    fontSize: 10.5,
    letterSpacing: -0.1,
    color: colors.textMuted,
  },
  labelActive: {
    fontFamily: font.semibold,
    color: colors.text,
  },
});
