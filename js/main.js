import { CITY, BOUNDARY } from './config.js';
import { watchPosition } from './gps.js';
import { keepScreenOn } from './wakelock.js';
import { isInside } from './geo.js';

// Zatím jen testovací obrazovka: mapa, hranice území a vlastní poloha z GPS.
const statusEl = document.getElementById('status');

const map = L.map('map', { zoomControl: false }).setView(CITY.center, CITY.zoom);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; přispěvatelé <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(map);

// Vše mimo herní území je „za červeným sklem“: obdélník přes celý svět s vyříznutým územím
const WORLD = [[-90, -180], [-90, 180], [90, 180], [90, -180]];
L.polygon([WORLD, BOUNDARY], {
  stroke: false,
  fillColor: '#dc2626',
  fillOpacity: 0.3,
  interactive: false,
}).addTo(map);

// Hranice území: plná červená čára
L.polygon(BOUNDARY, {
  color: '#dc2626',
  weight: 4,
  fill: false,
  interactive: false,
}).addTo(map);

let me = null;

watchPosition(
  ({ lat, lng, accuracy }) => {
    const pos = [lat, lng];
    if (!me) {
      me = {
        dot: L.circleMarker(pos, { radius: 9, color: '#fff', weight: 3, fillColor: '#3b82f6', fillOpacity: 1 }).addTo(map),
        ring: L.circle(pos, { radius: accuracy, color: '#3b82f6', weight: 1, fillOpacity: 0.1 }).addTo(map),
      };
    } else {
      me.dot.setLatLng(pos);
      me.ring.setLatLng(pos).setRadius(accuracy);
    }
    const inside = isInside(pos, BOUNDARY);
    statusEl.classList.toggle('error', !inside);
    statusEl.textContent = `${inside ? 'V herním území' : 'MIMO území!'} · přesnost ${Math.round(accuracy)} m`;
  },
  (message) => {
    statusEl.classList.add('error');
    statusEl.textContent = message;
  },
);

document.getElementById('locate').addEventListener('click', () => {
  if (me) map.setView(me.dot.getLatLng(), 17);
});

keepScreenOn();

// Zajistí, že se po každé změně hry načte nejnovější verze
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' });
}
