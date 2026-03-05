'use client';
import { useState } from 'react';
import FloatingWindow from './FloatingWindow';

// videoId  → YouTube embed (youtube-nocookie.com/embed/VIDEO_ID)
// liveUrl  → fallback "open in browser" link
// ytHandle → used to build the fallback YouTube channel live URL
const CHANNELS = [
  {
    id: 'aje',
    label: 'AL JAZEERA ENGLISH',
    short: 'AJE',
    color: '#e8b400',
    videoId: 'gCNeDWCI0vo',
    liveUrl: 'https://www.youtube.com/live/gCNeDWCI0vo',
  },
  {
    id: 'trt',
    label: 'TRT WORLD',
    short: 'TRT',
    color: '#e84040',
    videoId: 'ABfFhWzWs0s',
    liveUrl: 'https://www.youtube.com/live/ABfFhWzWs0s',
  },
  {
    id: 'cnn18',
    label: 'CNN NEWS 18',
    short: 'CNN18',
    color: '#cc0000',
    videoId: '_12EKnFPspY',
    liveUrl: 'https://www.youtube.com/live/_12EKnFPspY',
  },
  {
    id: 'fox',
    label: 'FOX NEWS',
    short: 'FOX',
    color: '#003f8a',
    videoId: '31IWLnU6Ca8',
    liveUrl: 'https://www.youtube.com/live/31IWLnU6Ca8',
  },
  {
    id: 'f24',
    label: 'FRANCE 24 ENGLISH',
    short: 'F24',
    color: '#d40000',
    videoId: 'Ap-UM1O9RBU',
    liveUrl: 'https://www.youtube.com/live/Ap-UM1O9RBU',
  },
  {
    id: 'sky',
    label: 'SKY NEWS',
    short: 'SKY',
    color: '#e8130c',
    videoId: '9Auq9mYxFEE',
    liveUrl: 'https://www.youtube.com/@SkyNews/live',
  },
  {
    id: 'bbc',
    label: 'BBC NEWS',
    short: 'BBC',
    color: '#bb1919',
    videoId: 'w_Ma8oQLmSM',
    liveUrl: 'https://www.youtube.com/@BBCNews/live',
  },
  {
    id: 'dw',
    label: 'DW NEWS',
    short: 'DW',
    color: '#006ab3',
    videoId: 'TG5RIgp_LZE',
    liveUrl: 'https://www.youtube.com/@dwnews/live',
  },
  {
    id: 'abc',
    label: 'ABC NEWS',
    short: 'ABC',
    color: '#ffcd00',
    videoId: 'vOTiJkg1voo',
    liveUrl: 'https://www.youtube.com/@ABCNews/live',
  },
  {
    id: 'ary',
    label: 'ARY NEWS',
    short: 'ARY',
    color: '#ff6600',
    videoId: null,
    liveUrl: 'https://www.youtube.com/@ARYNewsPK/live',
  },
  {
    id: 'ndtv',
    label: 'NDTV 24x7',
    short: 'NDTV',
    color: '#e00000',
    videoId: null,
    liveUrl: 'https://www.youtube.com/@ndtv/live',
  },
  {
    id: 'arb',
    label: 'AL ARABIYA ENGLISH',
    short: 'ARABIYA',
    color: '#c8a000',
    videoId: null,
    liveUrl: 'https://www.youtube.com/@AlArabiyaEnglish/live',
  },
];

export default function LiveTVWindow({ onClose, defaultX, defaultY }) {
  const [active, setActive] = useState('aje');
  const ch = CHANNELS.find((c) => c.id === active);

  return (
    <FloatingWindow
      title="▶ LIVE TV — DIRECT STREAMS"
      defaultX={defaultX ?? (typeof window !== 'undefined' ? window.innerWidth - 510 : 900)}
      defaultY={defaultY ?? 60}
      width={490}
      height={420}
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
                padding: '5px 10px', whiteSpace: 'nowrap', flexShrink: 0,
                background: active === c.id ? c.color + '22' : 'transparent',
                border: 'none',
                borderBottom: `2px solid ${active === c.id ? c.color : 'transparent'}`,
                color: active === c.id ? c.color : '#444',
                cursor: 'pointer',
                fontFamily: '"Share Tech Mono", monospace', fontSize: 9, fontWeight: 'bold',
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

          {ch?.videoId ? (
            <iframe
              key={ch.id}
              src={`https://www.youtube-nocookie.com/embed/${ch.videoId}?autoplay=1&mute=0&rel=0&modestbranding=1`}
              style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
              allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
              allowFullScreen
            />
          ) : (
            /* Channels without a confirmed embed ID — open on YouTube */
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
                  LIVE STREAM — WATCH ON YOUTUBE
                </div>
                <a
                  href={ch?.liveUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'inline-block', padding: '6px 18px',
                    background: ch?.color + '22', border: `1px solid ${ch?.color}`,
                    color: ch?.color, fontFamily: '"Share Tech Mono", monospace',
                    fontSize: 10, textDecoration: 'none', letterSpacing: 1,
                  }}
                >
                  ↗ WATCH LIVE ON YOUTUBE
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '4px 10px', borderTop: '1px solid #001a00',
          background: '#030303', flexShrink: 0,
        }}>
          <span style={{ fontSize: 8, color: '#333', fontFamily: '"Share Tech Mono", monospace' }}>
            {ch?.videoId ? `youtube.com/embed/${ch.videoId}` : ch?.liveUrl}
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
