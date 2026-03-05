'use client';
import { useEffect, useRef, useCallback, useState } from 'react';
import { EMERGENCY_SQUAWKS } from '../lib/threatClassifier';

const CESIUM_VERSION = '1.114';
const CESIUM_CDN = `https://cesium.com/downloads/cesiumjs/releases/${CESIUM_VERSION}/Build/Cesium`;

// How far ahead to extrapolate (= poll interval). Cesium interpolates between
// current GPS fix and extrapolated point, giving smooth continuous movement.
const SMOOTH_S = 10;
const TRAIL_LEN = 30; // max trail points per aircraft

const HOTSPOTS = [
  { name: 'Ukraine', lat: 49.0, lon: 31.0, r: 800000, desc: 'Russian full-scale invasion since Feb 2022. Active frontline combat across eastern and southern regions.', keywords: ['ukraine', 'kyiv', 'russia', 'russian', 'zelensky', 'putin', 'kharkiv', 'kherson', 'zaporizhzhia', 'donbas', 'mariupol', 'bakhmut', 'crimea'], location: 'Eastern Europe' },
  { name: 'Gaza', lat: 31.5, lon: 34.5, r: 80000, desc: 'Israel-Hamas war. Heavy urban combat, humanitarian crisis, regional escalation risk.', keywords: ['gaza', 'hamas', 'israel', 'netanyahu', 'palestin', 'rafah', 'idf', 'west bank', 'hezbollah', 'tel aviv', 'beirut'], location: 'Middle East' },
  { name: 'Taiwan Strait', lat: 24.0, lon: 120.0, r: 400000, desc: 'PRC military exercises and ADIZ incursions ongoing. Risk of blockade or invasion scenario.', keywords: ['taiwan', 'taipei', 'china', 'prc', 'pla', 'strait', 'xi jinping', 'adiz'], location: 'Indo-Pacific' },
  { name: 'South China Sea', lat: 12.0, lon: 114.0, r: 900000, desc: 'Disputed waters — China vs Philippines, Vietnam, Malaysia. Naval confrontations at Spratly Islands.', keywords: ['south china sea', 'spratly', 'philippines', 'scarborough', 'paracel', 'nine-dash'], location: 'Indo-Pacific' },
  { name: 'Iran', lat: 32.0, lon: 53.0, r: 700000, desc: 'Nuclear programme escalation, proxy networks active across Middle East. Direct exchange with Israel.', keywords: ['iran', 'tehran', 'khamenei', 'irgc', 'persian', 'nuclear', 'sanctions', 'rouhani', 'raisi'], location: 'Middle East' },
  { name: 'Yemen', lat: 15.5, lon: 48.0, r: 500000, desc: 'Houthi attacks on Red Sea shipping, US/UK airstrikes. Civil war ongoing since 2015.', keywords: ['yemen', 'houthi', 'sanaa', 'red sea', 'aden', 'shipping', 'tanker'], location: 'Arabian Peninsula' },
  { name: 'Sudan', lat: 15.0, lon: 30.0, r: 600000, desc: "Civil war — RSF vs SAF since April 2023. Mass atrocities, one of world's worst humanitarian crises.", keywords: ['sudan', 'rsf', 'khartoum', 'darfur', 'saf', 'hemeti'], location: 'East Africa' },
  { name: 'Korea', lat: 38.0, lon: 127.5, r: 300000, desc: 'DPRK ballistic missile tests, military cooperation with Russia. DMZ incidents ongoing.', keywords: ['korea', 'dprk', 'pyongyang', 'kim jong', 'missile', 'north korea'], location: 'East Asia' },
];

// ── Airplane icon ─────────────────────────────────────────────────────────────
// Draws a white top-down aircraft shape pointing NORTH (up).
// Cesium's billboard `rotation` then rotates it to the actual heading.
function makePlaneIcon(size = 32) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const cx = size / 2, cy = size / 2;

  function shape(dx, dy) {
    // fuselage
    ctx.beginPath();
    ctx.ellipse(cx + dx, cy - 1 + dy, 2.2, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    // wings (swept back)
    ctx.beginPath();
    ctx.moveTo(cx + dx, cy - 3 + dy);
    ctx.lineTo(cx + 13 + dx, cy + 5 + dy);
    ctx.lineTo(cx + 13 + dx, cy + 8 + dy);
    ctx.lineTo(cx + 1 + dx, cy + 3 + dy);
    ctx.lineTo(cx - 1 + dx, cy + 3 + dy);
    ctx.lineTo(cx - 13 + dx, cy + 8 + dy);
    ctx.lineTo(cx - 13 + dx, cy + 5 + dy);
    ctx.closePath();
    ctx.fill();
    // tail fins
    ctx.beginPath();
    ctx.moveTo(cx + dx, cy + 5 + dy);
    ctx.lineTo(cx + 5 + dx, cy + 12 + dy);
    ctx.lineTo(cx + 5 + dx, cy + 15 + dy);
    ctx.lineTo(cx + dx, cy + 11 + dy);
    ctx.lineTo(cx - 5 + dx, cy + 15 + dy);
    ctx.lineTo(cx - 5 + dx, cy + 12 + dy);
    ctx.closePath();
    ctx.fill();
  }

  // shadow for legibility on light map
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  shape(1, 1);
  // body (white — Cesium billboard `color` tints this)
  ctx.fillStyle = '#ffffff';
  shape(0, 0);

  return c;
}

