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

// The marker is a short bar that sits on the top rule and slides to whichever
// tab is active. It is the only moving part, so it is the only gold on the bar.
const MARKER_WIDTH = 18;

interface BottomNavProps {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
}

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  const [tabWidth, setTabWidth] = useState(0);
  const activeIndex = Math.max(tabs.findIndex((tab) => tab.id === activeTab), 0);
  const position = useRef(new Animated.Value(activeIndex)).current;

  useEffect(() => {
    Animated.spring(position, {
      toValue: activeIndex,
      speed: 18,
      bounciness: 4,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [activeIndex, position]);

  const markerX = Animated.multiply(position, tabWidth);

  return (
    <View
      accessibilityRole="tablist"
      style={styles.bar}
      onLayout={(event) => setTabWidth(event.nativeEvent.layout.width / tabs.length)}
    >
      {tabWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.marker,
            { left: (tabWidth - MARKER_WIDTH) / 2, transform: [{ translateX: markerX }] },
          ]}
        />
      ) : null}

      {tabs.map(({ id, label, Icon }) => {
        const active = id === activeTab;
        const tint = active ? colors.text : colors.textSubtle;

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
            <Icon color={tint} size={21} strokeWidth={active ? 2 : 1.6} />
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
  bar: {
    flexDirection: 'row',
    height: 62,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.14)',
    backgroundColor: '#0A0B0C',
  },
  marker: {
    position: 'absolute',
    top: -1,
    width: MARKER_WIDTH,
    height: 2,
    backgroundColor: colors.gold,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 2,
  },
  pressed: {
    opacity: 0.55,
  },
  label: {
    marginTop: 5,
    fontFamily: font.regular,
    fontSize: 10.5,
    letterSpacing: 0.2,
    color: colors.textSubtle,
  },
  labelActive: {
    fontFamily: font.medium,
    color: colors.text,
  },
});
