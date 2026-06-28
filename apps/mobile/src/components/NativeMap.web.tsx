import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import type { NativeMapRef } from './NativeMap';
import type { OsmPub } from '../types';
import { MAP_HTML } from './mapHtml';

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
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const readyRef = useRef(false);

  function inject(code: string) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (iframeRef.current?.contentWindow as any)?.eval?.(code);
    } catch {
      // sandboxed iframe — ignore
    }
  }

  useImperativeHandle(ref, () => ({
    recenter: (lat, lon) => inject(`recenter(${lat},${lon});`),
  }));

  useEffect(() => {
    if (!readyRef.current || !userCoords) return;
    inject(`setLocation(${userCoords.lat},${userCoords.lon});`);
  }, [userCoords]);

  useEffect(() => {
    if (!readyRef.current || !pubs.length) return;
    inject(`setPubs(${JSON.stringify(pubs)});`);
  }, [pubs]);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.source !== iframeRef.current?.contentWindow) return;
      try {
        onPubPress(JSON.parse(e.data) as OsmPub);
      } catch {
        // ignore
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onPubPress]);

  return (
    <View style={style}>
      <iframe
        ref={iframeRef}
        srcDoc={MAP_HTML}
        sandbox="allow-scripts allow-same-origin"
        style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
        onLoad={() => {
          readyRef.current = true;
          if (userCoords) inject(`setLocation(${userCoords.lat},${userCoords.lon});`);
          if (pubs.length) inject(`setPubs(${JSON.stringify(pubs)});`);
          onMapReady?.();
        }}
      />
    </View>
  );
});
