'use client';
import { useEffect, useRef, useCallback, useState } from 'react';
import { EMERGENCY_SQUAWKS } from '../lib/threatClassifier';

const CESIUM_VERSION = '1.114';
const CESIUM_CDN = `https://cesium.com/downloads/cesiumjs/releases/${CESIUM_VERSION}/Build/Cesium`;

const HOTSPOTS = [
  {
    name: 'Ukraine', lat: 49.0, lon: 31.0, r: 800000,
    desc: 'Russian full-scale invasion since Feb 2022. Active frontline combat across eastern and southern regions.',
    keywords: ['ukraine', 'kyiv', 'russia', 'russian', 'zelensky', 'putin', 'kharkiv', 'kherson', 'zaporizhzhia', 'donbas', 'mariupol', 'bakhmut', 'crimea'],
    location: 'Eastern Europe',
  },
  {
    name: 'Gaza', lat: 31.5, lon: 34.5, r: 80000,
    desc: 'Israel-Hamas war. Heavy urban combat, humanitarian crisis, regional escalation risk.',
    keywords: ['gaza', 'hamas', 'israel', 'netanyahu', 'palestin', 'rafah', 'idf', 'west bank', 'hezbollah', 'tel aviv', 'beirut'],
    location: 'Middle East',
  },
  {
    name: 'Taiwan Strait', lat: 24.0, lon: 120.0, r: 400000,
    desc: 'PRC military exercises and ADIZ incursions ongoing. Risk of blockade or invasion scenario.',
    keywords: ['taiwan', 'taipei', 'china', 'prc', 'pla', 'strait', 'xi jinping', 'adiz'],
    location: 'Indo-Pacific',
  },
  {
    name: 'South China Sea', lat: 12.0, lon: 114.0, r: 900000,
    desc: 'Disputed waters — China vs Philippines, Vietnam, Malaysia. Naval confrontations at Spratly Islands.',
    keywords: ['south china sea', 'spratly', 'philippines', 'scarborough', 'paracel', 'nine-dash'],
    location: 'Indo-Pacific',
  },
  {
    name: 'Iran', lat: 32.0, lon: 53.0, r: 700000,
    desc: 'Nuclear programme escalation, proxy networks active across Middle East. Direct exchange with Israel.',
    keywords: ['iran', 'tehran', 'khamenei', 'irgc', 'persian', 'nuclear', 'sanctions', 'rouhani', 'raisi'],
    location: 'Middle East',
  },
  {
    name: 'Yemen', lat: 15.5, lon: 48.0, r: 500000,
    desc: 'Houthi attacks on Red Sea shipping, US/UK airstrikes. Civil war ongoing since 2015.',
    keywords: ['yemen', 'houthi', 'sanaa', 'red sea', 'aden', 'shipping', 'tanker'],
    location: 'Arabian Peninsula',
  },
  {
    name: 'Sudan', lat: 15.0, lon: 30.0, r: 600000,
    desc: 'Civil war — RSF vs SAF since April 2023. Mass atrocities, one of world\'s worst humanitarian crises.',
    keywords: ['sudan', 'rsf', 'khartoum', 'darfur', 'saf', 'hemeti'],
    location: 'East Africa',
  },
  {
    name: 'Korea', lat: 38.0, lon: 127.5, r: 300000,
    desc: 'DPRK ballistic missile tests, military cooperation with Russia. DMZ incidents ongoing.',
    keywords: ['korea', 'dprk', 'pyongyang', 'kim jong', 'missile', 'north korea'],
    location: 'East Asia',
  },
];

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  if (isNaN(diff)) return '';
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function getNewsForHotspot(newsItems, hotspot) {
  if (!newsItems?.length) return [];
  const kws = hotspot.keywords;
  return newsItems.filter((item) => {
    const text = `${item.title || ''} ${item.description || ''}`.toLowerCase();
    return kws.some((kw) => text.includes(kw));
  }).sort((a, b) => (b.classification?.level ?? 0) - (a.classification?.level ?? 0));
}

function threatBadge(level) {
  if (level >= 4) return { label: 'CRITICAL', bg: '#3a0000', color: '#ff3333', border: '#ff3333' };
  if (level >= 3) return { label: 'HIGH', bg: '#2a1400', color: '#ff6600', border: '#ff6600' };
  if (level >= 2) return { label: 'ELEVATED', bg: '#1a1a00', color: '#ffcc00', border: '#ffcc00' };
  return { label: 'LOW', bg: '#001a00', color: '#00cc44', border: '#00cc44' };
}

