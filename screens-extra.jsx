/* ============================================================
   SCREENS — Templates · Schedule
   ============================================================ */

function TemplatesScreen({ lang, openClip }) {
  const T = STR[lang];
  const [tab, setTab] = useState('captions');
  const tabs = [
    { id: 'captions', label: T.tab_captions, icon: 'text' },
    { id: 'layouts', label: T.tab_layouts, icon: 'crop' },
    { id: 'niches', label: T.tab_niches, icon: 'grid' },
    { id: 'formats', label: T.tab_formats, icon: 'ratio' },
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
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    async function load() {
      if (!window.Supa?.client) {
        setSchedule(window.SCHEDULE || []);
        setLoading(false);
        return;
      }
      const { data } = await window.Supa.client
        .from('schedule')
        .select('*, clips(*)')
        .eq('user_id', user?.id || '')
        .order('scheduled_at', { ascending: true });
        
      if (data) {
        const mapped = data.map(d => {
          const date = new Date(d.scheduled_at);
          return {
            id: d.id,
            clip: d.clip_id,
            clipData: d.clips,
            plat: d.platform,
            day: date.getDate(),
            time: date.getHours() + ':00',
            status: d.status
          };
        });
        setSchedule(mapped);
      } else {
        setSchedule(window.SCHEDULE || []);
      }
      setLoading(false);
    }
    load();
  }, [user]);

  const dows = lang === 'en' ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] : ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const monthName = lang === 'en' ? 'June 2026' : 'Junho 2026';
  // June 2026 starts on Monday (1st = Mon). Pad so 1 lands under Mon.
  const firstDow = 1; // Monday
  const days = 30;
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  while (cells.length % 7) cells.push(null);
  const evByDay = {};
  schedule.forEach(e => { (evByDay[e.day] = evByDay[e.day] || []).push(e); });
  const today = 11;

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
          <Btn variant="dark" icon="plus">{lang === 'en' ? 'Schedule clip' : 'Agendar corte'}</Btn>
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
                  const clip = e.clipData || window.CLIPS?.find(c => c.id === e.clip);
                  return (
                    <div key={j} className="cal-event" style={{ background: platColor(e.plat) }} title={clip?.title}>
                      <Icon plat={e.plat} size={11} />{e.time}
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
            <div className="row between" style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
              <h3 className="h3">{T.queue}</h3>
              <span className="tag accent">{schedule.length} {T.posts_scheduled}</span>
            </div>
            {loading ? <div style={{padding: 16}}>Carregando...</div> : schedule.slice(0, 5).map((e, i) => {
              const clip = e.clipData || window.CLIPS?.find(c => c.id === e.clip);
              return (
                <div key={i} className="queue-item">
                  <Thumb niche={clip.niche} className="qthumb" label={false} />
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{clip.title}</div>
                    <div className="row" style={{ gap: 6, marginTop: 4 }}>
                      <span className={`plat ${e.plat}`} style={{ width: 20, height: 20, borderRadius: 5 }}><Icon plat={e.plat} size={11} /></span>
                      <span className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>{lang === 'en' ? 'Jun' : ''} {e.day}{lang === 'en' ? '' : '/06'} · {e.time}</span>
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
