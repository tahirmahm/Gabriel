'use client';
import { useRef, useState, useEffect } from 'react';

export default function FloatingWindow({
  title,
  children,
  defaultX = 100,
  defaultY = 100,
  width = 360,
  height = 480,
  onClose,
  zIndex = 500,
}) {
  const [pos, setPos] = useState({ x: defaultX, y: defaultY });
  const [minimized, setMinimized] = useState(false);
  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (e) => {
      if (!dragging.current) return;
      setPos({
        x: Math.max(0, Math.min(e.clientX - dragOffset.current.x, window.innerWidth - width)),
        y: Math.max(0, Math.min(e.clientY - dragOffset.current.y, window.innerHeight - 38)),
      });
    };
    const onUp = () => { dragging.current = false; };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [width]);

  const startDrag = (e) => {
    dragging.current = true;
    dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    e.preventDefault();
  };

  return (
    <div style={{
      position: 'fixed',
      left: pos.x,
      top: pos.y,
      width,
      height: minimized ? 'auto' : height,
      display: 'flex',
      flexDirection: 'column',
      background: '#070709',
      border: '1px solid #003300',
      boxShadow: '0 8px 40px rgba(0,0,0,0.7), 0 0 0 1px rgba(0,255,65,0.06)',
      zIndex,
      overflow: 'hidden',
    }}>
      {/* Title bar */}
      <div
        onMouseDown={startDrag}
        style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '5px 8px', background: '#030303',
          borderBottom: minimized ? 'none' : '1px solid #002200',
          cursor: 'grab', userSelect: 'none', flexShrink: 0,
        }}
      >
        <span style={{
          fontFamily: '"Share Tech Mono", monospace', fontSize: 10,
          color: '#00ff41', letterSpacing: 2,
        }}>
          {title}
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={() => setMinimized((v) => !v)}
            style={{
              background: 'none', border: '1px solid #003300', color: '#006600',
              fontFamily: '"Share Tech Mono", monospace', fontSize: 10,
              cursor: 'pointer', width: 18, height: 18, lineHeight: '16px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {minimized ? '□' : '−'}
          </button>
          {onClose && (
            <button
              onClick={onClose}
              style={{
                background: 'none', border: '1px solid #330000', color: '#660000',
                fontFamily: '"Share Tech Mono", monospace', fontSize: 10,
                cursor: 'pointer', width: 18, height: 18, lineHeight: '16px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {!minimized && (
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {children}
        </div>
      )}
    </div>
  );
}
