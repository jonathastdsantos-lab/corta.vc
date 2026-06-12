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
  const [stats, setStats] = useState(null);

  useEffect(() => {
    async function load() {
      if (!window.Supa?.client) return;
      const { count: clipsCount } = await window.Supa.client.from('clips').select('*', { count: 'exact', head: true }).eq('user_id', user?.id || '');
      const { count: projectsCount } = await window.Supa.client.from('projects').select('*', { count: 'exact', head: true }).eq('user_id', user?.id || '');
      const { count: scheduleCount } = await window.Supa.client.from('schedule').select('*', { count: 'exact', head: true }).eq('user_id', user?.id || '');
      setStats({ clips: clipsCount || 0, projects: projectsCount || 0, schedules: scheduleCount || 0 });
    }
    load();
  }, [user]);

  return (
    <div className="page page-wide fade-up">
      <div className="section-head fade-up">
        <div>
          <div className="h-eyebrow">Insights</div>
          <h1 className="h1">{lang === 'en' ? 'Analytics' : 'Métricas'}</h1>
          <p className="sub">{lang === 'en' ? 'Track your content performance' : 'Acompanhe o desempenho do seu conteúdo'}</p>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginTop: 24 }}>
        <div className="card" style={{ padding: 24 }}>
          <div className="tmeta" style={{ marginBottom: 8 }}>{lang === 'en' ? 'Total Projects' : 'Total de Projetos'}</div>
          <div className="h1" style={{ fontSize: 48 }}>{stats ? stats.projects : '...'}</div>
        </div>
        <div className="card" style={{ padding: 24 }}>
          <div className="tmeta" style={{ marginBottom: 8 }}>{lang === 'en' ? 'Clips Generated' : 'Cortes Gerados'}</div>
          <div className="h1" style={{ fontSize: 48 }}>{stats ? stats.clips : '...'}</div>
        </div>
        <div className="card" style={{ padding: 24 }}>
          <div className="tmeta" style={{ marginBottom: 8 }}>{lang === 'en' ? 'Posts Scheduled' : 'Agendamentos'}</div>
          <div className="h1" style={{ fontSize: 48 }}>{stats ? stats.schedules : '...'}</div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { TemplatesScreen, ScheduleScreen, AnalyticsScreen, nicheIcon, platColor });
