'use client';
import { useState } from 'react';

const CHANNELS = [
  { id: 'aje',   short: 'AJE',     label: 'AL JAZEERA ENGLISH', color: '#e8b400', videoId: 'gCNeDWCI0vo' },
  { id: 'trt',   short: 'TRT',     label: 'TRT WORLD',          color: '#e84040', videoId: 'ABfFhWzWs0s' },
  { id: 'cnn18', short: 'CNN18',   label: 'CNN NEWS 18',        color: '#cc0000', videoId: '_12EKnFPspY' },
  { id: 'fox',   short: 'FOX',     label: 'FOX NEWS',           color: '#003f8a', videoId: '31IWLnU6Ca8' },
  { id: 'f24',   short: 'F24',     label: 'FRANCE 24',          color: '#d40000', videoId: 'Ap-UM1O9RBU' },
  { id: 'sky',   short: 'SKY',     label: 'SKY NEWS',           color: '#e8130c', videoId: '9Auq9mYxFEE' },
  { id: 'bbc',   short: 'BBC',     label: 'BBC NEWS',           color: '#bb1919', videoId: 'w_Ma8oQLmSM' },
  { id: 'dw',    short: 'DW',      label: 'DW NEWS',            color: '#006ab3', videoId: 'TG5RIgp_LZE' },
  { id: 'abc',   short: 'ABC',     label: 'ABC NEWS',           color: '#ffcd00', videoId: 'vOTiJkg1voo' },
  { id: 'ary',   short: 'ARY',     label: 'ARY NEWS',           color: '#ff6600', videoId: null, liveUrl: 'https://www.youtube.com/@ARYNewsPK/live' },
  { id: 'ndtv',  short: 'NDTV',    label: 'NDTV 24x7',          color: '#e00000', videoId: null, liveUrl: 'https://www.youtube.com/@ndtv/live' },
  { id: 'arb',   short: 'ARABIYA', label: 'AL ARABIYA ENGLISH', color: '#c8a000', videoId: null, liveUrl: 'https://www.youtube.com/@AlArabiyaEnglish/live' },
];

export default function LiveNewsPanel() {
  const [activeId, setActiveId] = useState('aje');
  const ch = CHANNELS.find(c => c.id === activeId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#020202' }}>

      {/* Header */}
      <div className="panel-header">
        <span>▶ LIVE NEWS</span>
        <span style={{ color: '#ff3333', fontSize: 7, animation: 'blink 1s step-end infinite' }}>● LIVE</span>
      </div>

      {/* Tabs (horizontal, scrollable) + video */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

        {/* Channel list — vertical on left */}
        <div style={{
          width: 54, flexShrink: 0, display: 'flex', flexDirection: 'column',
          borderRight: '1px solid var(--border)', overflowY: 'auto',
          background: '#010101', scrollbarWidth: 'none',
        }}>
          {CHANNELS.map(c => (
            <button
              key={c.id}
              onClick={() => setActiveId(c.id)}
              style={{
                padding: '5px 4px',
                background:   activeId === c.id ? c.color + '18' : 'transparent',
                border:       'none',
                borderLeft:   `2px solid ${activeId === c.id ? c.color : 'transparent'}`,
                color:        activeId === c.id ? c.color : '#334',
                cursor:       'pointer',
                fontFamily:   '"Share Tech Mono", monospace',
                fontSize:     8,
                letterSpacing: 0.5,
                textAlign:    'left',
                flexShrink:   0,
              }}
            >
              {c.short}
            </button>
          ))}
        </div>

        {/* Video */}
        <div style={{ flex: 1, position: 'relative', background: '#000', overflow: 'hidden' }}>
          {/* Channel badge */}
          <div style={{
            position: 'absolute', top: 4, left: 5, zIndex: 5, pointerEvents: 'none',
            fontFamily: '"Share Tech Mono", monospace', fontSize: 8,
            background: 'rgba(0,0,0,0.75)', padding: '1px 6px',
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <span style={{ color: '#ff3333', animation: 'blink 1s step-end infinite' }}>●</span>
            <span style={{ color: ch?.color }}>{ch?.label}</span>
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
              justifyContent: 'center', height: '100%', gap: 8, background: '#030303',
            }}>
              <span style={{ color: ch?.color, fontSize: 20 }}>▶</span>
              <span style={{ fontSize: 10, color: ch?.color, fontFamily: '"Share Tech Mono", monospace', letterSpacing: 1 }}>
                {ch?.label}
              </span>
              <a
                href={ch?.liveUrl} target="_blank" rel="noreferrer"
                style={{
                  fontSize: 8, color: ch?.color, fontFamily: '"Share Tech Mono", monospace',
                  textDecoration: 'none', border: `1px solid ${ch?.color}55`, padding: '3px 10px',
                }}
              >
                ↗ OPEN ON YOUTUBE
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
