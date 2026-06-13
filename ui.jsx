/* ============================================================
   UI — icons + shared primitives
   ============================================================ */
const { useState, useEffect, useRef, useMemo } = React;

// ---- Icon set (stroke, 24-grid) ----
const I = {
  home: 'M3 10.5 12 3l9 7.5M5 9.5V21h5v-6h4v6h5V9.5',
  folder: 'M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z',
  film: 'M4 4h16v16H4Zm0 4h16M4 16h16M8 4v16M16 4v16',
  template: 'M4 4h7v7H4Zm9 0h7v4h-7Zm0 7h7v9h-7ZM4 14h7v6H4Z',
  calendar: 'M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2ZM4 9h16M8 3v3M16 3v3',
  chart: 'M4 20V4M4 20h16M8 20v-6M13 20V9M18 20v-9',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM21 21l-4.3-4.3',
  plus: 'M12 5v14M5 12h14',
  scissors: 'M6 6a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Zm0 7a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5ZM8 8l12 8M8 16 20 8M14 12l6-4',
  sparkles: 'M12 3l1.8 4.7L18.5 9l-4.7 1.3L12 15l-1.8-4.7L5.5 9l4.7-1.3ZM18 14l.9 2.3 2.3.9-2.3.9L18 20l-.9-2.3-2.3-.9 2.3-.9Z',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 1 0-5.7-5.7l-1.5 1.5M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 1 0 11 18.7l1.5-1.5',
  upload: 'M12 16V4M8 8l4-4 4 4M5 20h14',
  play: 'M7 4v16l13-8Z',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  send: 'M22 2 11 13M22 2l-7 20-4-9-9-4Z',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2',
  chevR: 'M9 6l6 6-6 6', chevD: 'M6 9l6 6 6-6', chevL: 'M15 6l-6 6 6 6',
  x: 'M6 6l12 12M18 6 6 18',
  wand: 'M15 4V2M15 10V8M11 6h2M17 6h2M5 21l11-11 2 2L7 23ZM14 7l3 3',
  type: 'M4 6V4h16v2M9 20h6M12 4v16',
  palette: 'M12 21a9 9 0 1 1 0-18c4.5 0 8 3 8 7 0 2.5-2 3.5-4 3.5h-1.5a1.5 1.5 0 0 0-1 2.6c.4.4.5.9.5 1.4a2 2 0 0 1-2 1.5ZM7.5 12a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm3-3a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm5 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z',
  image: 'M4 5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1Zm2 12 4-4 3 3 3-3 4 4M9 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z',
  crop: 'M6 2v14a2 2 0 0 0 2 2h14M2 6h14a2 2 0 0 1 2 2v14',
  music: 'M9 18a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM9 12V5l10-2v7M19 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  download: 'M12 4v12M8 12l4 4 4-4M5 20h14',
  check: 'M5 12l5 5 9-11',
  checkCircle: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM8.5 12l2.5 2.5 4.5-5',
  arrowR: 'M5 12h14M13 6l6 6-6 6',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 13a7.5 7.5 0 0 0 0-2l2-1.5-2-3.4-2.3 1a7.6 7.6 0 0 0-1.7-1l-.3-2.6h-4l-.3 2.6a7.6 7.6 0 0 0-1.7 1l-2.3-1-2 3.4L4.6 11a7.5 7.5 0 0 0 0 2l-2 1.5 2 3.4 2.3-1a7.6 7.6 0 0 0 1.7 1l.3 2.6h4l.3-2.6a7.6 7.6 0 0 0 1.7-1l2.3 1 2-3.4Z',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM3 12h18M12 3c2.5 2.5 3.5 6 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-6-3.5-9s1-6.5 3.5-9Z',
  mic: 'M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3ZM6 11a6 6 0 0 0 12 0M12 18v3',
  message: 'M4 5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-4 4Z',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-4a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0-3a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
  trend: 'M3 17l6-6 4 4 7-7M14 8h6v6',
  zap: 'M13 2 4 14h7l-2 8 9-12h-7Z',
  grid: 'M4 4h7v7H4Zm9 0h7v7h-7ZM4 13h7v7H4Zm9 0h7v7h-7Z',
  sliders: 'M4 8h10M18 8h2M4 16h2M10 16h10M14 6v4M6 14v4',
  refresh: 'M4 12a8 8 0 0 1 14-5l2 2M20 12a8 8 0 0 1-14 5l-2-2M18 4v5h-5M6 20v-5h5',
  hash: 'M9 4 7 20M17 4l-2 16M5 9h15M4 15h15',
  brain: 'M9 4a3 3 0 0 0-3 3 3 3 0 0 0-1 5 3 3 0 0 0 2 5 3 3 0 0 0 5 1V4a2 2 0 0 0-3 0ZM15 4a3 3 0 0 1 3 3 3 3 0 0 1 1 5 3 3 0 0 1-2 5 3 3 0 0 1-5 1',
  gamepad: 'M7 12h4m-2-2v4M15 11h.01M18 13h.01M3 16l1.5-7A3 3 0 0 1 7.5 7h9a3 3 0 0 1 3 2l1.5 7a2 2 0 0 1-3.7 1.2L15.5 16h-7l-1.8 1.2A2 2 0 0 1 3 16Z',
  lock: 'M6 11V8a6 6 0 0 1 12 0v3M5 11h14v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1Z',
  star: 'M12 3l2.6 5.8 6.4.6-4.8 4.2 1.4 6.2L12 16.8 6.4 19.8 7.8 13.6 3 9.4l6.4-.6Z',
  flame: 'M12 22c4 0 7-2.5 7-7 0-4-3-6-3-9 0 0-2 2-2.5 5C13 9 12 7 12 4c0 0-7 3-7 11 0 4.5 3 7 7 7Z',
  scissors2: 'M8 8l8 8m0-8-8 8',
  copy: 'M9 9h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V10a1 1 0 0 1 1-1ZM5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1',
  heart: 'M12 20s-7-4.5-9.5-9C1 8 2.5 4.5 6 4.5c2 0 3.2 1.2 4 2.3.8-1.1 2-2.3 4-2.3 3.5 0 5 3.5 3.5 6.5C19 15.5 12 20 12 20Z',
  bookmark: 'M6 4h12a1 1 0 0 1 1 1v15l-7-4-7 4V5a1 1 0 0 1 1-1Z',
  ratio: 'M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z',
  text: 'M5 7V5h14v2M12 5v14M9 19h6',
  bell: 'M6 8a6 6 0 0 1 12 0c0 4 2 6 2 7H4c0-1 2-3 2-7ZM10 21h4M12 3v1',
  alert: 'M12 9v4M12 17h.01M10.3 4l-8.3 14a1 1 0 0 0 .9 1.5h18.2a1 1 0 0 0 .9-1.5L13.7 4a1 1 0 0 0-1.7 0Z',
  arrowL: 'M19 12H5M12 6l-6 6 6 6',
  close: 'M6 6l12 12M18 6 6 18',
  users: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
  trash: 'M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6',
  undo: 'M3 7v6h6M3 13C5 7.5 10 4 16 5.5a9 9 0 0 1 5 8',
  info: 'M12 8h.01M12 12v4M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
  drag: 'M9 6h.01M9 12h.01M9 18h.01M15 6h.01M15 12h.01M15 18h.01',
  apple: 'M12 2.5a3.5 3.5 0 0 1 3-1.5c.3 1.2-.2 2.5-1 3.2-.8.8-2 1.2-3 1-.3-1.2.2-2.5 1-3.2v.5Zm5.5 3c1.5 0 2.5 1 3 1.5-1 1-1.5 2.5-1.5 4s1 3 1.5 4c-1 1.5-2 3-3.5 3-1.5 0-2.5-.5-3.5-.5s-2 .5-3.5.5C7.5 18 6 16.5 5 15c-1.5-2.5-1.5-6.5-.5-8.5 1-1.5 2.5-2.5 4-2.5 1.5 0 2.5.5 3.5.5s2-.5 3.5-.5Z',
  github: 'M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22',
  save:   'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2zM17 21v-8H7v8M7 3v5h8',
  resize: 'M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7'
};

