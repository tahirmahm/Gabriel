'use client';
import { useMemo } from 'react';

// Regional instability scoring — keywords matched against threats + news
const REGIONS = [
  { name: 'Ukraine',     color: '#4488ff', keywords: ['ukraine', 'kyiv', 'russia', 'zelensky', 'donbas'] },
  { name: 'Middle East', color: '#ff6600', keywords: ['israel', 'gaza', 'iran', 'lebanon', 'houthi', 'tehran', 'beirut'] },
  { name: 'Taiwan/SCS',  color: '#00ccff', keywords: ['taiwan', 'china', 'south china sea', 'pla', 'strait'] },
  { name: 'Korea',       color: '#cc44cc', keywords: ['korea', 'dprk', 'pyongyang', 'kim jong', 'missile'] },
  { name: 'Sudan/Africa',color: '#ff9900', keywords: ['sudan', 'rsf', 'sahel', 'mali', 'niger', 'darfur'] },
  { name: 'Yemen',       color: '#ff4444', keywords: ['yemen', 'houthi', 'red sea', 'shipping', 'aden'] },
];

function regionScore(threats, newsItems, region) {
  let s = 0;
  for (const t of threats) {
    const txt = `${t.msg || ''} ${t.region || ''} ${(t.tags || []).join(' ')}`.toLowerCase();
    if (region.keywords.some(k => txt.includes(k))) s += (t.level || 1) * 6;
  }
  for (const n of newsItems) {
    const txt = `${n.title || ''} ${n.description || ''}`.toLowerCase();
    if (region.keywords.some(k => txt.includes(k))) s += (n.classification?.level || 0) * 3;
  }
  return Math.min(100, Math.round(s));
}

// SVG arc gauge for overall risk level
function RiskGauge({ level }) {
  const pct = Math.min(1, level / 5);
  const label = level >= 4 ? 'CRITICAL' : level >= 3 ? 'HIGH' : level >= 2 ? 'ELEVATED' : level >= 1 ? 'GUARDED' : 'NORMAL';
  const color = level >= 4 ? '#ff2222' : level >= 3 ? '#ff6600' : level >= 2 ? '#ffcc00' : '#00ff41';

  // Arc params: 240° sweep starting from bottom-left
  const R = 48, CX = 60, CY = 62;
  const startDeg = -210, sweep = 240;
  const toDeg = (deg) => ({ x: CX + R * Math.cos((deg - 90) * Math.PI / 180), y: CY + R * Math.sin((deg - 90) * Math.PI / 180) });
  const s = toDeg(startDeg);
  const eTrack = toDeg(startDeg + sweep);
  const eFill = toDeg(startDeg + pct * sweep);
  const lArcFill = pct * sweep > 180 ? 1 : 0;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '100%', padding: '4px 0',
    }}>
      <div style={{ fontSize: 7, color: '#003300', letterSpacing: 2, marginBottom: 2 }}>STRATEGIC RISK</div>
      <svg width="120" height="84" style={{ overflow: 'visible' }}>
        {/* Track */}
        <path d={`M${s.x},${s.y} A${R},${R} 0 1 1 ${eTrack.x},${eTrack.y}`}
          fill="none" stroke="#111" strokeWidth="7" strokeLinecap="round" />
        {/* Fill */}
        {pct > 0.01 && (
          <path d={`M${s.x},${s.y} A${R},${R} 0 ${lArcFill} 1 ${eFill.x},${eFill.y}`}
            fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" />
        )}
        {/* Score */}
        <text x={CX} y={CY - 4} textAnchor="middle"
          fontFamily="VT323, monospace" fontSize="26" fill={color}>
          {Math.round(pct * 100)}
        </text>
        {/* Label */}
        <text x={CX} y={CY + 12} textAnchor="middle"
          fontFamily="Share Tech Mono, monospace" fontSize="7" fill={color} letterSpacing="1">
          {label}
        </text>
      </svg>
    </div>
  );
}

