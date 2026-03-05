'use client';
import { useEffect, useRef, useCallback } from 'react';
import { EMERGENCY_SQUAWKS } from '../lib/threatClassifier';

const CESIUM_VERSION = '1.114';
const CESIUM_CDN = `https://cesium.com/downloads/cesiumjs/releases/${CESIUM_VERSION}/Build/Cesium`;

export default function Globe({ flights = [], militaryFlights = [], threats = [], onFlightSelect }) {
  const containerRef = useRef(null);
  const viewerRef = useRef(null);
  const entitiesRef = useRef(new Map()); // icao24 -> entity
  const initRef = useRef(false);

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
    return Cesium.Color.fromCssColorString('#00ff41').withAlpha(0.8);
  }, []);

  useEffect(() => {
    if (initRef.current || !containerRef.current) return;

    // Inject Cesium CSS
    if (!document.getElementById('cesium-css')) {
      const link = document.createElement('link');
      link.id = 'cesium-css';
      link.rel = 'stylesheet';
      link.href = `${CESIUM_CDN}/Widgets/widgets.css`;
      document.head.appendChild(link);
    }

    // Inject Cesium JS
    if (!document.getElementById('cesium-js')) {
      const script = document.createElement('script');
      script.id = 'cesium-js';
      script.src = `${CESIUM_CDN}/Cesium.js`;
      script.async = true;
      document.head.appendChild(script);
    }

    const tryInit = () => {
      if (typeof window === 'undefined' || !window.Cesium) {
        setTimeout(tryInit, 200);
        return;
      }
      if (initRef.current) return;
      initRef.current = true;

      const Cesium = window.Cesium;

      // Ion token (optional)
      const ionToken = process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN;
      if (ionToken) Cesium.Ion.defaultAccessToken = ionToken;

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
        creditContainer: document.createElement('div'), // hide cesium credit
        terrainProvider: ionToken
          ? Cesium.createWorldTerrain({ requestWaterMask: false, requestVertexNormals: false })
          : new Cesium.EllipsoidTerrainProvider(),
      });

      // Dark globe style
      viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#050510');
      viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString('#050510');
      viewer.scene.globe.enableLighting = true;
      viewer.scene.skyBox.show = true;
      viewer.scene.skyAtmosphere.show = true;

      // Night-side imagery
      viewer.imageryLayers.removeAll();
      viewer.imageryLayers.addImageryProvider(
        new Cesium.IonImageryProvider({ assetId: 3845 }) // Earth at Night
      ).catch(() => {
        // Fallback to OSM if Ion not available
        viewer.imageryLayers.addImageryProvider(
          new Cesium.OpenStreetMapImageryProvider({
            url: 'https://a.tile.openstreetmap.org/',
            credit: '',
          })
        );
      });

      // Try Google 3D Photorealistic Tiles
      const googleKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      if (googleKey && Cesium.createGooglePhotorealistic3DTileset) {
        Cesium.createGooglePhotorealistic3DTileset({ key: googleKey })
          .then((tileset) => {
            viewer.scene.primitives.add(tileset);
            viewer.scene.globe.show = false; // hide globe when using 3D tiles
          })
          .catch(() => {});
      }

      // Add hotspot threat zone cylinders
      const hotspots = [
        { name: 'Ukraine', lat: 49.0, lon: 31.0, r: 800000 },
        { name: 'Gaza', lat: 31.5, lon: 34.5, r: 80000 },
        { name: 'Taiwan Strait', lat: 24.0, lon: 120.0, r: 400000 },
        { name: 'South China Sea', lat: 12.0, lon: 114.0, r: 900000 },
        { name: 'Iran', lat: 32.0, lon: 53.0, r: 700000 },
      ];
      for (const hs of hotspots) {
        viewer.entities.add({
          name: hs.name,
          position: Cesium.Cartesian3.fromDegrees(hs.lon, hs.lat, 0),
          ellipse: {
            semiMinorAxis: hs.r,
            semiMajorAxis: hs.r,
            height: 0,
            material: Cesium.Color.RED.withAlpha(0.08),
            outline: true,
            outlineColor: Cesium.Color.RED.withAlpha(0.4),
            outlineWidth: 1,
          },
          label: {
            text: hs.name,
            font: '11px "Share Tech Mono", monospace',
            fillColor: Cesium.Color.RED.withAlpha(0.7),
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 1,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            pixelOffset: new Cesium.Cartesian2(0, -14),
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
        });
      }

      // Set initial camera
      viewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(20.0, 30.0, 18000000),
        orientation: { heading: 0, pitch: -Cesium.Math.PI_OVER_TWO, roll: 0 },
      });

      // Click handler
      const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
      handler.setInputAction((click) => {
        const picked = viewer.scene.pick(click.position);
        if (picked && picked.id && picked.id._flightData) {
          onFlightSelect && onFlightSelect(picked.id._flightData);
        }
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

      viewerRef.current = viewer;
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

  // Update flight entities
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed() || typeof window === 'undefined' || !window.Cesium) return;
    const Cesium = window.Cesium;

    const allFlights = [
      ...flights.map((f) => ({ ...f, _military: false })),
      ...militaryFlights.map((f) => ({ ...f, _military: true })),
    ];

    const seen = new Set();

    for (const flight of allFlights) {
      const id = flight.icao24 || flight.callsign;
      if (!id || flight.latitude == null || flight.longitude == null) continue;
      seen.add(id);

      const pos = Cesium.Cartesian3.fromDegrees(
        flight.longitude,
        flight.latitude,
        Math.max(0, (flight.geo_altitude ?? flight.baro_altitude ?? 1000))
      );
      const color = getFlightColor(flight, Cesium);
      const heading = Cesium.Math.toRadians(flight.true_track || 0);
      const hpr = new Cesium.HeadingPitchRoll(heading, 0, 0);
      const orientation = Cesium.Transforms.headingPitchRollQuaternion(pos, hpr);

      if (entitiesRef.current.has(id)) {
        const e = entitiesRef.current.get(id);
        e.position = pos;
        e.orientation = orientation;
        if (e.point) e.point.color = color;
      } else {
        const e = viewer.entities.add({
          id: `flight_${id}`,
          position: pos,
          orientation,
          point: {
            pixelSize: flight._military ? 6 : 4,
            color,
            outlineColor: Cesium.Color.BLACK,
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

    // Remove stale entities
    for (const [id, entity] of entitiesRef.current) {
      if (!seen.has(id)) {
        viewer.entities.remove(entity);
        entitiesRef.current.delete(id);
      }
    }
  }, [flights, militaryFlights, getFlightColor]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%', background: '#050510' }} />
      {/* HUD overlay */}
      <div style={{
        position: 'absolute', top: 8, left: 8, pointerEvents: 'none',
        fontFamily: '"Share Tech Mono", monospace', fontSize: 10, color: '#00ff41', opacity: 0.7,
      }}>
        <div>● LIVE TRACKING</div>
        <div style={{ color: '#00b4d8' }}>▲ CIVIL: {flights.length}</div>
        <div style={{ color: '#00ffff' }}>★ MILITARY: {militaryFlights.length}</div>
      </div>
      <div style={{
        position: 'absolute', bottom: 8, right: 8, pointerEvents: 'none',
        fontFamily: '"Share Tech Mono", monospace', fontSize: 9,
        color: 'rgba(0,255,65,0.4)',
      }}>
        <span style={{ color: '#00b4d8' }}>● </span>CIVIL &nbsp;
        <span style={{ color: '#00ffff' }}>★ </span>MIL &nbsp;
        <span style={{ color: '#ff0000' }}>● </span>EMRG &nbsp;
        <span style={{ color: '#ff4400', border: '1px solid #ff440055', padding: '0 4px' }}>ZONE</span> HOTSPOT
      </div>
    </div>
  );
}
