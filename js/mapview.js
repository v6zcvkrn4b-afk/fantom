// Mapa: herní území, vlastní živá poloha a značky hráčů z odhalení.
const RED = '#dc2626';
const DETECTIVE = '#dc2626'; // detektivové červeně
const PHANTOM = '#111111';   // Fantom černě

export function createMap(elementId, area) {
  const map = L.map(elementId, { zoomControl: false });
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; přispěvatelé <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);

  // Vše mimo herní území je „za červeným sklem“: obdélník přes celý svět s vyříznutým územím
  const WORLD = [[-90, -180], [-90, 180], [90, 180], [90, -180]];
  const zone = L.layerGroup().addTo(map);
  let currentArea = null;

  function setArea(next) {
    if (currentArea === next) return;
    currentArea = next;
    zone.clearLayers();
    L.polygon([WORLD, next.boundary], { stroke: false, fillColor: RED, fillOpacity: 0.3, interactive: false }).addTo(zone);
    L.polygon(next.boundary, { color: RED, weight: 4, fill: false, interactive: false }).addTo(zone);
    map.fitBounds(next.boundary, { padding: [20, 20] });
  }
  setArea(area);

  const players = L.layerGroup().addTo(map);
  // Živá poloha hráče leží nad značkami z odhalení, aby ji nic nezakrylo
  map.createPane('me');
  map.getPane('me').style.zIndex = 650;
  let me = null;

  return {
    map,
    setArea,
    fitArea() {
      if (currentArea) map.fitBounds(currentArea.boundary, { padding: [20, 20] });
    },

    // Vlastní živá poloha; barva podle role
    showMe(fix, isPhantom) {
      const pos = [fix.lat, fix.lng];
      const color = isPhantom ? PHANTOM : DETECTIVE;
      // Jen tečka, bez kruhu přesnosti
      if (!me) {
        me = { dot: L.circleMarker(pos, { pane: 'me', radius: 9, color: '#fff', weight: 3, fillColor: color, fillOpacity: 1 }).addTo(map) };
      } else {
        me.dot.setLatLng(pos).setStyle({ fillColor: color });
      }
    },

    centerOnMe() {
      if (me) map.setView(me.dot.getLatLng(), 17);
    },

    // markers: [{ lat, lng, kind: 'detective'|'phantom', label, faded }]
    // lines: [[[lat, lng], [lat, lng], ...]] – trasa Fantoma
    showPlayers(markers, lines = []) {
      players.clearLayers();
      for (const line of lines) {
        L.polyline(line, { color: PHANTOM, weight: 3, dashArray: '6 8', opacity: 0.8, interactive: false }).addTo(players);
      }
      for (const m of markers) {
        const icon = L.divIcon({
          className: '',
          html: `<div class="pin ${m.kind}${m.faded ? ' faded' : ''}">${m.kind === 'phantom' ? '👻' : '🕵️'}</div>`
            + (m.label ? `<div class="pin-label">${escapeHtml(m.label)}</div>` : ''),
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        });
        L.marker([m.lat, m.lng], { icon, interactive: false, zIndexOffset: m.faded ? 0 : 500 }).addTo(players);
      }
    },
  };
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
