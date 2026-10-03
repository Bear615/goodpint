// Pub green and brass. The base is a bottle-green near-black rather than a
// neutral one, text is a warm off-white, and `brand` is the solid green used
// for headers and the membership card, the way a real pub's livery would be.
export const colors = {
  background: '#08100D',
  backgroundWarm: '#0B1511',
  panel: '#0F1A16',
  panelRaised: '#15241E',
  panelSoft: 'rgba(240,230,205,0.045)',
  panelGlass: '#0F1A16',
  border: 'rgba(240,230,205,0.08)',
  borderStrong: 'rgba(244,200,74,0.46)',
  brand: '#1E5A43',
  brandBright: '#2F7A5B',
  brandDeep: '#123827',
  brandSoft: 'rgba(62,138,104,0.16)',
  cream: '#F3EBDD',
  gold: '#F4C84A',
  goldBright: '#FFE082',
  goldDark: '#8E610D',
  goldSoft: 'rgba(244,200,74,0.12)',
  teal: '#8A9A92',
  tealSoft: 'rgba(138,154,146,0.12)',
  coral: '#C07A65',
  coralSoft: 'rgba(192,122,101,0.12)',
  text: '#F6F2EA',
  textMuted: '#A7B0AA',
  textSubtle: '#6F7C75',
  danger: '#FF6B6B',
  success: '#6EE7A7',
  mapBlue: '#4D8DFF',
  mapGreen: '#111716',
};

export const radii = {
  xs: 6,
  sm: 12,
  md: 14,
  lg: 18,
  xl: 24,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

// Inter, loaded once in App.tsx. Each weight is its own family so Android
// never has to synthesise a bold, and nothing should set fontWeight on top.
export const font = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
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
