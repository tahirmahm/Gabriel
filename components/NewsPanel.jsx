'use client';
import { useState, useEffect, useRef } from 'react';
import { classifyNewsItem, HIGH_THREAT_KEYWORDS, MEDIUM_THREAT_KEYWORDS } from '../lib/threatClassifier';

const YOUTUBE_CHANNELS = [
  { id: 'bbc', label: 'BBC', color: '#bb1919', channelId: 'UCK4richmQHKar2O4LJHlRpw' },
  { id: 'aljazeera', label: 'AJE', color: '#e8b400', channelId: 'UCNye-wNBqNL5ZzHSJdpkDXA' },
  { id: 'cnn', label: 'CNN', color: '#cc0000', channelId: 'UCupvZG-5ko_eiXAupbDfxWw' },
  { id: 'france24', label: 'F24', color: '#004899', channelId: 'UCQfwfsi5VrQ8yKZ-UWmAEFg' },
  { id: 'dw', label: 'DW', color: '#006fba', channelId: 'UCknLrEdhRCp1aegoMqRaCZg' },
  { id: 'sky', label: 'SKY', color: '#ee1c25', channelId: 'UC9wIJb2_ylNFOKJFHpEQAUg' },
  { id: 'euronews', label: 'EUR', color: '#003399', channelId: 'UCW4WJFEIaYobHVlfMvJzkXg' },
];

const RSS_SOURCES = ['reuters', 'bbc', 'aljazeera', 'ap', 'france24', 'dw', 'euronews', 'sky'];

const SOURCE_COLORS = {
  reuters: '#ff9500', bbc: '#ff4444', aljazeera: '#e8b400',
  ap: '#00b4d8', france24: '#004899', dw: '#006fba',
  euronews: '#003399', sky: '#ee1c25',
};

function highlightKeywords(text) {
  if (!text) return text;
  let result = text;
  for (const kw of HIGH_THREAT_KEYWORDS) {
    const re = new RegExp(`(${kw})`, 'gi');
    result = result.replace(re, '|||HIGH:$1|||');
  }
  for (const kw of MEDIUM_THREAT_KEYWORDS) {
    const re = new RegExp(`(${kw})`, 'gi');
    result = result.replace(re, '|||MED:$1|||');
  }
  return result.split('|||').map((part, i) => {
    if (part.startsWith('HIGH:')) return (
      <span key={i} style={{ color: '#ff4400', fontWeight: 'bold', background: 'rgba(255,68,0,0.15)' }}>
        {part.slice(5)}
      </span>
    );
    if (part.startsWith('MED:')) return (
      <span key={i} style={{ color: '#ffff00', background: 'rgba(255,255,0,0.1)' }}>
        {part.slice(4)}
      </span>
    );
    return part;
  });
}

