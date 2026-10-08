import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** The OS "reduce motion" setting (prefers-reduced-motion on web). */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (mounted) setReduced(value);
      })
      .catch(() => undefined);
    // react-native-web returns nothing when the media query is unavailable.
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced) as
      | { remove: () => void }
      | undefined;
    return () => {
      mounted = false;
      subscription?.remove();
    };
  }, []);

  return reduced;
}
