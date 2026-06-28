// Native fallback — Expo Go compatible (no react-native-webview)
// Web bundler uses MapWebView.web.tsx instead (real Leaflet OSM map)
// For real native map: create a development build with react-native-webview
import { forwardRef, useImperativeHandle } from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, font } from '../theme';

export interface MapRef {
  injectJavaScript: (code: string) => void;
}

interface Props {
  html: string;
  style?: StyleProp<ViewStyle>;
  onMessage?: (e: { nativeEvent: { data: string } }) => void;
  onLoadEnd?: () => void;
}

export const MapWebView = forwardRef<MapRef, Props>(function MapWebView(
  { style },
  ref,
) {
  useImperativeHandle(ref, () => ({
    injectJavaScript: () => {},
  }));

  return (
    <View style={[styles.wrap, style]}>
      <Text style={styles.msg}>
        Map available on web.{'\n'}Open in a browser for the full experience.
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0A0C0E',
  },
  msg: {
    color: colors.textMuted,
    fontFamily: font.regular,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
});
