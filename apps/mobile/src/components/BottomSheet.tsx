import type { PropsWithChildren } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, PanResponder, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';

const useNativeMotion = Platform.OS !== 'web';
const OFFSCREEN = 720;

interface BottomSheetProps extends PropsWithChildren {
  visible: boolean;
  onClose: () => void;
  // Blocks dismissal while something irreversible is in flight.
  dismissable?: boolean;
}

/**
 * A modal sheet that springs up from the bottom and can be dragged away by its
 * grabber. The parent owns `visible`; the sheet keeps itself mounted long
 * enough to animate out before unmounting.
 */
export function BottomSheet({ children, dismissable = true, onClose, visible }: BottomSheetProps) {
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);
  const translateY = useRef(new Animated.Value(OFFSCREEN)).current;
  const backdrop = useRef(new Animated.Value(0)).current;
  const dismissableRef = useRef(dismissable);
  const onCloseRef = useRef(onClose);

  useEffect(() => { dismissableRef.current = dismissable; }, [dismissable]);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      translateY.setValue(OFFSCREEN);
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, tension: 70, friction: 12, useNativeDriver: useNativeMotion }),
        Animated.timing(backdrop, { toValue: 1, duration: 220, useNativeDriver: useNativeMotion }),
      ]).start();
      return;
    }

    Animated.parallel([
      Animated.timing(translateY, {
        toValue: OFFSCREEN,
        duration: 240,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: useNativeMotion,
      }),
      Animated.timing(backdrop, { toValue: 0, duration: 240, useNativeDriver: useNativeMotion }),
    ]).start(({ finished }) => {
      if (finished) setMounted(false);
    });
  }, [visible, translateY, backdrop]);

  const requestClose = () => {
    if (dismissableRef.current) onCloseRef.current();
  };

  const dragToDismiss = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, { dy }) => Math.abs(dy) > 4,
      onPanResponderMove: (_, { dy }) => {
        // Resist upward pulls; follow the finger downwards.
        translateY.setValue(dy > 0 ? dy : dy / 6);
      },
      onPanResponderRelease: (_, { dy, vy }) => {
        if (dismissableRef.current && (dy > 110 || vy > 0.9)) {
          onCloseRef.current();
          return;
        }
        Animated.spring(translateY, { toValue: 0, tension: 90, friction: 11, useNativeDriver: useNativeMotion }).start();
      },
    }),
  ).current;

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={requestClose}>
      <View style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: backdrop }]}>
          <Pressable accessibilityLabel="Close" style={StyleSheet.absoluteFill} onPress={requestClose} />
        </Animated.View>
        <Animated.View
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8, transform: [{ translateY }] }]}
        >
          <View style={styles.grabberZone} {...dragToDismiss.panHandlers}>
            <View style={styles.grabber} />
          </View>
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  backdrop: {
    backgroundColor: 'rgba(0,0,0,0.62)',
  },
  sheet: {
    width: '100%',
    maxWidth: 460,
    paddingHorizontal: 22,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(255,255,255,0.09)',
    backgroundColor: colors.panelRaised,
  },
  grabberZone: {
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grabber: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
});
