'use client';
import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import {
  classifyFlight,
  classifyNewsItem,
  convergenceScore,
  EMERGENCY_SQUAWKS,
} from '../lib/threatClassifier';
import StatusBar     from './StatusBar';
import LeftPanel     from './LeftPanel';
import RightPanel    from './RightPanel';
import BottomBar     from './BottomBar';
import LiveNewsPanel from './LiveNewsPanel';

const Map2D = lazy(() => import('./Map2D'));

// ── Static conflict zone reference data ─────────────────────────────────────
const ZONE_DETAILS = {
  'Ukraine': {
    since: 'Feb 24, 2022', location: 'Eastern & Southern Ukraine',
    status: 'ACTIVE WAR',
    belligerents: ['RUSSIA', 'UKRAINE', 'NATO'],
    description: 'Full-scale Russian invasion. Active ground combat across Donetsk, Zaporizhzhia and Kherson oblasts. NATO supplying weapons, intelligence and air-defence systems.',
    keywords: ['ukraine', 'kyiv', 'russia', 'zelensky', 'donbas', 'kharkiv', 'russian', 'nato', 'zaporizhzhia'],
    color: '#ff3300',
  },
  'Gaza / Levant': {
    since: 'Oct 7, 2023', location: 'Gaza Strip · Lebanon · West Bank',
    status: 'ACTIVE CONFLICT',
    belligerents: ['ISRAEL', 'IDF', 'HAMAS', 'HEZBOLLAH'],
    description: 'Israeli military operations in Gaza following Hamas cross-border attack. Northern front with Hezbollah in Lebanon intermittently active. Largest displacement since 1948.',
    keywords: ['israel', 'gaza', 'hamas', 'hezbollah', 'idf', 'beirut', 'west bank', 'netanyahu', 'rafah', 'lebanese'],
    color: '#ff6600',
  },
  'Iran': {
    since: 'Jan 2024', location: 'Iran · Gulf Region',
    status: 'ACTIVE HOSTILITIES',
    belligerents: ['IRAN', 'IRGC', 'USA', 'ISRAEL'],
    description: 'US-Israeli air campaign targeting Iranian nuclear, missile and leadership infrastructure. Iran retaliating with ballistic missiles and drone swarms across the region. Major escalation ongoing.',
    keywords: ['iran', 'irgc', 'tehran', 'khamenei', 'iranian', 'nuclear', 'persian gulf', 'strait of hormuz'],
    color: '#ff3300',
  },
  'Yemen': {
    since: 'Mar 2015', location: 'Yemen · Red Sea',
    status: 'ACTIVE CONFLICT',
    belligerents: ['HOUTHIS', 'ANSARALLAH', 'USA', 'UK', 'SAUDI ARABIA'],
    description: 'Houthi forces attacking commercial shipping and warships in the Red Sea in solidarity with Gaza. US-UK conducting sustained airstrikes on Houthi positions. Major shipping rerouting via Cape of Good Hope.',
    keywords: ['yemen', 'houthi', 'red sea', 'shipping', 'aden', 'sanaa', 'ansarallah'],
    color: '#ff6600',
  },
  'Taiwan Strait': {
    since: 'Ongoing', location: 'Taiwan Strait · Western Pacific',
    status: 'ELEVATED TENSION',
    belligerents: ['CHINA', 'PLA', 'TAIWAN', 'USA'],
    description: 'PLA conducts regular air and naval incursions into Taiwan\'s ADIZ. US carrier strike groups maintain forward presence. Cross-strait tensions elevated following recent PLA exercises.',
    keywords: ['taiwan', 'china', 'pla', 'strait', 'taipei', 'chinese military', 'adiz'],
    color: '#ff9900',
  },
  'South China Sea': {
    since: 'Ongoing', location: 'South China Sea',
    status: 'ELEVATED TENSION',
    belligerents: ['CHINA', 'PHILIPPINES', 'VIETNAM', 'USA'],
    description: 'Disputed territorial waters. Frequent confrontations at Second Thomas Shoal between Chinese Coast Guard and Philippine resupply missions. US freedom-of-navigation operations ongoing.',
    keywords: ['south china sea', 'philippines', 'vietnam', 'spratly', 'shoal', 'scarborough', 'philippine'],
    color: '#ff9900',
  },
  'Sudan': {
    since: 'Apr 2023', location: 'Sudan · Sahel',
    status: 'ACTIVE WAR',
    belligerents: ['SAF', 'RSF', 'DARFUR FACTIONS'],
    description: 'Civil war between Sudanese Armed Forces and Rapid Support Forces. Widespread atrocities in Darfur. 8M+ displaced — largest displacement crisis globally. Famine conditions spreading.',
    keywords: ['sudan', 'rsf', 'darfur', 'khartoum', 'sahel', 'mali', 'niger', 'sudanese'],
    color: '#ff9900',
  },
  'Korean Peninsula': {
    since: 'Ongoing', location: 'Korean Peninsula',
    status: 'ELEVATED TENSION',
    belligerents: ['DPRK', 'SOUTH KOREA', 'USA', 'RUSSIA'],
    description: 'North Korea ballistic-missile testing programme active. DPRK troops deployed to Russia supporting Ukraine operations. US-South Korea joint exercises ongoing. Pyongyang rhetoric at elevated levels.',
    keywords: ['korea', 'dprk', 'north korea', 'kim jong', 'pyongyang', 'icbm', 'nuclear test', 'korean'],
    color: '#ff3300',
  },
};

