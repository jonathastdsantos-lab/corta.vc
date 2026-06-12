/* ============================================================
   SCREENS — Dashboard · Import · Processing · Clips
   ============================================================ */

function Dashboard({ lang, go, openAI }) {
  const T = STR[lang];
  const [link, setLink] = useState('');
  const sources = [
    { ic: 'youtube', label: 'YouTube' }, { ic: 'upload', label: lang === 'en' ? 'Upload' : 'Upload', plain: true },
    { ic: 'link', label: 'Drive', plain: true }, { ic: 'gamepad', label: 'Twitch', plain: true },
    { ic: 'mic', label: 'Zoom', plain: true },
  ];
  return (
    <div className="page">
      <div className="fade-up" style={{ marginBottom: 26 }}>
        <h1 className="h1">{T.greeting} <span style={{ color: 'var(--accent)' }}>✦</span></h1>
        <p className="sub">{T.greeting_sub}</p>
      </div>

      {/* Import hero */}
      <div className="hero-import fade-up" style={{ marginBottom: 28 }}>
        <div className="import-field">
          <Icon name="link" />
          <input value={link} onChange={e => setLink(e.target.value)} placeholder={T.paste_ph}
            onKeyDown={e => { if (e.key === 'Enter' && link.trim()) go('processing'); }} />
          <Btn variant="ghost" size="sm" icon="upload" onClick={() => go('import')}>{lang === 'en' ? 'File' : 'Arquivo'}</Btn>
          <Btn variant="primary" icon="sparkles" onClick={() => go(link.trim() ? 'processing' : 'import')}>{T.generate}</Btn>
        </div>
        <div className="source-chips">
          <span style={{ fontSize: 12.5, color: 'var(--muted)', fontWeight: 600, alignSelf: 'center', marginRight: 2 }}>{lang === 'en' ? 'From:' : 'De:'}</span>
          {sources.map(s => (
            <span key={s.label} className="source-chip">
              <Icon name={s.plain ? s.ic : undefined} plat={s.plain ? undefined : s.ic} size={14} />{s.label}
            </span>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="stat-row stagger" style={{ marginBottom: 30 }}>
        {STATS.map(s => (
          <div key={s.key} className="stat">
            <div className="label"><Icon name={s.icon} size={15} />{s.label[lang]}</div>
            <div className="num">{s.num}</div>
            <div className={`delta ${s.dir}`}>{s.dir === 'up' ? '↑' : '↓'} {s.delta}</div>
          </div>
        ))}
      </div>

      {/* Recent projects */}
      <div className="section-head">
        <div><h2 className="h2">{T.recent}</h2></div>
        <button className="link-more" onClick={() => go('clips')}>{T.see_all} <Icon name="arrowR" size={15} /></button>
      </div>
      <div className="proj-grid stagger">
        {PROJECTS.map(p => (
          <button key={p.id} className="proj-card" onClick={() => go('clips', { project: p })}>
            <Thumb niche={p.niche} ratio="16:9" dur={p.dur}>
              <span className="badge-tl"><Icon name={p.src === 'youtube' ? undefined : 'film'} plat={p.src === 'youtube' ? 'youtube' : undefined} size={12} /></span>
            </Thumb>
            <div className="body">
              <div className="title">{p.title}</div>
              <div className="meta">
                <span className="tag accent"><Icon name="scissors" size={12} />{p.clips} {T.clips_from}</span>
                <span style={{ marginLeft: 'auto' }}>{p.when}</span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function ImportScreen({ lang, go, user }) {
  const T = STR[lang];
  const [prompt, setPrompt] = useState('');
  const [dur, setDur] = useState('auto');
  const [clipLang, setClipLang] = useState('pt');
  const [ratio, setRatio] = useState('9:16');
  const [caps, setCaps] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  const ideas = lang === 'en' ? PROMPT_IDEAS_EN : PROMPT_IDEAS_PT;

  async function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    await Supa.uploadVideo(file, user?.id || 'anon');
    setUploading(false);
    go('processing');
  }
  const durs = [
    { v: 'auto', label: T.auto }, { v: '<30', label: '<30s' },
    { v: '30-60', label: '30–60s' }, { v: '60-90', label: '60–90s' },
  ];

  return (
    <div className="page">
      <div className="import-wrap fade-up">
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <h1 className="h1">{T.import_title}</h1>
          <p className="sub" style={{ maxWidth: 460, margin: '8px auto 0' }}>{T.import_sub}</p>
        </div>

        <div className="dropzone" onClick={() => !uploading && fileRef.current?.click()}>
          <input ref={fileRef} type="file" accept="video/*" hidden onChange={onFile} />
          <div className="dz-icon"><Icon name={uploading ? 'refresh' : 'upload'} size={26} className={uploading ? 'spin' : ''} /></div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{uploading ? (lang === 'en' ? 'Uploading…' : 'Enviando…') : (lang === 'en' ? 'Drop your video or paste a link' : 'Solte seu vídeo ou cole um link')}</div>
          <div className="sub" style={{ marginTop: 4 }}>{T.accepts}</div>
          <div className="row" style={{ justifyContent: 'center', gap: 8, marginTop: 16 }}>
            {['youtube', 'instagram', 'tiktok'].map(p => <span key={p} className="plat" style={{ width: 30, height: 30 }} ><Icon plat={p} size={16} /></span>)}
            <span className="source-chip"><Icon name="link" size={14} />Drive · Zoom · Twitch</span>
          </div>
        </div>

        {/* AI prompt */}
        <div style={{ marginTop: 24 }}>
          <div className="opt-label" style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="ai-chip"><Icon name="sparkles" size={12} />IA</span>{T.ai_prompt_label}
          </div>
          <div className="ai-prompt-box">
            <textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder={T.ai_prompt_ph} />
            <div className="ai-prompt-foot">
              {ideas.map(idea => <button key={idea} className="prompt-pill" onClick={() => setPrompt(idea)}>{idea}</button>)}
            </div>
          </div>
        </div>

        {/* Options */}
        <div className="opt-grid">
          <div className="opt-box">
            <div className="opt-label"><Icon name="clock" />{T.duration}</div>
            <div className="seg">{durs.map(d => <button key={d.v} className={dur === d.v ? 'on' : ''} onClick={() => setDur(d.v)}>{d.label}</button>)}</div>
          </div>
          <div className="opt-box">
            <div className="opt-label"><Icon name="globe" />{T.language}</div>
            <div className="seg">
              <button className={clipLang === 'pt' ? 'on' : ''} onClick={() => setClipLang('pt')}>🇧🇷 PT</button>
              <button className={clipLang === 'en' ? 'on' : ''} onClick={() => setClipLang('en')}>🇺🇸 EN</button>
              <button className={clipLang === 'es' ? 'on' : ''} onClick={() => setClipLang('es')}>🇪🇸 ES</button>
            </div>
          </div>
          <div className="opt-box" style={{ gridColumn: '1 / -1' }}>
            <div className="opt-label"><Icon name="ratio" />{T.ratio}</div>
            <div className="ratio-pick">
              {RATIOS.map(r => (
                <button key={r.id} className={`ratio-opt ${ratio === r.id ? 'on' : ''}`} onClick={() => setRatio(r.id)}>
                  <div className="glyph" style={{ width: r.w, height: r.h }} />
                  <div className="rname">{r.name}</div>
                  <div className="rmeta">{r.id}</div>
                </button>
              ))}
            </div>
          </div>
          <div className="opt-box" style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="opt-label" style={{ margin: 0 }}><Icon name="text" />{T.captions_on}</div>
            <Switch on={caps} onClick={() => setCaps(!caps)} />
          </div>
        </div>

        <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <Btn variant="ghost" onClick={() => go('dashboard')}>{lang === 'en' ? 'Cancel' : 'Cancelar'}</Btn>
          <Btn variant="primary" size="lg" icon="sparkles" onClick={() => go('processing')}>{T.generate}</Btn>
        </div>
      </div>
    </div>
  );
}

function ProcessingScreen({ lang, go }) {
  const T = STR[lang];
  const steps = lang === 'en'
    ? ['Transcribing audio', 'Finding key moments', 'Scoring virality', 'Reframing & captions']
    : ['Transcrevendo o áudio', 'Achando os melhores momentos', 'Calculando viralização', 'Reenquadrando e legendando'];
  const stepIcons = ['mic', 'target', 'flame', 'crop'];
  const [active, setActive] = useState(0);
  const [pct, setPct] = useState(0);

  useEffect(() => {
    const total = 5200;
    const start = Date.now();
    const iv = setInterval(() => {
      const e = Date.now() - start;
      const p = Math.min(100, (e / total) * 100);
      setPct(p);
      setActive(Math.min(steps.length - 1, Math.floor((p / 100) * steps.length)));
      if (p >= 100) { clearInterval(iv); setTimeout(() => go('clips'), 500); }
    }, 60);
    return () => clearInterval(iv);
  }, []);

  const r = 54, c = 2 * Math.PI * r;
  return (
    <div className="page">
      <div className="proc-wrap fade-up">
        <div className="proc-ring">
          <svg width="120" height="120" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="60" cy="60" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="8" />
            <circle cx="60" cy="60" r={r} fill="none" stroke="var(--accent)" strokeWidth="8" strokeLinecap="round"
              strokeDasharray={c} strokeDashoffset={c - (pct / 100) * c} style={{ transition: 'stroke-dashoffset .1s linear' }} />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
            <div className="mono" style={{ fontSize: 26, fontWeight: 700 }}>{Math.round(pct)}%</div>
          </div>
        </div>
        <h1 className="h1">{T.processing}</h1>
        <p className="sub">{T.processing_sub}</p>

        <div className="proc-steps card" style={{ padding: 8 }}>
          {steps.map((s, i) => (
            <div key={i} className={`proc-step ${i < active ? 'done' : i === active ? 'active' : ''}`}>
              <div className="pstep-ic">
                {i < active ? <Icon name="check" size={15} /> : i === active ? <Icon name={stepIcons[i]} size={15} className="spin" /> : <Icon name={stepIcons[i]} size={15} />}
              </div>
              <span className="grow">{s}</span>
              {i < active && <span className="mono" style={{ fontSize: 12, color: 'var(--good)' }}>✓</span>}
              {i === active && <span className="mono" style={{ fontSize: 12, color: 'var(--muted)' }}>…</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ClipsScreen({ lang, go, project, openClip }) {
  const T = STR[lang];
  const [sort, setSort] = useState('score');
  const [niche, setNiche] = useState('all');
  const sorted = useMemo(() => {
    let arr = [...CLIPS];
    if (niche !== 'all') arr = arr.filter(c => c.niche === niche);
    if (sort === 'score') arr.sort((a, b) => b.score - a.score);
    if (sort === 'dur') arr.sort((a, b) => a.dur - b.dur);
    return arr;
  }, [sort, niche]);
  const niches = ['all', ...new Set(CLIPS.map(c => c.niche))];

  return (
    <div className="page page-wide">
      <div className="section-head fade-up">
        <div>
          <div className="h-eyebrow">{project ? (lang === 'en' ? 'From project' : 'Do projeto') : (lang === 'en' ? 'Latest batch' : 'Último lote')}</div>
          <h1 className="h1">{project ? project.title.slice(0, 42) + (project.title.length > 42 ? '…' : '') : (lang === 'en' ? 'Your clips' : 'Seus cortes')}</h1>
          <p className="sub">{sorted.length} {T.clips_ready} · {lang === 'en' ? 'ranked by AI virality score' : 'ordenados pela nota de viralização da IA'}</p>
        </div>
        <Btn variant="dark" icon="plus" onClick={() => go('import')}>{T.new_clip}</Btn>
      </div>

      <div className="filter-bar">
        {niches.map(n => (
          <button key={n} className={`chip-toggle ${niche === n ? 'on' : ''}`} onClick={() => setNiche(n)}>
            {n === 'all' ? T.filter_all : NICHES[n].label}
          </button>
        ))}
        <div style={{ marginLeft: 'auto' }}>
          <div className="seg">
            <button className={sort === 'score' ? 'on' : ''} onClick={() => setSort('score')}>{T.sort_score}</button>
            <button className={sort === 'dur' ? 'on' : ''} onClick={() => setSort('dur')}>{T.sort_dur}</button>
          </div>
        </div>
      </div>

      <div className="clips-grid stagger">
        {sorted.map(c => {
          const style = CAPTION_STYLES[0];
          return (
            <div key={c.id} className="clip-card" onClick={() => openClip(c)}>
              <Thumb niche={c.niche} dur={c.dur} score={c.score}>
                <div className="cap"><CaptionText text={c.cap} style={style} fontSize={13} /></div>
              </Thumb>
              <div className="body">
                <div className="title">{c.title}</div>
                <div className="foot">
                  <span className="tag"><Icon name="flame" size={12} />{c.hook}</span>
                  <div className="row" style={{ gap: 4 }}>
                    <IconBtn name="scissors" size={15} onClick={e => { e.stopPropagation(); openClip(c); }} />
                    <IconBtn name="download" size={15} onClick={e => e.stopPropagation()} />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

Object.assign(window, { Dashboard, ImportScreen, ProcessingScreen, ClipsScreen });
