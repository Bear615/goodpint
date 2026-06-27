import type { PropsWithChildren, ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import { Animated, Dimensions, Easing, Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

const useNativeMotion = Platform.OS !== 'web';

interface AnimatedScreenProps extends PropsWithChildren {
  animationKey: string;
  variant?: 'tab' | 'push';
  direction?: 'left' | 'right' | null;
}

export function AnimatedScreen({ animationKey, children, direction, variant = 'push' }: AnimatedScreenProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(18)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(variant === 'tab' ? 0.97 : 0.985)).current;

  useEffect(() => {
    if (Platform.OS === 'web') {
      return undefined;
    }

    const screenWidth = Dimensions.get('window').width;

    opacity.setValue(0);
    scale.setValue(variant === 'tab' ? 0.97 : 0.985);

    if (variant === 'push') {
      translateY.setValue(18);
      translateX.setValue(0);
    } else if (direction) {
      translateX.setValue(direction === 'right' ? screenWidth : -screenWidth);
    } else {
      translateX.setValue(0);
    }

    const animations: Animated.CompositeAnimation[] = [
      Animated.timing(opacity, {
        toValue: 1,
        duration: variant === 'tab' ? 210 : 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: useNativeMotion,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: variant === 'tab' ? 280 : 380,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: useNativeMotion,
      }),
    ];

    if (variant === 'push') {
      animations.push(
        Animated.timing(translateY, {
          toValue: 0,
          duration: 380,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: useNativeMotion,
        }),
      );
    } else if (direction) {
      animations.push(
        Animated.timing(translateX, {
          toValue: 0,
          duration: 280,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: useNativeMotion,
        }),
      );
    }

    Animated.parallel(animations).start();
  }, [animationKey, direction, opacity, scale, translateX, translateY, variant]);

  if (Platform.OS === 'web') {
    return <View style={styles.screen}>{children}</View>;
  }

  let transform: object[];
  if (variant === 'push') {
    transform = [{ translateY }, { scale }];
  } else if (direction) {
    transform = [{ translateX }, { scale }];
  } else {
    transform = [{ scale }];
  }

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
});