const OPENSKY_POLL_MS = 10000;
const MIL_POLL_MS     = 30000;
const MAX_LOG         = 120;

function nowStr() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function parseOpenSkyState(s) {
  return {
    icao24: s[0], callsign: (s[1] || '').trim(), origin_country: s[2],
    time_position: s[3], last_contact: s[4], longitude: s[5], latitude: s[6],
    baro_altitude: s[7], on_ground: s[8], velocity: s[9], true_track: s[10],
    vertical_rate: s[11], sensors: s[12], geo_altitude: s[13],
    squawk: s[14], spi: s[15], position_source: s[16],
  };
}

export default function Dashboard() {
  const [flights,           setFlights]           = useState([]);
  const [militaryFlights,   setMilitaryFlights]   = useState([]);
  const [threats,           setThreats]           = useState([]);
  const [convergenceAlerts, setConvergenceAlerts] = useState([]);
  const [overallLevel,      setOverallLevel]      = useState(0);
  const [newsItems,         setNewsItems]         = useState([]);
  const [eventLog,          setEventLog]          = useState([]);
  const [selectedFlight,    setSelectedFlight]    = useState(null);
  const [selectedZone,      setSelectedZone]      = useState(null);

  const [layers, setLayers] = useState({
    civilFlights:    true,
    militaryFlights: true,
    conflictZones:   true,
    flightLabels:    false,
    emergencyOnly:   false,
  });

  const isMountedRef = useRef(true);

  const addLog = useCallback((category, msg) => {
    setEventLog(prev => [{ category, msg, time: nowStr() }, ...prev.slice(0, MAX_LOG - 1)]);
  }, []);

  const handleLayerToggle = useCallback(id => {
    setLayers(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const fetchFlights = useCallback(async () => {
    try {
      const res = await fetch('/api/opensky');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!isMountedRef.current) return;

      const states = (data.states || [])
        .filter(s => s[5] != null && s[6] != null)
        .map(parseOpenSkyState);

      const classified = states.map(f => {
        const result = classifyFlight(f);
        f._threatLevel = result.level;
        f._threatScore = result.score;
        f._tags        = result.tags;
        return { raw: f, result };
      });

      const newThreats = classified
        .filter(c => c.result.level >= 2)
        .flatMap(c =>
          c.result.alerts.map(a => ({
            ...a,
            id:       `${c.raw.icao24}_${a.type}`,
            callsign: c.raw.callsign,
            country:  c.raw.origin_country,
            region:   c.result.tags.find(t =>
              ['UKRAINE','GAZA','TAIWAN STRAIT','SOUTH CHINA SEA',
               'IRAN','KOREAN PENINSULA','SYRIA','YEMEN','SUDAN','SAHEL'].includes(t)
            ),
            time: nowStr(),
            tags: c.result.tags,
          }))
        );

      if (!isMountedRef.current) return;
      setFlights(states);

      newThreats.filter(t => t.type === 'SQUAWK').forEach(t => {
        addLog('EMERGENCY', `${t.callsign} — ${t.msg}`);
      });

      updateThreats(classified, newsItems, newThreats);
    } catch (e) {
      addLog('SYSTEM', `OpenSky fetch failed: ${e.message}`);
    }
  }, [newsItems, addLog]); // eslint-disable-line

  const fetchMilitary = useCallback(async () => {
    try {
      const res = await fetch('/api/adsb?type=mil');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!isMountedRef.current) return;

      const ac = (data.ac || []).filter(a => a.latitude != null && a.longitude != null);
      setMilitaryFlights(ac);
      if (ac.length > 0) addLog('MILITARY', `${ac.length} military aircraft tracked`);

      const resEmrg = await fetch('/api/adsb?type=squawks');
      if (resEmrg.ok) {
        const emrgData = await resEmrg.json();
        if (!isMountedRef.current) return;
        (emrgData.ac || []).forEach(a => {
          addLog('EMERGENCY', `SQ7700: ${a.callsign || a.icao24} — ${a.origin_country || '?'}`);
        });
      }
    } catch (e) {
      addLog('SYSTEM', `ADS-B fetch failed: ${e.message}`);
    }
  }, [addLog]);

  const updateThreats = useCallback((classifiedFlights, classifiedNews, flightThreats) => {
    const newsClassified = classifiedNews.map(n => ({
      raw: n,
      result: n.classification || classifyNewsItem(n),
    }));

    const { overallLevel: ol, convergenceAlerts: ca } = convergenceScore(classifiedFlights, newsClassified);

    if (!isMountedRef.current) return;
    setOverallLevel(ol);
    setConvergenceAlerts(ca);
    ca.forEach(a => addLog('CONVERGENCE', a.msg));

    const newsThreats = classifiedNews
      .filter(n => (n.classification?.level ?? 0) >= 2)
      .map(n => ({
        type:     'NEWS',
        level:    n.classification.level,
        msg:      n.title.slice(0, 80),
        callsign: `[${n.source?.toUpperCase()}]`,
        time:     nowStr(),
        tags:     n.classification.tags,
        id:       `news_${n.title.slice(0, 20)}`,
      }));

    setThreats([...flightThreats, ...newsThreats].sort((a, b) => b.level - a.level).slice(0, 50));
  }, [addLog]);

  const handleNewsClassified = useCallback(classified => {
    if (!isMountedRef.current) return;
    setNewsItems(classified);
    classified.filter(n => n.classification.level >= 3).forEach(n => {
      addLog('NEWS', `${n.source?.toUpperCase()}: ${n.title.slice(0, 60)}`);
    });
  }, [addLog]);

  useEffect(() => {
    isMountedRef.current = true;
    addLog('SYSTEM', 'SENTINEL OSINT initialized — monitoring all frequencies');
    fetchFlights();
    fetchMilitary();
    const flightIv = setInterval(fetchFlights, OPENSKY_POLL_MS);
    const milIv    = setInterval(fetchMilitary, MIL_POLL_MS);
    return () => {
      isMountedRef.current = false;
      clearInterval(flightIv);
      clearInterval(milIv);
    };
  }, []); // eslint-disable-line

  useEffect(() => {
    if (newsItems.length === 0) return;
    const cf = flights.map(f => ({ raw: f, result: classifyFlight(f) }));
    updateThreats(cf, newsItems, threats.filter(t => t.type !== 'NEWS'));
  }, [newsItems]); // eslint-disable-line

  const emergencyCount = threats.filter(t => t.level >= 4).length;

  return (
    <div className="dashboard-root">
      <div className="scanlines" />

      {/* ── STATUS BAR ─────────────────────────────────────────────── */}
      <div className="statusbar">
        <StatusBar
          overallLevel={overallLevel}
          flightCount={flights.length}
          militaryCount={militaryFlights.length}
          threatCount={threats.length}
          newsCount={newsItems.length}
          lastUpdate={null}
        />
      </div>

      {/* ── MAIN AREA (left column + right column) ─────────────────── */}
      <div className="main-area">

        {/* ── LEFT COLUMN: map area + live news bar ──────────────── */}
        <div className="left-column">

          {/* Map with layers overlay */}
          <div className="map-area">

            {/* Layers / situation overlay */}
            <div className="layers-overlay">
              <LeftPanel
                layers={layers}
                onLayerToggle={handleLayerToggle}
                threats={threats}
                overallLevel={overallLevel}
                flights={flights}
                militaryFlights={militaryFlights}
              />
            </div>

            {/* 2D map */}
            <Suspense fallback={<MapLoading />}>
              <Map2D
                flights={flights}
                militaryFlights={militaryFlights}
                threats={threats}
                newsItems={newsItems}
                layers={layers}
                onFlightSelect={setSelectedFlight}
                onZoneSelect={z => { setSelectedZone(z); setSelectedFlight(null); }}
              />
            </Suspense>

            {/* Conflict zone detail overlay */}
            {selectedZone && (
              <ZoneOverlay
                zone={selectedZone}
                newsItems={newsItems}
                threats={threats}
                onClose={() => setSelectedZone(null)}
              />
            )}

            {/* Flight detail overlay */}
            {selectedFlight && !selectedZone && (
              <FlightOverlay
                flight={selectedFlight}
                onClose={() => setSelectedFlight(null)}
              />
            )}
          </div>

          {/* Live news bar */}
          <div className="live-news-bar">
            <LiveNewsPanel />
          </div>
        </div>

        {/* ── RIGHT COLUMN ────────────────────────────────────────── */}
        <RightPanel
          threats={threats}
          convergenceAlerts={convergenceAlerts}
          overallLevel={overallLevel}
          eventLog={eventLog}
          onNewsClassified={handleNewsClassified}
        />
      </div>

      {/* ── BOTTOM BAR ─────────────────────────────────────────────── */}
      <div className="bottom-bar">
        <BottomBar
          threats={threats}
          newsItems={newsItems}
          overallLevel={overallLevel}
          flights={flights}
          militaryFlights={militaryFlights}
        />
      </div>

      {emergencyCount > 0 && (
        <div className="emergency-banner">
          ☢ {emergencyCount} EMERGENCY SQUAWK{emergencyCount > 1 ? 'S' : ''} ACTIVE — CHECK THREAT PANEL ☢
        </div>
      )}
    </div>
  );
}

/* ── Conflict zone detail overlay ──────────────────────────────────────────── */
function ZoneOverlay({ zone, newsItems, threats, onClose }) {
  const info = ZONE_DETAILS[zone.name] || {};
  const kw   = info.keywords || [];

  // Related news: filter by zone keywords, sort by threat level
  const related = newsItems
    .filter(n => {
      const txt = `${n.title} ${n.description || ''}`.toLowerCase();
      return kw.some(k => txt.includes(k));
    })
    .sort((a, b) => (b.classification?.level ?? 0) - (a.classification?.level ?? 0))
    .slice(0, 8);

  // Zone threat level from matching threats + news
  const zoneThreats = threats.filter(t =>
    kw.some(k => `${t.msg} ${t.region || ''} ${(t.tags || []).join(' ')}`.toLowerCase().includes(k))
  );
  const maxNewsLevel = related.length ? Math.max(...related.map(n => n.classification?.level ?? 0)) : 0;
  const score = zoneThreats.length * 2 + maxNewsLevel;
  const levelLabel = score >= 8 ? 'CRITICAL' : score >= 5 ? 'HIGH' : score >= 2 ? 'ELEVATED' : 'MONITORED';
  const levelColor = score >= 8 ? '#ff2222' : score >= 5 ? '#ff6600' : score >= 2 ? '#ffcc00' : '#00ff41';

  const bColor = zone.color || '#ff6600';

  return (
    <div style={{
      position: 'absolute',
      top: '50%', left: 'calc(var(--layers-w) + 16px)',
      transform: 'translateY(-50%)',
      zIndex: 60, width: 360,
      maxHeight: 'calc(100% - 24px)',
      display: 'flex', flexDirection: 'column',
      background: '#050505f2',
      border: `1px solid ${bColor}`,
      fontFamily: '"Share Tech Mono", monospace',
      boxShadow: `0 0 24px ${bColor}33, 0 0 6px #000`,
      overflow: 'hidden',
    }}>
      {/* ── Header ── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '8px 12px', background: bColor + '18',
        borderBottom: `1px solid ${bColor}55`, flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#ff3333', animation: 'blink 1s step-end infinite', fontSize: 8 }}>●</span>
          <span style={{ color: bColor, fontSize: 13, letterSpacing: 2, fontWeight: 'bold' }}>
            {zone.name.toUpperCase()}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: 8, padding: '2px 7px',
            color: levelColor, border: `1px solid ${levelColor}`,
            letterSpacing: 1,
          }}>{levelLabel}</span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#446', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}
          >✕</button>
        </div>
      </div>

      {/* ── Info grid ── */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr',
        gap: '6px 12px', padding: '10px 12px 6px',
        borderBottom: `1px solid #001800`, flexShrink: 0,
      }}>
        {info.since && <ZoneField label="SINCE"    value={info.since} color={bColor} />}
        {info.location && <ZoneField label="LOCATION" value={info.location} color={bColor} />}
        {info.status && <ZoneField label="STATUS"   value={info.status} color={levelColor} />}
        <ZoneField label="THREATS"  value={`${zoneThreats.length} active`} color={zoneThreats.length > 2 ? '#ff4444' : '#00cc33'} />
      </div>

      {/* ── Description ── */}
      {info.description && (
        <div style={{
          padding: '8px 12px', fontSize: 9.5, color: '#667',
          lineHeight: 1.55, borderBottom: '1px solid #001800', flexShrink: 0,
        }}>
          {info.description}
        </div>
      )}

      {/* ── Belligerents ── */}
      {info.belligerents?.length > 0 && (
        <div style={{
          padding: '6px 12px', display: 'flex', flexWrap: 'wrap', gap: 5,
          borderBottom: '1px solid #001800', flexShrink: 0,
        }}>
          <span style={{ fontSize: 7, color: '#334', letterSpacing: 1.5, alignSelf: 'center', marginRight: 4 }}>
            BELLIGERENTS
          </span>
          {info.belligerents.map(b => (
            <span key={b} style={{
              fontSize: 8, padding: '2px 6px', letterSpacing: 0.5,
              color: bColor, border: `1px solid ${bColor}44`,
            }}>{b}</span>
          ))}
        </div>
      )}

      {/* ── Related news ── */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        <div style={{ padding: '5px 12px 3px', fontSize: 7, color: '#334', letterSpacing: 2 }}>
          INTELLIGENCE FEED — {related.length} ITEM{related.length !== 1 ? 'S' : ''}
        </div>
        {related.length === 0 ? (
          <div style={{ padding: '8px 12px', fontSize: 9, color: '#334' }}>◌ NO MATCHING INTEL — MONITORING...</div>
        ) : (
          related.map((n, i) => {
            const lvl = n.classification?.level ?? 0;
            const badgeColor = lvl >= 4 ? '#ff2222' : lvl >= 3 ? '#ff6600' : lvl >= 2 ? '#ffcc00' : '#334';
            const badge      = lvl >= 4 ? 'CRIT' : lvl >= 3 ? 'HIGH' : lvl >= 2 ? 'ELEV' : 'INFO';
            return (
              <div key={i} style={{
                display: 'flex', gap: 6, padding: '5px 12px',
                borderBottom: '1px solid #080808', alignItems: 'flex-start',
              }}>
                <span style={{
                  fontSize: 7, padding: '1px 4px', flexShrink: 0, marginTop: 1,
                  color: badgeColor, border: `1px solid ${badgeColor}55`,
                }}>{badge}</span>
                <div>
                  <div style={{ fontSize: 9, color: '#889', lineHeight: 1.4 }}>{n.title}</div>
                  <div style={{ fontSize: 7, color: '#334', marginTop: 2 }}>
                    [{n.source?.toUpperCase()}]
                    {n.pubDate ? ` · ${new Date(n.pubDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function ZoneField({ label, value, color }) {
  return (
    <div>
      <div style={{ fontSize: 7, color: '#334', letterSpacing: 1.5, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 10, color: color || '#00cc33', letterSpacing: 0.5 }}>{value}</div>
    </div>
  );
}

/* ── Loading fallback ───────────────────────────────────────────────────── */
function MapLoading() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100%', background: '#0d1117', gap: 12,
    }}>
      <div style={{ fontFamily: '"VT323", monospace', fontSize: 32, color: '#00cc33', animation: 'blink 1s step-end infinite' }}>
        ◎
      </div>
      <div style={{ fontFamily: '"Share Tech Mono", monospace', fontSize: 12, color: '#004400', letterSpacing: 3 }}>
        INITIALIZING MAP...
      </div>
    </div>
  );
}

/* ── Flight detail overlay (appears over map) ───────────────────────────── */
function FlightOverlay({ flight, onClose }) {
  const sq     = String(flight.squawk || '');
  const sqInfo = EMERGENCY_SQUAWKS[sq];

  return (
    <div style={{
      position: 'absolute', bottom: 12, left: 'calc(var(--layers-w) + 12px)', zIndex: 100,
      background: '#050505ee', border: `1px solid ${sqInfo ? '#ff0000' : '#003300'}`,
      padding: '10px 14px', maxWidth: 260,
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
        <InfoRow label="ICAO"    value={flight.icao24} />
        <InfoRow label="COUNTRY" value={flight.origin_country} />
        <InfoRow label="ALT"     value={flight.geo_altitude != null ? `${Math.round(flight.geo_altitude)}m` : '—'} />
        <InfoRow label="SPEED"   value={flight.velocity   != null ? `${Math.round(flight.velocity)}m/s`    : '—'} />
        <InfoRow label="HEADING" value={flight.true_track  != null ? `${Math.round(flight.true_track)}°`   : '—'} />
        <InfoRow label="SQUAWK"  value={sq || '—'} color={sqInfo?.color} />
        <InfoRow label="LAT"     value={flight.latitude?.toFixed(3)} />
        <InfoRow label="LON"     value={flight.longitude?.toFixed(3)} />
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
      <span style={{ fontSize: 8,  color: '#004400' }}>{label}:</span>
      <span style={{ fontSize: 10, color: color || '#00cc33' }}>{value || '—'}</span>
    </>
  );
}