export default function NewsPanel({ onNewsClassified }) {
  const [activeTab, setActiveTab] = useState('feed'); // feed | live
  const [activeChannel, setActiveChannel] = useState('bbc');
  const [liveVideoIds, setLiveVideoIds] = useState({});
  const [newsItems, setNewsItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const scrollRef = useRef(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const fetchNews = async () => {
    if (!isMountedRef.current) return;
    setLoading(true);
    try {
      const res = await fetch('/api/rss?source=all');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!isMountedRef.current) return;

      const classified = (data.items || []).map((item) => ({
        ...item,
        classification: classifyNewsItem(item),
        id: `${item.source}_${item.title.slice(0, 20)}_${Date.now()}`,
      }));

      setNewsItems(classified);
      onNewsClassified && onNewsClassified(classified);
    } catch (e) {
      console.warn('RSS fetch failed:', e.message);
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    fetchNews();
    const iv = setInterval(fetchNews, 120000); // refresh every 2 min
    return () => clearInterval(iv);
  }, []); // eslint-disable-line

  // Fetch live video IDs for all channels
  useEffect(() => {
    const fetchVideoIds = async () => {
      const results = {};
      await Promise.allSettled(
        YOUTUBE_CHANNELS.map(async (ch) => {
          try {
            const res = await fetch(`/api/youtube-live?channelId=${ch.channelId}`);
            if (!res.ok) return;
            const data = await res.json();
            if (data.videoId) results[ch.id] = data.videoId;
          } catch {}
        })
      );
      if (isMountedRef.current) setLiveVideoIds(results);
    };
    fetchVideoIds();
  }, []); // eslint-disable-line

  const filteredItems = newsItems.filter((item) => {
    if (filter === 'all') return true;
    if (filter === 'threats') return item.classification.level >= 2;
    if (filter === 'critical') return item.classification.level >= 4;
    return item.source === filter;
  });

  const ch = YOUTUBE_CHANNELS.find((c) => c.id === activeChannel);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #003300', flexShrink: 0 }}>
        {['feed', 'live'].map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            flex: 1, padding: '6px 4px', background: activeTab === tab ? '#001a00' : 'transparent',
            border: 'none', borderBottom: activeTab === tab ? '2px solid #00ff41' : '2px solid transparent',
            color: activeTab === tab ? '#00ff41' : '#006600', cursor: 'pointer',
            fontFamily: '"Share Tech Mono", monospace', fontSize: 11, letterSpacing: 1,
          }}>
            {tab === 'feed' ? '◈ RSS FEED' : '▶ LIVE TV'}
          </button>
        ))}
      </div>

      {activeTab === 'feed' && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          {/* Filter bar */}
          <div style={{
            display: 'flex', gap: 4, padding: '4px 6px', overflowX: 'auto',
            borderBottom: '1px solid #001a00', flexShrink: 0, scrollbarWidth: 'none',
          }}>
            {['all', 'threats', 'critical', ...RSS_SOURCES].map((f) => (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding: '2px 6px', whiteSpace: 'nowrap', background: filter === f ? '#003300' : 'transparent',
                border: `1px solid ${filter === f ? '#00ff41' : '#002200'}`,
                color: filter === f ? '#00ff41' : '#004400', cursor: 'pointer',
                fontFamily: '"Share Tech Mono", monospace', fontSize: 9,
                textTransform: 'uppercase',
              }}>
                {f === 'all' ? '■ ALL' : f === 'threats' ? '⚠ THREATS' : f === 'critical' ? '☢ CRIT' : f.toUpperCase()}
              </button>
            ))}
          </div>

          {/* News list */}
          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'thin' }}>
            {loading && newsItems.length === 0 ? (
              <div style={{ padding: 12, color: '#004400', fontFamily: '"Share Tech Mono", monospace', fontSize: 11 }}>
                ◌ FETCHING FEEDS...
              </div>
            ) : filteredItems.length === 0 ? (
              <div style={{ padding: 12, color: '#004400', fontFamily: '"Share Tech Mono", monospace', fontSize: 10 }}>
                NO EVENTS MATCHING FILTER
              </div>
            ) : (
              filteredItems.map((item) => (
                <NewsItem key={item.id} item={item} />
              ))
            )}
          </div>

          {/* Ticker */}
          <div style={{
            borderTop: '1px solid #003300', padding: '4px 6px', background: '#030303',
            overflow: 'hidden', flexShrink: 0,
          }}>
            <NewsTickerBar items={newsItems.filter((i) => i.classification.level >= 2)} />
          </div>
        </div>
      )}

      {activeTab === 'live' && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          {/* Channel selector */}
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 4, padding: '6px',
            borderBottom: '1px solid #001a00', flexShrink: 0,
          }}>
            {YOUTUBE_CHANNELS.map((c) => (
              <button key={c.id} onClick={() => setActiveChannel(c.id)} style={{
                padding: '3px 8px', background: activeChannel === c.id ? c.color + '33' : 'transparent',
                border: `1px solid ${activeChannel === c.id ? c.color : '#002200'}`,
                color: activeChannel === c.id ? c.color : '#004400', cursor: 'pointer',
                fontFamily: '"Share Tech Mono", monospace', fontSize: 10, fontWeight: 'bold',
              }}>
                {c.label}
              </button>
            ))}
          </div>

          {/* YouTube embed */}
          <div style={{ flex: 1, position: 'relative', background: '#000' }}>
            <div style={{
              position: 'absolute', top: 4, left: 6, zIndex: 2,
              fontFamily: '"Share Tech Mono", monospace', fontSize: 9,
              color: '#ff4444', display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <span style={{ animation: 'blink 1s step-end infinite', fontSize: 8 }}>●</span>
              LIVE — {ch?.label}
            </div>
            {ch && liveVideoIds[ch.id] ? (
              <iframe
                key={ch.id + liveVideoIds[ch.id]}
                style={{ width: '100%', height: '100%', border: 'none' }}
                src={`https://www.youtube.com/embed/${liveVideoIds[ch.id]}?autoplay=1&mute=1`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : ch ? (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                height: '100%', gap: 12, color: '#004400',
                fontFamily: '"Share Tech Mono", monospace', fontSize: 11,
              }}>
                <div>{liveVideoIds[ch.id] === undefined ? '◌ LOADING STREAM...' : '⚠ NO LIVE STREAM FOUND'}</div>
                <a
                  href={`https://www.youtube.com/channel/${ch.channelId}/live`}
                  target="_blank" rel="noreferrer"
                  style={{ color: '#00b4d8', fontSize: 10 }}
                >
                  → WATCH ON YOUTUBE ↗
                </a>
              </div>
            ) : null}
          </div>

          {/* Channel links */}
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 6, padding: '6px',
            borderTop: '1px solid #001a00', flexShrink: 0,
          }}>
            {YOUTUBE_CHANNELS.map((c) => (
              <a key={c.id}
                href={`https://www.youtube.com/channel/${c.channelId}/live`}
                target="_blank" rel="noreferrer"
                style={{
                  fontSize: 9, fontFamily: '"Share Tech Mono", monospace',
                  color: c.color, textDecoration: 'none', opacity: 0.7,
                }}>
                ↗ {c.label}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function NewsItem({ item }) {
  const [expanded, setExpanded] = useState(false);
  const lvl = item.classification.level;
  const srcColor = SOURCE_COLORS[item.source] || '#00b4d8';

  const levelBg = lvl >= 4 ? 'rgba(255,0,0,0.05)' : lvl >= 3 ? 'rgba(255,149,0,0.05)' : lvl >= 2 ? 'rgba(255,255,0,0.04)' : 'transparent';
  const levelBorder = lvl >= 4 ? 'rgba(255,0,0,0.3)' : lvl >= 3 ? 'rgba(255,149,0,0.3)' : lvl >= 2 ? 'rgba(255,255,0,0.2)' : 'transparent';
  const indicator = lvl >= 4 ? '☢' : lvl >= 3 ? '⚠' : lvl >= 2 ? '▲' : '▸';
  const indColor = lvl >= 4 ? '#ff0000' : lvl >= 3 ? '#ff9500' : lvl >= 2 ? '#ffff00' : '#003300';

  return (
    <div
      onClick={() => setExpanded(!expanded)}
      style={{
        padding: '5px 8px', borderBottom: '1px solid #001a00', cursor: 'pointer',
        background: levelBg, borderLeft: `2px solid ${levelBorder}`,
        transition: 'background 0.2s',
      }}
    >
      <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
        <span style={{ color: indColor, fontSize: 10, flexShrink: 0, marginTop: 1 }}>{indicator}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 4, marginBottom: 2 }}>
            <span style={{
              fontSize: 9, fontFamily: '"Share Tech Mono", monospace',
              color: srcColor, textTransform: 'uppercase', flexShrink: 0,
            }}>
              [{item.source}]
            </span>
            <span style={{ fontSize: 9, color: '#003300', fontFamily: '"Share Tech Mono", monospace', flexShrink: 0 }}>
              {item.pubDate ? new Date(item.pubDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
            </span>
          </div>
          <div style={{
            fontSize: 11, fontFamily: '"Share Tech Mono", monospace', color: '#00cc33',
            lineHeight: 1.3, wordBreak: 'break-word',
          }}>
            {highlightKeywords(item.title)}
          </div>
          {expanded && item.description && (
            <div style={{
              fontSize: 10, color: '#006622', marginTop: 4, lineHeight: 1.4,
              fontFamily: '"Share Tech Mono", monospace', borderTop: '1px solid #001a00', paddingTop: 4,
            }}>
              {highlightKeywords(item.description)}
              {item.link && (
                <a href={item.link} target="_blank" rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  style={{ display: 'block', marginTop: 4, color: '#00b4d8', fontSize: 9 }}>
                  → READ FULL ARTICLE
                </a>
              )}
            </div>
          )}
          {item.classification.tags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 3 }}>
              {item.classification.tags.slice(0, 3).map((tag) => (
                <span key={tag} style={{
                  fontSize: 8, padding: '1px 4px', border: '1px solid #ff440066',
                  color: '#ff4400', fontFamily: '"Share Tech Mono", monospace',
                }}>
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function NewsTickerBar({ items }) {
  if (!items.length) return (
    <div style={{ fontSize: 9, color: '#002200', fontFamily: '"Share Tech Mono", monospace' }}>
      ◌ MONITORING FEEDS...
    </div>
  );
  const tickerText = items.map((i) => `⚠ ${i.source.toUpperCase()}: ${i.title}`).join('   ║   ');

  return (
    <div style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}>
      <span style={{
        display: 'inline-block',
        animation: 'ticker 60s linear infinite',
        fontSize: 9, color: '#ff9500',
        fontFamily: '"Share Tech Mono", monospace',
      }}>
        {tickerText}
      </span>
    </div>
  );
}