export default function BottomBar({ threats, newsItems, overallLevel, flights, militaryFlights }) {
  const regions = useMemo(
    () => REGIONS.map(r => ({ ...r, score: regionScore(threats, newsItems, r) })),
    [threats, newsItems]
  );

  const topNews = useMemo(() =>
    [...newsItems]
      .filter(n => (n.classification?.level ?? 0) >= 2)
      .sort((a, b) => (b.classification?.level ?? 0) - (a.classification?.level ?? 0))
      .slice(0, 10),
    [newsItems]
  );

  const emergency = threats.filter(t => t.type === 'SQUAWK');

  return (
    <>
      {/* ── COLUMN 1: COUNTRY INSTABILITY ── */}
      <div className="bottom-cell" style={{ padding: '6px 9px' }}>
        <div style={{ fontSize: 7, color: '#003300', letterSpacing: 2, marginBottom: 6 }}>COUNTRY INSTABILITY</div>
        {regions.map(r => (
          <div key={r.name} style={{ marginBottom: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 1 }}>
              <span style={{ fontSize: 8, color: r.color }}>{r.name}</span>
              <span style={{ fontSize: 8, color: '#334' }}>{r.score}</span>
            </div>
            <div style={{ height: 3, background: '#0d0d0d' }}>
              <div style={{ height: '100%', width: `${r.score}%`, background: r.color, transition: 'width 0.6s' }} />
            </div>
          </div>
        ))}
      </div>

      {/* ── COLUMN 2: INTEL FEED ── */}
      <div className="bottom-cell" style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="panel-header">
          <span>◈ INTEL FEED</span>
          <span style={{ color: '#ff3333', fontSize: 7, animation: 'blink 1s step-end infinite' }}>● LIVE</span>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {topNews.length === 0
            ? <div style={{ padding: 8, fontSize: 9, color: '#003300' }}>◌ MONITORING FEEDS...</div>
            : topNews.map((item, i) => {
              const lvl = item.classification?.level ?? 0;
              const badge = lvl >= 4 ? { t: 'CRIT', c: '#ff2222' } : lvl >= 3 ? { t: 'HIGH', c: '#ff6600' } : { t: 'ELEV', c: '#ffcc00' };
              return (
                <div key={i} style={{ display: 'flex', gap: 5, padding: '3px 7px', borderBottom: '1px solid #080808', alignItems: 'flex-start' }}>
                  <span style={{
                    fontSize: 7, padding: '1px 3px', color: badge.c,
                    border: `1px solid ${badge.c}44`, whiteSpace: 'nowrap', flexShrink: 0, marginTop: 2,
                  }}>{badge.t}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 9, color: '#778', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.title}
                    </div>
                    <div style={{ fontSize: 7, color: '#334' }}>[{item.source?.toUpperCase()}]</div>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* ── COLUMN 3: STRATEGIC RISK GAUGE ── */}
      <div className="bottom-cell">
        <RiskGauge level={overallLevel} />
      </div>

      {/* ── COLUMN 4: FLIGHT OVERVIEW ── */}
      <div className="bottom-cell" style={{ padding: '6px 9px' }}>
        <div style={{ fontSize: 7, color: '#003300', letterSpacing: 2, marginBottom: 5 }}>FLIGHT OVERVIEW</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 8 }}>
          <MiniStat label="CIVIL"    value={flights.length}                               color="#0288d1" />
          <MiniStat label="MILITARY" value={militaryFlights.length}                       color="#00eeff" />
          <MiniStat label="THREATS"  value={threats.filter(t => (t.level ?? 0) >= 2).length} color="#ff9500" />
          <MiniStat label="EMERG"    value={emergency.length}                             color="#ff2222" />
        </div>
        {/* Active threat list */}
        <div style={{ fontSize: 7, color: '#003300', letterSpacing: 2, marginBottom: 3 }}>ACTIVE ALERTS</div>
        <div style={{ overflowY: 'auto', maxHeight: 90 }}>
          {threats.slice(0, 6).map((t, i) => (
            <div key={i} style={{ display: 'flex', gap: 5, padding: '2px 0', borderBottom: '1px solid #080808', alignItems: 'center' }}>
              <span style={{ color: (t.level ?? 0) >= 4 ? '#ff2222' : (t.level ?? 0) >= 3 ? '#ff6600' : '#ffcc00', fontSize: 8 }}>▲</span>
              <span style={{ fontSize: 8, color: '#556', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {t.callsign || t.type} — {(t.msg || '').slice(0, 32)}
              </span>
            </div>
          ))}
          {threats.length === 0 && <div style={{ fontSize: 8, color: '#003300' }}>NO ACTIVE THREATS</div>}
        </div>
      </div>
    </>
  );
}

function MiniStat({ label, value, color }) {
  return (
    <div style={{ padding: '3px 5px', background: '#030303', border: `1px solid ${color}18` }}>
      <div style={{ fontSize: 7, color: '#003300', marginBottom: 1 }}>{label}</div>
      <div style={{ fontSize: 14, color, fontFamily: '"VT323", monospace' }}>{value}</div>
    </div>
  );
}
