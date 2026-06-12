/* ============================================================
   SCREENS — Dashboard · Import · Processing · Clips
   ============================================================ */

function Dashboard({ lang, go, openAI, user }) {
  const T = STR[lang];
  const [link, setLink] = useState('');
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!Supa.client || !user) {
        setProjects(window.PROJECTS || []);
        setLoading(false);
        return;
      }
      const { data } = await Supa.client.from('projects')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(6);
      
      setProjects(data || []);
      setLoading(false);
    }
    load();
  }, [user]);

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
        {loading ? (
          [1,2,3].map(i => (
            <div key={i} className="proj-card" style={{height: 200, background: 'var(--surface-3)', animation: 'pulse 1.5s infinite'}} />
          ))
        ) : projects.length === 0 ? (
          <div className="empty-state" style={{gridColumn: '1 / -1', padding: 40, textAlign: 'center', background: 'var(--surface-2)', borderRadius: 12}}>
            <div style={{marginBottom: 12}}><Icon name="film" size={32} /></div>
            <h3>{lang === 'en' ? 'No projects yet' : 'Nenhum projeto ainda'}</h3>
            <p className="sub" style={{marginBottom: 16}}>{lang === 'en' ? 'Import your first video to start clipping.' : 'Importe seu primeiro vídeo para começar a cortar.'}</p>
            <Btn variant="primary" onClick={() => go('import')}>{lang === 'en' ? 'Import video' : 'Importar vídeo'}</Btn>
          </div>
        ) : projects.map(p => (
          <button key={p.id} className="proj-card" onClick={() => go('clips', { project: p })}>
            <Thumb niche={p.niche || 'podcast'} ratio="16:9" dur={p.duration || 0}>
              <span className="badge-tl"><Icon name={p.source_type === 'youtube' ? undefined : 'film'} plat={p.source_type === 'youtube' ? 'youtube' : undefined} size={12} /></span>
            </Thumb>
            <div className="body">
              <div className="title">{p.title}</div>
              <div className="meta">
                <span className="tag accent"><Icon name="scissors" size={12} />{p.clips || 0} {T.clips_from}</span>
                <span style={{ marginLeft: 'auto' }}>{p.status === 'processing' ? 'Processando' : (p.created_at ? new Date(p.created_at).toLocaleDateString() : p.when)}</span>
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
  const [uploadPct, setUploadPct] = useState(0);
  const fileRef = useRef(null);
  const ideas = lang === 'en' ? PROMPT_IDEAS_EN : PROMPT_IDEAS_PT;

  async function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const mb = file.size / (1024 * 1024);
    if (mb > 500) {
      if (!confirm(`Arquivo grande (${mb.toFixed(0)}MB). O processamento pode levar alguns minutos. Deseja continuar?`)) return;
    }

    setUploading(true);
    setUploadPct(0);

    const iv = setInterval(() => {
      setUploadPct(p => Math.min(99, p + Math.random() * 5));
    }, 500);

    const res = await Supa.uploadVideo(file, user?.id || 'anon');
    clearInterval(iv);

    if (res.error) {
      setUploading(false);
      alert('Erro no upload: ' + res.error);
      return;
    }

    setUploadPct(100);

    if (Supa.client && user) {
      await Supa.client.from('projects').insert({
        user_id: user.id,
        title: file.name,
        source_type: 'upload',
        storage_path: res.path,
        status: 'processing'
      });
    }

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
          <div style={{ fontSize: 16, fontWeight: 700 }}>{uploading ? (lang === 'en' ? `Uploading… ${Math.round(uploadPct)}%` : `Enviando… ${Math.round(uploadPct)}%`) : (lang === 'en' ? 'Drop your video or paste a link' : 'Solte seu vídeo ou cole um link')}</div>
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

function ProcessingScreen({ lang, go, project }) {
  const T = STR[lang];
  const [err, setErr] = useState(false);

  useEffect(() => {
    let iv;
    if (Supa.client && project?.id) {
      iv = setInterval(async () => {
        const { data } = await Supa.client
          .from('projects').select('status').eq('id', project.id).single();
        if (data?.status === 'ready') { clearInterval(iv); go('clips', { project }); }
        if (data?.status === 'failed') { clearInterval(iv); setErr(true); }
      }, 3000);
    } else {
      const ms = { auto: 8000, '<30': 4000, '30-60': 6000, '60-90': 8000 }[project?.dur || 'auto'] || 8000;
      iv = setTimeout(() => go('clips', { project }), ms);
    }
    return () => clearInterval(iv);
  }, [project, go]);

  return (
    <div className="page" style={{ placeItems: 'center', textAlign: 'center' }}>
      <div className="fade-up" style={{ maxWidth: 360 }}>
        {err ? (
          <React.Fragment>
            <div style={{ marginBottom: 24, color: 'var(--accent)' }}><Icon name="alert" size={48} /></div>
            <h1 className="h1">{lang === 'en' ? 'Processing failed' : 'Falha no processamento'}</h1>
            <p className="sub" style={{ margin: '8px 0 24px' }}>{lang === 'en' ? 'An error occurred while generating clips.' : 'Ocorreu um erro ao gerar seus cortes.'}</p>
            <Btn variant="primary" onClick={() => go('import')}>{lang === 'en' ? 'Try again' : 'Tentar novamente'}</Btn>
          </React.Fragment>
        ) : (
          <React.Fragment>
            <div style={{ marginBottom: 24 }}><Icon name="refresh" size={48} className="spin" style={{ color: 'var(--accent)' }} /></div>
            <h1 className="h1">{T.proc_title}</h1>
            <p className="sub" style={{ margin: '8px 0 24px' }}>{T.proc_sub}</p>
            <div className="meter" style={{ height: 6 }}><i style={{ animation: 'progress 8s ease-out forwards' }} /></div>
            <style>{`@keyframes progress { 0% { width: 0%; } 20% { width: 15%; } 50% { width: 45%; } 80% { width: 85%; } 100% { width: 95%; } }`}</style>
          </React.Fragment>
        )}
      </div>
    </div>
  );
}

function ClipsScreen({ lang, go, project }) {
  const T = STR[lang];
  const [clips, setClips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [previewUrl, setPreviewUrl] = useState(null);

  useEffect(() => {
    async function load() {
      if (!Supa.client || !project?.id) {
        setClips(window.CLIPS || []);
        setLoading(false);
        return;
      }
      const { data } = await Supa.client
        .from('clips')
        .select('*')
        .eq('project_id', project.id)
        .order('score', { ascending: false });
      setClips(data || []);
      setLoading(false);
    }
    load();
  }, [project]);

  async function dl(clip, e) {
    e.stopPropagation();
    if (!Supa.client) { alert('Modo demo'); return; }
    try {
      e.target.innerText = '...';
      const { data } = await Supa.client.storage.from('clips').download(clip.storage_path);
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `corta-vc-${clip.title.replace(/\W+/g, '-')}.mp4`;
      a.click();
      e.target.innerText = lang === 'en' ? 'Download' : 'Baixar';
    } catch(err) { alert('Erro no download'); }
  }

  return (
    <div className="page fade-up">
      <div className="topbar">
        <IconBtn name="arrowL" size={20} onClick={() => go('dashboard')} />
        <h2 className="h2">{project?.title || 'Projeto'}</h2>
      </div>

      <div className="clips-grid stagger">
        {loading ? (
          <div style={{padding: 20}}>Carregando cortes...</div>
        ) : clips.map(c => (
          <div key={c.id} className="clip-card fade-up">
            <div className="clip-top" onClick={() => c.storage_path && setPreviewUrl(Supa.client.storage.from('clips').getPublicUrl(c.storage_path).data.publicUrl)}>
              {c.thumbnail_url ? (
                <img src={c.thumbnail_url} alt="thumb" style={{width: '100%', height: '100%', objectFit: 'cover', display: 'block'}} />
              ) : (
                <Thumb niche={c.niche} ratio={c.ratio || '9:16'} dur={c.duration} />
              )}
              <div className="badge-tl" style={{ background: c.score >= 80 ? 'var(--good)' : 'rgba(0,0,0,.6)' }}>
                {c.score} <Icon name="zap" size={12} fill="current" />
              </div>
              <div className="clip-acts">
                <IconBtn name="play" variant="primary" style={{ borderRadius: 99 }} />
              </div>
            </div>
            <div className="body">
              <div className="title" style={{ fontSize: 13 }}>{c.title}</div>
              <div className="meta" style={{ marginTop: 8 }}>
                <Btn size="sm" variant="ghost" onClick={() => go('editor', { project, clip: c })}>{T.edit}</Btn>
                <div className="row" style={{ gap: 4, marginLeft: 'auto' }}>
                  <Btn size="sm" variant="ghost" icon="send">{lang === 'en' ? 'Post' : 'Postar'}</Btn>
                  <Btn size="sm" variant="primary" icon="download" onClick={(e) => dl(c, e)}>{T.dl}</Btn>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {previewUrl && (
        <div style={{position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'grid', placeItems: 'center', zIndex: 9999}}>
          <div style={{position: 'absolute', top: 20, right: 20}}>
            <IconBtn name="close" size={32} onClick={() => setPreviewUrl(null)} />
          </div>
          <video src={previewUrl} controls autoPlay style={{maxWidth: '90%', maxHeight: '90%', borderRadius: 12}} />
        </div>
      )}
    </div>
  );
}

Object.assign(window, { Dashboard, ImportScreen, ProcessingScreen, ClipsScreen });
