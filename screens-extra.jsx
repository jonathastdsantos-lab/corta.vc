/* ============================================================
   SCREENS — Templates · Schedule
   ============================================================ */

function CommunityTemplates({ lang, openClip }) {
  const en = lang === 'en';
  return (
    <div className="tpl-grid stagger">
      {[
        { name: 'Podcast Primo', author: '@thiagonigro', uses: '12k', style: 'hormozi' },
        { name: 'Gameplay Rápida', author: '@alanzoka', uses: '8.5k', style: 'netflix' },
        { name: 'Pregação Emocionante', author: '@deiveleonardo', uses: '15k', style: 'dev' },
      ].map((t, i) => (
        <div key={i} className="tpl-card" onClick={() => openClip && openClip(CLIPS[i % CLIPS.length])}>
          <div className="tpl-preview" style={{ background: 'var(--surface-3)', aspectRatio: '16/11' }}>
            <div style={{ position: 'relative', zIndex: 2, padding: '0 14px', textAlign: 'center' }}>
              <CaptionText text={en ? 'Community' : 'Comunidade'} style={CAPTION_STYLES.find(s=>s.id===t.style)} fontSize={20} />
            </div>
          </div>
          <div className="body">
            <div>
              <div className="tname">{t.name}</div>
              <div className="tmeta" style={{ display: 'flex', gap: 6 }}>
                <span>{t.author}</span>
                <span style={{ color: 'var(--accent)' }}>• {t.uses} {en ? 'uses' : 'usos'}</span>
              </div>
            </div>
            <Btn variant="ghost" size="sm">{en ? 'Use' : 'Usar'}</Btn>
          </div>
        </div>
      ))}
    </div>
  );
}

