import type { PropsWithChildren, ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PanResponder, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { colors } from '../theme';

interface ScreenFrameProps extends PropsWithChildren {
  bottomNav: ReactNode;
  scrollKey?: string;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
}

export function ScreenFrame({ children, bottomNav, scrollKey, onSwipeLeft, onSwipeRight }: ScreenFrameProps) {
  const scrollRef = useRef<ScrollView>(null);
  const onSwipeLeftRef = useRef(onSwipeLeft);
  const onSwipeRightRef = useRef(onSwipeRight);

  useEffect(() => { onSwipeLeftRef.current = onSwipeLeft; }, [onSwipeLeft]);
  useEffect(() => { onSwipeRightRef.current = onSwipeRight; }, [onSwipeRight]);

  const swipePan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, { dx, dy }) =>
        Math.abs(dx) > Math.abs(dy) * 2 && Math.abs(dx) > 10,
      onMoveShouldSetPanResponderCapture: (_, { dx, dy }) =>
        Math.abs(dx) > Math.abs(dy) * 2.5 && Math.abs(dx) > 15,
      onPanResponderRelease: (_, { dx, vx }) => {
        if (dx < -50 || vx < -0.4) onSwipeLeftRef.current?.();
        else if (dx > 50 || vx > 0.4) onSwipeRightRef.current?.();
      },
    }),
  ).current;

  const resetScroll = () => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });

    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      Array.from(document.querySelectorAll('*')).forEach((element) => {
        const scrollable = element as HTMLElement;

        if (scrollable.scrollTop > 0) {
          scrollable.scrollTop = 0;
        }
      });
    }
  };

  useEffect(() => {
    resetScroll();
    const immediateReset = setTimeout(resetScroll, 0);
    const layoutReset = setTimeout(resetScroll, 120);

    return () => {
      clearTimeout(immediateReset);
      clearTimeout(layoutReset);
    };
    // resetScroll intentionally reads the current platform DOM state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollKey]);

  return (
    <LinearGradient colors={[colors.background, colors.backgroundWarm, colors.background]} style={styles.root}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.phoneFrame}>
          <View style={styles.contentArea} {...swipePan.panHandlers}>
            <ScrollView
              key={scrollKey}
              ref={scrollRef}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
            >
              {children}
            </ScrollView>
          </View>
          {bottomNav}
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  safeArea: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    paddingTop: Platform.OS === 'android' ? 12 : 0,
  },
  phoneFrame: {
    flex: 1,
    width: '100%',
    maxWidth: 460,
    overflow: 'hidden',
    borderLeftWidth: Platform.OS === 'web' ? 1 : 0,
    borderRightWidth: Platform.OS === 'web' ? 1 : 0,
    borderColor: 'rgba(255,255,255,0.045)',
    backgroundColor: colors.background,
  },
  contentArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 22,
    paddingTop: 14,
    paddingBottom: 112,
  },
});
