/* ============================================================
   SCREENS — Dashboard · Import · Processing · Clips
   ============================================================ */

function Dashboard({ lang, go, openAI, user }) {
  const T = STR[lang];
  const [link, setLink] = useState('');
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userStats, setUserStats] = useState(null);

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
    
    async function loadStats() {
      if (!Supa.client || !user) return;
      const [clipsRes, postedRes] = await Promise.all([
        Supa.client.from('clips').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        Supa.client.from('schedule').select('id', { count: 'exact', head: true })
          .eq('user_id', user.id).eq('status', 'published'),
      ]);
      setUserStats({
        clips: clipsRes.count || 0,
        posted: postedRes.count || 0,
      });
    }

    load();
    loadStats();
  }, [user]);

  const sources = [
    { ic: 'youtube', label: 'YouTube' }, { ic: 'upload', label: lang === 'en' ? 'Upload' : 'Upload', plain: true },
    { ic: 'link', label: 'Drive', plain: true }, { ic: 'gamepad', label: 'Twitch', plain: true },
    { ic: 'mic', label: 'Zoom', plain: true },
  ];
  return (
    <div className="page">
      <div className="fade-up" style={{ marginBottom: 26 }}>
        <h1 className="h1" style={{ wordBreak: 'break-word' }}>{typeof T.greeting === 'function' ? T.greeting(user?.name?.split(' ')[0] || '') : T.greeting} <span style={{ color: 'var(--accent)' }}>✦</span></h1>
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
        {(userStats ? [
          { key: 'clips',   label: { pt: 'Cortes criados',    en: 'Clips made'     }, num: String(userStats.clips),  delta: '', dir: 'up',   icon: 'scissors' },
          { key: 'posted',  label: { pt: 'Publicados',         en: 'Published'      }, num: String(userStats.posted), delta: '', dir: 'up',   icon: 'send'     },
          { key: 'credits', label: { pt: 'Créditos restantes', en: 'Credits left'   }, num: user?.credits === -1 ? '∞' : String(user?.credits || 0), delta: '', dir: (user?.credits === -1 || user?.credits > 5) ? 'up' : 'down', icon: 'zap' },
          { key: 'time',    label: { pt: 'Horas economizadas', en: 'Hours saved'    }, num: `${Math.round((userStats.clips * 0.8))}h`, delta: '', dir: 'up', icon: 'clock' },
        ] : STATS).map(s => (
          <div key={s.key} className="stat">
            <div className="label"><Icon name={s.icon} size={15} />{s.label[lang] || (typeof s.label === 'string' ? s.label : '')}</div>
            <div className="num">{s.num}</div>
            {s.delta && <div className={`delta ${s.dir}`}>{s.dir === 'up' ? '↑' : '↓'} {s.delta}</div>}
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
            <div key={i} className="proj-card skeleton-card">
              <div className="thumb skeleton" style={{ borderRadius: 0 }} />
              <div className="body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div className="skeleton skeleton-text" style={{ height: 16, width: '85%' }} />
                <div className="skeleton skeleton-text" style={{ height: 16, width: '50%' }} />
              </div>
            </div>
          ))
        ) : projects.length === 0 ? (
          <div className="empty-hero" style={{ gridColumn: '1 / -1' }}>
            <div className="empty-phone-wrap">
              <Icon name="sparkles" className="empty-particle" style={{ top: -10, right: -10, color: '#facc15' }} />
              <Icon name="zap" className="empty-particle" style={{ bottom: 20, left: -20, color: '#a78bfa', animationDelay: '1.5s' }} />
              <div className="empty-phone">
                <div className="empty-phone-screen">
                  <div className="empty-phone-bar" style={{ width: '40%', marginBottom: 16 }} />
                  <div className="empty-phone-bar" style={{ width: '80%', marginBottom: 8 }} />
                  <div className="empty-phone-bar" style={{ width: '60%' }} />
                  <Icon name="scissors" className="empty-phone-scissors" />
                  <div className="empty-phone-bar" style={{ marginTop: 'auto' }} />
                </div>
              </div>
            </div>
            <h3 className="h2" style={{ marginBottom: 8 }}>{lang === 'en' ? 'No projects yet' : 'Nenhum projeto ainda'}</h3>
            <p className="sub" style={{ marginBottom: 24, maxWidth: 320 }}>
              {lang === 'en' ? 'Import your first video to start clipping automatically.' : 'Importe seu primeiro vídeo e deixe a IA extrair os melhores cortes.'}
            </p>
            <Btn variant="primary" size="lg" icon="plus" onClick={() => go('import')}>{lang === 'en' ? 'Import video' : 'Importar vídeo'}</Btn>
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
        status: 'processing',
        lang: clipLang,
        ratio: ratio,
        clip_prompt: prompt.trim() || null,   // ← intenção do usuário
      });
    }

    setUploading(false);
    go('processing');
  }
  const [linkValue, setLinkValue] = useState('');

  async function handleLinkSubmit() {
    if (!linkValue.trim()) return;
    setUploading(true);
    
    if (Supa.client && user) {
      const { data: proj, error } = await Supa.client.from('projects').insert({
        user_id: user.id,
        title: linkValue.includes('youtube') ? 'Vídeo do YouTube' : 'Vídeo importado',
        source_type: linkValue.includes('youtube') ? 'youtube'
          : linkValue.includes('drive') ? 'drive'
          : linkValue.includes('twitch') ? 'twitch' : 'link',
        source_url: linkValue.trim(),
        status: 'processing',
        lang: clipLang,
        ratio: ratio,
        clip_prompt: prompt.trim() || null,   // ← intenção do usuário
      }).select().single();
      
      if (!error && proj) {
        try {
          const { data: { session } } = await Supa.client.auth.getSession();
          await fetch(window.CORTA_CONFIG.SUPABASE_URL + '/functions/v1/process-video', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session?.access_token}`
            },
            body: JSON.stringify({ project_id: proj.id, user_id: user.id })
          });
        } catch(e) { console.error('Erro ao iniciar processamento', e); }
        
        setUploading(false);
        go('processing', { project: proj });
        return;
      }
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

        <div className="dropzone" onClick={(e) => { if (e.target.tagName !== 'INPUT' && !uploading) fileRef.current?.click(); }}>
          <input ref={fileRef} type="file" accept="video/*" hidden onChange={onFile} />
          <div className="dz-icon"><Icon name={uploading ? 'refresh' : 'upload'} size={26} className={uploading ? 'spin' : ''} /></div>
          {uploading ? (
            <div style={{ fontSize: 16, fontWeight: 700 }}>{lang === 'en' ? `Uploading… ${Math.round(uploadPct)}%` : `Enviando… ${Math.round(uploadPct)}%`}</div>
          ) : (
            <div style={{ width: '100%', maxWidth: 400, marginTop: 8 }}>
              <input
                value={linkValue}
                onChange={e => setLinkValue(e.target.value)}
                placeholder={T.paste_ph}
                onKeyDown={e => { if (e.key === 'Enter' && linkValue.trim()) handleLinkSubmit(); }}
                style={{ width: '100%', textAlign: 'center', background: 'var(--surface-3)', border: '1px solid var(--surface-2)', padding: 12, borderRadius: 8, color: 'var(--fg)' }}
                onClick={e => e.stopPropagation()}
              />
              <div style={{ fontSize: 14, fontWeight: 700, marginTop: 12 }}>
                {(() => {
                  const isTouch = window.matchMedia('(hover: none)').matches;
                  if (lang === 'en') return isTouch ? 'or tap to choose file' : 'or click to upload';
                  return isTouch ? 'ou toque para escolher arquivo' : 'ou clique para enviar arquivo';
                })()}
              </div>
            </div>
          )}
          <div className="sub" style={{ marginTop: 8 }}>{T.accepts}</div>
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
          <Btn variant="primary" size="lg" icon="sparkles" onClick={() => linkValue.trim() ? handleLinkSubmit() : go('processing')}>{T.generate}</Btn>
        </div>
      </div>
    </div>
  );
}

function ProcessingScreen({ lang, go, project }) {
  const T = STR[lang];
  const [err, setErr] = useState(false);

  useEffect(() => {
    async function triggerProcessing() {
      if (!Supa.client || !project?.id || project.status !== 'processing') return;
      try {
        const { data: { session } } = await Supa.client.auth.getSession();
        await fetch(window.CORTA_CONFIG.SUPABASE_URL + '/functions/v1/process-video', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`
          },
          body: JSON.stringify({ project_id: project.id, user_id: project.user_id })
        });
      } catch(e) {
        console.warn('Erro ao disparar processamento:', e);
      }
    }
    triggerProcessing();
  }, [project?.id]);

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

