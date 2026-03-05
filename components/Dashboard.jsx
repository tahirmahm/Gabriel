'use client';
import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import {
  classifyFlight,
  classifyNewsItem,
  convergenceScore,
  EMERGENCY_SQUAWKS,
} from '../lib/threatClassifier';
import FlightPanel from './FlightPanel';
import ThreatPanel from './ThreatPanel';
import NewsPanel from './NewsPanel';
import StatusBar from './StatusBar';

// Globe is huge — lazy load to avoid SSR issues
const Globe = lazy(() => import('./Globe'));

const OPENSKY_POLL_MS = 15000;
const MIL_POLL_MS = 30000;
const MAX_LOG = 120;

function nowStr() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function parseOpenSkyState(s) {
  return {
    icao24: s[0],
    callsign: (s[1] || '').trim(),
    origin_country: s[2],
    time_position: s[3],
    last_contact: s[4],
    longitude: s[5],
    latitude: s[6],
    baro_altitude: s[7],
    on_ground: s[8],
    velocity: s[9],
    true_track: s[10],
    vertical_rate: s[11],
    sensors: s[12],
    geo_altitude: s[13],
    squawk: s[14],
    spi: s[15],
    position_source: s[16],
  };
}

export default function Dashboard() {
  const [flights, setFlights] = useState([]);
  const [militaryFlights, setMilitaryFlights] = useState([]);
  const [threats, setThreats] = useState([]);
  const [convergenceAlerts, setConvergenceAlerts] = useState([]);
  const [overallLevel, setOverallLevel] = useState(0);
  const [newsItems, setNewsItems] = useState([]);
  const [eventLog, setEventLog] = useState([]);
  const [selectedFlight, setSelectedFlight] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [layout, setLayout] = useState('default'); // default | globe-focus
  const isMountedRef = useRef(true);

  const addLog = useCallback((category, msg) => {
    setEventLog((prev) => [
      { category, msg, time: nowStr() },
      ...prev.slice(0, MAX_LOG - 1),
    ]);
  }, []);

  // ─── Fetch civil flights ────────────────────────────────────────────────────
  const fetchFlights = useCallback(async () => {
    try {
      const res = await fetch('/api/opensky');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!isMountedRef.current) return;

      const states = (data.states || [])
        .filter((s) => s[5] != null && s[6] != null)
        .map(parseOpenSkyState);

      // Classify each flight
      const classified = states.map((f) => {
        const result = classifyFlight(f);
        f._threatLevel = result.level;
        f._threatScore = result.score;
        f._tags = result.tags;
        return { raw: f, result };
      });

      const newThreats = classified
        .filter((c) => c.result.level >= 2)
        .flatMap((c) =>
          c.result.alerts.map((a) => ({
            ...a,
            id: `${c.raw.icao24}_${a.type}`,
            callsign: c.raw.callsign,
            country: c.raw.origin_country,
            region: c.result.tags.find((t) =>
              ['UKRAINE', 'GAZA', 'TAIWAN STRAIT', 'SOUTH CHINA SEA', 'IRAN', 'KOREAN PENINSULA', 'SYRIA', 'YEMEN', 'SUDAN', 'SAHEL'].includes(t)
            ),
            time: nowStr(),
            tags: c.result.tags,
          }))
        );

      if (!isMountedRef.current) return;
      setFlights(states);
      setLastUpdate(nowStr());

      // Emergency squawk alerts → log
      newThreats.filter((t) => t.type === 'SQUAWK').forEach((t) => {
        addLog('EMERGENCY', `${t.callsign} — ${t.msg}`);
      });

      // Update global threat analysis
      updateThreats(classified, newsItems, newThreats);
    } catch (e) {
      addLog('SYSTEM', `OpenSky fetch failed: ${e.message}`);
    }
  }, [newsItems, addLog]); // eslint-disable-line

  // ─── Fetch military/special flights ────────────────────────────────────────
  const fetchMilitary = useCallback(async () => {
    try {
      const res = await fetch('/api/adsb?type=mil');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!isMountedRef.current) return;

      const ac = (data.ac || []).filter((a) => a.latitude != null && a.longitude != null);
      setMilitaryFlights(ac);

      if (ac.length > 0) {
        addLog('MILITARY', `${ac.length} military aircraft tracked`);
      }

      // Also fetch squawk 7700 emergencies
      const resEmrg = await fetch('/api/adsb?type=squawks');
      if (resEmrg.ok) {
        const emrgData = await resEmrg.json();
        if (!isMountedRef.current) return;
        (emrgData.ac || []).forEach((a) => {
          addLog('EMERGENCY', `SQ7700: ${a.callsign || a.icao24} — ${a.origin_country || '?'}`);
        });
      }
    } catch (e) {
      addLog('SYSTEM', `ADS-B fetch failed: ${e.message}`);
    }
  }, [addLog]);

  // ─── Convergence & threat update ───────────────────────────────────────────
  const updateThreats = useCallback((classifiedFlights, classifiedNews, flightThreats) => {
    const newsClassified = classifiedNews.map((n) => ({
      raw: n,
      result: n.classification || classifyNewsItem(n),
    }));

    const { overallLevel: ol, convergenceAlerts: ca } = convergenceScore(classifiedFlights, newsClassified);

    if (!isMountedRef.current) return;
    setOverallLevel(ol);
    setConvergenceAlerts(ca);

    ca.forEach((a) => {
      addLog('CONVERGENCE', a.msg);
    });

    // Collect all threats (flights + news)
    const newsThreats = classifiedNews
      .filter((n) => (n.classification?.level ?? 0) >= 2)
      .map((n) => ({
        type: 'NEWS',
        level: n.classification.level,
        msg: n.title.slice(0, 80),
        callsign: `[${n.source?.toUpperCase()}]`,
        time: nowStr(),
        tags: n.classification.tags,
        id: `news_${n.title.slice(0, 20)}`,
      }));

    setThreats([
      ...flightThreats,
      ...newsThreats,
    ].sort((a, b) => b.level - a.level).slice(0, 50));
  }, [addLog]);

  // ─── News classified callback ───────────────────────────────────────────────
  const handleNewsClassified = useCallback((classified) => {
    if (!isMountedRef.current) return;
    setNewsItems(classified);
    classified.filter((n) => n.classification.level >= 3).forEach((n) => {
      addLog('NEWS', `${n.source?.toUpperCase()}: ${n.title.slice(0, 60)}`);
    });
  }, [addLog]);

  // ─── Polling ────────────────────────────────────────────────────────────────
  useEffect(() => {
    isMountedRef.current = true;
    addLog('SYSTEM', 'SENTINEL OSINT initialized — monitoring all frequencies');

    fetchFlights();
    fetchMilitary();

    const flightIv = setInterval(fetchFlights, OPENSKY_POLL_MS);
    const milIv = setInterval(fetchMilitary, MIL_POLL_MS);

    return () => {
      isMountedRef.current = false;
      clearInterval(flightIv);
      clearInterval(milIv);
    };
  }, []); // eslint-disable-line

  // Re-run convergence when news updates
  useEffect(() => {
    if (newsItems.length === 0) return;
    const cf = flights.map((f) => ({ raw: f, result: classifyFlight(f) }));
    updateThreats(cf, newsItems, threats.filter((t) => t.type !== 'NEWS'));
  }, [newsItems]); // eslint-disable-line

  const emergencyCount = threats.filter((t) => t.level >= 4).length;

  return (
    <div className="dashboard-root">
      {/* Scan line overlay */}
      <div className="scanlines" />

      {/* ── Top status bar ─────────────────────────────────────────── */}
      <div className="statusbar">
        <StatusBar
          overallLevel={overallLevel}
          flightCount={flights.length}
          militaryCount={militaryFlights.length}
          threatCount={threats.length}
          newsCount={newsItems.length}
          lastUpdate={lastUpdate}
        />
      </div>

      {/* ── Main content ───────────────────────────────────────────── */}
      <div className={`main-grid ${layout === 'globe-focus' ? 'globe-focus' : ''}`}>

        {/* LEFT — Threat panel */}
        <div className="panel panel-left">
          <ThreatPanel
            threats={threats}
            convergenceAlerts={convergenceAlerts}
            overallLevel={overallLevel}
            eventLog={eventLog}
          />
        </div>

        {/* CENTER — Globe */}
        <div className="panel panel-globe" onClick={() => {}}>
          <div style={{ position: 'absolute', inset: 0 }}>
            <Suspense fallback={<GlobeLoading />}>
              <Globe
                flights={flights}
                militaryFlights={militaryFlights}
                threats={threats}
                onFlightSelect={setSelectedFlight}
              />
            </Suspense>
          </div>

          {/* Globe expand toggle */}
          <button
            onClick={() => setLayout((l) => l === 'default' ? 'globe-focus' : 'default')}
            className="globe-toggle"
          >
            {layout === 'globe-focus' ? '⊡ NORMAL' : '⊞ EXPAND'}
          </button>

          {/* Selected flight overlay */}
          {selectedFlight && (
            <FlightOverlay flight={selectedFlight} onClose={() => setSelectedFlight(null)} />
          )}
        </div>

        {/* RIGHT — News panel */}
        <div className="panel panel-right">
          <NewsPanel onNewsClassified={handleNewsClassified} />
        </div>
      </div>

      {/* ── Bottom — Flight table ──────────────────────────────────── */}
      <div className="panel panel-bottom">
        <FlightPanel
          flights={flights}
          militaryFlights={militaryFlights}
          selectedFlight={selectedFlight}
          onFlightSelect={setSelectedFlight}
        />
      </div>

      {/* Emergency alert banner */}
      {emergencyCount > 0 && (
        <div className="emergency-banner">
          ☢ {emergencyCount} EMERGENCY SQUAWK{emergencyCount > 1 ? 'S' : ''} ACTIVE — CHECK THREAT PANEL ☢
        </div>
      )}
    </div>
  );
}