function TemplatesScreen({ lang, openClip }) {
  const T = STR[lang];
  const [tab, setTab] = useState('captions');
  const tabs = [
    { id: 'captions', label: T.tab_captions, icon: 'text' },
    { id: 'layouts', label: T.tab_layouts, icon: 'crop' },
    { id: 'niches', label: T.tab_niches, icon: 'grid' },
    { id: 'formats', label: T.tab_formats, icon: 'ratio' },
    { id: 'community', label: lang === 'en' ? 'Community' : 'Comunidade', icon: 'users' },
  ];
  const demoText = lang === 'en' ? 'this is {viral}' : 'isso é {viral}';

  return (
    <div className="page page-wide">
      <div className="section-head fade-up">
        <div>
          <div className="h-eyebrow">{lang === 'en' ? 'Template library' : 'Biblioteca'}</div>
          <h1 className="h1">{T.tpl_title}</h1>
          <p className="sub">{T.tpl_sub}</p>
        </div>
        <Btn variant="dark" icon="plus">{lang === 'en' ? 'New template' : 'Novo template'}</Btn>
      </div>

      <div className="filter-bar" style={{ gap: 6 }}>
        {tabs.map(t => (
          <button key={t.id} className={`chip-toggle ${tab === t.id ? 'on' : ''}`} onClick={() => setTab(t.id)}>
            <Icon name={t.icon} size={14} />{t.label}
          </button>
        ))}
      </div>

      {tab === 'captions' && (
        <div className="tpl-grid stagger">
          {CAPTION_STYLES.map((s, i) => (
            <div key={s.id} className="tpl-card" onClick={() => openClip(CLIPS[i % CLIPS.length])}>
              <div className="tpl-preview" style={{ background: NICHES[Object.keys(NICHES)[i % 7]].tint }}>
                <div className="thumb" style={{ position: 'absolute', inset: 0, borderRadius: 0 }}><span className="thumb-label" style={{ opacity: .4 }}>9:16</span></div>
                <div style={{ position: 'relative', zIndex: 2, padding: '0 14px', textAlign: 'center' }}>
                  <CaptionText text={demoText} style={s} fontSize={22} />
                </div>
              </div>
              <div className="body">
                <div><div className="tname">{s.name}</div><div className="tmeta">{s.anim === 'word' ? 'Karaokê' : s.uppercase ? 'CAIXA ALTA' : 'Normal'}</div></div>
                <IconBtn name="arrowR" size={16} />
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'layouts' && (
        <div className="tpl-grid stagger">
          {LAYOUTS.map((l, i) => (
            <div key={l.id} className="tpl-card" onClick={() => openClip(CLIPS[i % CLIPS.length])}>
              <div className="tpl-preview" style={{ background: 'var(--stage)' }}>
                <div className="thumb" style={{ position: 'absolute', inset: 0, borderRadius: 0 }} />
                <div style={{ position: 'relative', zIndex: 2, transform: 'scale(1.5)', color: 'rgba(255,255,255,.7)' }}><LayoutGlyph kind={l.glyph} /></div>
              </div>
              <div className="body">
                <div><div className="tname">{l.name}</div><div className="tmeta">{l.desc}</div></div>
                <IconBtn name="arrowR" size={16} />
              </div>
            </div>
          ))}
          <div className="tpl-card" style={{ display: 'grid', placeItems: 'center', minHeight: 200, borderStyle: 'dashed' }}>
            <div className="empty" style={{ padding: 20 }}><Icon name="plus" size={28} /><div style={{ fontSize: 13 }}>{lang === 'en' ? 'Custom layout' : 'Layout próprio'}</div></div>
          </div>
        </div>
      )}

      {tab === 'niches' && (
        <div className="tpl-grid stagger" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))' }}>
          {Object.entries(NICHES).map(([k, n], i) => (
            <div key={k} className="tpl-card" onClick={() => openClip(CLIPS.find(c => c.niche === k) || CLIPS[i])}>
              <div className="tpl-preview" style={{ aspectRatio: '16/11', background: n.tint }}>
                <div className="thumb" style={{ position: 'absolute', inset: 0, borderRadius: 0 }} />
                <div style={{ position: 'relative', zIndex: 2, textAlign: 'center', color: '#fff' }}>
                  <Icon name={nicheIcon(k)} size={30} style={{ opacity: .9 }} />
                  <div style={{ fontWeight: 800, fontSize: 17, marginTop: 8, letterSpacing: '-.02em' }}>{n.label}</div>
                </div>
              </div>
              <div className="body">
                <div className="tmeta" style={{ marginTop: 0 }}>{lang === 'en' ? 'Caption + layout + colors preset' : 'Legenda + layout + cores'}</div>
                <span className="tag accent"><Icon name="sparkles" size={12} />{lang === 'en' ? 'Preset' : 'Pronto'}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'community' && <CommunityTemplates lang={lang} openClip={openClip} />}

      {tab === 'formats' && (
        <div className="proj-grid stagger" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
          {RATIOS.map(r => (
            <div key={r.id} className="card" style={{ padding: 22, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, cursor: 'pointer' }}>
              <div style={{ border: '2.5px solid var(--border-strong)', borderRadius: 8, width: r.w * 2.4, height: r.h * 2.4, background: 'var(--surface-2)', display: 'grid', placeItems: 'center', color: 'var(--muted)' }}>
                <span className="mono" style={{ fontSize: 12 }}>{r.id}</span>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div className="h3">{r.name}</div>
                <div className="tmeta">{r.meta}</div>
              </div>
              <div className="row" style={{ gap: 5 }}>
                {(r.id === '9:16' ? ['tiktok', 'youtube', 'instagram', 'kwai'] : r.id === '1:1' ? ['instagram', 'facebook'] : ['youtube', 'x', 'linkedin']).map(p => (
                  <span key={p} className={`plat ${p}`} style={{ width: 24, height: 24 }}><Icon plat={p} size={13} /></span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function nicheIcon(k) {
  return { podcast: 'mic', games: 'gamepad', noticias: 'message', fe: 'star', financas: 'trend', educacao: 'brain', fitness: 'flame' }[k] || 'film';
}

function ScheduleScreen({ lang, openAI, user }) {
  const T = STR[lang];
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [modalClip, setModalClip] = useState('');
  const [modalPlatform, setModalPlatform] = useState('tiktok');
  const [modalDateTime, setModalDateTime] = useState('');
  const [modalSubmitting, setModalSubmitting] = useState(false);
  const [userClips, setUserClips] = useState([]);

  useEffect(() => {
    async function load() {
      if (!window.Supa?.client || !user) {
        setEvents(window.SCHEDULE.map(e => ({
          ...e, id: e.day + e.plat,
          clips: { title: window.CLIPS.find(c => c.id === e.clip)?.title || 'Corte' },
          scheduled_at: `2026-06-${String(e.day).padStart(2,'0')}T${e.time}:00`,
          platform: e.plat, status: 'queued'
        })));
        setLoading(false);
        return;
      }
      const { data } = await window.Supa.client
        .from('schedule')
        .select('*, clips(title, thumbnail_url, niche)')
        .eq('user_id', user.id)
        .order('scheduled_at', { ascending: true });
      setEvents(data || []);

      // Carrega clips do usuário para o modal de agendamento
      if (window.Supa?.client && user) {
        window.Supa.client.from('clips')
          .select('id, title, niche, thumbnail_url')
          .eq('user_id', user.id)
          .eq('status', 'rendered')
          .order('score', { ascending: false })
          .limit(20)
          .then(({ data }) => setUserClips(data || []));
      } else {
        setUserClips(window.CLIPS || []);
      }

      setLoading(false);
    }
    load();
  }, [user]);

  const dows = lang === 'en' ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] : ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const now = new Date();
  const monthName = now.toLocaleDateString(lang === 'en' ? 'en-US' : 'pt-BR', { month: 'long', year: 'numeric' });
  const firstDow = new Date(now.getFullYear(), now.getMonth(), 1).getDay();
  const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const today = now.getDate();
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  while (cells.length % 7) cells.push(null);
  const evByDay = {};
  events.forEach(e => {
    const day = new Date(e.scheduled_at).getDate();
    (evByDay[day] = evByDay[day] || []).push(e);
  });

  return (
    <div className="page page-wide">
      <div className="section-head fade-up">
        <div>
          <div className="h-eyebrow">{lang === 'en' ? 'Calendar' : 'Calendário'}</div>
          <h1 className="h1">{T.sched_title}</h1>
          <p className="sub">{T.sched_sub}</p>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <Btn variant="ghost" icon="sparkles" onClick={openAI}>{T.best_time}</Btn>
          <Btn variant="dark" icon="plus" onClick={() => {
            setModalDateTime(new Date(Date.now() + 30 * 60000).toISOString().slice(0,16));
            setShowAddModal(true);
          }}>
            {lang === 'en' ? 'Schedule clip' : 'Agendar corte'}
          </Btn>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 22, alignItems: 'start' }}>
        {/* Calendar */}
        <div className="card" style={{ padding: 18 }}>
          <div className="row between" style={{ marginBottom: 14 }}>
            <h2 className="h2">{monthName}</h2>
            <div className="row" style={{ gap: 4 }}><IconBtn name="chevL" size={18} /><IconBtn name="chevR" size={18} /></div>
          </div>
          <div className="cal-grid" style={{ marginBottom: 8 }}>
            {dows.map(d => <div key={d} className="cal-head">{d}</div>)}
          </div>
          <div className="cal-grid">
            {cells.map((d, i) => (
              <div key={i} className={`cal-cell ${d == null ? 'muted' : ''} ${d === today ? 'today' : ''}`}>
                {d != null && <span className="cal-date">{d}</span>}
                {(evByDay[d] || []).map((e, j) => {
                  return (
                    <div key={j} className="cal-event" style={{ background: platColor(e.platform) }} title={e.clips?.title}>
                      <Icon plat={e.platform} size={11} />{new Date(e.scheduled_at).getHours() + ':00'}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Queue */}
        <div className="col" style={{ gap: 16 }}>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="row between" style={{ padding: '16px 16px 12px' }}>
              <h3 className="h3">{T.queue}</h3>
              <span className="tag accent">{events.length} {T.posts_scheduled}</span>
            </div>
            {loading ? <div style={{padding: 16}}>Carregando...</div> : events.slice(0, 5).map((e, i) => {
              const clip = e.clips || window.CLIPS?.find(c => c.id === e.clip);
              return (
                <div key={i} className="queue-item">
                  <Thumb niche={clip?.niche} className="qthumb" label={false} />
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{clip?.title}</div>
                    <div className="row" style={{ gap: 6, marginTop: 4 }}>
                      <span className={`plat ${e.platform}`} style={{ width: 20, height: 20, borderRadius: 5 }}><Icon plat={e.platform} size={11} /></span>
                      <span className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>{lang === 'en' ? 'Jun' : ''} {new Date(e.scheduled_at).getDate()}{lang === 'en' ? '' : '/06'} · {new Date(e.scheduled_at).getHours() + ':00'}</span>
                    </div>
                  </div>
                  <IconBtn name="more" size={16} />
                </div>
              );
            })}
          </div>

          <div className="card" style={{ padding: 16, background: 'var(--surface-2)' }}>
            <div className="row" style={{ gap: 9, marginBottom: 8 }}>
              <span className="spark" style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--accent)', color: 'var(--accent-ink)', display: 'grid', placeItems: 'center' }}><Icon name="sparkles" size={15} /></span>
              <div style={{ fontWeight: 700, fontSize: 13.5 }}>{T.best_time}</div>
            </div>
            <p style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5, margin: 0 }}>
              {lang === 'en' ? 'Your audience is most active Tue & Thu, 18–21h. I queued your top 3 clips for those windows.' : 'Seu público é mais ativo ter. e qui., 18–21h. Já agendei seus 3 melhores cortes nesses horários.'}
            </p>
            <Btn variant="ghost" size="sm" icon="check" style={{ marginTop: 11 }} onClick={openAI}>{lang === 'en' ? 'Apply suggestion' : 'Aplicar sugestão'}</Btn>
          </div>
        </div>
        </div>
      </div>

      {/* Modal de novo agendamento */}
      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 999,
          display: 'grid', placeItems: 'center', padding: 20 }}
          onClick={() => setShowAddModal(false)}>
          <div className="card fade-up" style={{ width: '100%', maxWidth: 440, padding: 24 }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 className="h3">{lang === 'en' ? 'Schedule clip' : 'Agendar corte'}</h3>
              <IconBtn name="x" size={18} onClick={() => setShowAddModal(false)} />
            </div>

            {/* Seleção de clip */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-2)', display: 'block', marginBottom: 6 }}>
                {lang === 'en' ? 'Clip' : 'Corte'}
              </label>
              <select
                value={modalClip}
                onChange={e => setModalClip(e.target.value)}
                style={{ width: '100%', height: 42, padding: '0 12px', borderRadius: 'var(--r)',
                  border: '1.5px solid var(--border-strong)', background: 'var(--surface)',
                  color: 'var(--ink)', fontSize: 14, outline: 'none' }}>
                <option value="">{lang === 'en' ? 'Choose a clip…' : 'Escolha um corte…'}</option>
                {userClips.map(c => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
            </div>

            {/* Seleção de plataforma */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-2)', display: 'block', marginBottom: 6 }}>
                {lang === 'en' ? 'Platform' : 'Plataforma'}
              </label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[
                  { id: 'tiktok', label: 'TikTok' },
                  { id: 'instagram', label: 'Instagram' },
                  { id: 'youtube', label: 'Shorts' },
                  { id: 'facebook', label: 'Facebook' },
                  { id: 'linkedin', label: 'LinkedIn' },
                  { id: 'kwai', label: 'Kwai' },
                ].map(p => (
                  <button key={p.id}
                    onClick={() => setModalPlatform(p.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
                      borderRadius: 99, border: `1.5px solid ${modalPlatform === p.id ? 'var(--accent)' : 'var(--border)'}`,
                      background: modalPlatform === p.id ? 'var(--accent-soft)' : 'var(--surface)',
                      color: modalPlatform === p.id ? 'var(--accent)' : 'var(--ink-2)',
                      fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: '.12s'
                    }}>
                    <span className={`plat ${p.id}`} style={{ width: 20, height: 20, borderRadius: 5 }}>
                      <Icon plat={p.id} size={11} />
                    </span>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Data e hora */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-2)', display: 'block', marginBottom: 6 }}>
                {lang === 'en' ? 'Date & time' : 'Data e horário'}
              </label>
              <input
                type="datetime-local"
                value={modalDateTime}
                min={new Date(Date.now() + 10 * 60000).toISOString().slice(0,16)}
                onChange={e => setModalDateTime(e.target.value)}
                style={{ width: '100%', height: 42, padding: '0 12px', borderRadius: 'var(--r)',
                  border: '1.5px solid var(--border-strong)', background: 'var(--surface)',
                  color: 'var(--ink)', fontSize: 14, outline: 'none' }} />
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <Btn variant="ghost" onClick={() => setShowAddModal(false)}>
                {lang === 'en' ? 'Cancel' : 'Cancelar'}
              </Btn>
              <Btn variant="primary" icon={modalSubmitting ? 'refresh' : 'send'}
                disabled={!modalClip || !modalDateTime || modalSubmitting}
                onClick={async () => {
                  if (!modalClip || !modalDateTime) return;
                  setModalSubmitting(true);
                  try {
                    const scheduledAt = new Date(modalDateTime).toISOString();
                    if (window.Supa?.client && user) {
                      const { error } = await window.Supa.client.from('schedule').insert({
                        user_id: user.id,
                        clip_id: modalClip,
                        platform: modalPlatform,
                        scheduled_at: scheduledAt,
                        status: 'queued'
                      });
                      if (error) throw error;
                      // Recarrega eventos
                      const { data } = await window.Supa.client
                        .from('schedule')
                        .select('*, clips(title, thumbnail_url, niche)')
                        .eq('user_id', user.id)
                        .order('scheduled_at', { ascending: true });
                      setEvents(data || []);
                    } else {
                      // Demo: adiciona localmente
                      const clipObj = userClips.find(c => c.id === modalClip);
                      setEvents(prev => [...prev, {
                        id: Date.now(), clip_id: modalClip, platform: modalPlatform,
                        scheduled_at: scheduledAt, status: 'queued',
                        clips: { title: clipObj?.title || 'Corte' }
                      }]);
                    }
                    setShowAddModal(false);
                    window.showToast?.(
                      lang === 'en'
                        ? `Scheduled for ${new Date(modalDateTime).toLocaleDateString('en-US', {weekday:'short', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'})}`
                        : `Agendado para ${new Date(modalDateTime).toLocaleDateString('pt-BR', {weekday:'short', day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'})}`,
                      { type: 'success' }
                    );
                  } catch (err) {
                    window.showToast?.(lang === 'en' ? 'Failed to schedule' : 'Falha ao agendar', { type: 'error' });
                    console.error(err);
                  }
                  setModalSubmitting(false);
                }}>
                {modalSubmitting ? (lang === 'en' ? 'Scheduling…' : 'Agendando…') : (lang === 'en' ? 'Schedule' : 'Agendar')}
              </Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function platColor(p) {
  return { tiktok: '#111', youtube: '#ff0033', instagram: '#d6249f', x: '#111', linkedin: '#0a66c2', facebook: '#1877f2', kwai: '#ff5000' }[p] || '#888';
}

function AnalyticsScreen({ lang, user }) {
  const en = lang === 'en';

  // ── Estado ────────────────────────────────────────────────────
  const [stats,    setStats]    = useState(null);   // métricas do topo
  const [topClips, setTopClips] = useState(null);   // top 5 por score
  const [weekly,   setWeekly]   = useState(null);   // clips por semana (8 semanas)
  const [loading,  setLoading]  = useState(true);

  // ── Carregamento ──────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      setLoading(true);

      // ── Modo demo: dados mock ──
      if (!window.Supa?.client || !user?.id) {
        await new Promise(r => setTimeout(r, 600)); // simula latência
        setStats({
          projects:    12,
          clips:      184,
          schedules:   96,
          totalViews: 2_400_000,
          totalLikes:   47_000,
          hoursaved:      47,
        });
        setTopClips([
          { id: '1', title: 'O segredo que ninguém te conta 🔥', score: 94, views_count: 48200, likes_count: 3100, niche: 'financas',  thumbnail_url: null },
          { id: '2', title: 'Por que você nunca fica rico 💸',   score: 91, views_count: 31500, likes_count: 2400, niche: 'financas',  thumbnail_url: null },
          { id: '3', title: 'A verdade sobre investimentos',     score: 88, views_count: 22800, likes_count: 1870, niche: 'educacao',  thumbnail_url: null },
          { id: '4', title: 'Esse hack mudou minha vida toda',   score: 85, views_count: 18400, likes_count: 1220, niche: 'podcast',   thumbnail_url: null },
          { id: '5', title: 'Você está fazendo isso errado ⚠️',  score: 82, views_count: 14100, likes_count:  980, niche: 'fitness',   thumbnail_url: null },
        ]);
        // Gera dados semanais de demo para as últimas 8 semanas
        setWeekly(Array.from({ length: 8 }, (_, i) => ({
          label: `S${8 - i}`,
          count: Math.floor(Math.random() * 18) + 4,
        })).reverse());
        setLoading(false);
        return;
      }

      // ── Modo live: queries reais ──
      const uid = user.id;

      // Busca tudo em paralelo para não bloquear sequencialmente
      const [
        { count: projectsCount },
        { count: clipsCount },
        { count: scheduleCount },
        { data: clipsData },
      ] = await Promise.all([
        window.Supa.client
          .from('projects').select('*', { count: 'exact', head: true })
          .eq('user_id', uid),
        window.Supa.client
          .from('clips').select('*', { count: 'exact', head: true })
          .eq('user_id', uid),
        window.Supa.client
          .from('schedule').select('*', { count: 'exact', head: true })
          .eq('user_id', uid),
        window.Supa.client
          .from('clips')
          .select('id, title, score, views_count, likes_count, niche, thumbnail_url, created_at')
          .eq('user_id', uid)
          .order('created_at', { ascending: false })
          .limit(200),  // busca recentes suficientes para calcular tudo
      ]);

      const clips = clipsData || [];

      // ── Métricas agregadas ──
      const totalViews = clips.reduce((s, c) => s + (c.views_count || 0), 0);
      const totalLikes = clips.reduce((s, c) => s + (c.likes_count || 0), 0);
      const hoursaved  = Math.round((clipsCount || 0) * 0.8);

      setStats({
        projects:  projectsCount || 0,
        clips:     clipsCount    || 0,
        schedules: scheduleCount || 0,
        totalViews,
        totalLikes,
        hoursaved,
      });

      // ── Top 5 clips por score ──
      const sorted = [...clips].sort((a, b) => (b.score || 0) - (a.score || 0));
      setTopClips(sorted.slice(0, 5));

      // ── Clips por semana (últimas 8 semanas) ──
      const now    = Date.now();
      const msWeek = 7 * 24 * 60 * 60 * 1000;
      const weeks  = Array.from({ length: 8 }, (_, i) => {
        const weekStart = now - (7 - i) * msWeek;
        const weekEnd   = weekStart + msWeek;
        return {
          label: new Date(weekStart).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
          count: clips.filter(c => {
            const t = new Date(c.created_at).getTime();
            return t >= weekStart && t < weekEnd;
          }).length,
        };
      });
      setWeekly(weeks);

      setLoading(false);
    }

    load();
  }, [user]);

  // ── Helpers ───────────────────────────────────────────────────
  function fmt(n) {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace('.0', '') + 'M';
    if (n >= 1_000)     return (n / 1_000).toFixed(1).replace('.0', '') + 'k';
    return String(n);
  }

  const maxWeekly = weekly ? Math.max(...weekly.map(w => w.count), 1) : 1;

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="page page-wide fade-up">

      {/* Cabeçalho */}
      <div className="section-head fade-up" style={{ marginBottom: 28 }}>
        <div>
          <div className="h-eyebrow">Insights</div>
          <h1 className="h1">{en ? 'Analytics' : 'Métricas'}</h1>
          <p className="sub">
            {en ? 'Track your content performance' : 'Acompanhe o desempenho do seu conteúdo'}
          </p>
        </div>
      </div>

      {/* ── Stat row: 6 métricas ── */}
      <div className="stat-row stagger" style={{ marginBottom: 32 }}>
        {loading ? (
          // Skeleton: 6 cards shimmer
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="stat skeleton-card">
              <div className="skeleton skeleton-text" style={{ height: 12, width: '60%', marginBottom: 12 }} />
              <div className="skeleton skeleton-text" style={{ height: 30, width: '45%' }} />
            </div>
          ))
        ) : stats ? [
          { key: 'views',    icon: 'eye',      label: { pt: 'Visualizações',     en: 'Total views'    }, num: fmt(stats.totalViews), delta: '', dir: 'up' },
          { key: 'likes',    icon: 'heart',    label: { pt: 'Curtidas totais',   en: 'Total likes'    }, num: fmt(stats.totalLikes), delta: '', dir: 'up' },
          { key: 'clips',    icon: 'scissors', label: { pt: 'Cortes gerados',    en: 'Clips generated'}, num: String(stats.clips),   delta: '', dir: 'up' },
          { key: 'projects', icon: 'folder',   label: { pt: 'Projetos',          en: 'Projects'       }, num: String(stats.projects),delta: '', dir: 'up' },
          { key: 'posted',   icon: 'send',     label: { pt: 'Publicados',        en: 'Published'      }, num: String(stats.schedules), delta: '', dir: 'up' },
          { key: 'time',     icon: 'clock',    label: { pt: 'Horas economizadas',en: 'Hours saved'    }, num: `${stats.hoursaved}h`,  delta: '', dir: 'up' },
        ].map(s => (
          <div key={s.key} className="stat">
            <div className="label">
              <Icon name={s.icon} size={15} />
              {s.label[lang] || s.label.pt}
            </div>
            <div className="num">{s.num}</div>
          </div>
        )) : null}
      </div>

      {/* ── Grid: gráfico semanal + top clips ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>

        {/* Gráfico semanal */}
        <div className="card" style={{ padding: '20px 20px 16px' }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
            {en ? 'Clips per week' : 'Cortes por semana'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>
            {en ? 'Last 8 weeks' : 'Últimas 8 semanas'}
          </div>

          {loading ? (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 100 }}>
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="skeleton" style={{
                  flex: 1, height: `${30 + Math.random() * 60}%`,
                  borderRadius: '4px 4px 0 0'
                }} />
              ))}
            </div>
          ) : weekly ? (
            <div>
              {/* Barras */}
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 100, marginBottom: 6 }}>
                {weekly.map((w, i) => {
                  const pct = maxWeekly > 0 ? (w.count / maxWeekly) * 100 : 0;
                  return (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, height: '100%', justifyContent: 'flex-end' }}>
                      {w.count > 0 && (
                        <span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600 }}>{w.count}</span>
                      )}
                      <div
                        title={`${w.label}: ${w.count} ${en ? 'clips' : 'cortes'}`}
                        style={{
                          width: '100%',
                          height: `${Math.max(pct, w.count > 0 ? 8 : 2)}%`,
                          background: w.count > 0 ? 'var(--accent)' : 'var(--surface-3)',
                          borderRadius: '3px 3px 0 0',
                          opacity: w.count > 0 ? 1 : 0.4,
                          transition: 'height .4s cubic-bezier(.2,.7,.2,1)',
                        }}
                      />
                    </div>
                  );
                })}
              </div>
              {/* Labels de data */}
              <div style={{ display: 'flex', gap: 5 }}>
                {weekly.map((w, i) => (
                  <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: 9, color: 'var(--faint)', lineHeight: 1 }}>
                    {w.label}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {/* Top 5 clips por score */}
        <div className="card" style={{ padding: '20px 20px 8px' }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
            {en ? 'Top clips by score' : 'Top cortes por score'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>
            {en ? 'Highest virality score' : 'Maior score de viralização'}
          </div>

          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <div className="skeleton" style={{ width: 32, height: 32, borderRadius: 6, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div className="skeleton skeleton-text" style={{ height: 12, width: '75%', marginBottom: 6 }} />
                  <div className="skeleton skeleton-text" style={{ height: 10, width: '40%' }} />
                </div>
                <div className="skeleton" style={{ width: 36, height: 24, borderRadius: 99 }} />
              </div>
            ))
          ) : topClips?.length > 0 ? (
            topClips.map((clip, i) => (
              <div key={clip.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 0',
                borderBottom: i < topClips.length - 1 ? '1px solid var(--border)' : 'none',
              }}>
                {/* Rank */}
                <div style={{
                  width: 20, textAlign: 'center', fontSize: 12,
                  fontWeight: 700, color: i === 0 ? 'var(--accent)' : 'var(--faint)',
                  flexShrink: 0,
                }}>
                  {i + 1}
                </div>

                {/* Thumbnail ou placeholder */}
                <div style={{
                  width: 36, height: 36, borderRadius: 6, overflow: 'hidden',
                  background: 'var(--surface-3)', flexShrink: 0, display: 'grid', placeItems: 'center',
                }}>
                  {clip.thumbnail_url ? (
                    <img src={clip.thumbnail_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <Icon name="film" size={14} style={{ opacity: .4 }} />
                  )}
                </div>

                {/* Título + métricas */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
                    overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {clip.title}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, display: 'flex', gap: 8 }}>
                    {clip.views_count > 0 && (
                      <span><Icon name="eye"   size={10} /> {fmt(clip.views_count)}</span>
                    )}
                    {clip.likes_count > 0 && (
                      <span><Icon name="heart" size={10} /> {fmt(clip.likes_count)}</span>
                    )}
                  </div>
                </div>

                {/* Score badge */}
                <div style={{
                  flexShrink: 0, padding: '3px 8px', borderRadius: 99, fontSize: 12, fontWeight: 700,
                  background: clip.score >= 80 ? 'var(--good-bg)' : clip.score >= 60 ? 'var(--accent-soft)' : 'var(--surface-3)',
                  color:      clip.score >= 80 ? 'var(--good)'    : clip.score >= 60 ? 'var(--accent)'      : 'var(--muted)',
                }}>
                  {clip.score ?? '—'}
                </div>
              </div>
            ))
          ) : (
            <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
              {en ? 'No clips yet' : 'Nenhum corte ainda'}
            </div>
          )}
        </div>

      </div>

      {/* ── Nota sobre sincronização ── */}
      {!loading && stats?.totalViews === 0 && stats?.clips > 0 && (
        <div style={{
          marginTop: 16, padding: '10px 14px', background: 'var(--surface-2)',
          borderRadius: 'var(--r)', border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'var(--muted)',
        }}>
          <Icon name="info" size={14} style={{ flexShrink: 0 }} />
          {en
            ? 'Views and likes sync automatically after posting. Connect your social networks to see real data.'
            : 'Views e curtidas sincronizam automaticamente após publicar. Conecte suas redes sociais para ver dados reais.'}
        </div>
      )}

    </div>
  );
}

Object.assign(window, { TemplatesScreen, ScheduleScreen, AnalyticsScreen, nicheIcon, platColor });