export default function Globe({ flights = [], militaryFlights = [], threats = [], newsItems = [], onFlightSelect }) {
  const containerRef = useRef(null);
  const viewerRef = useRef(null);
  const entitiesRef = useRef(new Map());
  const initRef = useRef(false);
  const flightsRef = useRef({ flights: [], militaryFlights: [] });
  const newsItemsRef = useRef([]);
  const showFlightsRef = useRef(true);
  const [showFlights, setShowFlights] = useState(true);
  const [popup, setPopup] = useState(null);

  useEffect(() => { flightsRef.current = { flights, militaryFlights }; }, [flights, militaryFlights]);
  useEffect(() => { newsItemsRef.current = newsItems; }, [newsItems]);
  useEffect(() => { showFlightsRef.current = showFlights; }, [showFlights]);

  const getFlightColor = useCallback((flight, Cesium) => {
    const sq = String(flight.squawk || '');
    if (EMERGENCY_SQUAWKS[sq]) {
      if (sq === '7500') return Cesium.Color.RED;
      if (sq === '7700') return Cesium.Color.ORANGERED;
      if (sq === '7600') return Cesium.Color.ORANGE;
    }
    if (flight._military) return Cesium.Color.CYAN;
    const alt = flight.geo_altitude ?? flight.baro_altitude ?? 0;
    if (alt > 10000) return Cesium.Color.fromCssColorString('#00b4d8');
    if (alt > 5000) return Cesium.Color.fromCssColorString('#0077b6');
    return Cesium.Color.fromCssColorString('#00ff41').withAlpha(0.9);
  }, []);

  const doUpdateFlights = useCallback((Cesium, viewer) => {
    const { flights, militaryFlights } = flightsRef.current;
    const show = showFlightsRef.current;

    const allFlights = [
      ...flights.map((f) => ({ ...f, _military: false })),
      ...militaryFlights.map((f) => ({ ...f, _military: true })),
    ];

    const seen = new Set();

    for (const flight of allFlights) {
      const id = flight.icao24 || flight.callsign;
      if (!id || flight.latitude == null || flight.longitude == null) continue;
      seen.add(id);

      const alt = Math.max(500, flight.geo_altitude ?? flight.baro_altitude ?? 5000);
      const pos = Cesium.Cartesian3.fromDegrees(flight.longitude, flight.latitude, alt);
      const color = getFlightColor(flight, Cesium);

      if (entitiesRef.current.has(id)) {
        const e = entitiesRef.current.get(id);
        e.position = pos;
        e.show = show;
        if (e.point) e.point.color = color;
      } else {
        const e = viewer.entities.add({
          id: `flight_${id}`,
          position: pos,
          show,
          point: {
            pixelSize: flight._military ? 8 : 5,
            color,
            outlineColor: Cesium.Color.BLACK.withAlpha(0.5),
            outlineWidth: 1,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
          label: {
            text: (flight.callsign || id).trim(),
            font: '9px "Share Tech Mono", monospace',
            fillColor: color,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 1,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            pixelOffset: new Cesium.Cartesian2(8, 0),
            show: flight._military || EMERGENCY_SQUAWKS[String(flight.squawk || '')] != null,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
        });
        e._flightData = flight;
        entitiesRef.current.set(id, e);
      }
    }

    for (const [id, entity] of entitiesRef.current) {
      if (!seen.has(id)) {
        viewer.entities.remove(entity);
        entitiesRef.current.delete(id);
      }
    }
  }, [getFlightColor]);

  useEffect(() => {
    if (initRef.current || !containerRef.current) return;

    if (!document.getElementById('cesium-css')) {
      const link = document.createElement('link');
      link.id = 'cesium-css';
      link.rel = 'stylesheet';
      link.href = `${CESIUM_CDN}/Widgets/widgets.css`;
      document.head.appendChild(link);
    }

    if (!document.getElementById('cesium-js')) {
      const script = document.createElement('script');
      script.id = 'cesium-js';
      script.src = `${CESIUM_CDN}/Cesium.js`;
      script.async = true;
      document.head.appendChild(script);
    }

    const tryInit = () => {
      if (typeof window === 'undefined' || !window.Cesium) { setTimeout(tryInit, 200); return; }
      if (initRef.current) return;
      initRef.current = true;

      const Cesium = window.Cesium;

      const viewer = new Cesium.Viewer(containerRef.current, {
        timeline: false,
        animation: false,
        homeButton: false,
        sceneModePicker: false,
        baseLayerPicker: false,
        navigationHelpButton: false,
        geocoder: false,
        fullscreenButton: false,
        infoBox: false,
        selectionIndicator: false,
        creditContainer: document.createElement('div'),
        terrainProvider: new Cesium.EllipsoidTerrainProvider(),
      });

      viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#050508');
      viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString('#0d0d14');
      viewer.scene.globe.enableLighting = false;
      viewer.scene.globe.showGroundAtmosphere = false;
      viewer.scene.skyAtmosphere.show = false;
      viewer.scene.fog.enabled = false;
      viewer.scene.skyBox.show = true;

      viewer.imageryLayers.removeAll();
      viewer.imageryLayers.addImageryProvider(
        new Cesium.UrlTemplateImageryProvider({
          url: 'https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
          credit: '',
          minimumLevel: 0,
          maximumLevel: 18,
        })
      );

      for (const hs of HOTSPOTS) {
        const entity = viewer.entities.add({
          name: hs.name,
          position: Cesium.Cartesian3.fromDegrees(hs.lon, hs.lat, 0),
          ellipse: {
            semiMinorAxis: hs.r,
            semiMajorAxis: hs.r,
            height: 0,
            material: Cesium.Color.RED.withAlpha(0.15),
            outline: true,
            outlineColor: Cesium.Color.fromCssColorString('#ff3300').withAlpha(0.8),
            outlineWidth: 2,
          },
          label: {
            text: hs.name,
            font: 'bold 12px "Share Tech Mono", monospace',
            fillColor: Cesium.Color.fromCssColorString('#ff4444'),
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            pixelOffset: new Cesium.Cartesian2(0, -10),
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
        });
        entity._hotspotData = hs;
      }

      viewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(20.0, 25.0, 18000000),
        orientation: { heading: 0, pitch: -Cesium.Math.PI_OVER_TWO, roll: 0 },
      });

      const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
      handler.setInputAction((click) => {
        const picked = viewer.scene.pick(click.position);
        if (picked?.id?._flightData) {
          onFlightSelect && onFlightSelect(picked.id._flightData);
          setPopup(null);
        } else if (picked?.id?._hotspotData) {
          const hs = picked.id._hotspotData;
          const related = getNewsForHotspot(newsItemsRef.current, hs);
          setPopup({
            hotspot: hs,
            related,
            x: click.position.x,
            y: click.position.y,
          });
        } else {
          setPopup(null);
        }
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

      viewerRef.current = viewer;
      doUpdateFlights(Cesium, viewer);
    };

    tryInit();

    return () => {
      initRef.current = false;
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, []); // eslint-disable-line

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed() || !window.Cesium) return;
    doUpdateFlights(window.Cesium, viewer);
  }, [flights, militaryFlights, doUpdateFlights]);

  useEffect(() => {
    for (const [, entity] of entitiesRef.current) {
      entity.show = showFlights;
    }
  }, [showFlights]);

  // Refresh popup news when newsItems update and popup is open
  useEffect(() => {
    if (!popup?.hotspot) return;
    const related = getNewsForHotspot(newsItems, popup.hotspot);
    setPopup((prev) => prev ? { ...prev, related } : null);
  }, [newsItems]); // eslint-disable-line

  const topItem = popup?.related?.[0];
  const restItems = popup?.related?.slice(1, 6) ?? [];

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%', background: '#050508' }} />

      {/* ── Conflict zone news popup ── */}
      {popup?.hotspot && (
        <div style={{
          position: 'absolute',
          left: Math.min(popup.x + 14, (typeof window !== 'undefined' ? window.innerWidth : 1400) - 320),
          top: Math.max(8, Math.min(popup.y, (typeof window !== 'undefined' ? window.innerHeight : 800) - 420)),
          width: 300,
          background: '#0c0c0e',
          border: '1px solid #550000',
          fontFamily: '"Share Tech Mono", monospace',
          zIndex: 20,
          boxShadow: '0 0 30px rgba(180,0,0,0.3)',
          display: 'flex',
          flexDirection: 'column',
        }}>
          {/* Header */}
          <div style={{ background: '#110000', padding: '8px 12px', borderBottom: '1px solid #330000', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ color: '#ff3333', fontSize: 11, fontWeight: 'bold', letterSpacing: 1 }}>
              ⚠ {popup.hotspot.name.toUpperCase()} — CONFLICT ZONE
            </div>
            <button onClick={() => setPopup(null)} style={{ background: 'none', border: 'none', color: '#553333', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}>✕</button>
          </div>

          <div style={{ padding: '10px 12px', overflowY: 'auto', maxHeight: 420 }}>
            {/* Zone description */}
            <div style={{ fontSize: 9, color: '#664444', marginBottom: 10, lineHeight: 1.5 }}>{popup.hotspot.desc}</div>

            {topItem ? (
              <>
                {/* Top headline */}
                <div style={{ background: '#0f0800', border: '1px solid #331100', padding: '8px 10px', marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6, marginBottom: 6 }}>
                    <div style={{ fontSize: 11, color: '#ffddaa', lineHeight: 1.4, flex: 1 }}>{topItem.title}</div>
                    {(() => {
                      const b = threatBadge(topItem.classification?.level ?? 0);
                      return (
                        <span style={{ fontSize: 8, padding: '2px 5px', background: b.bg, color: b.color, border: `1px solid ${b.border}`, whiteSpace: 'nowrap', flexShrink: 0 }}>
                          {b.label}
                        </span>
                      );
                    })()}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 0', fontSize: 9 }}>
                    <span style={{ color: '#443333' }}>TYPE</span>
                    <span style={{ color: '#443333' }}>LOCATION</span>
                    <span style={{ color: '#888' }}>{topItem.source?.toUpperCase() || '—'}</span>
                    <span style={{ color: '#888' }}>{popup.hotspot.location}</span>
                  </div>
                  <div style={{ marginTop: 6, fontSize: 9 }}>
                    <span style={{ color: '#443333' }}>TIME  </span>
                    <span style={{ color: '#666' }}>{timeAgo(topItem.pubDate)}</span>
                  </div>
                  {topItem.link && (
                    <a href={topItem.link} target="_blank" rel="noreferrer" style={{ display: 'block', marginTop: 8, fontSize: 9, color: '#886644', textDecoration: 'none', letterSpacing: 1 }}>
                      Source →
                    </a>
                  )}
                </div>

                {/* Related events */}
                {restItems.length > 0 && (
                  <>
                    <div style={{ fontSize: 9, color: '#443333', letterSpacing: 2, marginBottom: 5 }}>RELATED EVENTS</div>
                    {restItems.map((item, i) => {
                      const b = threatBadge(item.classification?.level ?? 0);
                      return (
                        <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', padding: '5px 0', borderBottom: '1px solid #1a0a0a' }}>
                          <span style={{ fontSize: 7, padding: '2px 4px', background: b.bg, color: b.color, border: `1px solid ${b.border}`, whiteSpace: 'nowrap', flexShrink: 0, marginTop: 1 }}>
                            {b.label}
                          </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 10, color: '#998877', lineHeight: 1.3, wordBreak: 'break-word' }}>{item.title}</div>
                            <div style={{ fontSize: 8, color: '#443333', marginTop: 2 }}>{timeAgo(item.pubDate)}</div>
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </>
            ) : (
              <div style={{ fontSize: 10, color: '#443333', padding: '8px 0' }}>
                {newsItems.length === 0 ? '◌ LOADING NEWS FEEDS...' : '◌ NO RECENT EVENTS DETECTED FOR THIS REGION'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* HUD */}
      <div style={{
        position: 'absolute', top: 8, left: 8, pointerEvents: 'none',
        fontFamily: '"Share Tech Mono", monospace', fontSize: 10, color: '#00ff41', lineHeight: 1.6,
      }}>
        <div>● LIVE TRACKING</div>
        <div style={{ color: '#00b4d8' }}>▲ CIVIL: {flights.length}</div>
        <div style={{ color: '#00ffff' }}>★ MILITARY: {militaryFlights.length}</div>
      </div>

      {/* Flight toggle */}
      <button
        onClick={() => setShowFlights((v) => !v)}
        style={{
          position: 'absolute', top: 8, right: 8,
          background: showFlights ? 'rgba(0,180,216,0.15)' : 'rgba(0,0,0,0.6)',
          border: `1px solid ${showFlights ? '#00b4d8' : '#333'}`,
          color: showFlights ? '#00b4d8' : '#555',
          fontFamily: '"Share Tech Mono", monospace', fontSize: 9,
          cursor: 'pointer', padding: '4px 10px', letterSpacing: 1,
        }}
      >
        {showFlights ? '▲ FLIGHTS ON' : '▲ FLIGHTS OFF'}
      </button>

      {/* Legend */}
      <div style={{
        position: 'absolute', bottom: 8, right: 8, pointerEvents: 'none',
        fontFamily: '"Share Tech Mono", monospace', fontSize: 9,
        color: 'rgba(0,255,65,0.45)',
      }}>
        <span style={{ color: '#00b4d8' }}>● </span>CIVIL &nbsp;
        <span style={{ color: '#00ffff' }}>★ </span>MIL &nbsp;
        <span style={{ color: '#ff0000' }}>● </span>EMRG &nbsp;
        <span style={{ color: '#ff4400', border: '1px solid #ff440055', padding: '0 4px' }}>ZONE</span> HOTSPOT
      </div>
    </div>
  );
}
