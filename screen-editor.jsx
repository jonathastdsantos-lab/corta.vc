/* ============================================================
   EDITOR — single clip editing workspace
   ============================================================ */

function EditorScreen({ clip, lang, onClose, openAI, captionStyleId, onPickStyle }) {
  const T = STR[lang];
  const [tab, setTab] = useState('captions');
  const [styleId, setStyleId] = useState(captionStyleId || 'hormozi');
  const [hlColor, setHlColor] = useState('#ffe14d');
  const [capSize, setCapSize] = useState(26);
  const [pos, setPos] = useState('center');
  const [layout, setLayout] = useState('fill');
  const [ratio, setRatio] = useState('9:16');
  const [activeLine, setActiveLine] = useState(1);
  const [caption, setCaption] = useState(clip.cap);
  const [improving, setImproving] = useState(false);
  const [meta, setMeta] = useState(null);
  const [metaLoading, setMetaLoading] = useState(false);
  const [lines, setLines] = useState(TRANSCRIPT);
  const [playing, setPlaying] = useState(true);

  const style = { ...CAPTION_STYLES.find(s => s.id === styleId), hl: hlColor };
  const swatches = ['#ffe14d', '#7cf6c0', '#5ef1ff', '#ff7a9c', 'var(--accent)', '#ffffff'];

  async function improve() {
    setImproving(true);
    const r = await aiImproveCaption(caption, lang);
    setCaption(r);
    setImproving(false);
  }
  async function genMeta() {
    setMetaLoading(true);
    const r = await aiClipMeta({ ...clip, cap: caption }, lang);
    setMeta(r);
    setMetaLoading(false);
  }

  const tabs = [
    { id: 'captions', label: T.ed_captions, icon: 'text' },
    { id: 'style', label: T.ed_style, icon: 'palette' },
    { id: 'layout', label: T.ed_layout, icon: 'crop' },
    { id: 'brand', label: T.ed_brand, icon: 'star' },
    { id: 'export', label: T.ed_export, icon: 'send' },
  ];

  const posStyle = pos === 'center' ? { top: '50%', transform: 'translateY(-50%)' }
    : pos === 'bottom' ? { bottom: '16%' } : { top: '12%' };

  return (
    <div className="editor stage-scope">
      {/* LEFT: stage */}
      <div className="ed-main">
        <div className="ed-top">
          <IconBtn name="chevL" onClick={onClose} style={{ color: 'var(--stage-ink)' }} />
          <div className="ed-title">{clip.title}</div>
          <span className="tag" style={{ background: 'var(--stage-2)', borderColor: 'var(--stage-border)', color: 'var(--stage-muted)' }}>
            <Icon name="flame" size={12} />{clip.hook}
          </span>
          <div className="grow" />
          <div className="row" style={{ gap: 8 }}>
            <span style={{ color: 'var(--stage-muted)', fontSize: 12.5 }}>{T.virality}</span>
            <Score value={clip.score} size={38} showCap={false} />
          </div>
          <Btn variant="ghost" size="sm" icon="sparkles" onClick={openAI} style={{ borderColor: 'var(--stage-border)', color: 'var(--stage-ink)' }}>IA</Btn>
        </div>

        <div className="ed-stage">
          <div className="phone" style={{ aspectRatio: ratio.replace(':', '/') }}>
            <Thumb niche={clip.niche} label={false} />
            {/* face tracking box */}
            {layout === 'fill' && <div className="face-box" style={{ left: '26%', top: '20%', width: '48%', height: '30%' }} />}
            {layout === 'split' && <React.Fragment>
              <div style={{ position: 'absolute', inset: '0 0 50% 0', borderBottom: '2px solid rgba(255,255,255,.2)' }} />
            </React.Fragment>}
            {/* live caption */}
            <div className="live-cap" style={posStyle}>
              <CaptionText text={caption} style={style} fontSize={capSize} />
            </div>
            {/* top UI mimic */}
            <div style={{ position: 'absolute', top: 12, left: 12, right: 12, display: 'flex', gap: 4, zIndex: 4 }}>
              {[0, 1, 2, 3].map(i => <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i === 0 ? '#fff' : 'rgba(255,255,255,.35)' }} />)}
            </div>
          </div>
        </div>

        <div className="ed-transport">
          <IconBtn name={playing ? 'film' : 'play'} onClick={() => setPlaying(!playing)} style={{ color: 'var(--stage-ink)', background: 'var(--stage-2)' }} bordered />
          <span className="mono" style={{ fontSize: 12, color: 'var(--stage-muted)' }}>0:0{clip.dur > 9 ? clip.dur % 10 : clip.dur} / 0:{clip.dur}</span>
          <div className="timeline">
            <div className="wave">{Array.from({ length: 80 }).map((_, i) => <i key={i} style={{ height: `${20 + Math.abs(Math.sin(i * 0.6)) * 70}%` }} />)}</div>
            <div className="sel" style={{ left: '18%', right: '24%' }} />
            <div className="play-head" style={{ left: '34%' }} />
          </div>
          <Btn variant="soft" size="sm" icon="scissors" style={{ background: 'var(--stage-2)', color: 'var(--stage-ink)' }}>{lang === 'en' ? 'Trim' : 'Recortar'}</Btn>
        </div>
      </div>

      {/* RIGHT: panel */}
      <div className="ed-panel">
        <div className="ed-tabs">
          {tabs.map(t => (
            <button key={t.id} className={`ed-tab ${tab === t.id ? 'on' : ''}`} onClick={() => setTab(t.id)}>
              <Icon name={t.icon} size={17} />{t.label}
            </button>
          ))}
        </div>

        <div className="ed-panel-body">
          {tab === 'captions' && (
            <React.Fragment>
              <div className="panel-group">
                <div className="pg-label">{lang === 'en' ? 'Caption text' : 'Texto da legenda'}</div>
                <div className="ai-prompt-box" style={{ marginBottom: 10 }}>
                  <textarea rows={2} value={caption} onChange={e => setCaption(e.target.value)} style={{ minHeight: 44, fontSize: 14 }} />
                </div>
                <Btn variant="primary" size="sm" icon={improving ? 'refresh' : 'sparkles'} onClick={improve} disabled={improving} className={improving ? '' : ''}>
                  <span className={improving ? 'spin' : ''} style={{ display: 'none' }} />{improving ? (lang === 'en' ? 'Improving…' : 'Melhorando…') : T.ai_caption}
                </Btn>
                <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 8 }}>{lang === 'en' ? 'Wrap the punchiest word in {braces} to highlight it.' : 'Coloque a palavra mais forte entre {chaves} para destacá-la.'}</div>
              </div>

              <div className="panel-group">
                <div className="pg-label">{lang === 'en' ? 'Transcript' : 'Transcrição'} · {lang === 'en' ? 'click to edit' : 'clique p/ editar'}</div>
                {lines.map((l, i) => (
                  <div key={i} className={`cap-line ${activeLine === i ? 'active' : ''}`} onClick={() => setActiveLine(i)}>
                    <span className="ts">{l.t}</span>
                    <span className="ct" contentEditable suppressContentEditableWarning
                      dangerouslySetInnerHTML={{ __html: l.text.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>') }} />
                  </div>
                ))}
              </div>

              <div className="panel-group">
                <div className="pg-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="ai-chip"><Icon name="sparkles" size={11} />IA</span>{T.title_hashtags}
                </div>
                {!meta && (
                  <Btn variant="soft" size="sm" icon={metaLoading ? 'refresh' : 'wand'} onClick={genMeta} disabled={metaLoading}>
                    {metaLoading ? (lang === 'en' ? 'Generating…' : 'Gerando…') : T.generate_meta}
                  </Btn>
                )}
                {meta && (
                  <div className="card" style={{ padding: 12, borderRadius: 11 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.3 }}>{meta.title}</div>
                    <div className="row wrap" style={{ gap: 5, marginTop: 9 }}>
                      {meta.hashtags.map(h => <span key={h} className="tag" style={{ height: 22, fontSize: 11.5 }}>{h}</span>)}
                    </div>
                    <div className="row" style={{ gap: 6, marginTop: 11 }}>
                      <Btn variant="ghost" size="sm" icon="copy">{lang === 'en' ? 'Copy' : 'Copiar'}</Btn>
                      <Btn variant="ghost" size="sm" icon="refresh" onClick={genMeta}>{lang === 'en' ? 'Redo' : 'Refazer'}</Btn>
                    </div>
                  </div>
                )}
              </div>
            </React.Fragment>
          )}

          {tab === 'style' && (
            <React.Fragment>
              <div className="panel-group">
                <div className="pg-label">{lang === 'en' ? 'Caption style' : 'Estilo de legenda'}</div>
                <div className="style-grid">
                  {CAPTION_STYLES.map(s => (
                    <button key={s.id} className={`style-cell ${styleId === s.id ? 'on' : ''}`} onClick={() => { setStyleId(s.id); onPickStyle && onPickStyle(s.id); }}>
                      <div className="cap-demo" style={{ fontSize: 13 }}>
                        <CaptionText text={lang === 'en' ? 'this {works}' : 'isso {funciona}'} style={{ ...s, hl: s.id === styleId ? hlColor : s.hl }} fontSize={13} />
                        <div className="style-name">{s.name}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="panel-group">
                <div className="pg-label">{lang === 'en' ? 'Highlight color' : 'Cor de destaque'}</div>
                <div className="swatch-row">
                  {swatches.map(c => <button key={c} className={`swatch ${hlColor === c ? 'on' : ''}`} style={{ background: c }} onClick={() => setHlColor(c)} />)}
                </div>
              </div>
              <div className="panel-group">
                <div className="pg-label">{lang === 'en' ? 'Size & position' : 'Tamanho e posição'}</div>
                <div className="field-row">
                  <span className="frl"><Icon name="type" />{lang === 'en' ? 'Size' : 'Tamanho'}</span>
                  <input type="range" className="rng" min="16" max="40" value={capSize} onChange={e => setCapSize(+e.target.value)} />
                </div>
                <div className="field-row">
                  <span className="frl"><Icon name="sliders" />{lang === 'en' ? 'Position' : 'Posição'}</span>
                  <div className="seg">
                    {[['top', '↑'], ['center', '−'], ['bottom', '↓']].map(([v, g]) => <button key={v} className={pos === v ? 'on' : ''} onClick={() => setPos(v)}>{g}</button>)}
                  </div>
                </div>
                <div className="field-row">
                  <span className="frl"><Icon name="zap" />{lang === 'en' ? 'Animation' : 'Animação'}</span>
                  <span className="tag accent">{style.anim === 'word' ? 'Karaokê' : style.anim === 'pop' ? 'Pop' : 'Fade'}</span>
                </div>
              </div>
            </React.Fragment>
          )}

          {tab === 'layout' && (
            <React.Fragment>
              <div className="panel-group">
                <div className="pg-label">{lang === 'en' ? 'Framing' : 'Enquadramento'}</div>
                <div className="style-grid">
                  {LAYOUTS.map(l => (
                    <button key={l.id} className={`style-cell ${layout === l.id ? 'on' : ''}`} onClick={() => setLayout(l.id)} style={{ flexDirection: 'column' }}>
                      <LayoutGlyph kind={l.glyph} />
                      <div className="style-name">{l.name}</div>
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Icon name="target" size={13} style={{ color: 'var(--good)' }} />
                  {lang === 'en' ? 'AI keeps the speaker centered automatically.' : 'A IA mantém o falante centralizado automaticamente.'}
                </div>
              </div>
              <div className="panel-group">
                <div className="pg-label">{T.ratio}</div>
                <div className="ratio-pick">
                  {RATIOS.map(r => (
                    <button key={r.id} className={`ratio-opt ${ratio === r.id ? 'on' : ''}`} onClick={() => setRatio(r.id)}>
                      <div className="glyph" style={{ width: r.w * 0.7, height: r.h * 0.7 }} />
                      <div className="rname">{r.id}</div>
                    </button>
                  ))}
                </div>
              </div>
            </React.Fragment>
          )}

          {tab === 'brand' && (
            <React.Fragment>
              <div className="panel-group">
                <div className="pg-label">{lang === 'en' ? 'Logo' : 'Logo'}</div>
                <div className="dropzone" style={{ padding: 20 }}>
                  <div className="dz-icon" style={{ width: 40, height: 40, marginBottom: 10 }}><Icon name="image" size={20} /></div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{lang === 'en' ? 'Drop your logo' : 'Solte seu logo'}</div>
                  <div className="sub" style={{ fontSize: 12, marginTop: 2 }}>PNG · SVG</div>
                </div>
              </div>
              <div className="panel-group">
                <div className="pg-label">{lang === 'en' ? 'Brand color' : 'Cor da marca'}</div>
                <div className="swatch-row">
                  {['var(--accent)', '#111', '#1f9d6b', '#2e6bff', '#7c5cff', '#e8543b'].map(c => <button key={c} className="swatch" style={{ background: c }} />)}
                </div>
              </div>
              <div className="panel-group">
                <div className="pg-label">{lang === 'en' ? 'Font' : 'Fonte'}</div>
                {['Schibsted Grotesk', 'Anton', 'Poppins'].map((f, i) => (
                  <div key={f} className="field-row" style={{ cursor: 'pointer' }}>
                    <span className="frl" style={{ fontWeight: 700 }}>{f}</span>
                    {i === 0 ? <Icon name="checkCircle" size={18} style={{ color: 'var(--accent)' }} /> : <div className="switch" />}
                  </div>
                ))}
              </div>
              <div className="panel-group">
                <div className="field-row">
                  <span className="frl"><Icon name="bookmark" />{lang === 'en' ? 'Auto outro / CTA' : 'Encerramento / CTA'}</span>
                  <Switch on={true} onClick={() => { }} />
                </div>
              </div>
            </React.Fragment>
          )}

          {tab === 'export' && (
            <React.Fragment>
              <div className="panel-group">
                <div className="pg-label">{lang === 'en' ? 'Publish to' : 'Publicar em'}</div>
                {PLATFORMS.slice(0, 5).map((p, i) => (
                  <div key={p.id} className="field-row">
                    <span className="frl"><span className={`plat ${p.id}`} style={{ width: 24, height: 24 }}><Icon plat={p.id} size={14} /></span>{p.name}</span>
                    <Switch on={i < 3} onClick={() => { }} />
                  </div>
                ))}
              </div>
              <div className="panel-group">
                <Btn variant="primary" size="lg" icon="send" className="grow" style={{ width: '100%', marginBottom: 9 }} onClick={openAI}>{lang === 'en' ? 'Schedule post' : 'Agendar publicação'}</Btn>
                <Btn variant="ghost" size="lg" icon="download" style={{ width: '100%' }}>{lang === 'en' ? 'Download clip' : 'Baixar corte'}</Btn>
                <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 12, textAlign: 'center' }}>1080×1920 · MP4 · {lang === 'en' ? 'no watermark' : 'sem marca d\'água'}</div>
              </div>
            </React.Fragment>
          )}
        </div>
      </div>
    </div>
  );
}

function LayoutGlyph({ kind }) {
  const box = { position: 'relative', width: 30, height: 46, borderRadius: 5, border: '2px solid currentColor', color: 'var(--muted)', overflow: 'hidden' };
  return (
    <div style={box}>
      {kind === 'fill' && <div style={{ position: 'absolute', left: '50%', top: '30%', transform: 'translateX(-50%)', width: 12, height: 12, borderRadius: 99, border: '2px solid currentColor' }} />}
      {kind === 'split' && <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', borderTop: '2px solid currentColor' }} />}
      {kind === 'stack' && <div style={{ position: 'absolute', left: 0, right: 0, top: '40%', height: '2px', background: 'currentColor' }} />}
      {kind === 'blur' && <div style={{ position: 'absolute', inset: '28% 18%', border: '2px solid currentColor', borderRadius: 3 }} />}
    </div>
  );
}

Object.assign(window, { EditorScreen });
