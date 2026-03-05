'use client';
import { useState } from 'react';
import ThreatPanel from './ThreatPanel';
import NewsPanel from './NewsPanel';

const CHANNELS = [
  { id: 'aje',  short: 'AJE',    label: 'AL JAZEERA ENGLISH', color: '#e8b400', url: 'https://www.aljazeera.com/live/',      embed: true  },
  { id: 'arb',  short: 'ARABIYA',label: 'AL ARABIYA ENGLISH', color: '#c8a000', url: 'https://english.alarabiya.net/live',  embed: true  },
  { id: 'ary',  short: 'ARY',    label: 'ARY NEWS',           color: '#ff6600', url: 'https://arynews.tv/live',             embed: true  },
  { id: 'bbc',  short: 'BBC',    label: 'BBC NEWS',           color: '#bb1919', url: 'https://www.bbc.co.uk/news',          embed: false },
  { id: 'cnn',  short: 'CNN',    label: 'CNN',                color: '#cc0000', url: 'https://edition.cnn.com/live-tv',     embed: false },
];

export default function RightPanel({ threats, convergenceAlerts, overallLevel, eventLog, onNewsClassified }) {
  const [activeChannel, setActiveChannel] = useState('aje');
  const ch = CHANNELS.find(c => c.id === activeChannel);

  return (
    <div className="panel-right">

      {/* ── TOP: LIVE TV ─────────────────────────────────────────────────── */}
      <div className="right-top">
        {/* Header */}
        <div className="panel-header">
          <span>▶ LIVE NEWS</span>
          <span style={{ color: '#ff3333', fontSize: 8, animation: 'blink 1s step-end infinite' }}>● LIVE</span>
        </div>

        {/* Channel tabs */}
        <div style={{
          display: 'flex', borderBottom: '1px solid var(--border)',
          background: '#020202', flexShrink: 0, overflowX: 'auto', scrollbarWidth: 'none',
        }}>
          {CHANNELS.map(c => (
            <button
              key={c.id}
              onClick={() => setActiveChannel(c.id)}
              style={{
                padding: '4px 10px', whiteSpace: 'nowrap', flexShrink: 0, flexGrow: 1,
                background: activeChannel === c.id ? c.color + '18' : 'transparent',
                border: 'none',
                borderBottom: `2px solid ${activeChannel === c.id ? c.color : 'transparent'}`,
                color: activeChannel === c.id ? c.color : '#334',
                cursor: 'pointer',
                fontFamily: '"Share Tech Mono", monospace', fontSize: 9, fontWeight: 'bold',
                letterSpacing: 0.5,
              }}
            >
              {c.short}
            </button>
          ))}
        </div>

        {/* Video embed */}
        <div style={{ flex: 1, background: '#000', position: 'relative', overflow: 'hidden' }}>
          {/* Live badge */}
          <div style={{
            position: 'absolute', top: 5, left: 6, zIndex: 5, pointerEvents: 'none',
            fontFamily: '"Share Tech Mono", monospace', fontSize: 8,
            background: 'rgba(0,0,0,0.7)', padding: '2px 7px',
            display: 'flex', alignItems: 'center', gap: 5,
          }}>
            <span style={{ color: '#ff3333', animation: 'blink 1s step-end infinite' }}>●</span>
            <span style={{ color: '#555' }}>LIVE —</span>
            <span style={{ color: ch?.color, letterSpacing: 0.5 }}>{ch?.label}</span>
          </div>

          {ch?.embed ? (
            <iframe
              key={ch.id}
              src={ch.url}
              style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
              allow="autoplay; fullscreen"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', height: '100%', gap: 10, background: '#030303',
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: '50%',
                background: ch?.color + '18', border: `2px solid ${ch?.color}55`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ color: ch?.color, fontSize: 18 }}>▶</span>
              </div>
              <div style={{ textAlign: 'center', fontFamily: '"Share Tech Mono", monospace' }}>
                <div style={{ color: ch?.color, fontSize: 11, fontWeight: 'bold', letterSpacing: 1, marginBottom: 3 }}>{ch?.label}</div>
                <div style={{ color: '#333', fontSize: 8, marginBottom: 10 }}>DIRECT EMBED NOT PERMITTED BY CHANNEL</div>
                <a href={ch?.url} target="_blank" rel="noreferrer" style={{
                  fontSize: 9, color: ch?.color, fontFamily: '"Share Tech Mono", monospace',
                  textDecoration: 'none', border: `1px solid ${ch?.color}55`, padding: '3px 12px',
                }}>
                  ↗ WATCH LIVE ON {ch?.short}
                </a>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── BOTTOM SPLIT: LIVE INTEL | WORLD NEWS ──────────────────────── */}
      <div className="right-bottom">
        <div className="right-bottom-left">
          <ThreatPanel
            threats={threats}
            convergenceAlerts={convergenceAlerts}
            overallLevel={overallLevel}
            eventLog={eventLog}
          />
        </div>
        <div className="right-bottom-right">
          <NewsPanel onNewsClassified={onNewsClassified} />
        </div>
      </div>
    </div>
  );
}
