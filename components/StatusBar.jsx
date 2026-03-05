'use client';
import { useState, useEffect } from 'react';
import { THREAT_LEVEL } from '../lib/threatClassifier';

export default function StatusBar({ overallLevel = 0, flightCount = 0, militaryCount = 0, threatCount = 0, newsCount = 0, lastUpdate = null }) {
  const [utcTime, setUtcTime] = useState('');
  const [uptime, setUptime] = useState(0);
  const [startTime] = useState(Date.now());
  const [blink, setBlink] = useState(true);

  useEffect(() => {
    const iv = setInterval(() => {
      const now = new Date();
      setUtcTime(
        now.toUTCString().replace('GMT', 'UTC').split(' ').slice(1).join(' ')
      );
      setUptime(Math.floor((Date.now() - startTime) / 1000));
      setBlink((b) => !b);
    }, 1000);
    return () => clearInterval(iv);
  }, [startTime]);

  const lvlInfo = THREAT_LEVEL[Math.min(overallLevel, 5)];

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 0,
      padding: '0 12px', height: '100%', flexWrap: 'nowrap', overflow: 'hidden',
    }}>
      {/* Logo */}
      <div style={{ flexShrink: 0, marginRight: 16 }}>
        <span style={{
          fontFamily: '"VT323", monospace', fontSize: 22, color: '#00ff41',
          letterSpacing: 4, textShadow: '0 0 10px #00ff41',
        }}>
          ◈ SENTINEL
        </span>
        <span style={{ fontFamily: '"Share Tech Mono", monospace', fontSize: 9, color: '#004400', marginLeft: 8 }}>
          OSINT v1.0
        </span>
      </div>

      {/* Separator */}
      <Sep />

      {/* Threat Level */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontFamily: '"Share Tech Mono", monospace', fontSize: 9, color: '#004400' }}>THREAT</span>
        <span style={{
          fontFamily: '"VT323", monospace', fontSize: 18, color: lvlInfo.color,
          textShadow: `0 0 8px ${lvlInfo.color}`,
          animation: overallLevel >= 4 ? 'blink 0.8s step-end infinite' : 'none',
          background: `${lvlInfo.bg}cc`, padding: '0 6px',
        }}>
          {lvlInfo.label}
        </span>
        <DefconDots level={overallLevel} />
      </div>

      <Sep />

      {/* Stats */}
      <div style={{ display: 'flex', gap: 12, flexShrink: 0 }}>
        <Stat label="CIVIL" value={flightCount.toLocaleString()} color="#00b4d8" />
        <Stat label="MIL" value={militaryCount} color="#00ffff" />
        <Stat label="THREATS" value={threatCount} color={threatCount > 0 ? '#ff9500' : '#004400'} />
        <Stat label="NEWS" value={newsCount} color="#006622" />
      </div>

      <Sep />

      {/* Last update */}
      <div style={{ flexShrink: 0 }}>
        <span style={{ fontFamily: '"Share Tech Mono", monospace', fontSize: 9, color: '#004400' }}>
          UPD: <span style={{ color: '#006622' }}>{lastUpdate || '—'}</span>
        </span>
      </div>

      <Sep />

      {/* Live indicator */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{
          fontSize: 8, color: blink ? '#ff0000' : 'transparent',
          transition: 'color 0.1s',
        }}>●</span>
        <span style={{ fontFamily: '"Share Tech Mono", monospace', fontSize: 9, color: '#006622' }}>LIVE</span>
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* UTC Time */}
      <div style={{ flexShrink: 0 }}>
        <span style={{ fontFamily: '"Share Tech Mono", monospace', fontSize: 10, color: '#00ff41', letterSpacing: 1 }}>
          {utcTime}
        </span>
      </div>

      <Sep />

      {/* Uptime */}
      <div style={{ flexShrink: 0 }}>
        <span style={{ fontFamily: '"Share Tech Mono", monospace', fontSize: 9, color: '#004400' }}>
          UP: <span style={{ color: '#006622' }}>{formatUptime(uptime)}</span>
        </span>
      </div>
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
      <span style={{ fontFamily: '"Share Tech Mono", monospace', fontSize: 8, color: '#004400' }}>{label}:</span>
      <span style={{ fontFamily: '"Share Tech Mono", monospace', fontSize: 11, color }}>{value}</span>
    </div>
  );
}

function Sep() {
  return <div style={{ width: 1, height: 16, background: '#002200', margin: '0 10px', flexShrink: 0 }} />;
}

function DefconDots({ level }) {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((l) => {
        const active = l <= level;
        const c = THREAT_LEVEL[l]?.color || '#002200';
        return (
          <div key={l} style={{
            width: 6, height: 6, borderRadius: '50%',
            background: active ? c : '#001100',
            boxShadow: active ? `0 0 4px ${c}` : 'none',
          }} />
        );
      })}
    </div>
  );
}

function formatUptime(s) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}
