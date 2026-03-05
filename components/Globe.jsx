'use client';
import { useEffect, useRef, useCallback, useState } from 'react';
import { EMERGENCY_SQUAWKS } from '../lib/threatClassifier';

const CESIUM_VERSION = '1.114';
const CESIUM_CDN = `https://cesium.com/downloads/cesiumjs/releases/${CESIUM_VERSION}/Build/Cesium`;

const HOTSPOTS = [
  { name: 'Ukraine', lat: 49.0, lon: 31.0, r: 800000, desc: 'Active conflict — Russian full-scale invasion since Feb 2022. Ongoing frontline combat across eastern and southern regions.' },
  { name: 'Gaza', lat: 31.5, lon: 34.5, r: 80000, desc: 'Active conflict — Israel-Hamas war. Heavy urban combat, humanitarian crisis, regional escalation risk.' },
  { name: 'Taiwan Strait', lat: 24.0, lon: 120.0, r: 400000, desc: 'High tension — PRC military exercises and incursions into ADIZ. Risk of blockade or invasion scenario.' },
  { name: 'South China Sea', lat: 12.0, lon: 114.0, r: 900000, desc: 'Disputed waters — China vs Philippines, Vietnam, Malaysia. Regular naval confrontations at Spratly Islands.' },
  { name: 'Iran', lat: 32.0, lon: 53.0, r: 700000, desc: 'Regional destabiliser — nuclear programme escalation, proxy networks active across Middle East, direct exchange with Israel.' },
  { name: 'Yemen', lat: 15.5, lon: 48.0, r: 500000, desc: 'Active conflict — Houthi attacks on Red Sea shipping, US/UK airstrikes. Civil war ongoing since 2015.' },
  { name: 'Sudan', lat: 15.0, lon: 30.0, r: 600000, desc: 'Civil war — RSF vs SAF since April 2023. Mass atrocities, one of world\'s worst humanitarian crises.' },
  { name: 'Korea', lat: 38.0, lon: 127.5, r: 300000, desc: 'Flashpoint — DPRK ballistic missile tests, military cooperation with Russia. DMZ incidents ongoing.' },
];

export default function Globe({ flights = [], militaryFlights = [], threats = [], onFlightSelect }) {
  const containerRef = useRef(null);
  const viewerRef = useRef(null);
  const entitiesRef = useRef(new Map());
  const initRef = useRef(false);
  const flightsRef = useRef({ flights: [], militaryFlights: [] });
  const showFlightsRef = useRef(true);
  const [showFlights, setShowFlights] = useState(true);
  const [popup, setPopup] = useState(null);

  // Keep refs current
  useEffect(() => { flightsRef.current = { flights, militaryFlights }; }, [flights, militaryFlights]);
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

  // Init Cesium
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

      // Suppress Ion errors — we're not using Ion
      try { Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.invalid'; } catch {}

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

      // Solid dark background, no atmospheric glow
      viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#050508');
      viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString('#0d0d14');
      viewer.scene.globe.enableLighting = false;
      viewer.scene.globe.showGroundAtmosphere = false;
      viewer.scene.skyAtmosphere.show = false;
      viewer.scene.fog.enabled = false;
      viewer.scene.skyBox.show = true;

      // CARTO Dark Matter — free tiles, no API key, fully opaque dark map
      viewer.imageryLayers.removeAll();
      viewer.imageryLayers.addImageryProvider(
        new Cesium.UrlTemplateImageryProvider({
          url: 'https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
          credit: '',
          minimumLevel: 0,
          maximumLevel: 18,
        })
      );

      // Hotspot threat zones
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

      // Click — handle flights AND hotspots
      const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
      handler.setInputAction((click) => {
        const picked = viewer.scene.pick(click.position);
        if (picked?.id?._flightData) {
          onFlightSelect && onFlightSelect(picked.id._flightData);
          setPopup(null);
        } else if (picked?.id?._hotspotData) {
          const hs = picked.id._hotspotData;
          setPopup({ name: hs.name, desc: hs.desc, x: click.position.x, y: click.position.y });
        } else {
          setPopup(null);
        }
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

      viewerRef.current = viewer;

      // Render any flights that already arrived before Cesium finished loading
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

  // Update flights when props change
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed() || !window.Cesium) return;
    doUpdateFlights(window.Cesium, viewer);
  }, [flights, militaryFlights, doUpdateFlights]);

  // Toggle flight visibility
  useEffect(() => {
    for (const [, entity] of entitiesRef.current) {
      entity.show = showFlights;
    }
  }, [showFlights]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%', background: '#050508' }} />

      {/* Conflict zone popup */}
      {popup && (
        <div style={{
          position: 'absolute',
          left: Math.min(popup.x + 12, window.innerWidth - 300),
          top: Math.min(popup.y + 12, window.innerHeight - 120),
          background: '#0a0a0c',
          border: '1px solid #ff3300',
          padding: '10px 14px',
          fontFamily: '"Share Tech Mono", monospace',
          zIndex: 20,
          width: 270,
          boxShadow: '0 0 20px rgba(255,50,0,0.25)',
        }}>
          <div style={{ color: '#ff4444', fontSize: 12, fontWeight: 'bold', marginBottom: 5, letterSpacing: 1 }}>
            ⚠ {popup.name.toUpperCase()}
          </div>
          <div style={{ color: '#888', fontSize: 10, lineHeight: 1.5, marginBottom: 8 }}>{popup.desc}</div>
          <button onClick={() => setPopup(null)} style={{
            background: 'none', border: '1px solid #333', color: '#555',
            fontFamily: '"Share Tech Mono", monospace', fontSize: 9,
            cursor: 'pointer', padding: '2px 8px', letterSpacing: 1,
          }}>✕ CLOSE</button>
        </div>
      )}

      {/* HUD — top left */}
      <div style={{
        position: 'absolute', top: 8, left: 8, pointerEvents: 'none',
        fontFamily: '"Share Tech Mono", monospace', fontSize: 10, color: '#00ff41', lineHeight: 1.6,
      }}>
        <div>● LIVE TRACKING</div>
        <div style={{ color: '#00b4d8' }}>▲ CIVIL: {flights.length}</div>
        <div style={{ color: '#00ffff' }}>★ MILITARY: {militaryFlights.length}</div>
      </div>

      {/* Flight toggle — top right */}
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

      {/* Legend — bottom right */}
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