// Platform mini-glyphs (generic, non-trademark)
const PG = {
  tiktok: 'M9 17a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM12 11V5c1 2 3 3 5 3M12 5v6',
  youtube: 'M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2ZM10 9l5 3-5 3Z',
  instagram: 'M4 4h16v16H4Zm12 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8Zm1.5-1.5h.01',
  x: 'M5 5l14 14M19 5 5 19',
  linkedin: 'M5 9v10M5 5v.01M10 19v-6a3 3 0 0 1 6 0v6M10 9v10',
  facebook: 'M14 7h2V4h-2a3 3 0 0 0-3 3v2H9v3h2v8h3v-8h2.5l.5-3H14V7Z',
  kwai: 'M6 4v16l7-8-7-8ZM13 12h6',
};

function Icon({ name, size = 20, plat, fill = 'none', stroke = 2, style, className }) {
  const d = plat ? PG[plat] : I[name];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill === 'current' ? 'currentColor' : 'none'}
      stroke={fill === 'current' ? 'none' : 'currentColor'} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"
      style={style} className={className} aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

function Btn({ variant = 'ghost', size, icon, iconR, children, className = '', ...p }) {
  const sz = size === 'sm' ? 'btn-sm' : size === 'lg' ? 'btn-lg' : '';
  return (
    <button className={`btn btn-${variant} ${sz} ${className}`} {...p}>
      {icon && <Icon name={icon} size={size === 'sm' ? 15 : 17} />}
      {children}
      {iconR && <Icon name={iconR} size={size === 'sm' ? 15 : 17} />}
    </button>
  );
}

