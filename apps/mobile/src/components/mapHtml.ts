export const MAP_HTML = `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
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
function send(msg){
  if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(msg);
  else window.parent.postMessage(msg,'*');
}
var map=L.map('map',{zoomControl:false,attributionControl:false}).setView([51.505,-0.09],16);
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{
  subdomains:'abcd',maxZoom:20
}).addTo(map);
var userMarker=null;
function setLocation(lat,lon){
  map.setView([lat,lon],16);
  if(userMarker)userMarker.remove();
  userMarker=L.circleMarker([lat,lon],{
    radius:9,fillColor:'#4D8DFF',color:'#ffffff',weight:3,opacity:1,fillOpacity:1
  }).addTo(map).bindPopup('You are here');
}
function setPubs(pubs){
  pubs.forEach(function(pub){
    var icon=L.divIcon({
      html:'<div class="pub-icon"><div class="pub-icon-inner">🍺</div></div>',
      className:'',iconSize:[34,42],iconAnchor:[17,42]
    });
    L.marker([pub.lat,pub.lon],{icon:icon}).addTo(map).on('click',function(){
      send(JSON.stringify(pub));
    });
  });
}
function recenter(lat,lon){map.setView([lat,lon],16);}
</script>
</body>
</html>`;