function ClipsScreen({ lang, go, project, openClip, user }) {
  const T = STR[lang];
  const [clips, setClips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [sort, setSort] = useState('score');
  const [nicheFilter, setNicheFilter] = useState('all');
  const [selected, setSelected] = useState(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [dlLoadingId, setDlLoadingId] = useState(null); // id do clip sendo baixado

  function toggleSelect(id) {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  }
  function clearSelection() { setSelected(new Set()); }

  useEffect(() => {
    async function load() {
      setLoading(true);

      if (!Supa.client) {
        // Modo demo: sempre usa mock
        setClips(window.CLIPS || []);
        setLoading(false);
        return;
      }

      if (project?.id) {
        // Modo projeto: busca clips deste projeto específico
        const { data } = await Supa.client
          .from('clips')
          .select('*')
          .eq('project_id', project.id)
          .order('score', { ascending: false });
        setClips(data || []);
      } else if (user?.id) {
        // Modo "todos os cortes": busca todos os clips do usuário
        // (sidebar → Cortes sem ter aberto um projeto)
        const { data } = await Supa.client
          .from('clips')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'rendered')
          .order('created_at', { ascending: false })
          .limit(100);
        setClips(data || []);
      } else {
        // Fallback final: sem usuário logado → demo
        setClips(window.CLIPS || []);
      }

      setLoading(false);
    }
    load();
  }, [project, user]);

  const filtered = useMemo(() => {
    let arr = [...clips];
    if (nicheFilter !== 'all') arr = arr.filter(c => c.niche === nicheFilter);
    if (sort === 'score') arr.sort((a, b) => b.score - a.score);
    if (sort === 'recent') arr.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    if (sort === 'dur') arr.sort((a, b) => a.duration - b.duration);
    return arr;
  }, [clips, sort, nicheFilter]);

  async function dl(clip, e) {
    e.stopPropagation();

    if (!Supa.client) {
      window.showToast(
        lang === 'en' ? 'Demo mode — download unavailable' : 'Modo demo — download indisponível',
        { type: 'info' }
      );
      return;
    }

    if (dlLoadingId) return; // impede clique duplo enquanto outro download roda

    setDlLoadingId(clip.id);
    try {
      const { data, error } = await Supa.client.storage
        .from('clips')
        .download(clip.storage_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a   = document.createElement('a');
      a.href     = url;
      a.download = `corta-vc-${clip.title.replace(/\W+/g, '-').toLowerCase()}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Libera memória após 60s (tempo suficiente para o download iniciar)
      setTimeout(() => URL.revokeObjectURL(url), 60_000);

      window.showToast('Download concluído ✓', { type: 'success' });
    } catch (err) {
      console.error('Download falhou:', err);
      window.showToast(
        lang === 'en' ? 'Download failed' : 'Falha no download',
        { type: 'error' }
      );
    } finally {
      setDlLoadingId(null);
    }
  }

  return (
    <div className="page fade-up">
      <div className="topbar">
        <IconBtn name="arrowL" size={20} onClick={() => go('dashboard')} />
        <h2 className="h2">
    {project?.title || (lang === 'en' ? 'All clips' : 'Todos os cortes')}
  </h2>
      </div>

      <div className="filter-bar" style={{ marginBottom: 16 }}>
        {['all', ...new Set(clips.map(c => c.niche).filter(Boolean))].map(n => (
          <button key={n}
            className={`chip-toggle ${nicheFilter === n ? 'on' : ''}`}
            onClick={() => setNicheFilter(n)}>
            {n === 'all' ? (lang === 'en' ? 'All' : 'Todos') : (NICHES[n]?.label || n)}
          </button>
        ))}
        <div style={{ marginLeft: 'auto' }}>
          <div className="seg">
            <button className={sort === 'score' ? 'on' : ''} onClick={() => setSort('score')}>
              {lang === 'en' ? 'Score' : 'Score'}
            </button>
            <button className={sort === 'recent' ? 'on' : ''} onClick={() => setSort('recent')}>
              {lang === 'en' ? 'Recent' : 'Recente'}
            </button>
            <button className={sort === 'dur' ? 'on' : ''} onClick={() => setSort('dur')}>
              {lang === 'en' ? 'Duration' : 'Duração'}
            </button>
          </div>
        </div>
      </div>

      <div className="clips-grid stagger">
        {loading ? (
          [1,2,3,4].map(i => (
            <div key={i} className="clip-card skeleton-card">
              <div className="thumb skeleton" style={{ borderRadius: 0 }} />
              <div className="clip-card-body-skeleton" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div className="skeleton skeleton-text" style={{ height: 14, width: '90%' }} />
                <div className="skeleton skeleton-text" style={{ height: 14, width: '60%' }} />
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <div className="skeleton skeleton-text" style={{ height: 28, width: 60, borderRadius: 6 }} />
                  <div className="skeleton skeleton-text" style={{ height: 28, width: 28, borderRadius: 6, marginLeft: 'auto' }} />
                </div>
              </div>
            </div>
          ))
        ) : filtered.map(c => (
          <div key={c.id} className={`clip-card fade-up ${selected.has(c.id) ? 'clip-selected' : ''}`}
            onClick={(e) => {
              if (selected.size > 0) { e.preventDefault(); toggleSelect(c.id); }
            }}>
            
            <button className="clip-checkbox" onClick={(e) => { e.stopPropagation(); toggleSelect(c.id); }}>
              {selected.has(c.id) 
                ? <div style={{width:22, height:22, borderRadius:'50%', background:'var(--accent)', color:'#fff', display:'grid', placeItems:'center'}}><Icon name="check" size={14}/></div>
                : <div className="clip-checkbox-empty" />}
            </button>

            <div className="clip-top" onClick={() => {
              if (selected.size > 0) { toggleSelect(c.id); return; }
              if (c.storage_path) setPreviewUrl(Supa.client.storage.from('clips').getPublicUrl(c.storage_path).data.publicUrl);
            }}>
              {c.thumbnail_url ? (
                <img src={c.thumbnail_url} alt="thumb" style={{width: '100%', height: '100%', objectFit: 'cover', display: 'block'}} />
              ) : (
                <Thumb niche={c.niche} ratio={c.ratio || '9:16'} dur={c.duration} reelChrome={true} />
              )}
              <div className="badge-tl" style={{ background: c.score >= 80 ? 'var(--good)' : 'rgba(0,0,0,.6)' }}>
                <Score value={c.score} size={18} showCap={false} /> <span style={{marginLeft: 4}}>{c.score}</span>
              </div>
              <div className="clip-acts">
                <IconBtn name="play" variant="primary" style={{ borderRadius: 99 }} />
              </div>
            </div>
            
            <div className="body">
              <div className="title" style={{ fontSize: 13 }}>{c.title}</div>
              
              <div className="row" style={{ marginTop: 6, gap: 12, fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
                {c.views_count >= 0 && <span className="row" style={{gap:4}}><Icon name="eye" size={12}/>{c.views_count}</span>}
                {c.likes_count >= 0 && <span className="row" style={{gap:4}}><Icon name="heart" size={12}/>{c.likes_count}</span>}
              </div>

              <div className="meta" style={{ marginTop: 8 }}>
                <Btn size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openClip ? openClip(c) : go('editor', { project, clip: c }); }}>{T.edit}</Btn>
                <div className="row" style={{ gap: 4, marginLeft: 'auto' }}>
                  <Btn size="sm" variant="ghost" icon="send" onClick={e => { e.stopPropagation(); go('schedule'); }}>{lang === 'en' ? 'Post' : 'Postar'}</Btn>
                  <Btn
    size="sm"
    variant="primary"
    icon={dlLoadingId === c.id ? 'refresh' : 'download'}
    disabled={dlLoadingId === c.id}
    onClick={(e) => dl(c, e)}
    style={{ minWidth: 80 }}
  >
    {dlLoadingId === c.id
      ? (lang === 'en' ? 'Saving…' : 'Salvando…')
      : T.dl}
  </Btn>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {selected.size > 0 && (
        <div className="bulk-bar fade-up" role="toolbar" aria-label={lang === 'en' ? 'Batch actions' : 'Ações em lote'}>
          <span className="bulk-count">
            {selected.size} {selected.size === 1
              ? (lang === 'en' ? 'selected' : 'selecionado')
              : (lang === 'en' ? 'selected' : 'selecionados')}
          </span>
          <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,.2)', margin: '0 4px' }} />
          <div className="bulk-actions">
      
            {/* Agendar em lote — abre agenda com clips pré-selecionados */}
            <Btn size="sm" icon="calendar"
              onClick={() => {
                // Salva seleção no sessionStorage para a agenda acessar
                sessionStorage.setItem('bulk_schedule_ids', JSON.stringify([...selected]));
                go('schedule');
                clearSelection();
                window.showToast(
                  lang === 'en'
                    ? `${selected.size} clips ready to schedule`
                    : `${selected.size} corte${selected.size > 1 ? 's' : ''} prontos para agendar`,
                  { type: 'info' }
                );
              }}>
              {lang === 'en' ? 'Schedule' : 'Agendar'}
            </Btn>
      
            {/* Download em lote — real */}
            <Btn size="sm" icon="download" disabled={bulkLoading}
              onClick={async () => {
                if (!Supa.client) {
                  window.showToast(lang === 'en' ? 'Demo mode — download unavailable' : 'Modo demo — download indisponível', { type: 'info' });
                  return;
                }
                setBulkLoading(true);
                const toDownload = filtered.filter(c => selected.has(c.id) && c.storage_path);
                let done = 0;
                for (const c of toDownload) {
                  try {
                    const { data, error } = await Supa.client.storage.from('clips').download(c.storage_path);
                    if (error) throw error;
                    const url = URL.createObjectURL(data);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `corta-vc-${c.title.replace(/\W+/g, '-').toLowerCase()}.mp4`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    done++;
                    // Pausa entre downloads para não sobrecarregar o browser
                    await new Promise(r => setTimeout(r, 600));
                  } catch (err) {
                    console.error('Falha no download de', c.title, err);
                  }
                }
                setBulkLoading(false);
                clearSelection();
                window.showToast(
                  lang === 'en'
                    ? `${done} clip${done !== 1 ? 's' : ''} downloaded`
                    : `${done} corte${done !== 1 ? 's' : ''} baixado${done !== 1 ? 's' : ''}`,
                  { type: done > 0 ? 'success' : 'error' }
                );
              }}>
              {bulkLoading ? '…' : (lang === 'en' ? 'Download' : 'Baixar')}
            </Btn>
      
            {/* Excluir em lote com undo real */}
            <Btn size="sm" icon="trash"
              style={{ color: '#f87171' }}
              onClick={async () => {
                if (!confirm(lang === 'en'
                  ? `Delete ${selected.size} clip${selected.size > 1 ? 's' : ''}? This cannot be undone.`
                  : `Excluir ${selected.size} corte${selected.size > 1 ? 's' : ''}? Esta ação não pode ser desfeita.`
                )) return;
      
                const deletedClips = filtered.filter(c => selected.has(c.id));
                const deletedIds = [...selected];
      
                // Remove do estado imediatamente (otimista)
                setClips(prev => prev.filter(c => !selected.has(c.id)));
                clearSelection();
      
                // Persiste no banco
                if (Supa.client) {
                  const { error } = await Supa.client.from('clips').delete().in('id', deletedIds);
                  if (error) {
                    // Reverte se falhar
                    setClips(prev => [...prev, ...deletedClips]);
                    window.showToast(lang === 'en' ? 'Delete failed' : 'Falha ao excluir', { type: 'error' });
                    return;
                  }
                }
      
                window.showToast(
                  lang === 'en'
                    ? `${deletedClips.length} clip${deletedClips.length > 1 ? 's' : ''} deleted`
                    : `${deletedClips.length} corte${deletedClips.length > 1 ? 's' : ''} excluído${deletedClips.length > 1 ? 's' : ''}`,
                  {
                    type: 'success',
                    undo: async () => {
                      // Reinsere no banco (se ainda tiver os dados)
                      if (Supa.client) {
                        const toRestore = deletedClips.map(c => ({ ...c }));
                        await Supa.client.from('clips').upsert(toRestore);
                      }
                      setClips(prev => {
                        const ids = new Set(prev.map(c => c.id));
                        return [...prev, ...deletedClips.filter(c => !ids.has(c.id))];
                      });
                      window.showToast(lang === 'en' ? 'Restored ✓' : 'Restaurado ✓', { type: 'success', duration: 2000 });
                    }
                  }
                );
              }}>
              {lang === 'en' ? 'Delete' : 'Excluir'}
            </Btn>
          </div>
      
          <button className="bulk-close" onClick={clearSelection}
            aria-label={lang === 'en' ? 'Clear selection' : 'Limpar seleção'}>
            <Icon name="x" size={16} />
          </button>
        </div>
      )}

      {previewUrl && (
        <div className="scrim show" style={{ zIndex: 9999, display: 'grid', placeItems: 'center' }} onClick={() => setPreviewUrl(null)}>
          <div style={{ position: 'absolute', top: 20, right: 20 }}>
            <IconBtn name="close" size={32} style={{ color: '#fff', background: 'rgba(0,0,0,.5)' }} onClick={() => setPreviewUrl(null)} />
          </div>
          <div className="fade-up" style={{ padding: 20, maxWidth: '100%', maxHeight: '100%', display: 'flex', justifyContent: 'center' }} onClick={e => e.stopPropagation()}>
            <div className="phone" style={{ height: 'min(85vh, 800px)', boxShadow: '0 20px 60px rgba(0,0,0,.8)' }}>
              <video src={previewUrl} controls autoPlay style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

Object.assign(window, { Dashboard, ImportScreen, ProcessingScreen, ClipsScreen });
