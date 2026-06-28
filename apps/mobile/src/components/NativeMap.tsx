import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
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

export const NativeMap = forwardRef<NativeMapRef, Props>(function NativeMap(
  { userCoords, pubs, onPubPress, onMapReady, style },
  ref,
) {
  const webViewRef = useRef<WebView>(null);
  const readyRef = useRef(false);

  // Always-current refs so handleLoad sees latest values regardless of when it fires
  const userCoordsRef = useRef(userCoords);
  const pubsRef = useRef(pubs);
  userCoordsRef.current = userCoords;
  pubsRef.current = pubs;

  function inject(code: string) {
    webViewRef.current?.injectJavaScript(code + '; true;');
  }

  useImperativeHandle(ref, () => ({
    recenter: (lat, lon) => inject(`recenter(${lat},${lon})`),
  }));

  const handleLoad = () => {
    readyRef.current = true;
    if (userCoordsRef.current) inject(`setLocation(${userCoordsRef.current.lat},${userCoordsRef.current.lon})`);
    if (pubsRef.current.length) inject(`setPubs(${JSON.stringify(pubsRef.current)})`);
    onMapReady?.();
  };

  // Push prop updates after map is ready; handleLoad covers pre-ready values
  useEffect(() => {
    if (!readyRef.current || !userCoords) return;
    inject(`setLocation(${userCoords.lat},${userCoords.lon})`);
  }, [userCoords]);

  useEffect(() => {
    if (!readyRef.current || !pubs.length) return;
    inject(`setPubs(${JSON.stringify(pubs)})`);
  }, [pubs]);

  return (
    <WebView
      ref={webViewRef}
      source={{ html: MAP_HTML }}
      style={style}
      javaScriptEnabled
      scrollEnabled={false}
      onLoadEnd={handleLoad}
      onMessage={(e) => {
        try {
          onPubPress(JSON.parse(e.nativeEvent.data) as OsmPub);
        } catch {
          // ignore
        }
      }}
    />
  );
});
