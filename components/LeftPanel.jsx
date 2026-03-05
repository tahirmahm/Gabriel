'use client';

const LAYER_DEFS = [
  { id: 'civilFlights',    icon: '✈', label: 'CIVIL FLIGHTS',     color: '#0288d1' },
  { id: 'militaryFlights', icon: '★', label: 'MILITARY',          color: '#00eeff' },
  { id: 'conflictZones',   icon: '⚠', label: 'CONFLICT ZONES',    color: '#ff3300' },
  { id: 'flightLabels',    icon: '▤', label: 'FLIGHT LABELS',     color: '#00ff41' },
  { id: 'emergencyOnly',   icon: '☢', label: 'EMERG. ONLY',       color: '#ff0000' },
];

const ALT_LEGEND = [
  { color: '#1565c0', label: 'HIGH ALT  >10km' },
  { color: '#0288d1', label: 'MID ALT   5-10km' },
  { color: '#00897b', label: 'LOW ALT   2-5km'  },
  { color: '#e65100', label: 'GROUND    <2km'   },
  { color: '#00eeff', label: 'MILITARY'          },
  { color: '#ff0000', label: 'EMERGENCY'         },
];

export default function LeftPanel({ layers, onLayerToggle, threats, overallLevel, flights, militaryFlights }) {
  const emergencyCount = threats.filter(t => t.type === 'SQUAWK').length;
  const levelLabel = overallLevel >= 4 ? 'CRITICAL' : overallLevel >= 3 ? 'HIGH' : overallLevel >= 2 ? 'ELEVATED' : overallLevel >= 1 ? 'GUARDED' : 'NORMAL';
  const levelColor = overallLevel >= 4 ? '#ff0000' : overallLevel >= 3 ? '#ff6600' : overallLevel >= 2 ? '#ffcc00' : '#00ff41';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* ── GLOBAL SITUATION ── */}
      <div className="panel-header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4, padding: '6px 8px' }}>
        <span style={{ fontSize: 8, color: '#003300', letterSpacing: 2 }}>GLOBAL SITUATION</span>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, width: '100%', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: '"VT323", monospace', fontSize: 22, color: levelColor, letterSpacing: 1 }}>{levelLabel}</span>
          <span style={{ fontSize: 18, color: levelColor, fontFamily: '"VT323", monospace' }}>{overallLevel}/5</span>
        </div>
        <div style={{ height: 2, width: '100%', background: '#0a0a0a' }}>
          <div style={{ height: '100%', width: `${(overallLevel / 5) * 100}%`, background: levelColor, transition: 'width 0.5s, background 0.5s' }} />
        </div>
      </div>

      {/* ── LIVE TRACKING STATS ── */}
      <div style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ fontSize: 7, color: '#003300', letterSpacing: 2, marginBottom: 5 }}>LIVE TRACKING</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
          <Stat label="CIVIL"     value={flights.length}                                  color="#0288d1" />
          <Stat label="MILITARY"  value={militaryFlights.length}                          color="#00eeff" />
          <Stat label="THREATS"   value={threats.filter(t => (t.level ?? 0) >= 2).length} color="#ff9500" />
          <Stat label="EMERGENCY" value={emergencyCount}                                  color="#ff0000" />
        </div>
      </div>

      {/* ── LAYERS ── */}
      <div style={{ flex: 1, overflowY: 'auto', paddingTop: 4 }}>
        <div style={{ padding: '3px 8px 4px', fontSize: 7, color: '#003300', letterSpacing: 2 }}>LAYERS</div>
        {LAYER_DEFS.map((layer) => (
          <label
            key={layer.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px',
              cursor: 'pointer', userSelect: 'none',
              background: layers[layer.id] ? layer.color + '0a' : 'transparent',
              borderLeft: `2px solid ${layers[layer.id] ? layer.color : '#111'}`,
            }}
          >
            <input
              type="checkbox"
              checked={!!layers[layer.id]}
              onChange={() => onLayerToggle(layer.id)}
              style={{ accentColor: layer.color, width: 11, height: 11, flexShrink: 0 }}
            />
            <span style={{ color: layers[layer.id] ? layer.color : '#334', fontSize: 9, letterSpacing: 0.5 }}>
              {layer.icon} {layer.label}
            </span>
          </label>
        ))}
      </div>

      {/* ── ALTITUDE LEGEND ── */}
      <div style={{ padding: '6px 8px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ fontSize: 7, color: '#003300', letterSpacing: 2, marginBottom: 5 }}>ALTITUDE LEGEND</div>
        {ALT_LEGEND.map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: l.color, flexShrink: 0 }} />
            <span style={{ fontSize: 8, color: '#334' }}>{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div style={{ padding: '4px 5px', background: '#030303', border: `1px solid ${color}18` }}>
      <div style={{ fontSize: 7, color: '#003300', marginBottom: 1 }}>{label}</div>
      <div style={{ fontSize: 15, color, fontFamily: '"VT323", monospace' }}>{value}</div>
    </div>
  );
}
