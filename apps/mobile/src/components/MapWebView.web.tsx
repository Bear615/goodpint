// Web implementation — plain iframe with Leaflet
// Metro picks this file over MapWebView.tsx when bundling for web
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import type { MapRef } from './MapWebView';

interface Props {
  html: string;
  style?: StyleProp<ViewStyle>;
  onMessage?: (e: { nativeEvent: { data: string } }) => void;
  onLoadEnd?: () => void;
}

export const MapWebView = forwardRef<MapRef, Props>(function MapWebView(
  { html, style, onMessage, onLoadEnd },
  ref,
) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useImperativeHandle(ref, () => ({
    injectJavaScript: (code) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (iframeRef.current?.contentWindow as any)?.eval?.(code);
      } catch {
        // sandboxed iframe — ignore
      }
    },
  }));

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.source !== iframeRef.current?.contentWindow) return;
      onMessage?.({ nativeEvent: { data: e.data } });
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onMessage]);

  return (
    <View style={style}>
      <iframe
        ref={iframeRef}
        srcDoc={html}
        // allow-same-origin needed so contentWindow.eval works
        sandbox="allow-scripts allow-same-origin"
        style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
        onLoad={onLoadEnd}
      />
    </View>
  );
});
