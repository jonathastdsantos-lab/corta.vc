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
  const [variations, setVariations] = useState(null);
  const [variationsLoading, setVariationsLoading] = useState(false);
  const [lines, setLines] = useState(TRANSCRIPT);
  const [playing, setPlaying] = useState(true);
  const [shareUrl, setShareUrl] = useState(null);
  const [sharing, setSharing] = useState(false);

  // ── Transcrição real e edição por palavras ──
  const [txWords, setTxWords]               = useState([]);
  const [deletedIdxs, setDeletedIdxs]       = useState(new Set());
  const [pendingRemovals, setPendingRemovals] = useState([]);
  const [trimming, setTrimming]             = useState(false);
  const [trimResult, setTrimResult]         = useState(null); // { new_duration, removed_seconds }
  const [txLoaded, setTxLoaded]             = useState(false);

  // ── Brand Kit ──────────────────────────────────────────────────
  const [brand, setBrand]           = useState({
    logo_url:      null,
    brand_color:   '#e8543b',
    brand_font:    'Schibsted Grotesk',
    logo_position: 'br',
    logo_size:     10,
    cta_text:      '',
    cta_enabled:   false,
  });
  const [brandLoading, setBrandLoading] = useState(false);
  const [brandSaving,  setBrandSaving]  = useState(false);
  const [brandSaved,   setBrandSaved]   = useState(false);
  const [logoPreview,  setLogoPreview]  = useState(null);
  const [logoFile,     setLogoFile]     = useState(null);

  // Carrega transcript do clip (words[]) — banco > mock
  useEffect(() => {
    if (clip.transcript && Array.isArray(clip.transcript) && clip.transcript.length > 0) {
      // Transcript real: { w, s, e } por palavra
      setTxWords(clip.transcript);
      setTxLoaded(true);
    } else {
      // Fallback: converte mock TRANSCRIPT em pseudo-words para UI consistente
      const pseudo = [];
      let t = 0;
      for (const line of TRANSCRIPT) {
        const clean = line.text.replace(/\*\*/g, '');
        const words = clean.split(/\s+/).filter(Boolean);
        for (const w of words) {
          pseudo.push({ w, s: parseFloat(t.toFixed(2)), e: parseFloat((t + 0.4).toFixed(2)) });
          t += 0.45;
        }
        t += 0.5; // pausa entre linhas
      }
      setTxWords(pseudo);
    }
  }, [clip.id]);

  // Carrega brand_prefs do banco (ou do user object se já disponível)
  useEffect(() => {
    async function loadBrand() {
      setBrandLoading(true);
      try {
        if (Supa.client) {
          const { data: { user: authUser } } = await Supa.client.auth.getUser();
          if (!authUser) return;
          const { data: prof } = await Supa.client
            .from('profiles')
            .select('brand_prefs')
            .eq('id', authUser.id)
            .single();
          if (prof?.brand_prefs && Object.keys(prof.brand_prefs).length > 0) {
            setBrand(prev => ({ ...prev, ...prof.brand_prefs }));
            if (prof.brand_prefs.logo_url) setLogoPreview(prof.brand_prefs.logo_url);
          }
        } else {
          // Demo: carrega do localStorage
          const u = JSON.parse(localStorage.getItem('corta_auth_v1') || 'null');
          if (u?.brand_prefs) {
            setBrand(prev => ({ ...prev, ...u.brand_prefs }));
            if (u.brand_prefs.logo_url) setLogoPreview(u.brand_prefs.logo_url);
          }
        }
      } catch (e) {
        console.warn('loadBrand falhou:', e);
      }
      setBrandLoading(false);
    }
    loadBrand();
  }, []);

  async function handleShare() {
    if (!Supa.client) {
      alert('Modo demo — no plano real geraria um link público de 24h.');
      return;
    }
    setSharing(true);
    try {
      const { data: { session } } = await Supa.client.auth.getSession();
      const res = await fetch(
        window.CORTA_CONFIG.SUPABASE_URL + '/functions/v1/share-clip',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`
          },
          body: JSON.stringify({ clip_id: clip.id })
        }
      );
      const data = await res.json();
      if (data.share_url) {
        setShareUrl(data.share_url);
        navigator.clipboard?.writeText(data.share_url).catch(() => {});
      }
    } catch (e) {
      console.error(e);
    }
    setSharing(false);
  }

  // Drag and drop do texto
  function handleLineDragStart(e, idx) { e.dataTransfer.setData('text/plain', idx); }
  function handleLineDrop(e, destIdx) {
    e.preventDefault();
    const srcIdx = +e.dataTransfer.getData('text/plain');
    if (srcIdx === destIdx) return;
    const newLines = [...lines];
    const [moved] = newLines.splice(srcIdx, 1);
    newLines.splice(destIdx, 0, moved);
    setLines(newLines);
  }

  // Draggable caption box simulation (UX)
  const [capY, setCapY] = useState(50);
  const [draggingCap, setDraggingCap] = useState(false);
  function handleCapDrag(e) {
    if (!draggingCap) return;
    const bounds = e.currentTarget.getBoundingClientRect();
    const y = Math.max(10, Math.min(90, ((e.clientY - bounds.top) / bounds.height) * 100));
    setCapY(y);
  }

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

  async function genVariations() {
    setVariationsLoading(true);
    setVariations(null);
    try {
      if (!Supa.client) {
        // Fallback demo
        setVariations([
          { style: 'emocional', caption: `A {transformação} que ninguém te contou`, hook: 'Apelo emocional forte' },
          { style: 'intrigante', caption: `Por que {isso} muda tudo que você sabe`, hook: 'Cria curiosidade e tensão' },
          { style: 'didático',  caption: `O {método} que funciona em 3 passos`, hook: 'Promessa clara e prática' },
        ]);
        setVariationsLoading(false);
        return;
      }
      const { data: { session } } = await Supa.client.auth.getSession();
      const res = await fetch(
        window.CORTA_CONFIG.SUPABASE_URL + '/functions/v1/generate-variations',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`
          },
          body: JSON.stringify({
            caption: caption.replace(/\{|\}/g, ''),
            niche: clip.niche,
            lang
          })
        }
      );
      const data = await res.json();
      if (data.variations) setVariations(data.variations);
      else throw new Error(data.error || 'Erro ao gerar variações');
    } catch (e) {
      window.showToast?.(lang === 'en' ? 'Failed to generate variations' : 'Falha ao gerar variações', { type: 'error' });
      console.error(e);
    }
    setVariationsLoading(false);
  }

  // Marca/desmarca uma palavra como deletada
  function toggleWordDelete(idx) {
    setDeletedIdxs(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  }

  // Converte índices deletados → intervalos de tempo (agrupando consecutivos)
  function buildRemovals(words, deleted) {
    const sorted = [...deleted].sort((a, b) => a - b);
    const removals = [];
    let groupStart = null;
    let groupEnd   = null;

    for (const idx of sorted) {
      const w = words[idx];
      if (!w) continue;
      if (groupStart === null) {
        groupStart = w.s;
        groupEnd   = w.e;
      } else if (w.s - groupEnd < 0.15) {
        // Palavra consecutiva ou muito próxima — estende o grupo
        groupEnd = w.e;
      } else {
        removals.push({ s: groupStart, e: groupEnd + 0.03 });
        groupStart = w.s;
        groupEnd   = w.e;
      }
    }
    if (groupStart !== null) removals.push({ s: groupStart, e: groupEnd + 0.03 });
    return removals;
  }

  // Chama trim-clip e atualiza o clip localmente
  async function applyTrim() {
    const removals = buildRemovals(txWords, deletedIdxs);
    if (!removals.length) return;

    setTrimming(true);
    setTrimResult(null);

    try {
      if (!Supa.client) {
        // Demo: simula delay e mostra resultado
        await new Promise(r => setTimeout(r, 1800));
        const removed = removals.reduce((a, r) => a + (r.e - r.s), 0);
        setTrimResult({ new_duration: (clip.dur || 38) - Math.round(removed), removed_seconds: parseFloat(removed.toFixed(1)) });
        // Remove visualmente as palavras deletadas
        setTxWords(prev => prev.filter((_, i) => !deletedIdxs.has(i)));
        setDeletedIdxs(new Set());
        window.showToast?.(lang === 'en' ? 'Demo: trim simulated ✓' : 'Demo: corte simulado ✓', { type: 'success' });
        setTrimming(false);
        return;
      }

      const { data: { session } } = await Supa.client.auth.getSession();
      const res = await fetch(
        window.CORTA_CONFIG.SUPABASE_URL + '/functions/v1/trim-clip',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ clip_id: clip.id, removals }),
        }
      );

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Erro no trim-clip');

      setTrimResult({ new_duration: data.new_duration, removed_seconds: data.removed_seconds });

      // Atualiza transcript local com as palavras restantes (reindexadas pelo servidor)
      if (data.words_remaining !== undefined) {
        // Recarrega do banco para pegar transcript reindexado
        const { data: updated } = await Supa.client
          .from('clips').select('transcript, duration').eq('id', clip.id).single();
        if (updated?.transcript) setTxWords(updated.transcript);
      } else {
        setTxWords(prev => prev.filter((_, i) => !deletedIdxs.has(i)));
      }

      setDeletedIdxs(new Set());
      window.showToast?.(
        lang === 'en'
          ? `${data.removed_seconds}s removed — clip updated ✓`
          : `${data.removed_seconds}s removidos — corte atualizado ✓`,
        { type: 'success' }
      );
    } catch (e) {
      window.showToast?.(
        lang === 'en' ? `Trim failed: ${e.message}` : `Falha no corte: ${e.message}`,
        { type: 'error' }
      );
      console.error(e);
    }

    setTrimming(false);
  }

  // Desfaz todas as deleções pendentes
  function undoAllDeletes() {
    setDeletedIdxs(new Set());
    setTrimResult(null);
  }

  // Atualiza um campo do brand kit
  function setBrandField(key, value) {
    setBrand(prev => ({ ...prev, [key]: value }));
    setBrandSaved(false);
  }

  // Upload do logo
  async function handleLogoUpload(file) {
    if (!file) return;
    const allowed = ['image/png', 'image/svg+xml', 'image/webp'];
    if (!allowed.includes(file.type)) {
      window.showToast?.(lang === 'en' ? 'Use PNG, SVG or WebP' : 'Use PNG, SVG ou WebP', { type: 'error' });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      window.showToast?.(lang === 'en' ? 'Logo must be under 2MB' : 'Logo deve ter menos de 2MB', { type: 'error' });
      return;
    }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
    setBrandSaved(false);
  }

  // Salva brand_prefs (faz upload do logo se necessário, depois salva prefs)
  async function saveBrandKit() {
    setBrandSaving(true);
    setBrandSaved(false);
    try {
      let finalLogoUrl = brand.logo_url;

      // Se tem arquivo novo para upload
      if (logoFile) {
        if (Supa.client) {
          const { data: { user: authUser } } = await Supa.client.auth.getUser();
          finalLogoUrl = await Supa.uploadBrandLogo(logoFile, authUser.id);
        } else {
          // Demo: usa object URL local
          finalLogoUrl = logoPreview;
        }
        setLogoFile(null);
      }

      const prefs = { ...brand, logo_url: finalLogoUrl };
      setBrand(prefs);

      if (Supa.client) {
        const { data: { user: authUser } } = await Supa.client.auth.getUser();
        await Supa.saveBrandPrefs(authUser.id, prefs);
      } else {
        await Supa.saveBrandPrefs(null, prefs); // demo
      }

      setBrandSaved(true);
      window.showToast?.(
        lang === 'en' ? 'Brand kit saved ✓' : 'Brand kit salvo ✓',
        { type: 'success' }
      );
    } catch (e) {
      window.showToast?.(
        lang === 'en' ? `Save failed: ${e.message}` : `Falha ao salvar: ${e.message}`,
        { type: 'error' }
      );
      console.error(e);
    }
    setBrandSaving(false);
  }

  const tabs = [
    { id: 'captions', label: T.ed_captions, icon: 'text' },
    { id: 'style', label: T.ed_style, icon: 'palette' },
    { id: 'layout', label: T.ed_layout, icon: 'crop' },
    { id: 'brand', label: T.ed_brand, icon: 'star' },
    { id: 'export', label: T.ed_export, icon: 'send' },
  ];

  const posStyle = { top: `${capY}%`, transform: 'translateY(-50%)', cursor: draggingCap ? 'grabbing' : 'grab' };

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
            {/* live caption (draggable) */}
            <div 
              className="live-cap" 
              style={posStyle}
              onPointerDown={() => setDraggingCap(true)}
            >
              <CaptionText text={caption} style={style} fontSize={capSize} />
            </div>
          </div>
        </div>

        <div 
          className="ed-transport" 
          onPointerUp={() => setDraggingCap(false)} 
          onPointerLeave={() => setDraggingCap(false)} 
          onPointerMove={handleCapDrag} 
          style={{ position: 'absolute', inset: 0, zIndex: 10, pointerEvents: draggingCap ? 'auto' : 'none' }} 
        />
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

                {/* Botão gerar variações */}
                <div style={{ marginTop: 12 }}>
                  <Btn variant="soft" size="sm" icon={variationsLoading ? 'refresh' : 'wand'}
                    onClick={genVariations} disabled={variationsLoading}>
                    {variationsLoading
                      ? (lang === 'en' ? 'Generating…' : 'Gerando…')
                      : (lang === 'en' ? '3 variations' : '3 variações')}
                  </Btn>
                </div>

                {/* Cards de variações */}
                {variations && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                    <div className="pg-label" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 4 }}>
                      {lang === 'en' ? 'Choose a variation' : 'Escolha uma variação'}
                    </div>
                    {variations.map((v, i) => (
                      <button key={i}
                        onClick={() => { setCaption(v.caption); setVariations(null); window.showToast?.(lang === 'en' ? 'Caption applied ✓' : 'Legenda aplicada ✓', { type: 'success', duration: 2000 }); }}
                        style={{
                          background: 'var(--surface-2)', border: '1.5px solid var(--border)',
                          borderRadius: 'var(--r)', padding: '10px 12px', textAlign: 'left',
                          cursor: 'pointer', transition: '.12s', width: '100%'
                        }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                        onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                      >
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>
                          {v.style}
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.4 }}>
                          {v.caption.replace(/\{([^}]+)\}/g, (_, w) => `✦${w}✦`)}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{v.hook}</div>
                      </button>
                    ))}
                    <button onClick={() => setVariations(null)}
                      style={{ fontSize: 11, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}>
                      {lang === 'en' ? 'Dismiss' : 'Fechar'}
                    </button>
                  </div>
                )}
              </div>

              <div className="panel-group">

                {/* Cabeçalho com contador de deleções pendentes */}
                <div className="pg-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>
                    {lang === 'en' ? 'Transcript — click word to delete' : 'Transcrição — clique na palavra para deletar'}
                  </span>
                  {deletedIdxs.size > 0 && (
                    <span style={{ fontSize: 11, color: 'var(--hot)', fontWeight: 700 }}>
                      {deletedIdxs.size} {lang === 'en' ? 'marked' : 'marcadas'}
                    </span>
                  )}
                </div>

                {/* Palavras em chips inline — modo palavra a palavra */}
                <div style={{
                  display: 'flex', flexWrap: 'wrap', gap: '4px 3px',
                  padding: '10px 12px', background: 'var(--surface-2)',
                  borderRadius: 'var(--r)', border: '1px solid var(--border)',
                  maxHeight: 220, overflowY: 'auto', lineHeight: 1,
                }}>
                  {txWords.map((w, i) => {
                    const isDel = deletedIdxs.has(i);
                    return (
                      <button
                        key={i}
                        title={`${w.s.toFixed(2)}s → ${w.e.toFixed(2)}s`}
                        onClick={() => toggleWordDelete(i)}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 3,
                          padding: '3px 7px', borderRadius: 5, cursor: 'pointer',
                          fontSize: 13, fontFamily: 'var(--font-ui)',
                          border: isDel ? '1px solid var(--hot)' : '1px solid transparent',
                          background: isDel ? 'rgba(248,113,113,.15)' : 'transparent',
                          color: isDel ? 'var(--hot)' : 'var(--ink)',
                          textDecoration: isDel ? 'line-through' : 'none',
                          opacity: isDel ? 0.6 : 1,
                          transition: 'all .1s',
                        }}
                      >
                        {w.w}
                        {isDel && (
                          <span style={{ fontSize: 10, lineHeight: 1, opacity: .7 }}>×</span>
                        )}
                      </button>
                    );
                  })}

                  {txWords.length === 0 && (
                    <div style={{ fontSize: 12, color: 'var(--muted)', padding: '4px 0' }}>
                      {lang === 'en' ? 'No transcript available for this clip.' : 'Transcrição não disponível para este corte.'}
                    </div>
                  )}
                </div>

                {/* Instrução */}
                <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Icon name="info" size={12} />
                  {lang === 'en'
                    ? 'Click words to mark for removal, then apply.'
                    : 'Clique nas palavras para marcar a remoção, depois aplique.'}
                </div>

                {/* Resultado do último trim */}
                {trimResult && (
                  <div style={{
                    marginTop: 8, padding: '8px 12px', borderRadius: 'var(--r)',
                    background: 'var(--surface-2)', border: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    <Icon name="checkCircle" size={15} style={{ color: 'var(--good)', flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: 'var(--ink-2)', flex: 1 }}>
                      {lang === 'en'
                        ? `${trimResult.removed_seconds}s removed · new duration: ${trimResult.new_duration}s`
                        : `${trimResult.removed_seconds}s removidos · duração final: ${trimResult.new_duration}s`}
                    </span>
                  </div>
                )}

                {/* Barra de ações: Aplicar e Desfazer */}
                {deletedIdxs.size > 0 && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <Btn
                      variant="primary"
                      size="sm"
                      icon={trimming ? 'refresh' : 'scissors'}
                      disabled={trimming}
                      onClick={applyTrim}
                      style={{ flex: 1 }}
                    >
                      {trimming
                        ? (lang === 'en' ? 'Re-rendering…' : 'Re-renderizando…')
                        : lang === 'en'
                          ? `Remove ${deletedIdxs.size} word${deletedIdxs.size > 1 ? 's' : ''}`
                          : `Remover ${deletedIdxs.size} palavra${deletedIdxs.size > 1 ? 's' : ''}`}
                    </Btn>
                    <Btn
                      variant="ghost"
                      size="sm"
                      icon="undo"
                      onClick={undoAllDeletes}
                      disabled={trimming}
                    >
                      {lang === 'en' ? 'Undo' : 'Desfazer'}
                    </Btn>
                  </div>
                )}

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

              {/* ── Logo ───────────────────────────────────────── */}
              <div className="panel-group">
                <div className="pg-label">Logo</div>

                {/* Preview do logo atual */}
                {logoPreview && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 12px', background: 'var(--surface-2)',
                    borderRadius: 'var(--r)', border: '1px solid var(--border)',
                    marginBottom: 8,
                  }}>
                    <img
                      src={logoPreview}
                      alt="logo"
                      style={{ height: 36, maxWidth: 100, objectFit: 'contain', borderRadius: 4 }}
                      onError={() => setLogoPreview(null)}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>
                        {lang === 'en' ? 'Logo uploaded' : 'Logo carregado'}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                        {lang === 'en' ? 'Click below to replace' : 'Clique abaixo para trocar'}
                      </div>
                    </div>
                    <button
                      onClick={() => { setLogoPreview(null); setLogoFile(null); setBrandField('logo_url', null); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4, lineHeight: 0 }}
                      title={lang === 'en' ? 'Remove logo' : 'Remover logo'}
                    >
                      <Icon name="x" size={16} />
                    </button>
                  </div>
                )}

                {/* Drop zone */}
                <label
                  className="dropzone"
                  style={{ padding: '14px 16px', cursor: 'pointer', display: 'block' }}
                  onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--accent)'; }}
                  onDragLeave={e => { e.currentTarget.style.borderColor = ''; }}
                  onDrop={e => {
                    e.preventDefault();
                    e.currentTarget.style.borderColor = '';
                    const f = e.dataTransfer.files?.[0];
                    if (f) handleLogoUpload(f);
                  }}
                >
                  <input
                    type="file"
                    accept="image/png,image/svg+xml,image/webp"
                    style={{ display: 'none' }}
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); e.target.value = ''; }}
                  />
                  <div className="dz-icon" style={{ width: 36, height: 36, marginBottom: 8 }}>
                    <Icon name="upload" size={17} />
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                    {lang === 'en' ? 'Drop or click to upload' : 'Solte ou clique para enviar'}
                  </div>
                  <div className="sub" style={{ fontSize: 11, marginTop: 2 }}>PNG · SVG · WebP · max 2MB</div>
                </label>

                {/* Posição e tamanho do logo no vídeo */}
                {(logoPreview || brand.logo_url) && (
                  <React.Fragment>
                    <div style={{ marginTop: 10 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--faint)', letterSpacing: '.07em', textTransform: 'uppercase', marginBottom: 7 }}>
                        {lang === 'en' ? 'Position' : 'Posição'}
                      </div>
                      {/* Grid 2×2 de posição */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                        {[
                          { id: 'tl', label: lang === 'en' ? '↖ Top left'    : '↖ Canto sup. esq.' },
                          { id: 'tr', label: lang === 'en' ? '↗ Top right'   : '↗ Canto sup. dir.' },
                          { id: 'bl', label: lang === 'en' ? '↙ Bottom left' : '↙ Canto inf. esq.' },
                          { id: 'br', label: lang === 'en' ? '↘ Bottom right': '↘ Canto inf. dir.' },
                        ].map(p => (
                          <button
                            key={p.id}
                            onClick={() => setBrandField('logo_position', p.id)}
                            style={{
                              padding: '7px 10px', borderRadius: 'var(--r-sm)',
                              border: `1.5px solid ${brand.logo_position === p.id ? 'var(--accent)' : 'var(--border)'}`,
                              background: brand.logo_position === p.id ? 'var(--accent-soft)' : 'transparent',
                              color: brand.logo_position === p.id ? 'var(--accent)' : 'var(--ink-2)',
                              fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: '.12s',
                            }}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Tamanho do logo (% da largura) */}
                    <div style={{ marginTop: 10 }}>
                      <div className="field-row">
                        <span className="frl">
                          <Icon name="resize" size={14} />
                          {lang === 'en' ? 'Size' : 'Tamanho'} {brand.logo_size}%
                        </span>
                        <input
                          type="range" min="5" max="25" step="1"
                          value={brand.logo_size}
                          onChange={e => setBrandField('logo_size', +e.target.value)}
                          className="rng"
                          style={{ flex: 1 }}
                        />
                      </div>
                    </div>
                  </React.Fragment>
                )}
              </div>

              {/* ── Cor da marca ────────────────────────────────── */}
              <div className="panel-group">
                <div className="pg-label">{lang === 'en' ? 'Brand color' : 'Cor da marca'}</div>
                <div className="swatch-row" style={{ alignItems: 'center' }}>
                  {['#e8543b','#1f9d6b','#2e6bff','#7c5cff','#f59e0b','#111111','#ffffff'].map(c => (
                    <button
                      key={c}
                      className={`swatch ${brand.brand_color === c ? 'on' : ''}`}
                      style={{ background: c, borderColor: c === '#ffffff' ? 'var(--border)' : c }}
                      onClick={() => setBrandField('brand_color', c)}
                      title={c}
                    />
                  ))}
                  {/* Input de cor livre */}
                  <label style={{ position: 'relative', cursor: 'pointer' }} title={lang === 'en' ? 'Custom color' : 'Cor personalizada'}>
                    <div
                      className="swatch"
                      style={{
                        background: ['#e8543b','#1f9d6b','#2e6bff','#7c5cff','#f59e0b','#111111','#ffffff'].includes(brand.brand_color)
                          ? 'var(--surface-3)' : brand.brand_color,
                        border: '2px dashed var(--border)',
                      }}
                    >
                      {!['#e8543b','#1f9d6b','#2e6bff','#7c5cff','#f59e0b','#111111','#ffffff'].includes(brand.brand_color) && (
                        <span style={{ position:'absolute',inset:0,display:'grid',placeItems:'center',color:'#fff',fontSize:14,fontWeight:800,textShadow:'0 1px 2px rgba(0,0,0,.5)' }}>✓</span>
                      )}
                    </div>
                    <input
                      type="color"
                      value={brand.brand_color}
                      onChange={e => setBrandField('brand_color', e.target.value)}
                      style={{ position:'absolute',opacity:0,inset:0,cursor:'pointer',width:'100%',height:'100%' }}
                    />
                  </label>
                </div>
                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 14, height: 14, borderRadius: 3, background: brand.brand_color, border: '1px solid var(--border)', flexShrink: 0 }} />
                  <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--muted)' }}>{brand.brand_color}</span>
                </div>
              </div>

              {/* ── Fonte ───────────────────────────────────────── */}
              <div className="panel-group">
                <div className="pg-label">{lang === 'en' ? 'Caption font' : 'Fonte das legendas'}</div>
                {[
                  { id: 'Schibsted Grotesk', label: 'Schibsted Grotesk', sample: 'Aa' },
                  { id: 'Anton',             label: 'Anton',             sample: 'Aa' },
                  { id: 'Poppins',           label: 'Poppins',           sample: 'Aa' },
                ].map(f => (
                  <div
                    key={f.id}
                    className="field-row"
                    style={{ cursor: 'pointer' }}
                    onClick={() => setBrandField('brand_font', f.id)}
                  >
                    <span className="frl" style={{ fontFamily: f.id, fontWeight: 700 }}>
                      <span style={{ fontSize: 16, marginRight: 6, color: 'var(--muted)' }}>{f.sample}</span>
                      {f.label}
                    </span>
                    {brand.brand_font === f.id
                      ? <Icon name="checkCircle" size={18} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                      : <div style={{ width: 18, height: 18, borderRadius: 99, border: '1.5px solid var(--border)' }} />
                    }
                  </div>
                ))}
              </div>

              {/* ── CTA / Encerramento ──────────────────────────── */}
              <div className="panel-group">
                <div className="field-row">
                  <span className="frl">
                    <Icon name="bookmark" />
                    {lang === 'en' ? 'Auto outro / CTA' : 'Encerramento / CTA'}
                  </span>
                  <Switch on={brand.cta_enabled} onClick={() => setBrandField('cta_enabled', !brand.cta_enabled)} />
                </div>
                {brand.cta_enabled && (
                  <div style={{ marginTop: 8 }}>
                    <input
                      type="text"
                      value={brand.cta_text}
                      onChange={e => setBrandField('cta_text', e.target.value)}
                      placeholder={lang === 'en' ? 'e.g. Follow for more ↓' : 'ex: Segue para mais conteúdo ↓'}
                      maxLength={60}
                      style={{
                        width: '100%', padding: '8px 10px', fontSize: 13,
                        borderRadius: 'var(--r)', border: '1.5px solid var(--border)',
                        background: 'var(--surface)', color: 'var(--ink)', outline: 'none',
                      }}
                    />
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                      {60 - (brand.cta_text?.length || 0)} {lang === 'en' ? 'chars remaining' : 'chars restantes'}
                    </div>
                  </div>
                )}
              </div>

              {/* ── Botão salvar ────────────────────────────────── */}
              <div className="panel-group">
                <Btn
                  variant="primary"
                  size="lg"
                  icon={brandSaving ? 'refresh' : brandSaved ? 'checkCircle' : 'save'}
                  disabled={brandSaving || brandLoading}
                  onClick={saveBrandKit}
                  style={{ width: '100%' }}
                >
                  {brandSaving
                    ? (lang === 'en' ? 'Saving…' : 'Salvando…')
                    : brandSaved
                      ? (lang === 'en' ? 'Saved ✓' : 'Salvo ✓')
                      : (lang === 'en' ? 'Save brand kit' : 'Salvar brand kit')}
                </Btn>
                <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 8, textAlign: 'center' }}>
                  {lang === 'en'
                    ? 'Applied automatically on all future renders'
                    : 'Aplicado automaticamente em todos os próximos renders'}
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
                <div style={{ marginTop: 12 }}>
                  {!shareUrl ? (
                    <Btn variant="ghost" size="lg" icon={sharing ? 'refresh' : 'link'}
                      disabled={sharing} onClick={handleShare} style={{ width: '100%' }}>
                      {sharing
                        ? (lang === 'en' ? 'Generating link…' : 'Gerando link…')
                        : (lang === 'en' ? 'Share public link (24h)' : 'Compartilhar link público (24h)')}
                    </Btn>
                  ) : (
                    <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)',
                      borderRadius: 'var(--r)', padding: '10px 12px' }}>
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>
                        {lang === 'en' ? 'Link copied! Expires in 24h:' : 'Link copiado! Expira em 24h:'}
                      </div>
                      <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--accent)',
                        wordBreak: 'break-all', marginBottom: 8 }}>{shareUrl}</div>
                      <Btn variant="ghost" size="sm" icon="copy"
                        onClick={() => navigator.clipboard?.writeText(shareUrl)}>
                        {lang === 'en' ? 'Copy again' : 'Copiar novamente'}
                      </Btn>
                    </div>
                  )}
                </div>
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
