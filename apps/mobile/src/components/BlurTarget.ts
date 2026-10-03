import type { RefObject } from 'react';
import { createContext } from 'react';
import type { View } from 'react-native';

// Android's blur can only sample a view it has been pointed at, so ScreenFrame
// wraps the scrolling content in a BlurTargetView and shares its ref here for
// the floating nav to blur.
export const BlurTargetContext = createContext<RefObject<View | null> | null>(null);
