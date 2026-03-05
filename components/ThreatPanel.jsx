'use client';
import { useState, useEffect, useRef } from 'react';
import { THREAT_LEVEL } from '../lib/threatClassifier';

const MAX_LOG_ENTRIES = 80;

export default function ThreatPanel({ threats = [], convergenceAlerts = [], overallLevel = 0, eventLog = [] }) {
  const [activeTab, setActiveTab] = useState('threats'); // threats | convergence | log
  const logRef = useRef(null);

  useEffect(() => {
    if (activeTab === 'log' && logRef.current) {
      logRef.current.scrollTop = 0;
    }
  }, [eventLog, activeTab]);

  const lvlInfo = THREAT_LEVEL[Math.min(overallLevel, 5)];
  const criticalThreats = threats.filter((t) => t.level >= 4);
  const highThreats = threats.filter((t) => t.level === 3);
  const otherThreats = threats.filter((t) => t.level < 3 && t.level > 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* DEFCON indicator */}
      <div style={{
        padding: '8px 10px', borderBottom: '1px solid #003300', flexShrink: 0,
        background: `${lvlInfo.bg}aa`,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: '"VT323", monospace', fontSize: 20, color: lvlInfo.color, letterSpacing: 2 }}>
            THREAT LEVEL
          </span>
          <span style={{
            fontFamily: '"VT323", monospace', fontSize: 24, color: lvlInfo.color,
            animation: overallLevel >= 4 ? 'blink 0.5s step-end infinite' : 'none',
          }}>
            {overallLevel}/5
          </span>
        </div>
        <div style={{
          fontFamily: '"VT323", monospace', fontSize: 28, color: lvlInfo.color,
          letterSpacing: 4, textAlign: 'center', marginTop: 2,
          textShadow: `0 0 20px ${lvlInfo.color}`,
          animation: overallLevel >= 4 ? 'blink 1s step-end infinite' : 'none',
        }}>
          ▮ {lvlInfo.label} ▮
        </div>

        {/* Threat bar */}
        <div style={{ marginTop: 6, height: 4, background: '#001100', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{
            height: '100%', background: lvlInfo.color,
            width: `${(overallLevel / 5) * 100}%`,
            transition: 'width 1s ease', boxShadow: `0 0 8px ${lvlInfo.color}`,
          }} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
          {[0, 1, 2, 3, 4, 5].map((l) => (
            <span key={l} style={{
              fontSize: 8, fontFamily: '"Share Tech Mono", monospace',
              color: l <= overallLevel ? THREAT_LEVEL[l].color : '#002200',
            }}>
              {l}
            </span>
          ))}
        </div>
      </div>

      {/* Quick stats */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1,
        borderBottom: '1px solid #003300', flexShrink: 0,
      }}>
        <StatBox label="CRITICAL" value={criticalThreats.length} color="#ff0000" />
        <StatBox label="HIGH" value={highThreats.length} color="#ff4400" />
        <StatBox label="MODERATE" value={otherThreats.length} color="#ff9500" />
        <StatBox label="CONVERGENCE" value={convergenceAlerts.length} color="#ffff00" />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #003300', flexShrink: 0 }}>
        {[
          { id: 'threats', label: '⚠ THREATS' },
          { id: 'convergence', label: '◎ CONV' },
          { id: 'log', label: '▸ LOG' },
        ].map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            flex: 1, padding: '5px 2px', background: activeTab === tab.id ? '#001a00' : 'transparent',
            border: 'none', borderBottom: activeTab === tab.id ? '2px solid #00ff41' : '2px solid transparent',
            color: activeTab === tab.id ? '#00ff41' : '#004400', cursor: 'pointer',
            fontFamily: '"Share Tech Mono", monospace', fontSize: 9, letterSpacing: 0.5,
          }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'thin' }}>
        {activeTab === 'threats' && (
          <div>
            {threats.length === 0 ? (
              <NominalMessage />
            ) : (
              [...criticalThreats, ...highThreats, ...otherThreats].map((t, i) => (
                <ThreatItem key={`${t.id || i}`} threat={t} />
              ))
            )}
          </div>
        )}

        {activeTab === 'convergence' && (
          <div>
            {convergenceAlerts.length === 0 ? (
              <NominalMessage msg="NO CONVERGENCE DETECTED" />
            ) : (
              convergenceAlerts.map((a, i) => (
                <ConvergenceItem key={i} alert={a} />
              ))
            )}
          </div>
        )}

        {activeTab === 'log' && (
          <div ref={logRef}>
            {eventLog.length === 0 ? (
              <NominalMessage msg="EVENT LOG EMPTY" />
            ) : (
              eventLog.slice(0, MAX_LOG_ENTRIES).map((entry, i) => (
                <LogEntry key={i} entry={entry} />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StatBox({ label, value, color }) {
  return (
    <div style={{
      padding: '5px 8px', background: value > 0 ? `${color}08` : 'transparent',
      textAlign: 'center',
    }}>
      <div style={{ fontFamily: '"VT323", monospace', fontSize: 22, color: value > 0 ? color : '#002200' }}>
        {value}
      </div>
      <div style={{ fontFamily: '"Share Tech Mono", monospace', fontSize: 8, color: '#004400', letterSpacing: 1 }}>
        {label}
      </div>
    </div>
  );
}

function ThreatItem({ threat }) {
  const lvl = Math.min(threat.level, 5);
  const lvlInfo = THREAT_LEVEL[lvl];
  const icons = ['', '▪', '▸', '▲', '⚠', '☢'];

  return (
    <div style={{
      padding: '6px 10px', borderBottom: '1px solid #001500',
      borderLeft: `3px solid ${lvlInfo.color}`,
      background: lvl >= 4 ? `${lvlInfo.color}08` : 'transparent',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
        <span style={{ fontFamily: '"Share Tech Mono", monospace', fontSize: 10, color: lvlInfo.color }}>
          {icons[lvl]} {threat.type || 'EVENT'}
        </span>
        <span style={{ fontFamily: '"Share Tech Mono", monospace', fontSize: 8, color: '#004400', flexShrink: 0 }}>
          {threat.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
      </div>
      <div style={{ fontFamily: '"Share Tech Mono", monospace', fontSize: 11, color: '#00cc33', marginTop: 2, lineHeight: 1.3 }}>
        {threat.msg}
      </div>
      {threat.callsign && (
        <div style={{ fontSize: 9, color: '#00b4d8', fontFamily: '"Share Tech Mono", monospace', marginTop: 2 }}>
          ▸ {threat.callsign} {threat.country ? `[${threat.country}]` : ''} {threat.region ? `— ${threat.region}` : ''}
        </div>
      )}
      {threat.tags && threat.tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 3 }}>
          {threat.tags.slice(0, 4).map((tag) => (
            <span key={tag} style={{
              fontSize: 8, padding: '1px 3px', border: `1px solid ${lvlInfo.color}44`,
              color: lvlInfo.color, fontFamily: '"Share Tech Mono", monospace',
            }}>
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function ConvergenceItem({ alert }) {
  const lvl = Math.min(alert.level || 2, 5);
  const lvlInfo = THREAT_LEVEL[lvl];

  return (
    <div style={{
      padding: '8px 10px', borderBottom: '1px solid #001500',
      background: `${lvlInfo.color}06`, borderLeft: `3px solid ${lvlInfo.color}55`,
    }}>
      <div style={{ fontFamily: '"VT323", monospace', fontSize: 16, color: lvlInfo.color, letterSpacing: 2 }}>
        ◎ {alert.region?.toUpperCase()}
      </div>
      <div style={{ fontFamily: '"Share Tech Mono", monospace', fontSize: 10, color: '#00cc33', marginTop: 2 }}>
        {alert.msg}
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
        <span style={{ fontSize: 9, color: '#00b4d8', fontFamily: '"Share Tech Mono", monospace' }}>
          ▲ FLIGHTS: {alert.flights}
        </span>
        <span style={{ fontSize: 9, color: '#ff9500', fontFamily: '"Share Tech Mono", monospace' }}>
          ◈ NEWS: {alert.news}
        </span>
        <span style={{ fontSize: 9, color: lvlInfo.color, fontFamily: '"Share Tech Mono", monospace' }}>
          BOOST: +{alert.boost}
        </span>
      </div>
    </div>
  );
}

function LogEntry({ entry }) {
  const colors = { FLIGHT: '#00b4d8', NEWS: '#ff9500', MILITARY: '#00ffff', EMERGENCY: '#ff0000', CONVERGENCE: '#ffff00', SYSTEM: '#004400' };
  const color = colors[entry.category] || '#004400';

  return (
    <div style={{ display: 'flex', gap: 6, padding: '3px 8px', borderBottom: '1px solid #001100' }}>
      <span style={{ fontFamily: '"Share Tech Mono", monospace', fontSize: 9, color: '#003300', flexShrink: 0 }}>
        {entry.time}
      </span>
      <span style={{ fontFamily: '"Share Tech Mono", monospace', fontSize: 9, color, flexShrink: 0 }}>
        [{entry.category}]
      </span>
      <span style={{ fontFamily: '"Share Tech Mono", monospace', fontSize: 9, color: '#006622', lineHeight: 1.3 }}>
        {entry.msg}
      </span>
    </div>
  );
}

function NominalMessage({ msg = 'MONITORING... ALL CLEAR' }) {
  return (
    <div style={{ padding: 16, textAlign: 'center' }}>
      <div style={{ fontFamily: '"VT323", monospace', fontSize: 32, color: '#003300' }}>✓</div>
      <div style={{ fontFamily: '"Share Tech Mono", monospace', fontSize: 10, color: '#003300', letterSpacing: 2, marginTop: 4 }}>
        {msg}
      </div>
    </div>
  );
}
