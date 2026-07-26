// Leaflet is pinned by version *and* by content hash. Without subresource
// integrity, whoever controls (or can impersonate) the CDN controls the script
// running inside this frame; with it, a modified file simply fails to load.
const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_CSS_SRI = 'sha512-Zcn6bjR/8RZbLEpLIeOwNtzREBAJnUKESxces60Mpoj+2okopSAcSUIUOseddDm0cxnGQzxIR7vJgsLZbdLE3w==';
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
const LEAFLET_JS_SRI = 'sha512-BwHfrr4c9kmRkLw6iXFdzcdWV/PGkVgiIyIWLLlTSXzWQzxuSg4DiQUCpauz/EWjgk5TYQqX/kvn9pG1NpYfqg==';

/**
 * Builds the map document.
 *
 * The frame is driven entirely by structured messages — there is no string of
 * JavaScript being evaluated inside it, and no application data is interpolated
 * into the markup. That is what lets the web build run it with a real sandbox
 * (`allow-scripts` only, no `allow-same-origin`) instead of one that can undo
 * itself.
 *
 * @param parentOrigin Exact origin messages are sent to and accepted from. Pass
 *   null on native, where the WebView bridge is the transport and there is no
 *   browser origin to check against.
 */
export function buildMapHtml(parentOrigin: string | null): string {
  // Embedded as JSON so the value can only ever be a string literal.
  const originLiteral = JSON.stringify(parentOrigin);

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline' https://unpkg.com; script-src 'unsafe-inline' https://unpkg.com; img-src data: blob: https://*.basemaps.cartocdn.com; connect-src https://*.basemaps.cartocdn.com; base-uri 'none'; form-action 'none'">
<link rel="stylesheet" href="${LEAFLET_CSS}" integrity="${LEAFLET_CSS_SRI}" crossorigin="anonymous"/>
<script src="${LEAFLET_JS}" integrity="${LEAFLET_JS_SRI}" crossorigin="anonymous"></script>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body,#map{width:100%;height:100%;background:#050607}
  .leaflet-control-attribution{display:none}
  .pub-icon{
    width:34px;height:42px;
    background:linear-gradient(160deg,#FFE082,#F2A900);
    border-radius:50% 50% 50% 0;
    transform:rotate(-45deg);
    border:2px solid rgba(255,255,255,0.4);
    box-shadow:0 3px 10px rgba(0,0,0,0.5);
    display:flex;align-items:center;justify-content:center;
    cursor:pointer;
  }
  .pub-icon-inner{transform:rotate(45deg);font-size:15px;line-height:1}
</style>
</head>
<body>
<div id="map"></div>
<script>
(function(){
  var PARENT_ORIGIN = ${originLiteral};

  function send(payload){
    var msg = JSON.stringify(payload);
    if (window.ReactNativeWebView) { window.ReactNativeWebView.postMessage(msg); return; }
    // Addressed to one origin, never '*', so the message cannot be read by an
    // unexpected embedder.
    if (PARENT_ORIGIN) window.parent.postMessage(msg, PARENT_ORIGIN);
  }

  var map = L.map('map',{zoomControl:false,attributionControl:false}).setView([51.505,-0.09],16);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{
    subdomains:'abcd',maxZoom:20
  }).addTo(map);

  var userMarker = null;
  var pubLayer = L.layerGroup().addTo(map);

  function isCoord(value){ return typeof value === 'number' && isFinite(value); }
  function validLatLon(lat, lon){
    return isCoord(lat) && isCoord(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
  }

  function setLocation(lat, lon){
    if (!validLatLon(lat, lon)) return;
    map.setView([lat,lon],16);
    if (userMarker) userMarker.remove();
    userMarker = L.circleMarker([lat,lon],{
      radius:9,fillColor:'#4D8DFF',color:'#ffffff',weight:3,opacity:1,fillOpacity:1
    }).addTo(map).bindPopup('You are here');
  }

  function setPubs(pubs){
    if (!Array.isArray(pubs)) return;
    // Replace rather than append; repeated updates used to stack duplicate pins.
    pubLayer.clearLayers();
    pubs.slice(0, 500).forEach(function(pub){
      if (!pub || !validLatLon(pub.lat, pub.lon)) return;
      var icon = L.divIcon({
        // Static markup — pub names are never interpolated into HTML.
        html:'<div class="pub-icon"><div class="pub-icon-inner">🍺</div></div>',
        className:'',iconSize:[34,42],iconAnchor:[17,42]
      });
      L.marker([pub.lat,pub.lon],{icon:icon}).addTo(pubLayer).on('click',function(){
        send(pub);
      });
    });
  }

  function recenter(lat, lon){
    if (validLatLon(lat, lon)) map.setView([lat,lon],16);
  }

  function handleCommand(raw){
    var command;
    try { command = typeof raw === 'string' ? JSON.parse(raw) : raw; }
    catch (e) { return; }
    if (!command || typeof command.type !== 'string') return;
    if (command.type === 'setLocation') setLocation(command.lat, command.lon);
    else if (command.type === 'recenter') recenter(command.lat, command.lon);
    else if (command.type === 'setPubs') setPubs(command.pubs);
  }

  window.addEventListener('message', function(event){
    // In the browser, only the embedder we were built for may drive the map.
    // On native there is no origin to compare and the bridge is the boundary.
    if (PARENT_ORIGIN && event.origin !== PARENT_ORIGIN) return;
    handleCommand(event.data);
  });
  // react-native-webview delivers postMessage on document, not window.
  document.addEventListener('message', function(event){ handleCommand(event.data); });

  send({ type: 'ready' });
})();
</script>
</body>
</html>`;
}

/** Native builds have no browser origin to pin against. */
export const MAP_HTML = buildMapHtml(null);