// ── Great-circle extrapolation ────────────────────────────────────────────────
// Returns the position dt seconds ahead given speed/heading/vertical rate.
function extrapolatePos(lon, lat, alt, velocity, heading, vertRate, dt, Cesium) {
  if (!velocity || velocity < 1 || dt <= 0) {
    return Cesium.Cartesian3.fromDegrees(lon, lat, alt);
  }
  const hRad = Cesium.Math.toRadians(heading || 0);
  const R = 6371000;
  const dLat = (velocity * Math.cos(hRad) * dt) / R;
  const dLon = (velocity * Math.sin(hRad) * dt) / (R * Math.cos(Cesium.Math.toRadians(lat)));
  return Cesium.Cartesian3.fromDegrees(
    lon + Cesium.Math.toDegrees(dLon),
    lat + Cesium.Math.toDegrees(dLat),
    Math.max(50, alt + (vertRate || 0) * dt)
  );
}

// ── Helpers (news popup) ──────────────────────────────────────────────────────
function timeAgo(d) {
  if (!d) return '';
  const m = Math.floor((Date.now() - new Date(d)) / 60000);
  if (isNaN(m)) return '';
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function getNewsForHotspot(newsItems, hotspot) {
  if (!newsItems?.length) return [];
  return newsItems
    .filter((item) => {
      const t = `${item.title || ''} ${item.description || ''}`.toLowerCase();
      return hotspot.keywords.some((kw) => t.includes(kw));
    })
    .sort((a, b) => (b.classification?.level ?? 0) - (a.classification?.level ?? 0));
}

function threatBadge(level) {
  if (level >= 4) return { label: 'CRITICAL', bg: '#3a0000', color: '#ff3333', border: '#ff3333' };
  if (level >= 3) return { label: 'HIGH', bg: '#2a1400', color: '#ff6600', border: '#ff6600' };
  if (level >= 2) return { label: 'ELEVATED', bg: '#1a1a00', color: '#ffcc00', border: '#ffcc00' };
  return { label: 'LOW', bg: '#001a00', color: '#00cc44', border: '#00cc44' };
}

// ─────────────────────────────────────────────────────────────────────────────

export default function Globe({ flights = [], militaryFlights = [], threats = [], newsItems = [], layers = {}, onFlightSelect }) {
  const containerRef = useRef(null);
  const viewerRef = useRef(null);
  const entitiesRef = useRef(new Map());           // id → flight entity
  const trailEntitiesRef = useRef(new Map());      // id → trail polyline entity
  const trailRef = useRef(new Map());               // id → Cartesian3[]
  const conflictZoneEntitiesRef = useRef([]);       // conflict zone ellipse entities
  const planeIconRef = useRef(null);
  const initRef = useRef(false);
  const flightsRef = useRef({ flights: [], militaryFlights: [] });
  const newsItemsRef = useRef([]);
  const layersRef = useRef(layers);
  const [popup, setPopup] = useState(null);

  useEffect(() => { flightsRef.current = { flights, militaryFlights }; }, [flights, militaryFlights]);
  useEffect(() => { newsItemsRef.current = newsItems; }, [newsItems]);
  useEffect(() => { layersRef.current = layers; }, [layers]);

  // Altitude-based color (readable on Voyager political map)
  const getFlightColor = useCallback((flight, Cesium) => {
    const sq = String(flight.squawk || '');
    if (sq === '7500') return Cesium.Color.RED;
    if (sq === '7700') return Cesium.Color.ORANGERED;
    if (sq === '7600') return Cesium.Color.ORANGE;
    if (flight._military) return Cesium.Color.fromCssColorString('#00eeff');
    const alt = flight.geo_altitude ?? flight.baro_altitude ?? 0;
    if (alt > 10000) return Cesium.Color.fromCssColorString('#1565c0'); // high — dark blue
    if (alt > 5000)  return Cesium.Color.fromCssColorString('#0288d1'); // mid  — blue
    if (alt > 2000)  return Cesium.Color.fromCssColorString('#00897b'); // low  — teal
    return Cesium.Color.fromCssColorString('#e65100');                  // gnd  — orange
  }, []);

  const doUpdateFlights = useCallback((Cesium, viewer) => {
    const planeIcon = planeIconRef.current;
    if (!planeIcon) return;

    const { flights, militaryFlights } = flightsRef.current;
    const lrs = layersRef.current;
    const allFlights = [
      ...flights.map((f) => ({ ...f, _military: false })),
      ...militaryFlights.map((f) => ({ ...f, _military: true })),
    ];

    const seen = new Set();
    const nowJD = Cesium.JulianDate.now();
    const futureJD = Cesium.JulianDate.addSeconds(nowJD, SMOOTH_S, new Cesium.JulianDate());

    for (const flight of allFlights) {
      const id = flight.icao24 || flight.callsign;
      if (!id || flight.latitude == null || flight.longitude == null) continue;
      seen.add(id);

      const alt = Math.max(50, flight.geo_altitude ?? flight.baro_altitude ?? 1000);
      const lon = flight.longitude, lat = flight.latitude;
      const heading = flight.true_track || 0;
      const color = getFlightColor(flight, Cesium);
      const isMil = flight._military;
      const isEmerg = !!EMERGENCY_SQUAWKS[String(flight.squawk || '')];

      // Visibility based on layer toggles
      let show;
      if (isEmerg) show = true;
      else if (isMil) show = !lrs.emergencyOnly && (lrs.militaryFlights !== false);
      else show = !lrs.emergencyOnly && (lrs.civilFlights !== false);

      const showLabel = isMil || isEmerg || !!lrs.flightLabels;
      const showTrail = isMil || isEmerg;

      const currentPos = Cesium.Cartesian3.fromDegrees(lon, lat, alt);
      const futurePos = extrapolatePos(lon, lat, alt, flight.velocity, heading, flight.vertical_rate, SMOOTH_S, Cesium);

      // Build smooth interpolated position property
      const posProp = new Cesium.SampledPositionProperty();
      posProp.addSample(nowJD, currentPos);
      posProp.addSample(futureJD, futurePos);

      // Maintain trail history
      const trail = trailRef.current.get(id) || [];
      trail.push(currentPos);
      if (trail.length > TRAIL_LEN) trail.shift();
      trailRef.current.set(id, trail);

      if (entitiesRef.current.has(id)) {
        const e = entitiesRef.current.get(id);
        e.position = posProp;
        e.show = show;
        e._flightData = flight; // keep latest data for click
        if (e.billboard) {
          e.billboard.rotation = -Cesium.Math.toRadians(heading);
          e.billboard.color = color;
          e.billboard.scale = isMil ? 0.9 : 0.65;
        }
        if (e.label) {
          e.label.show = show && showLabel;
          e.label.text = (flight.callsign || id).trim();
        }
        // Update trail polyline
        if (showTrail && trail.length >= 2) {
          const te = trailEntitiesRef.current.get(id);
          if (te?.polyline) {
            te.polyline.positions = [...trail];
            te.show = show;
          }
        }
      } else {
        const callsign = (flight.callsign || id).trim();
        const e = viewer.entities.add({
          id: `flight_${id}`,
          position: posProp,
          show,
          billboard: {
            image: planeIcon,
            // billboard rotation is CCW; heading is CW from north → negate
            rotation: -Cesium.Math.toRadians(heading),
            scale: isMil ? 0.9 : 0.65,
            color,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
            // scale by camera distance: big when zoomed in, tiny when zoomed out
            scaleByDistance: new Cesium.NearFarScalar(5e4, 1.4, 1.5e7, 0.35),
            verticalOrigin: Cesium.VerticalOrigin.CENTER,
            horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
          },
          label: {
            text: callsign,
            font: '10px "Share Tech Mono", monospace',
            fillColor: color,
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 2,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            pixelOffset: new Cesium.Cartesian2(0, -20),
            show: showLabel,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
            scaleByDistance: new Cesium.NearFarScalar(5e4, 1.0, 1e7, 0.3),
          },
        });
        e._flightData = flight;
        entitiesRef.current.set(id, e);

        // Trail for military / emergency
        if (showTrail) {
          const te = viewer.entities.add({
            id: `trail_${id}`,
            show,
            polyline: {
              positions: [currentPos],
              width: isMil ? 1.5 : 1,
              material: new Cesium.ColorMaterialProperty(color.withAlpha(0.55)),
              clampToGround: false,
              arcType: Cesium.ArcType.NONE,
            },
          });
          trailEntitiesRef.current.set(id, te);
        }
      }
    }

    // Remove stale entities
    for (const [id, entity] of entitiesRef.current) {
      if (!seen.has(id)) {
        viewer.entities.remove(entity);
        entitiesRef.current.delete(id);
        trailRef.current.delete(id);
        const te = trailEntitiesRef.current.get(id);
        if (te) { viewer.entities.remove(te); trailEntitiesRef.current.delete(id); }
      }
    }
  }, [getFlightColor]);

  // ── Cesium init ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (initRef.current || !containerRef.current) return;

    if (!document.getElementById('cesium-css')) {
      const link = document.createElement('link');
      link.id = 'cesium-css'; link.rel = 'stylesheet';
      link.href = `${CESIUM_CDN}/Widgets/widgets.css`;
      document.head.appendChild(link);
    }
    if (!document.getElementById('cesium-js')) {
      const script = document.createElement('script');
      script.id = 'cesium-js'; script.src = `${CESIUM_CDN}/Cesium.js`; script.async = true;
      document.head.appendChild(script);
    }

    const tryInit = () => {
      if (typeof window === 'undefined' || !window.Cesium) { setTimeout(tryInit, 200); return; }
      if (initRef.current) return;
      initRef.current = true;
      const Cesium = window.Cesium;

      const viewer = new Cesium.Viewer(containerRef.current, {
        timeline: false, animation: false, homeButton: false,
        sceneModePicker: false, baseLayerPicker: false, navigationHelpButton: false,
        geocoder: false, fullscreenButton: false, infoBox: false,
        selectionIndicator: false,
        creditContainer: document.createElement('div'),
        terrainProvider: new Cesium.EllipsoidTerrainProvider(),
      });

      viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#a8c0d0');
      viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString('#c8dde8');
      viewer.scene.globe.enableLighting = false;
      viewer.scene.globe.showGroundAtmosphere = false;
      viewer.scene.skyAtmosphere.show = false;
      viewer.scene.fog.enabled = false;
      viewer.scene.skyBox.show = true;
      // Keep clock animating so SampledPositionProperty interpolates
      viewer.clock.shouldAnimate = true;
      viewer.clock.multiplier = 1;

      // CartoDB Voyager — Google Maps political style
      viewer.imageryLayers.removeAll();
      viewer.imageryLayers.addImageryProvider(
        new Cesium.UrlTemplateImageryProvider({
          url: 'https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
          credit: '', minimumLevel: 0, maximumLevel: 19,
        })
      );

      // Pre-build the airplane icon once
      planeIconRef.current = makePlaneIcon(32);

      // Conflict zones
      for (const hs of HOTSPOTS) {
        const entity = viewer.entities.add({
          name: hs.name,
          position: Cesium.Cartesian3.fromDegrees(hs.lon, hs.lat, 0),
          ellipse: {
            semiMinorAxis: hs.r, semiMajorAxis: hs.r, height: 0,
            material: Cesium.Color.RED.withAlpha(0.13),
            outline: true,
            outlineColor: Cesium.Color.fromCssColorString('#ff3300').withAlpha(0.75),
            outlineWidth: 2,
          },
          label: {
            text: hs.name,
            font: 'bold 12px "Share Tech Mono", monospace',
            fillColor: Cesium.Color.fromCssColorString('#dd2222'),
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 2,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            pixelOffset: new Cesium.Cartesian2(0, -10),
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
        });
        entity._hotspotData = hs;
        conflictZoneEntitiesRef.current.push(entity);
      }

      viewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(20.0, 25.0, 18000000),
        orientation: { heading: 0, pitch: -Cesium.Math.PI_OVER_TWO, roll: 0 },
      });

      // Click handler
      const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
      handler.setInputAction((click) => {
        const picked = viewer.scene.pick(click.position);
        if (picked?.id?._flightData) {
          onFlightSelect && onFlightSelect(picked.id._flightData);
          setPopup(null);
        } else if (picked?.id?._hotspotData) {
          const hs = picked.id._hotspotData;
          const related = getNewsForHotspot(newsItemsRef.current, hs);
          setPopup({ hotspot: hs, related, x: click.position.x, y: click.position.y });
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

  // Conflict zone visibility
  useEffect(() => {
    const show = layers.conflictZones !== false;
    for (const e of conflictZoneEntitiesRef.current) e.show = show;
  }, [layers.conflictZones]);

  // Flight visibility when layer toggles change without a new poll
  useEffect(() => {
    for (const [id, e] of entitiesRef.current) {
      const f = e._flightData;
      if (!f) continue;
      const isMil = f._military;
      const isEmerg = !!EMERGENCY_SQUAWKS[String(f.squawk || '')];
      let show;
      if (isEmerg) show = true;
      else if (isMil) show = !layers.emergencyOnly && (layers.militaryFlights !== false);
      else show = !layers.emergencyOnly && (layers.civilFlights !== false);
      e.show = show;
      if (e.label) e.label.show = show && (isMil || isEmerg || !!layers.flightLabels);
      const te = trailEntitiesRef.current.get(id);
      if (te) te.show = show;
    }
  }, [layers.civilFlights, layers.militaryFlights, layers.emergencyOnly, layers.flightLabels]);

  useEffect(() => {
    if (!popup?.hotspot) return;
    const related = getNewsForHotspot(newsItems, popup.hotspot);
    setPopup((prev) => prev ? { ...prev, related } : null);
  }, [newsItems]); // eslint-disable-line

  const topItem = popup?.related?.[0];
  const restItems = popup?.related?.slice(1, 6) ?? [];

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%', background: '#c8dde8' }} />

      {/* ── Conflict zone popup ── */}
      {popup?.hotspot && (
        <div style={{
          position: 'absolute',
          left: Math.min(popup.x + 14, (typeof window !== 'undefined' ? window.innerWidth : 1400) - 320),
          top: Math.max(8, Math.min(popup.y, (typeof window !== 'undefined' ? window.innerHeight : 800) - 420)),
          width: 300, background: '#0c0c0e', border: '1px solid #550000',
          fontFamily: '"Share Tech Mono", monospace', zIndex: 20,
          boxShadow: '0 0 30px rgba(180,0,0,0.3)', display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ background: '#110000', padding: '8px 12px', borderBottom: '1px solid #330000', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ color: '#ff3333', fontSize: 11, fontWeight: 'bold', letterSpacing: 1 }}>
              ⚠ {popup.hotspot.name.toUpperCase()} — CONFLICT ZONE
            </div>
            <button onClick={() => setPopup(null)} style={{ background: 'none', border: 'none', color: '#553333', cursor: 'pointer', fontSize: 14 }}>✕</button>
          </div>
          <div style={{ padding: '10px 12px', overflowY: 'auto', maxHeight: 420 }}>
            <div style={{ fontSize: 9, color: '#664444', marginBottom: 10, lineHeight: 1.5 }}>{popup.hotspot.desc}</div>
            {topItem ? (
              <>
                <div style={{ background: '#0f0800', border: '1px solid #331100', padding: '8px 10px', marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6, marginBottom: 6 }}>
                    <div style={{ fontSize: 11, color: '#ffddaa', lineHeight: 1.4, flex: 1 }}>{topItem.title}</div>
                    {(() => { const b = threatBadge(topItem.classification?.level ?? 0); return (<span style={{ fontSize: 8, padding: '2px 5px', background: b.bg, color: b.color, border: `1px solid ${b.border}`, whiteSpace: 'nowrap', flexShrink: 0 }}>{b.label}</span>); })()}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 0', fontSize: 9 }}>
                    <span style={{ color: '#443333' }}>TYPE</span><span style={{ color: '#443333' }}>LOCATION</span>
                    <span style={{ color: '#888' }}>{topItem.source?.toUpperCase() || '—'}</span>
                    <span style={{ color: '#888' }}>{popup.hotspot.location}</span>
                  </div>
                  <div style={{ marginTop: 6, fontSize: 9 }}>
                    <span style={{ color: '#443333' }}>TIME  </span><span style={{ color: '#666' }}>{timeAgo(topItem.pubDate)}</span>
                  </div>
                  {topItem.link && <a href={topItem.link} target="_blank" rel="noreferrer" style={{ display: 'block', marginTop: 8, fontSize: 9, color: '#886644', textDecoration: 'none', letterSpacing: 1 }}>Source →</a>}
                </div>
                {restItems.length > 0 && (
                  <>
                    <div style={{ fontSize: 9, color: '#443333', letterSpacing: 2, marginBottom: 5 }}>RELATED EVENTS</div>
                    {restItems.map((item, i) => {
                      const b = threatBadge(item.classification?.level ?? 0);
                      return (
                        <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', padding: '5px 0', borderBottom: '1px solid #1a0a0a' }}>
                          <span style={{ fontSize: 7, padding: '2px 4px', background: b.bg, color: b.color, border: `1px solid ${b.border}`, whiteSpace: 'nowrap', flexShrink: 0, marginTop: 1 }}>{b.label}</span>
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

    </div>
  );
}