function IconBtn({ name, size = 20, bordered, className = '', ...p }) {
  return (
    <button className={`btn-icon ${bordered ? 'bordered' : ''} ${className}`} {...p}>
      <Icon name={name} size={size} />
    </button>
  );
}

function Avatar({ name = 'RA', size = 32, src, tint }) {
  return (
    <div className="avatar" style={{ width: size, height: size, fontSize: size * 0.4, background: tint }}>
      {src ? <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : name}
    </div>
  );
}

// Striped video placeholder
function Thumb({ niche, ratio, label, score, dur, children, className = '', style, reelChrome = false }) {
  const n = NICHES[niche];
  const isVertical = !ratio || ratio === '9:16';
  return (
    <div className={`thumb ${className}`} style={{ '--thumb-tint': n ? n.tint : undefined, ...style }}>
      {label !== false && <span className="thumb-label">{label || (n ? n.label : 'vídeo')}{ratio ? ` · ${ratio}` : ''}</span>}
      {dur && <span className="badge-bl">{typeof dur === 'number' ? `0:${String(dur).padStart(2, '0')}` : dur}</span>}
      {score != null && (
        <span className="badge-tr" style={{ background: scoreColor(score), color: score >= 80 ? '#fff' : '#1a1a1a' }}>
          {score}
        </span>
      )}
      <span className="play"><Icon name="play" fill="current" /></span>
      {children}
      {(reelChrome || isVertical) && (
        <div className="reel-chrome" aria-hidden="true">
          {/* Barra de progresso no topo */}
          <div className="reel-progress">
            <div className="reel-progress-bar" />
          </div>
          {/* Coluna lateral direita: ❤️ 💬 ↗ */}
          <div className="reel-actions">
            <div className="reel-action">
              <Icon name="heart" size={20} />
              <span>24k</span>
            </div>
            <div className="reel-action">
              <Icon name="message" size={20} />
              <span>847</span>
            </div>
            <div className="reel-action">
              <Icon name="send" size={20} />
              <span>1.2k</span>
            </div>
            <div className="reel-action" style={{ marginTop: 8 }}>
              <div className="reel-audio-disc" />
            </div>
          </div>
          {/* Rodapé: @handle + legenda */}
          <div className="reel-footer">
            <div className="reel-handle">@{(niche || 'criador').replace('oes','')}</div>
            <div className="reel-desc">{n ? n.label : 'Vídeo'} · Corta.vc ✂️</div>
          </div>
        </div>
      )}
    </div>
  );
}

// Virality score ring
function Score({ value, size = 44, stroke = 4, showCap = true, breakdown = null }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const col = scoreColor(value);
  const [showPopover, setShowPopover] = useState(false);

  // Breakdown padrão derivado do score se não fornecido explicitamente
  const bd = breakdown || {
    hook:     Math.min(10, Math.round(value / 10 + (value > 80 ? 1 : -1))),
    rhythm:   Math.min(10, Math.round(value / 11 + (value > 70 ? 1 : 0))),
    trend:    Math.min(10, Math.round(value / 12)),
    emotion:  Math.min(10, Math.round(value / 10)),
  };

  const labels = { hook: 'Gancho', rhythm: 'Ritmo', trend: 'Tendência', emotion: 'Emoção' };

  return (
    <div className="score" style={{ width: size, height: size, position: 'relative' }}
      onMouseEnter={() => setShowPopover(true)}
      onMouseLeave={() => setShowPopover(false)}
    >
      <svg width={size} height={size}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={col} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c - (value / 100) * c}
          style={{ transition: 'stroke-dashoffset 1s cubic-bezier(.2,.7,.2,1)' }} />
      </svg>
      <span className="score-num" style={{
        color: col, fontSize: size * 0.3,
        top: showCap ? size * 0.22 : '50%',
        transform: showCap ? 'none' : 'translateY(-50%)'
      }}>{value}</span>
      {showCap && <span className="score-cap">VIRAL</span>}

      {showPopover && (
        <div className="score-popover" role="tooltip">
          <div className="score-popover-title">Nota de viralização</div>
          {Object.entries(bd).map(([key, val]) => (
            <div key={key} className="score-popover-row">
              <span className="score-popover-label">{labels[key] || key}</span>
              <div className="score-popover-bar-track">
                <div className="score-popover-bar" style={{
                  width: `${val * 10}%`,
                  background: val >= 8 ? 'var(--good)' : val >= 6 ? 'var(--warn)' : 'var(--hot)'
                }} />
              </div>
              <span className="score-popover-val">{val}/10</span>
            </div>
          ))}
          <div className="score-popover-footer">Calculado pela IA com base no conteúdo</div>
        </div>
      )}
    </div>
  );
}

