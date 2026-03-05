'use client';
import { useEffect, useRef } from 'react';

const CONFLICT_ZONES = [
  { name: 'Ukraine',          lat: 49.0, lon:  31.0,  radius: 600000, color: '#ff3300' },
  { name: 'Gaza / Levant',    lat: 31.5, lon:  35.0,  radius: 250000, color: '#ff6600' },
  { name: 'Taiwan Strait',    lat: 24.0, lon: 120.0,  radius: 350000, color: '#ff9900' },
  { name: 'South China Sea',  lat: 12.0, lon: 114.0,  radius: 800000, color: '#ff9900' },
  { name: 'Iran',             lat: 32.0, lon:  53.0,  radius: 600000, color: '#ff3300' },
  { name: 'Yemen',            lat: 15.5, lon:  48.0,  radius: 400000, color: '#ff6600' },
  { name: 'Sudan',            lat: 15.0, lon:  30.0,  radius: 500000, color: '#ff9900' },
  { name: 'Korean Peninsula', lat: 37.5, lon: 127.5,  radius: 250000, color: '#ff3300' },
];

function altColor(alt) {
  if (alt == null) return '#0288d1';
  if (alt > 10000) return '#1565c0';
  if (alt > 5000)  return '#0288d1';
  if (alt > 2000)  return '#00897b';
  return '#e65100';
}

