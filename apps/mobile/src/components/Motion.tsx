import type { PropsWithChildren, ReactNode } from 'react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

const useNativeMotion = Platform.OS !== 'web';

interface AnimatedScreenProps extends PropsWithChildren {
  animationKey: string;
  variant?: 'tab' | 'push';
  direction?: 'left' | 'right' | null;
}

export function AnimatedScreen({ animationKey, children, direction, variant = 'push' }: AnimatedScreenProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(variant === 'push' ? 18 : 0)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(variant === 'tab' ? 0.97 : 0.985)).current;

  const prevTranslateX = useRef(new Animated.Value(0)).current;
  const [exitingContent, setExitingContent] = useState<ReactNode>(null);
  const runningAnim = useRef<Animated.CompositeAnimation | null>(null);

  // Capture previous children during render (before key change propagates to effect).
  // Only update when key is stable so we hold the old value when key changes.
  const prevKeyForRender = useRef(animationKey);
  const prevChildrenRef = useRef<ReactNode>(children);
  if (prevKeyForRender.current !== animationKey) {
    prevKeyForRender.current = animationKey;
  } else {
    prevChildrenRef.current = children;
  }

  const prevKeyRef = useRef('');

  // Phase 1: set initial positions BEFORE paint (prevents flash on web where useEffect fires after paint)
  useLayoutEffect(() => {
    const firstRun = prevKeyRef.current === '';
    const keyChanged = !firstRun && prevKeyRef.current !== animationKey;

    if (!firstRun && !keyChanged) return;

    runningAnim.current?.stop();

    const screenWidth = Dimensions.get('window').width;

    if (firstRun) {
      opacity.setValue(0);
      scale.setValue(variant === 'tab' ? 0.97 : 0.985);
      translateX.setValue(0);
      if (variant === 'push') translateY.setValue(18);
    } else if (variant === 'tab' && direction) {
      // New screen starts off-screen; mount exiting content synchronously before paint
      translateX.setValue(direction === 'right' ? screenWidth : -screenWidth);
      prevTranslateX.setValue(0);
      opacity.setValue(1);
      scale.setValue(1);
      setExitingContent(prevChildrenRef.current);
    } else {
      setExitingContent(null);
      opacity.setValue(0);
      scale.setValue(variant === 'push' ? 0.985 : 0.97);
      translateX.setValue(0);
      if (variant === 'push') translateY.setValue(18);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animationKey, direction, variant]);

  // Phase 2: start animations after DOM is ready
  useEffect(() => {
    const firstRun = prevKeyRef.current === '';
    const keyChanged = !firstRun && prevKeyRef.current !== animationKey;

    if (!firstRun && !keyChanged) return;

    const screenWidth = Dimensions.get('window').width;

    if (firstRun) {
      const anims: Animated.CompositeAnimation[] = [
        Animated.timing(opacity, { toValue: 1, duration: variant === 'tab' ? 210 : 320, easing: Easing.out(Easing.cubic), useNativeDriver: useNativeMotion }),
        Animated.timing(scale, { toValue: 1, duration: variant === 'tab' ? 280 : 380, easing: Easing.out(Easing.cubic), useNativeDriver: useNativeMotion }),
      ];
      if (variant === 'push') {
        anims.push(Animated.timing(translateY, { toValue: 0, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: useNativeMotion }));
      }
      runningAnim.current = Animated.parallel(anims);
      runningAnim.current.start();
    } else if (variant === 'tab' && direction) {
      runningAnim.current = Animated.parallel([
        Animated.timing(translateX, { toValue: 0, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: useNativeMotion }),
        Animated.timing(prevTranslateX, {
          toValue: direction === 'right' ? -screenWidth : screenWidth,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: useNativeMotion,
        }),
      ]);
      runningAnim.current.start(({ finished }) => { if (finished) setExitingContent(null); });
    } else if (variant === 'push') {
      runningAnim.current = Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: useNativeMotion }),
        Animated.timing(scale, { toValue: 1, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: useNativeMotion }),
        Animated.timing(translateY, { toValue: 0, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: useNativeMotion }),
      ]);
      runningAnim.current.start();
    } else {
      runningAnim.current = Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 210, easing: Easing.out(Easing.cubic), useNativeDriver: useNativeMotion }),
        Animated.timing(scale, { toValue: 1, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: useNativeMotion }),
      ]);
      runningAnim.current.start();
    }

    prevKeyRef.current = animationKey;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animationKey, direction, variant]);

  // Carousel: both screens visible and sliding simultaneously
  if (exitingContent) {
    return (
      <View style={[styles.screen, styles.carouselClip]}>
        <Animated.View
          style={[StyleSheet.absoluteFill, { transform: [{ translateX: prevTranslateX }], pointerEvents: 'none' }]}
        >
          {exitingContent}
        </Animated.View>
        <Animated.View style={[styles.screen, { transform: [{ translateX }] }]}>
          {children}
        </Animated.View>
      </View>
    );
  }

  const transform: object[] =
    variant === 'push' ? [{ translateY }, { scale }] :
    direction ? [{ translateX }, { scale }] :
    [{ scale }];

  return (
    <Animated.View style={[styles.screen, { opacity, transform }]}>
      {children}
    </Animated.View>
  );
}

interface PressableScaleProps extends PropsWithChildren {
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  pressedScale?: number;
  accessibilityLabel?: string;
  accessibilityRole?: 'button';
  testID?: string;
}

export function PressableScale({
  accessibilityLabel,
  accessibilityRole = 'button',
  children,
  disabled,
  onPress,
  pressedScale = 0.965,
  style,
  testID,
}: PressableScaleProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = (value: number) => {
    Animated.timing(scale, {
      toValue: value,
      duration: 140,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: useNativeMotion,
    }).start();
  };

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => animateTo(pressedScale)}
      onPressOut={() => animateTo(1)}
      style={style}
      testID={testID}
    >
      <Animated.View style={{ transform: [{ scale }], opacity: disabled ? 0.45 : 1 }}>{children}</Animated.View>
    </Pressable>
  );
}

interface AmbientPulseProps {
  children: ReactNode;
  intensity?: number;
  style?: StyleProp<ViewStyle>;
}

export function AmbientPulse({ children, intensity = 1, style }: AmbientPulseProps) {
  const value = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(value, {
          toValue: 1,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: useNativeMotion,
        }),
        Animated.timing(value, {
          toValue: 0,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: useNativeMotion,
        }),
      ]),
    );

    animation.start();
    return () => animation.stop();
  }, [value]);

  const translateY = value.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -4 * intensity],
  });
  const scale = value.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1 + 0.015 * intensity],
  });

  return <Animated.View style={[style, { transform: [{ translateY }, { scale }] }]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  carouselClip: {
    overflow: 'hidden',
  },
});
