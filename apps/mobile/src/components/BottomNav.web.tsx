import LiquidGlass from 'liquid-glass-react';
import { CalendarDays, Search, Star, UserRound, WalletCards } from 'lucide-react-native';
import type { ComponentType } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { colors, font, radii } from '../theme';
import type { TabKey } from '../types';

// Web-only variant of the bottom bar. liquid-glass-react renders DOM elements and
// SVG filters, so it cannot run on native; Metro picks BottomNav.tsx there instead.

type IconComponent = ComponentType<{ color?: string; size?: number; strokeWidth?: number }>;

const tabs: Array<{ id: TabKey; label: string; Icon: IconComponent }> = [
  { id: 'explore', label: 'Explore', Icon: Search },
  { id: 'points', label: 'Points', Icon: Star },
  { id: 'plan', label: 'Plan', Icon: CalendarDays },
  { id: 'wallet', label: 'Wallet', Icon: WalletCards },
  { id: 'profile', label: 'Profile', Icon: UserRound },
];

const BAR_HEIGHT = 76;

interface BottomNavProps {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
}

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  const tabAnims = useRef(tabs.map((t) => new Animated.Value(t.id === activeTab ? 1 : 0))).current;
  const [barWidth, setBarWidth] = useState(0);

  useEffect(() => {
    tabs.forEach((tab, i) => {
      Animated.timing(tabAnims[i], {
        toValue: tab.id === activeTab ? 1 : 0,
        duration: 230,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    });
  }, [activeTab, tabAnims]);

  const onLayout = (event: LayoutChangeEvent) => {
    setBarWidth(Math.round(event.nativeEvent.layout.width));
  };

  return (
    <View style={styles.wrap} onLayout={onLayout}>
      {/* LiquidGlass measures itself once on mount, so wait for the bar's width
          and remount when it changes to keep the refraction map in sync. */}
      {barWidth > 0 ? (
        <LiquidGlass
          key={barWidth}
          cornerRadius={radii.xl}
          padding="0px"
          displacementScale={48}
          blurAmount={0.08}
          saturation={150}
          aberrationIntensity={1.5}
          elasticity={0.08}
          style={{ position: 'absolute', top: '50%', left: '50%' }}
        >
          <View style={[styles.row, { width: barWidth }]}>
            {tabs.map(({ id, label, Icon }, index) => {
              const anim = tabAnims[index];

              const activeOpacity = anim;
              const inactiveOpacity = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });

              const iconScale = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] });
              const pillOpacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
              const pillScale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] });
              const topLineWidth = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 20] });
              const labelColor = anim.interpolate({
                inputRange: [0, 1],
                outputRange: [colors.textMuted, colors.gold],
              });

              return (
                <Pressable
                  key={id}
                  accessibilityLabel={label}
                  accessibilityRole="button"
                  onPress={() => onTabChange(id)}
                  style={styles.item}
                  testID={`tab-${id}`}
                >
                  <Animated.View style={[styles.topLine, { width: topLineWidth, opacity: anim }]} />

                  <View style={styles.iconWrap}>
                    <Animated.View
                      style={[
                        styles.iconPill,
                        { opacity: pillOpacity, transform: [{ scale: pillScale }] },
                      ]}
                    />
                    <Animated.View
                      style={[StyleSheet.absoluteFill, styles.iconCenter, { opacity: inactiveOpacity }]}
                    >
                      <Icon color={colors.textMuted} size={22} strokeWidth={1.8} />
                    </Animated.View>
                    <Animated.View
                      style={[
                        StyleSheet.absoluteFill,
                        styles.iconCenter,
                        { opacity: activeOpacity, transform: [{ scale: iconScale }] },
                      ]}
                    >
                      <Icon color={colors.gold} size={22} strokeWidth={2.3} />
                    </Animated.View>
                  </View>

                  <Animated.Text style={[styles.label, { color: labelColor }]} numberOfLines={1}>
                    {label}
                  </Animated.Text>
                </Pressable>
              );
            })}
          </View>
        </LiquidGlass>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 12,
    height: BAR_HEIGHT,
  },
  row: {
    height: BAR_HEIGHT,
    paddingHorizontal: 6,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    borderRadius: radii.xl,
    backgroundColor: 'rgba(8,9,10,0.35)',
  },
  item: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 2,
  },
  topLine: {
    position: 'absolute',
    top: 0,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.gold,
  },
  iconWrap: {
    width: 44,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  iconPill: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: radii.md,
    backgroundColor: colors.goldSoft,
  },
  iconCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    marginTop: 3,
    fontFamily: font.regular,
    fontSize: 11,
    textAlign: 'center',
  },
});
