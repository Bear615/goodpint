import { LayoutAnimation } from 'react-native';

// How much of each pass's header shows above the next one in the stack.
export const PEEK = 66;
// A closed pass is a fixed height so the overlap maths is exact.
export const COLLAPSED_HEIGHT = 146;
// Space after an open pass, which the next card no longer overlaps.
export const OPEN_GAP = 12;

/** The shared open/close animation for the pass stack (a no-op on web). */
export function passAnimation() {
  LayoutAnimation.configureNext(LayoutAnimation.create(260, 'easeInEaseOut', 'opacity'));
}
