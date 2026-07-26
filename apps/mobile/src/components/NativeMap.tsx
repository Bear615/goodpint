import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import WebView from 'react-native-webview';
import { MAP_HTML } from './mapHtml';
import type { OsmPub } from '../types';

export interface NativeMapRef {
  recenter: (lat: number, lon: number) => void;
}

interface Props {
  userCoords: { lat: number; lon: number } | null;
  pubs: OsmPub[];
  onPubPress: (pub: OsmPub) => void;
  onMapReady?: () => void;
  style?: StyleProp<ViewStyle>;
}

type Command =
  | { type: 'setLocation'; lat: number; lon: number }
  | { type: 'recenter'; lat: number; lon: number }
  | { type: 'setPubs'; pubs: OsmPub[] };

export const NativeMap = forwardRef<NativeMapRef, Props>(function NativeMap(
  { userCoords, pubs, onPubPress, onMapReady, style },
  ref,
) {
  const webViewRef = useRef<WebView>(null);
  const readyRef = useRef(false);

  // Always-current refs so the ready handshake sees the latest values regardless
  // of when it fires.
  const userCoordsRef = useRef(userCoords);
  const pubsRef = useRef(pubs);
  userCoordsRef.current = userCoords;
  pubsRef.current = pubs;

  /**
   * Sends data, not code. The previous version built a JavaScript string and
   * handed it to injectJavaScript; keeping the bridge to structured messages
   * means nothing that flows through here can ever be parsed as script.
   */
  const send = useCallback((command: Command) => {
    webViewRef.current?.postMessage(JSON.stringify(command));
  }, []);

  useImperativeHandle(ref, () => ({
    recenter: (lat, lon) => send({ type: 'recenter', lat, lon }),
  }));

  useEffect(() => {
    if (!readyRef.current || !userCoords) return;
    send({ type: 'setLocation', lat: userCoords.lat, lon: userCoords.lon });
  }, [userCoords, send]);

  useEffect(() => {
    if (!readyRef.current || !pubs.length) return;
    send({ type: 'setPubs', pubs });
  }, [pubs, send]);

  return (
    <WebView
      ref={webViewRef}
      source={{ html: MAP_HTML }}
      style={style}
      javaScriptEnabled
      scrollEnabled={false}
      // The map is a fixed local document; it has no reason to read the file
      // system, open windows, or navigate anywhere.
      originWhitelist={['about:blank']}
      allowFileAccess={false}
      allowFileAccessFromFileURLs={false}
      allowUniversalAccessFromFileURLs={false}
      javaScriptCanOpenWindowsAutomatically={false}
      setSupportMultipleWindows={false}
      allowsInlineMediaPlayback={false}
      thirdPartyCookiesEnabled={false}
      cacheEnabled
      // Only the tile server and the pinned Leaflet bundle may be loaded; a link
      // that tries to navigate the WebView elsewhere is refused.
      onShouldStartLoadWithRequest={(request) => {
        const { url } = request;
        return (
          url === 'about:blank' ||
          url.startsWith('data:') ||
          url.startsWith('https://unpkg.com/') ||
          url.includes('.basemaps.cartocdn.com/')
        );
      }}
      onMessage={(event) => {
        let payload: unknown;
        try {
          payload = JSON.parse(event.nativeEvent.data) as unknown;
        } catch {
          return;
        }
        if (typeof payload !== 'object' || payload === null) return;

        if ((payload as { type?: string }).type === 'ready') {
          readyRef.current = true;
          if (userCoordsRef.current) {
            send({ type: 'setLocation', lat: userCoordsRef.current.lat, lon: userCoordsRef.current.lon });
          }
          if (pubsRef.current.length) send({ type: 'setPubs', pubs: pubsRef.current });
          onMapReady?.();
          return;
        }

        onPubPress(payload as OsmPub);
      }}
    />
  );
});
