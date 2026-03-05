'use client';
import { useState } from 'react';
import FloatingWindow from './FloatingWindow';

// Direct website live TV — tries iframe embed, always shows "Open" fallback
const CHANNELS = [
  {
    id: 'bbc',
    label: 'BBC NEWS',
    short: 'BBC',
    color: '#bb1919',
    liveUrl: 'https://www.bbc.co.uk/news',
    // BBC blocks iframes — link only
    iframeUrl: null,
    openLabel: 'bbc.co.uk/news',
  },
  {
    id: 'aje',
    label: 'AL JAZEERA ENGLISH',
    short: 'AJE',
    color: '#e8b400',
    liveUrl: 'https://www.aljazeera.com/live/',
    iframeUrl: 'https://www.aljazeera.com/live/',
    openLabel: 'aljazeera.com/live',
  },
  {
    id: 'arb',
    label: 'AL ARABIYA ENGLISH',
    short: 'ARABIYA',
    color: '#c8a000',
    liveUrl: 'https://english.alarabiya.net/live',
    iframeUrl: 'https://english.alarabiya.net/live',
    openLabel: 'english.alarabiya.net/live',
  },
  {
    id: 'ary',
    label: 'ARY NEWS',
    short: 'ARY',
    color: '#ff6600',
    liveUrl: 'https://arynews.tv/live',
    iframeUrl: 'https://arynews.tv/live',
    openLabel: 'arynews.tv/live',
  },
  {
    id: 'cnn',
    label: 'CNN',
    short: 'CNN',
    color: '#cc0000',
    liveUrl: 'https://edition.cnn.com/live-tv',
    // CNN requires auth / blocks iframes
    iframeUrl: null,
    openLabel: 'cnn.com/live-tv',
  },
];

export default function LiveTVWindow({ onClose, defaultX, defaultY }) {
  const [active, setActive] = useState('aje');
  const ch = CHANNELS.find((c) => c.id === active);

  return (
    <FloatingWindow
      title="▶ LIVE TV — DIRECT STREAMS"
      defaultX={defaultX ?? (typeof window !== 'undefined' ? window.innerWidth - 490 : 900)}
      defaultY={defaultY ?? 60}
      width={470}
      height={360}
      onClose={onClose}
      zIndex={510}
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Channel tabs */}
        <div style={{
          display: 'flex', flexShrink: 0, borderBottom: '1px solid #002200',
          background: '#030303', overflowX: 'auto', scrollbarWidth: 'none',
        }}>
          {CHANNELS.map((c) => (
            <button
              key={c.id}
              onClick={() => setActive(c.id)}
              style={{
                padding: '5px 12px', whiteSpace: 'nowrap', flexShrink: 0,
                background: active === c.id ? c.color + '22' : 'transparent',
                border: 'none',
                borderBottom: `2px solid ${active === c.id ? c.color : 'transparent'}`,
                color: active === c.id ? c.color : '#444',
                cursor: 'pointer',
                fontFamily: '"Share Tech Mono", monospace', fontSize: 10, fontWeight: 'bold',
                letterSpacing: 0.5,
              }}
            >
              {c.short}
            </button>
          ))}
        </div>

        {/* Viewer */}
        <div style={{ flex: 1, position: 'relative', background: '#000' }}>
          {/* Live badge */}
          <div style={{
            position: 'absolute', top: 6, left: 8, zIndex: 10, pointerEvents: 'none',
            fontFamily: '"Share Tech Mono", monospace', fontSize: 8,
            display: 'flex', alignItems: 'center', gap: 4,
            background: 'rgba(0,0,0,0.65)', padding: '2px 6px',
          }}>
            <span style={{ color: '#ff3333', animation: 'blink 1s step-end infinite' }}>●</span>
            <span style={{ color: '#888' }}>LIVE —</span>
            <span style={{ color: ch?.color }}>{ch?.label}</span>
          </div>

          {ch?.iframeUrl ? (
            <iframe
              key={ch.id}
              src={ch.iframeUrl}
              style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
              allow="autoplay; fullscreen; picture-in-picture"
              referrerPolicy="no-referrer"
            />
          ) : (
            /* Channels that block iframes (BBC, CNN) — full-area open button */
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', height: '100%', gap: 14,
              background: '#050505',
            }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%', background: ch?.color + '22',
                border: `2px solid ${ch?.color}`, display: 'flex', alignItems: 'center',
                justifyContent: 'center',
              }}>
                <span style={{ color: ch?.color, fontSize: 22 }}>▶</span>
              </div>
              <div style={{ fontFamily: '"Share Tech Mono", monospace', textAlign: 'center' }}>
                <div style={{ color: ch?.color, fontSize: 13, fontWeight: 'bold', letterSpacing: 1, marginBottom: 4 }}>
                  {ch?.label}
                </div>
                <div style={{ color: '#444', fontSize: 9, marginBottom: 14 }}>
                  LIVE STREAM — DIRECT WEBSITE EMBED NOT PERMITTED
                </div>
                <a
                  href={ch?.liveUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'inline-block',
                    padding: '6px 18px',
                    background: ch?.color + '22',
                    border: `1px solid ${ch?.color}`,
                    color: ch?.color,
                    fontFamily: '"Share Tech Mono", monospace',
                    fontSize: 10,
                    textDecoration: 'none',
                    letterSpacing: 1,
                  }}
                >
                  ↗ WATCH LIVE ON {ch?.short}
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Footer — open link for all channels */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '4px 10px', borderTop: '1px solid #001a00',
          background: '#030303', flexShrink: 0,
        }}>
          <span style={{ fontSize: 8, color: '#333', fontFamily: '"Share Tech Mono", monospace' }}>
            {ch?.openLabel}
          </span>
          <a
            href={ch?.liveUrl}
            target="_blank"
            rel="noreferrer"
            style={{ fontSize: 9, color: '#00b4d8', textDecoration: 'none', fontFamily: '"Share Tech Mono", monospace' }}
          >
            ↗ OPEN IN NEW TAB
          </a>
        </div>
      </div>
    </FloatingWindow>
  );
}
