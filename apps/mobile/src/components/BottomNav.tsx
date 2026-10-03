import { useContext } from 'react';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import { BlurTargetContext } from './BlurTarget';
import { NAV_HEIGHT, NAV_INSET, NAV_RADIUS, NavTabs, type NavTabsProps } from './NavTabs';

// A floating glass pill. The blur gives the frosted body, a faint white wash
// keeps it readable over the near-black app, and a top-lit gradient rim fakes
// the light catching the glass edge. The web build swaps in liquid-glass-react
// (BottomNav.web.tsx) for real refraction.
export function BottomNav(props: NavTabsProps) {
  const blurTarget = useContext(BlurTargetContext);

  return (
    <View pointerEvents="box-none" style={styles.dock}>
      <View style={styles.pill}>
        <BlurView
          blurTarget={blurTarget ?? undefined}
          blurMethod="dimezisBlurViewSdk31Plus"
          intensity={45}
          tint="systemUltraThinMaterialDark"
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(255,255,255,0.14)', 'rgba(255,255,255,0.04)', 'rgba(255,255,255,0.08)']}
          locations={[0, 0.55, 1]}
          style={StyleSheet.absoluteFill}
        />
        <NavTabs {...props} />
        <View pointerEvents="none" style={styles.rim} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dock: {
    position: 'absolute',
    left: NAV_INSET,
    right: NAV_INSET,
    bottom: NAV_INSET,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 12,
    borderRadius: NAV_RADIUS,
  },
  pill: {
    height: NAV_HEIGHT,
    borderRadius: NAV_RADIUS,
    overflow: 'hidden',
    backgroundColor: 'rgba(22,23,26,0.45)',
  },
  rim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: NAV_RADIUS,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    borderTopColor: 'rgba(255,255,255,0.32)',
  },
});
