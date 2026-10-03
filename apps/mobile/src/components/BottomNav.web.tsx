import { useEffect, useRef, useState } from 'react';
import LiquidGlass from 'liquid-glass-react';
import { StyleSheet, View } from 'react-native';
import { NAV_HEIGHT, NAV_INSET, NAV_RADIUS, NavTabs, type NavTabsProps } from './NavTabs';

// On the web we can do real refraction: liquid-glass-react bends whatever is
// scrolling underneath through an SVG displacement filter (Chromium; Safari
// and Firefox fall back to plain blur). It positions every layer at
// top/left 50% with a -50% translate, so it sits centred in a sized dock.
//
// The dock is a plain div on purpose. react-native-web gives every View
// `z-index: 0`, which makes it a stacking context; the library's
// mix-blend-mode rim layers then isolate that context, and the glass blur can
// no longer see the page behind it.
//
// The refraction samples slightly outside the pill, so on its own it leaves a
// band at the rim where the page shows through unblurred. A plain frosted
// underlay fills that band; elasticity stays off so the two never drift apart.
const UNDERLAY_BLUR = 10;

export function BottomNav(props: NavTabsProps) {
  const dockRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const dock = dockRef.current;
    if (!dock) return;

    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(dock);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={dockRef}
      style={{
        position: 'absolute',
        left: NAV_INSET,
        right: NAV_INSET,
        bottom: NAV_INSET,
        height: NAV_HEIGHT,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: NAV_RADIUS,
          backdropFilter: `blur(${UNDERLAY_BLUR}px) saturate(150%)`,
          WebkitBackdropFilter: `blur(${UNDERLAY_BLUR}px) saturate(150%)`,
        }}
      />
      {width > 0 ? (
        // The library only measures itself on mount and window resize, so
        // remount when the dock width changes.
        <LiquidGlass
          key={width}
          cornerRadius={NAV_RADIUS}
          padding="0"
          displacementScale={48}
          blurAmount={0.2}
          saturation={150}
          aberrationIntensity={1.5}
          elasticity={0}
          mode="standard"
          style={{ position: 'absolute', top: '50%', left: '50%', pointerEvents: 'auto' }}
        >
          <View style={[styles.surface, { width }]}>
            <NavTabs {...props} />
          </View>
        </LiquidGlass>
      ) : null}
    </div>
  );
}

const styles = StyleSheet.create({
  surface: {
    height: NAV_HEIGHT,
    borderRadius: NAV_RADIUS,
    // Just enough of a wash for the glass to read against the near-black app.
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
});