function Switch({ on, onClick }) {
  return <button className={`switch ${on ? 'on' : ''}`} onClick={onClick} aria-pressed={on}><i /></button>;
}

function Seg({ value, options, onChange }) {
  return (
    <div className="seg">
      {options.map(o => (
        <button key={o.v} className={value === o.v ? 'on' : ''} onClick={() => onChange(o.v)}>{o.label}</button>
      ))}
    </div>
  );
}

// Render a caption with {highlighted} word per a style
function CaptionText({ text, style, fontSize = 17 }) {
  const parts = text.split(/(\{[^}]+\})/g);
  const s = style || CAPTION_STYLES[0];
  const wrapStyle = {
    fontFamily: 'var(--font-ui)', fontWeight: s.font.includes('800') ? 800 : s.font.includes('700') ? 700 : 600,
    color: s.color, fontSize, lineHeight: 1.12, textTransform: s.uppercase ? 'uppercase' : 'none',
    textShadow: s.stroke ? '0 0 1px #000, 1px 1px 0 #000, -1px 1px 0 #000, 0 2px 6px rgba(0,0,0,.5)' : '0 2px 8px rgba(0,0,0,.55)',
    filter: s.glow ? `drop-shadow(0 0 8px ${s.hl})` : 'none',
    letterSpacing: '-.01em',
  };
  return (
    <span style={wrapStyle}>
      {parts.map((p, i) => {
        if (p.startsWith('{')) {
          const w = p.slice(1, -1);
          if (s.bar) return <span key={i} style={{ background: s.hl, color: '#111', padding: '0 4px', borderRadius: 3, boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone' }}>{w}</span>;
          return <span key={i} style={{ color: s.hl, filter: s.glow ? `drop-shadow(0 0 6px ${s.hl})` : 'none' }}>{w}</span>;
        }
        return <React.Fragment key={i}>{p}</React.Fragment>;
      })}
    </span>
  );
}

function Empty({ icon = 'film', children }) {
  return <div className="empty"><Icon name={icon} size={40} /><div>{children}</div></div>;
}

// ---- Toast system ----
let _toastId = 0;
const _toastListeners = new Set();

function showToast(message, { type = 'success', duration = 3500, undo } = {}) {
  const id = ++_toastId;
  const toast = { id, message, type, duration, undo };
  _toastListeners.forEach(fn => fn({ action: 'add', toast }));
  if (duration > 0) {
    setTimeout(() => _toastListeners.forEach(fn => fn({ action: 'remove', id })), duration);
  }
  return id;
}

function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    function listener({ action, toast, id }) {
      if (action === 'add') setToasts(prev => [...prev, toast]);
      if (action === 'remove') setToasts(prev => prev.filter(t => t.id !== id));
    }
    _toastListeners.add(listener);
    return () => _toastListeners.delete(listener);
  }, []);

  if (!toasts.length) return null;

  return (
    <div className="toast-container" role="status" aria-live="polite">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          <span className="toast-icon">
            {t.type === 'success' && <Icon name="checkCircle" size={16} />}
            {t.type === 'error' && <Icon name="alert" size={16} />}
            {t.type === 'info' && <Icon name="sparkles" size={16} />}
          </span>
          <span className="toast-msg">{t.message}</span>
          {t.undo && (
            <button className="toast-undo" onClick={() => {
              t.undo();
              _toastListeners.forEach(fn => fn({ action: 'remove', id: t.id }));
            }}>
              Desfazer
            </button>
          )}
          <button className="toast-close" onClick={() =>
            _toastListeners.forEach(fn => fn({ action: 'remove', id: t.id }))
          } aria-label="Fechar">
            <Icon name="x" size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

Object.assign(window, { Icon, Btn, IconBtn, Avatar, Thumb, Score, Switch, Seg, CaptionText, Empty,
  showToast, ToastContainer,
  useState, useEffect, useRef, useMemo });
