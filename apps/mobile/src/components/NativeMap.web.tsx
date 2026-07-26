import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import type { NativeMapRef } from './NativeMap';
import type { OsmPub } from '../types';
import { buildMapHtml } from './mapHtml';

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
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const readyRef = useRef(false);

  // The frame is told, once, which origin it may talk to.
  const parentOrigin = typeof window !== 'undefined' ? window.location.origin : null;
  const html = useMemo(() => buildMapHtml(parentOrigin), [parentOrigin]);

  /**
   * Sends a structured command to the map.
   *
   * This used to be `contentWindow.eval(...)` of a generated JavaScript string,
   * which required `allow-same-origin` on the sandbox — and `allow-scripts`
   * together with `allow-same-origin` lets the frame reach out and strip its own
   * sandbox attribute, so it was no sandbox at all. Passing data instead of code
   * removes the need for both.
   */
  const send = useCallback((command: Command) => {
    // The receiver is a window we created and hold a direct reference to, so
    // there is no other frame this could reach.
    iframeRef.current?.contentWindow?.postMessage(JSON.stringify(command), '*');
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

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      // Identity check by window reference. The frame runs sandboxed with an
      // opaque origin, so comparing origins would not distinguish it from any
      // other sandboxed frame on the page.
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (typeof event.data !== 'string') return;

      let payload: unknown;
      try {
        payload = JSON.parse(event.data);
      } catch {
        return;
      }
      if (typeof payload !== 'object' || payload === null) return;

      // The map announces itself once its script has run — more reliable than
      // the iframe's load event, which fires before Leaflet has initialised.
      if ((payload as { type?: string }).type === 'ready') {
        readyRef.current = true;
        if (userCoords) send({ type: 'setLocation', lat: userCoords.lat, lon: userCoords.lon });
        if (pubs.length) send({ type: 'setPubs', pubs });
        onMapReady?.();
        return;
      }

      onPubPress(payload as OsmPub);
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onPubPress, onMapReady, send, userCoords, pubs]);

  return (
    <View style={style}>
      <iframe
        ref={iframeRef}
        title="Nearby pubs map"
        srcDoc={html}
        // allow-scripts only. Notably absent: allow-same-origin (which would let
        // the frame remove this very attribute), allow-popups, allow-forms, and
        // allow-top-navigation.
        sandbox="allow-scripts"
        referrerPolicy="no-referrer"
        style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
      />
    </View>
  );
});