function GlobeLoading() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100%', background: '#050510', gap: 12,
    }}>
      <div style={{ fontFamily: '"VT323", monospace', fontSize: 32, color: '#00ff41', animation: 'blink 1s step-end infinite' }}>
        ◎
      </div>
      <div style={{ fontFamily: '"Share Tech Mono", monospace', fontSize: 12, color: '#004400', letterSpacing: 3 }}>
        INITIALIZING GLOBE...
      </div>
      <div style={{ fontFamily: '"Share Tech Mono", monospace', fontSize: 9, color: '#003300' }}>
        LOADING CESIUMJS ENGINE
      </div>
    </div>
  );
}

function FlightOverlay({ flight, onClose }) {
  const sq = String(flight.squawk || '');
  const sqInfo = EMERGENCY_SQUAWKS[sq];

  return (
    <div style={{
      position: 'absolute', bottom: 48, left: 12, zIndex: 100,
      background: '#050505ee', border: `1px solid ${sqInfo ? '#ff0000' : '#003300'}`,
      padding: '10px 14px', maxWidth: 280,
      fontFamily: '"Share Tech Mono", monospace',
      boxShadow: sqInfo ? '0 0 20px rgba(255,0,0,0.3)' : '0 0 10px rgba(0,255,65,0.1)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ color: '#00ff41', fontSize: 12, fontWeight: 'bold' }}>
          {flight._military ? '★ ' : '▲ '}{(flight.callsign || flight.icao24 || 'UNKNOWN').trim()}
        </span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#004400', cursor: 'pointer', fontSize: 14 }}>✕</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 12px' }}>
        <InfoRow label="ICAO" value={flight.icao24} />
        <InfoRow label="COUNTRY" value={flight.origin_country} />
        <InfoRow label="ALT" value={flight.geo_altitude != null ? `${Math.round(flight.geo_altitude)}m` : '—'} />
        <InfoRow label="SPEED" value={flight.velocity != null ? `${Math.round(flight.velocity)}m/s` : '—'} />
        <InfoRow label="HEADING" value={flight.true_track != null ? `${Math.round(flight.true_track)}°` : '—'} />
        <InfoRow label="SQUAWK" value={sq || '—'} color={sqInfo?.color} />
        <InfoRow label="LAT" value={flight.latitude?.toFixed(3)} />
        <InfoRow label="LON" value={flight.longitude?.toFixed(3)} />
      </div>
      {sqInfo && (
        <div style={{ marginTop: 6, padding: '4px 8px', background: 'rgba(255,0,0,0.15)', border: '1px solid #ff000055', color: '#ff4444', fontSize: 11, letterSpacing: 1 }}>
          ⚠ {sqInfo.label}
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value, color }) {
  return (
    <>
      <span style={{ fontSize: 8, color: '#004400' }}>{label}:</span>
      <span style={{ fontSize: 10, color: color || '#00cc33' }}>{value || '—'}</span>
    </>
  );
}
