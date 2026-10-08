import { useEffect, useRef, useState } from 'react';

interface CountUpOptions {
  // Where the first roll starts; defaults to the target (no roll on mount).
  from?: number;
  // Wait before the first roll. A tab slide mounts the incoming screen more
  // than once, so only the mount that survives this long actually animates.
  delayMs?: number;
  duration?: number;
  // Reduced motion: always show the target.
  disabled?: boolean;
}

/**
 * Eases a displayed number towards its target. An interrupted roll carries on
 * from whatever figure is currently on screen.
 */
export function useCountUp(target: number, { delayMs = 0, disabled = false, duration = 750, from }: CountUpOptions = {}) {
  const initial = disabled ? target : (from ?? target);
  const [display, setDisplay] = useState(initial);
  const current = useRef(initial);
  const hasRun = useRef(false);

  useEffect(() => {
    const firstRun = !hasRun.current;
    hasRun.current = true;

    if (disabled) {
      current.current = target;
      setDisplay(target);
      return;
    }

    const start = current.current;
    if (start === target) return;

    let frame = 0;
    let began = 0;
    const tick = () => {
      if (!began) began = Date.now();
      const progress = Math.min((Date.now() - began) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      current.current = start + (target - start) * eased;
      setDisplay(current.current);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    const timer = setTimeout(() => {
      frame = requestAnimationFrame(tick);
    }, firstRun ? delayMs : 0);

    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
  }, [target, duration, delayMs, disabled]);

  return display;
}
