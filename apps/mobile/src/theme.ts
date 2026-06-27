import { Platform } from 'react-native';

export const colors = {
  background: '#050607',
  backgroundWarm: '#090A0B',
  panel: '#0F1012',
  panelRaised: '#161719',
  panelSoft: 'rgba(255,255,255,0.045)',
  panelGlass: 'rgba(15,16,18,0.82)',
  border: 'rgba(255,255,255,0.105)',
  borderStrong: 'rgba(244,200,74,0.46)',
  gold: '#F4C84A',
  goldBright: '#FFE082',
  goldDark: '#8E610D',
  goldSoft: 'rgba(244,200,74,0.12)',
  teal: '#8A95A3',
  tealSoft: 'rgba(138,149,163,0.12)',
  coral: '#C07A65',
  coralSoft: 'rgba(192,122,101,0.12)',
  text: '#FFFFFF',
  textMuted: '#A9AAAD',
  textSubtle: '#74767A',
  danger: '#FF6B6B',
  success: '#6EE7A7',
  mapBlue: '#4D8DFF',
  mapGreen: '#111716',
};

export const radii = {
  xs: 5,
  sm: 8,
  md: 10,
  lg: 14,
  xl: 20,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const font = {
  regular: Platform.select({ android: 'sans-serif', ios: 'System', default: 'Arial' }),
  medium: Platform.select({ android: 'sans-serif-medium', ios: 'System', default: 'Arial' }),
  bold: Platform.select({ android: 'sans-serif-condensed', ios: 'System', default: 'Arial' }),
};

export const shadow = {
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 12 },
  shadowOpacity: 0.24,
  shadowRadius: 18,
  elevation: 4,
};

export const goldGlow = {
  shadowColor: colors.gold,
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0.2,
  shadowRadius: 10,
  elevation: 3,
};

export const tealGlow = {
  shadowColor: colors.teal,
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0.14,
  shadowRadius: 8,
  elevation: 2,
};

export function formatCurrency(value: number) {
  return `£${value.toFixed(2)}`;
}

export function formatPoints(value: number) {
  return new Intl.NumberFormat('en-GB').format(value);
}
