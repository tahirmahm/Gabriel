'use client';
import { useState } from 'react';
import ThreatPanel from './ThreatPanel';
import NewsPanel from './NewsPanel';

// videoId → YouTube embed; liveUrl → fallback link
const CHANNELS = [
  { id: 'aje',   short: 'AJE',     label: 'AL JAZEERA',   color: '#e8b400', videoId: 'gCNeDWCI0vo' },
  { id: 'trt',   short: 'TRT',     label: 'TRT WORLD',    color: '#e84040', videoId: 'ABfFhWzWs0s' },
  { id: 'cnn18', short: 'CNN18',   label: 'CNN NEWS 18',  color: '#cc0000', videoId: '_12EKnFPspY' },
  { id: 'fox',   short: 'FOX',     label: 'FOX NEWS',     color: '#003f8a', videoId: '31IWLnU6Ca8' },
  { id: 'f24',   short: 'F24',     label: 'FRANCE 24',    color: '#d40000', videoId: 'Ap-UM1O9RBU' },
  { id: 'sky',   short: 'SKY',     label: 'SKY NEWS',     color: '#e8130c', videoId: '9Auq9mYxFEE' },
  { id: 'bbc',   short: 'BBC',     label: 'BBC NEWS',     color: '#bb1919', videoId: 'w_Ma8oQLmSM' },
  { id: 'dw',    short: 'DW',      label: 'DW NEWS',      color: '#006ab3', videoId: 'TG5RIgp_LZE' },
  { id: 'abc',   short: 'ABC',     label: 'ABC NEWS',     color: '#ffcd00', videoId: 'vOTiJkg1voo' },
  { id: 'ndtv',  short: 'NDTV',    label: 'NDTV 24x7',   color: '#e00000', videoId: null, liveUrl: 'https://www.youtube.com/@ndtv/live' },
  { id: 'arb',   short: 'ARABIYA', label: 'AL ARABIYA',  color: '#c8a000', videoId: null, liveUrl: 'https://www.youtube.com/@AlArabiyaEnglish/live' },
  { id: 'ary',   short: 'ARY',     label: 'ARY NEWS',    color: '#ff6600', videoId: null, liveUrl: 'https://www.youtube.com/@ARYNewsPK/live' },
];

// Preset groups of 4 channels per region tab
const PRESETS = {
  GLOBAL:   ['aje',  'bbc',   'f24',   'dw'  ],
  MIDEAST:  ['aje',  'trt',   'f24',   'arb' ],
  EUROPE:   ['bbc',  'dw',    'f24',   'sky' ],
  AMERICAS: ['cnn18','fox',   'abc',   'bbc' ],
  ASIA:     ['aje',  'trt',   'ndtv',  'abc' ],
};

function FeedCell({ chId }) {
  const ch = CHANNELS.find(c => c.id === chId);
  if (!ch) return <div className="feed-cell" />;

  return (
    <div className="feed-cell">
      {ch.videoId ? (
        <iframe
          key={ch.id}
          src={`https://www.youtube-nocookie.com/embed/${ch.videoId}?autoplay=1&mute=1&rel=0&modestbranding=1&controls=1`}
          style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
          allowFullScreen
        />
      ) : (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', height: '100%', background: '#030303', gap: 5,
        }}>
          <span style={{ color: ch.color, fontSize: 16 }}>▶</span>
          <span style={{ fontSize: 9, color: ch.color, fontFamily: '"Share Tech Mono", monospace' }}>{ch.label}</span>
          <a href={ch.liveUrl} target="_blank" rel="noreferrer" style={{
            fontSize: 7, color: ch.color, fontFamily: '"Share Tech Mono", monospace',
            border: `1px solid ${ch.color}55`, padding: '2px 8px', textDecoration: 'none',
          }}>↗ YOUTUBE</a>
        </div>
      )}
      {/* Channel label overlay */}
      <div className="feed-label" style={{ color: ch.color }}>
        <span style={{ color: '#ff3333', marginRight: 3 }}>●</span>
        {ch.short}
      </div>
    </div>
  );
}

export default function RightPanel({ threats, convergenceAlerts, overallLevel, eventLog, onNewsClassified }) {
  const [activePreset, setActivePreset] = useState('GLOBAL');
  const activeChannels = PRESETS[activePreset];

  return (
    <div className="right-column">

      {/* ── LIVE FEEDS (2×2 grid) ───────────────────────────────────── */}
      <div className="live-feeds">

        {/* Header */}
        <div className="panel-header">
          <span>▶ LIVE FEEDS</span>
          <span style={{ color: '#ff3333', fontSize: 7, animation: 'blink 1s step-end infinite' }}>● LIVE</span>
        </div>

        {/* Region preset tabs */}
        <div style={{
          display: 'flex', background: '#020202',
          borderBottom: '1px solid var(--border)', flexShrink: 0,
        }}>
          {Object.keys(PRESETS).map(p => (
            <button
              key={p}
              onClick={() => setActivePreset(p)}
              style={{
                flex: 1, padding: '4px 2px',
                background:   activePreset === p ? '#001a00' : 'transparent',
                border:       'none',
                borderBottom: `2px solid ${activePreset === p ? '#00ff41' : 'transparent'}`,
                color:        activePreset === p ? '#00ff41' : '#334',
                cursor:       'pointer',
                fontFamily:   '"Share Tech Mono", monospace',
                fontSize: 8, letterSpacing: 0.3, fontWeight: 'bold',
              }}
            >
              {p}
            </button>
          ))}
        </div>

        {/* 2×2 feed grid */}
        <div className="feeds-grid">
          {activeChannels.map(id => <FeedCell key={id} chId={id} />)}
        </div>
      </div>

      {/* ── INTEL PANELS ────────────────────────────────────────────── */}
      <div className="intel-panels">
        <div className="intel-left">
          <ThreatPanel
            threats={threats}
            convergenceAlerts={convergenceAlerts}
            overallLevel={overallLevel}
            eventLog={eventLog}
          />
        </div>
        <div className="intel-right">
          <NewsPanel onNewsClassified={onNewsClassified} />
        </div>
      </div>

    </div>
  );
}