export default function Map2D({ flights, militaryFlights, threats, newsItems, layers, onFlightSelect, onZoneSelect }) {
  const containerRef = useRef(null);
  const mapState     = useRef({ map: null, civilLayer: null, milLayer: null, zonesLayer: null, ready: false });

  // Always-fresh refs so callbacks never go stale
  const flightsRef    = useRef(flights);
  const milRef        = useRef(militaryFlights);
  const layersRef     = useRef(layers);
  const selectRef     = useRef(onFlightSelect);
  const zoneSelectRef = useRef(onZoneSelect);

  useEffect(() => { flightsRef.current = flights;         renderFlights(); }, [flights]);         // eslint-disable-line
  useEffect(() => { milRef.current = militaryFlights;     renderFlights(); }, [militaryFlights]); // eslint-disable-line
  useEffect(() => { selectRef.current     = onFlightSelect; }, [onFlightSelect]);
  useEffect(() => { zoneSelectRef.current = onZoneSelect;   }, [onZoneSelect]);

  useEffect(() => {
    layersRef.current = layers;
    const s = mapState.current;
    if (!s.ready) return;
    // Toggle zone layer visibility
    if (layers.conflictZones) { if (!s.map.hasLayer(s.zonesLayer)) s.map.addLayer(s.zonesLayer); }
    else                       { if (s.map.hasLayer(s.zonesLayer))  s.map.removeLayer(s.zonesLayer); }
    renderFlights();
  }, [layers]); // eslint-disable-line

  function renderFlights() {
    const s = mapState.current;
    if (!s.ready || !window.L) return;
    const L = window.L;
    const lrs = layersRef.current;

    s.civilLayer.clearLayers();
    s.milLayer.clearLayers();

    // ── Civil flights ──────────────────────────────────────────────────────────
    if (lrs.civilFlights) {
      flightsRef.current.forEach(f => {
        if (!f.latitude || !f.longitude) return;
        if (lrs.emergencyOnly && (f._threatLevel ?? 0) < 3) return;

        const sq = String(f.squawk || '');
        const isEmerg = ['7500', '7600', '7700', '7777'].includes(sq);
        const color = isEmerg        ? '#ff0000'
                    : (f._threatLevel >= 4) ? '#ff4400'
                    : (f._threatLevel >= 3) ? '#ff9500'
                    : altColor(f.baro_altitude);

        const m = L.circleMarker([f.latitude, f.longitude], {
          radius:      isEmerg ? 5 : (f._threatLevel >= 3 ? 4 : 2.5),
          color,
          fillColor:   color,
          fillOpacity: isEmerg ? 1.0 : 0.8,
          weight:      isEmerg ? 2   : 1,
        }).addTo(s.civilLayer);

        m.on('click', () => selectRef.current && selectRef.current(f));

        if (lrs.flightLabels && f.callsign?.trim()) {
          m.bindTooltip(f.callsign.trim(), {
            permanent: true, direction: 'right', offset: [4, 0],
            className: 'map2d-flight-label',
          });
        }
      });
    }

    // ── Military flights ───────────────────────────────────────────────────────
    if (lrs.militaryFlights) {
      milRef.current.forEach(f => {
        if (!f.latitude || !f.longitude) return;
        L.circleMarker([f.latitude, f.longitude], {
          radius: 5, color: '#00eeff', fillColor: '#00eeff', fillOpacity: 0.9, weight: 2,
        }).addTo(s.milLayer);
      });
    }
  }

  // ── Map initialization ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;
    let destroyed = false;

    // Leaflet CSS
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css'; link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    // Terminal-theme overrides for Leaflet
    if (!document.getElementById('leaflet-theme')) {
      const style = document.createElement('style');
      style.id = 'leaflet-theme';
      style.textContent = `
        .leaflet-container { background: #0d1117 !important; font-family: 'Share Tech Mono', monospace; }
        .leaflet-tile-pane { filter: brightness(0.88) saturate(0.6); }
        .leaflet-control-zoom { border: 1px solid #002800 !important; }
        .leaflet-control-zoom a {
          background: #020202 !important; color: #004400 !important;
          border-bottom: 1px solid #001800 !important; font-size: 14px !important;
          line-height: 24px !important; width: 24px !important; height: 24px !important;
        }
        .leaflet-control-zoom a:hover { color: #00ff41 !important; background: #030303 !important; }
        .map2d-flight-label {
          background: transparent !important; border: none !important;
          box-shadow: none !important; color: #00aa28;
          font-size: 7px; font-family: 'Share Tech Mono', monospace;
          padding: 0 !important; white-space: nowrap;
        }
        .map2d-flight-label::before { display: none !important; }
        .leaflet-popup-content-wrapper {
          background: #050505ee; border: 1px solid #002800; border-radius: 0;
          color: #00cc33; font-family: 'Share Tech Mono', monospace; font-size: 11px;
          padding: 6px 10px;
        }
        .leaflet-popup-tip { background: #050505ee; }
        .leaflet-popup-close-button { color: #004400 !important; }
        .leaflet-control-attribution { display: none !important; }
      `;
      document.head.appendChild(style);
    }

    function initMap() {
      if (destroyed || !containerRef.current || !window.L) return;
      const L = window.L;

      const map = L.map(containerRef.current, {
        center: [25, 20], zoom: 3,
        zoomControl: false, attributionControl: false, preferCanvas: true,
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 18, subdomains: 'abcd',
      }).addTo(map);

      L.control.zoom({ position: 'topright' }).addTo(map);

      const civilLayer  = L.layerGroup().addTo(map);
      const milLayer    = L.layerGroup().addTo(map);
      const zonesLayer  = L.layerGroup().addTo(map);

      // Conflict zone circles + labels
      CONFLICT_ZONES.forEach(z => {
        L.circle([z.lat, z.lon], {
          radius: z.radius, color: z.color, fillColor: z.color,
          fillOpacity: 0.07, weight: 1.5, dashArray: '6,10',
        })
        .on('click', () => zoneSelectRef.current && zoneSelectRef.current(z))
        .addTo(zonesLayer);

        L.marker([z.lat, z.lon], {
          icon: L.divIcon({
            className: '',
            html: `<div style="color:${z.color};font-size:9px;font-family:'Share Tech Mono',monospace;`
                + `letter-spacing:1px;white-space:nowrap;pointer-events:none;`
                + `text-shadow:0 0 6px #000,0 0 3px #000">${z.name.toUpperCase()}</div>`,
            iconAnchor: [0, 0],
          }),
          interactive: false,
        }).addTo(zonesLayer);
      });

      mapState.current = { map, civilLayer, milLayer, zonesLayer, ready: true };

      // Render with current data after a short delay for layer groups to settle
      setTimeout(() => { if (!destroyed) renderFlights(); }, 80);
    }

    if (window.L) {
      initMap();
    } else if (!document.getElementById('leaflet-js')) {
      const script = document.createElement('script');
      script.id = 'leaflet-js';
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = initMap;
      document.head.appendChild(script);
    } else {
      // Script tag exists but hasn't fired onload yet
      document.getElementById('leaflet-js').addEventListener('load', initMap, { once: true });
    }

    return () => {
      destroyed = true;
      if (mapState.current.map) {
        mapState.current.map.remove();
        mapState.current = { map: null, civilLayer: null, milLayer: null, zonesLayer: null, ready: false };
      }
    };
  }, []); // eslint-disable-line

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', background: '#0d1117' }}
    />
  );
}
