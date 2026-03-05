'use client';
import { useState } from 'react';
import ThreatPanel from './ThreatPanel';
import NewsPanel from './NewsPanel';

// videoId → YouTube embed via youtube-nocookie.com
// liveUrl → fallback "open on YouTube" link
const CHANNELS = [
  { id: 'aje',  short: 'AJE',    label: 'AL JAZEERA ENGLISH', color: '#e8b400', videoId: 'gCNeDWCI0vo', liveUrl: 'https://www.youtube.com/live/gCNeDWCI0vo' },
  { id: 'trt',  short: 'TRT',    label: 'TRT WORLD',          color: '#e84040', videoId: 'ABfFhWzWs0s', liveUrl: 'https://www.youtube.com/live/ABfFhWzWs0s' },
  { id: 'cnn18',short: 'CNN18',  label: 'CNN NEWS 18',        color: '#cc0000', videoId: '_12EKnFPspY', liveUrl: 'https://www.youtube.com/live/_12EKnFPspY' },
  { id: 'fox',  short: 'FOX',    label: 'FOX NEWS',           color: '#003f8a', videoId: '31IWLnU6Ca8', liveUrl: 'https://www.youtube.com/live/31IWLnU6Ca8' },
  { id: 'f24',  short: 'F24',    label: 'FRANCE 24',          color: '#d40000', videoId: 'Ap-UM1O9RBU', liveUrl: 'https://www.youtube.com/live/Ap-UM1O9RBU' },
  { id: 'sky',  short: 'SKY',    label: 'SKY NEWS',           color: '#e8130c', videoId: '9Auq9mYxFEE', liveUrl: 'https://www.youtube.com/@SkyNews/live'    },
  { id: 'bbc',  short: 'BBC',    label: 'BBC NEWS',           color: '#bb1919', videoId: 'w_Ma8oQLmSM', liveUrl: 'https://www.youtube.com/@BBCNews/live'    },
  { id: 'dw',   short: 'DW',     label: 'DW NEWS',            color: '#006ab3', videoId: 'TG5RIgp_LZE', liveUrl: 'https://www.youtube.com/@dwnews/live'     },
  { id: 'abc',  short: 'ABC',    label: 'ABC NEWS',           color: '#ffcd00', videoId: 'vOTiJkg1voo', liveUrl: 'https://www.youtube.com/@ABCNews/live'    },
  { id: 'ary',  short: 'ARY',    label: 'ARY NEWS',           color: '#ff6600', videoId: null,          liveUrl: 'https://www.youtube.com/@ARYNewsPK/live'  },
  { id: 'ndtv', short: 'NDTV',   label: 'NDTV 24x7',          color: '#e00000', videoId: null,          liveUrl: 'https://www.youtube.com/@ndtv/live'       },
  { id: 'arb',  short: 'ARABIYA',label: 'AL ARABIYA ENGLISH', color: '#c8a000', videoId: null,          liveUrl: 'https://www.youtube.com/@AlArabiyaEnglish/live' },
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

          {ch?.videoId ? (
            <iframe
              key={ch.id}
              src={`https://www.youtube-nocookie.com/embed/${ch.videoId}?autoplay=1&mute=0&rel=0&modestbranding=1`}
              style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
              allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
              allowFullScreen
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
                <div style={{ color: '#333', fontSize: 8, marginBottom: 10 }}>WATCH LIVE ON YOUTUBE</div>
                <a href={ch?.liveUrl} target="_blank" rel="noreferrer" style={{
                  fontSize: 9, color: ch?.color, fontFamily: '"Share Tech Mono", monospace',
                  textDecoration: 'none', border: `1px solid ${ch?.color}55`, padding: '3px 12px',
                }}>
                  ↗ OPEN ON YOUTUBE
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
