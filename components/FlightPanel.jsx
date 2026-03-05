'use client';
import { useState, useMemo } from 'react';
import { EMERGENCY_SQUAWKS } from '../lib/threatClassifier';

const COLS = [
  { key: 'callsign', label: 'CALLSIGN', w: 90 },
  { key: 'origin_country', label: 'CNTRY', w: 50 },
  { key: 'geo_altitude', label: 'ALT(m)', w: 65 },
  { key: 'velocity', label: 'SPD(m/s)', w: 68 },
  { key: 'squawk', label: 'SQ', w: 45 },
  { key: '_type', label: 'TYPE', w: 45 },
  { key: '_threat', label: 'THR', w: 38 },
];

function squawkColor(sq) {
  if (!sq) return '#004400';
  const s = String(sq);
  if (EMERGENCY_SQUAWKS[s]) return EMERGENCY_SQUAWKS[s].color;
  return '#004400';
}

function altColor(alt) {
  if (alt == null) return '#004400';
  if (alt < 500) return '#ff9500';
  if (alt > 15000) return '#00b4d8';
  return '#00ff41';
}

export default function FlightPanel({ flights = [], militaryFlights = [], selectedFlight, onFlightSelect }) {
  const [sortCol, setSortCol] = useState('_threat');
  const [sortDir, setSortDir] = useState('desc');
  const [filter, setFilter] = useState('all'); // all | civil | military | emergency

  const allFlights = useMemo(() => {
    const civ = flights.map((f) => ({ ...f, _type: 'CIV', _military: false }));
    const mil = militaryFlights.map((f) => ({ ...f, _type: 'MIL', _military: true }));
    return [...civ, ...mil];
  }, [flights, militaryFlights]);

  const filtered = useMemo(() => {
    return allFlights.filter((f) => {
      if (filter === 'civil') return !f._military;
      if (filter === 'military') return f._military;
      if (filter === 'emergency') return EMERGENCY_SQUAWKS[String(f.squawk || '')];
      return true;
    });
  }, [allFlights, filter]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let va = a[sortCol] ?? -1;
      let vb = b[sortCol] ?? -1;
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filtered, sortCol, sortDir]);

  const handleSort = (col) => {
    if (sortCol === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortCol(col); setSortDir('desc'); }
  };

  const emergCount = allFlights.filter((f) => EMERGENCY_SQUAWKS[String(f.squawk || '')]).length;
  const milCount = militaryFlights.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '4px 8px',
        borderBottom: '1px solid #003300', flexShrink: 0, flexWrap: 'wrap',
      }}>
        <span style={{ color: '#00ff41', fontFamily: '"Share Tech Mono", monospace', fontSize: 11, fontWeight: 'bold' }}>
          ◈ FLIGHT TRACKER
        </span>
        <span style={{ color: '#006600', fontSize: 10, fontFamily: '"Share Tech Mono", monospace' }}>
          CIVIL: <span style={{ color: '#00b4d8' }}>{flights.length}</span>
          &nbsp;|&nbsp;MIL: <span style={{ color: '#00ffff' }}>{milCount}</span>
          &nbsp;|&nbsp;EMRG: <span style={{ color: emergCount > 0 ? '#ff0000' : '#004400' }}>{emergCount}</span>
        </span>
        <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
          {['all', 'civil', 'military', 'emergency'].map((f) => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: '2px 6px', background: filter === f ? '#003300' : 'transparent',
              border: `1px solid ${filter === f ? '#00ff41' : '#002200'}`,
              color: filter === f ? '#00ff41' : '#004400', cursor: 'pointer',
              fontFamily: '"Share Tech Mono", monospace', fontSize: 9, textTransform: 'uppercase',
            }}>
              {f === 'emergency' ? '☢ EMRG' : f === 'all' ? '■ ALL' : f === 'civil' ? '▲ CIV' : '★ MIL'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', scrollbarWidth: 'thin' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: 460 }}>
          <colgroup>
            {COLS.map((c) => <col key={c.key} style={{ width: c.w }} />)}
          </colgroup>
          <thead style={{ position: 'sticky', top: 0, background: '#030303', zIndex: 1 }}>
            <tr>
              {COLS.map((c) => (
                <th key={c.key}
                  onClick={() => handleSort(c.key)}
                  style={{
                    padding: '3px 6px', textAlign: 'left', cursor: 'pointer', userSelect: 'none',
                    borderBottom: '1px solid #003300', fontSize: 9,
                    fontFamily: '"Share Tech Mono", monospace', fontWeight: 'normal',
                    color: sortCol === c.key ? '#00ff41' : '#005500',
                    whiteSpace: 'nowrap', letterSpacing: 1,
                  }}
                >
                  {c.label} {sortCol === c.key ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.slice(0, 300).map((f, i) => {
              const sq = String(f.squawk || '');
              const sqInfo = EMERGENCY_SQUAWKS[sq];
              const isSelected = selectedFlight?.icao24 === f.icao24;
              const rowBg = isSelected ? '#001a00' : sqInfo ? 'rgba(255,0,0,0.06)' : f._military ? 'rgba(0,255,255,0.03)' : 'transparent';
              const thrLvl = f._threatLevel ?? 0;

              return (
                <tr key={`${f.icao24}_${i}`}
                  onClick={() => onFlightSelect && onFlightSelect(f)}
                  style={{
                    background: rowBg, cursor: 'pointer',
                    borderBottom: '1px solid #001100',
                  }}
                >
                  <td style={{ padding: '2px 6px', fontSize: 10, fontFamily: '"Share Tech Mono", monospace', color: f._military ? '#00ffff' : '#00cc33', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {f._military ? '★ ' : ''}{(f.callsign || f.icao24 || '—').trim()}
                  </td>
                  <td style={{ padding: '2px 6px', fontSize: 9, fontFamily: '"Share Tech Mono", monospace', color: '#005500' }}>
                    {(f.origin_country || '—').slice(0, 6)}
                  </td>
                  <td style={{ padding: '2px 6px', fontSize: 10, fontFamily: '"Share Tech Mono", monospace', color: altColor(f.geo_altitude ?? f.baro_altitude) }}>
                    {f.geo_altitude != null ? Math.round(f.geo_altitude).toLocaleString() : f.baro_altitude != null ? Math.round(f.baro_altitude).toLocaleString() : '—'}
                  </td>
                  <td style={{ padding: '2px 6px', fontSize: 10, fontFamily: '"Share Tech Mono", monospace', color: '#00aa22' }}>
                    {f.velocity != null ? Math.round(f.velocity) : '—'}
                  </td>
                  <td style={{ padding: '2px 6px', fontSize: 10, fontFamily: '"Share Tech Mono", monospace', color: squawkColor(f.squawk), fontWeight: sqInfo ? 'bold' : 'normal' }}>
                    {sq || '—'}{sqInfo ? ' !' : ''}
                  </td>
                  <td style={{ padding: '2px 6px', fontSize: 9, fontFamily: '"Share Tech Mono", monospace', color: f._military ? '#00ffff' : '#004400' }}>
                    {f._type}
                  </td>
                  <td style={{ padding: '2px 6px' }}>
                    <ThreatDot level={thrLvl} />
                  </td>
                </tr>
              );
            })}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={COLS.length} style={{ padding: 12, color: '#003300', fontFamily: '"Share Tech Mono", monospace', fontSize: 10, textAlign: 'center' }}>
                  ◌ AWAITING DATA...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ThreatDot({ level }) {
  const colors = ['#003300', '#005500', '#888800', '#ff9500', '#ff4400', '#ff0000'];
  const labels = ['—', '▪', '▸', '▲', '⚠', '☢'];
  return (
    <span style={{
      fontSize: 10,
      color: colors[Math.min(level, 5)],
      fontFamily: '"Share Tech Mono", monospace',
    }}>
      {labels[Math.min(level, 5)]}
    </span>
  );
}
