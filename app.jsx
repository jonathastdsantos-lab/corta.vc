/* ============================================================
   APP — shell, routing, tweaks, AI
   ============================================================ */

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#e8543b",
  "font": "Schibsted Grotesk",
  "dark": false,
  "density": "regular",
  "capStyle": "hormozi",
  "lang": localStorage.getItem("corta_lang") || "pt"
}/*EDITMODE-END*/;

const NAV = [
  { id: 'dashboard', icon: 'home', key: 'nav_home' },
  { id: 'clips', icon: 'film', key: 'nav_clips' },
  { id: 'templates', icon: 'template', key: 'nav_templates' },
  { id: 'schedule', icon: 'calendar', key: 'nav_schedule' },
  { id: 'analytics', icon: 'chart', key: 'nav_analytics' },
];

function NotifDropdown({ notifications, open, onClose, onRead, lang }) {
  const en = lang === 'en';
  const unread = notifications.filter(n => !n.read).length;

  const typeIcon = { processing_done: 'scissors', post_published: 'send', credits_low: 'zap', new_feature: 'sparkles', welcome: 'star' };

  if (!open) return null;

  return (
    <div className="card fade-up" style={{
      position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 320,
      zIndex: 100, boxShadow: 'var(--shadow-pop)', overflow: 'hidden'
    }}>
          <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>
              {en ? 'Notifications' : 'Notificações'}
              {unread > 0 && <span className="nav-badge" style={{ marginLeft: 8 }}>{unread}</span>}
            </span>
            {unread > 0 && (
              <button style={{ fontSize: 12, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}
                onClick={() => notifications.forEach(n => !n.read && onRead(n.id))}>
                {en ? 'Mark all read' : 'Marcar lidas'}
              </button>
            )}
          </div>
          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
                {en ? 'No notifications yet' : 'Nenhuma notificação ainda'}
              </div>
            ) : notifications.slice(0, 10).map(n => (
              <div key={n.id} onClick={() => onRead(n.id)}
                style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)',
                  background: n.read ? 'transparent' : 'var(--accent-soft)', cursor: 'pointer',
                  display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--surface-3)',
                  display: 'grid', placeItems: 'center', flex: 'none' }}>
                  <Icon name={typeIcon[n.type] || 'bell'} size={14} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: n.read ? 500 : 700, lineHeight: 1.3 }}>{n.title}</div>
                  {n.body && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{n.body}</div>}
                  <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
                    {new Date(n.created_at).toLocaleDateString('pt-BR')}
                  </div>
                </div>
                {!n.read && <div style={{ width: 7, height: 7, borderRadius: 99, background: 'var(--accent)', flex: 'none', marginTop: 4 }} />}
              </div>
            ))}
          </div>
    </div>
  );
}

function App() {
  const { TemplatesScreen, ScheduleScreen, AnalyticsScreen } = window;
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const lang = t.lang === 'en' ? 'en' : 'pt';
  const T = STR[lang];

  const [route, setRoute] = useState('dashboard');
  const [routeKey, setRouteKey] = useState(0);
  const [project, setProject] = useState(null);
  const [clip, setClip] = useState(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [clipsCount, setClipsCount] = useState(0);
  const [aiMsgs, setAiMsgs] = useState(null);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    function handleOutsideClick(e) {
      if (!e.target.closest('.notif-wrapper')) setShowNotif(false);
    }
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  async function markNotifRead(id) {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    if (Supa.client) await Supa.client.from('notifications').update({ read: true }).eq('id', id);
  }

  // persiste lang
  useEffect(() => {
    localStorage.setItem('corta_lang', lang);
  }, [lang]);

  // inatividade
  useEffect(() => {
    let timeout;
    let warningTimeout;
    function resetTimer() {
      setShowTimeoutWarning(false);
      clearTimeout(timeout);
      clearTimeout(warningTimeout);
      warningTimeout = setTimeout(() => setShowTimeoutWarning(true), 25 * 60 * 1000);
      timeout = setTimeout(() => logout(), 30 * 60 * 1000);
    }
    if (user) {
      window.addEventListener('mousemove', resetTimer);
      window.addEventListener('keydown', resetTimer);
      resetTimer();
    }
    return () => {
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keydown', resetTimer);
      clearTimeout(timeout);
      clearTimeout(warningTimeout);
    };
  }, [user]);

  // checa sessão ao montar
  useEffect(() => {
    let alive = true;
    Supa.getUser().then(u => { 
      if (alive) { 
        setUser(u); 
        setAuthReady(true); 
        
        if (u && !u.onboarding_done) setShowOnboarding(true);

        if (u && Supa.client) {
          Supa.client.from('clips').select('id', { count: 'exact', head: true })
            .eq('user_id', u.id)
            .then(({ count }) => setClipsCount(count || 0));

          Supa.client.from('notifications')
            .select('*').eq('user_id', u.id)
            .order('created_at', { ascending: false }).limit(20)
            .then(({ data }) => setNotifications(data || []));

          Supa.client.channel(`notif-${u.id}`)
            .on('postgres_changes', {
              event: 'INSERT', schema: 'public', table: 'notifications',
              filter: `user_id=eq.${u.id}`
            }, payload => setNotifications(prev => [payload.new, ...prev]))
            .subscribe();
        }
      } 
    });
    
    let authSub = null;
    if (Supa.client) {
      const { data } = Supa.client.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_OUT') {
          setUser(null);
          setRoute('dashboard');
        }
      });
      authSub = data.subscription;
    }
    return () => { alive = false; if(authSub) authSub.unsubscribe(); };
  }, []);

  async function logout() {
    await Supa.signOut();
    setUser(null);
    setRoute('dashboard');
  }

  // apply tweaks to :root
  useEffect(() => {
    const r = document.documentElement;
    r.style.setProperty('--accent', t.accent);
    r.style.setProperty('--accent-soft', `color-mix(in srgb, ${t.accent} 13%, transparent)`);
    r.style.setProperty('--font-ui', `'${t.font}', system-ui, sans-serif`);
    r.setAttribute('data-theme', t.dark ? 'dark' : 'light');
    r.setAttribute('data-density', t.density);
    document.documentElement.lang = lang === 'en' ? 'en' : 'pt-BR';
  }, [t.accent, t.font, t.dark, t.density, lang]);

  function go(r, params = {}) {
    if (params.project) setProject(params.project);
    if (r !== 'clips') { /* keep project for clips */ }
    setRoute(r);
    setRouteKey(k => k + 1);
    document.querySelector('.scroll')?.scrollTo(0, 0);
  }
  function openClip(c) { setClip(c); setRoute('editor'); }

  if (!authReady) return <div className="page" style={{placeItems:'center'}}><Icon name="refresh" className="spin" size={32} /></div>;

  if (!user) {
    return <AuthScreen lang={lang} onAuth={u => { setUser(u); }} />;
  }

  const crumbMap = {
    dashboard: T.nav_home, import: T.import_title, processing: T.processing,
    clips: T.nav_clips, templates: T.nav_templates, schedule: T.nav_schedule, analytics: T.nav_analytics,
  };

  return (
    <React.Fragment>
      {route !== 'editor' && (
        <div className="app">
          {/* SIDEBAR */}
          <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
            <div className="brand" style={{ padding: '24px 16px', display: 'flex', justifyContent: 'center' }}>
              <img src="/logo.png" alt="Corta.vc" style={{ height: 64 }} />
            </div>

            <Btn variant="primary" icon="plus" onClick={() => go('import')} style={{ marginBottom: 6, justifyContent: collapsed ? 'center' : 'flex-start' }}>
              <span className="hide-collapsed">{T.new_clip}</span>
            </Btn>

            <nav className="nav">
              {NAV.map(n => (
                <button key={n.id} className={`nav-item ${route === n.id || (n.id === 'clips' && (route === 'clips')) ? 'active' : ''}`}
                  onClick={() => go(n.id)}>
                  <Icon name={n.icon} size={18} />
                  <span className="hide-collapsed">{T[n.key]}</span>
                  {n.id === 'clips' && !collapsed && clipsCount > 0 && (
                    <span className="nav-badge">{clipsCount > 99 ? '99+' : clipsCount}</span>
                  )}
                </button>
              ))}
            </nav>

            <div className="sidebar-foot">
              {!collapsed && (
                <div className="plan-card">
                  <div className="row between" style={{ marginBottom: 2 }}>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>{T.plan}</span>
                    <span className={`tag ${user.plan !== 'free' ? 'accent' : ''}`} style={{ height: 20, fontSize: 11, textTransform: 'capitalize' }}>
                      {user.plan !== 'free' && <Icon name="zap" size={11} fill="current" />}
                      {user.plan}
                    </span>
                  </div>
                  <div className="meter"><i style={{ width: (() => {
                    const plan = window.CORTA_PLANS?.[user.plan];
                    const max = plan?.credits_monthly > 0 ? plan.credits_monthly : 500;
                    return Math.min(100, (user.credits / max) * 100) + '%';
                  })() }} /></div>
                  <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{user.credits} {T.credits}</div>
                </div>
              )}
              <div className="user-row">
                <Avatar name={user.initials} size={32} />
                {!collapsed && <div className="grow" style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', wordBreak: 'break-word' }} title={user.name}>{user.name}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--muted)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', wordBreak: 'break-word' }} title={user.email}>{user.email}</div>
                </div>}
                {!collapsed && <IconBtn name="lock" size={16} onClick={logout} title={lang === 'en' ? 'Log out' : 'Sair'} />}
              </div>
              
              {/* Botão de ajuda */}
              <button
                className="nav-item"
                onClick={() => setShowHelp(true)}
                title={lang === 'en' ? 'Help & Guide' : 'Ajuda e Guia'}
                style={{ color: 'var(--muted)', marginTop: 8 }}
              >
                <Icon name="info" size={18} />
                <span className="hide-collapsed">{lang === 'en' ? 'Help' : 'Ajuda'}</span>
              </button>
            </div>
          </aside>

          {/* MAIN */}
          <div className="main">
            {user?.plan === 'free' && user?.credits <= 0 && (
              <div style={{background: '#ea4335', color: '#fff', padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 500, fontSize: 14}}>
                <span>{lang === 'en' ? 'You have used all your free plan credits.' : 'Você usou todos os créditos do plano gratuito.'}</span>
                <Btn variant="dark" size="sm" onClick={() => setShowUpgrade(true)}>{lang === 'en' ? 'Upgrade' : 'Fazer upgrade'}</Btn>
              </div>
            )}
            <div className="topbar">
              <IconBtn name="drag" size={18} onClick={() => setCollapsed(!collapsed)} />
              <div className="crumb" style={{ display: 'flex', alignItems: 'center' }}>
                <img src="/logo.png" alt="Corta.vc" style={{ height: 40, marginRight: 8 }} /><Icon name="chevR" size={15} /><b>{crumbMap[route]}</b>
                {project && route === 'clips' && <React.Fragment><Icon name="chevR" size={15} /><span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 220 }}>{project.title}</span></React.Fragment>}
              </div>
              <div className="topbar-spacer" />
              <div className="searchbox">
                <Icon name="search" size={16} /><input placeholder={T.search} />
              </div>
              <IconBtn name="globe" bordered onClick={() => setTweak('lang', lang === 'en' ? 'pt' : 'en')} title="PT / EN" />
              
              <div className="notif-wrapper" style={{ position: 'relative' }}>
                <button className="btn-icon bordered" style={{ position: 'relative' }}
                  onClick={() => setShowNotif(!showNotif)}>
                  <Icon name="bell" size={18} />
                  {notifications.filter(n => !n.read).length > 0 && (
                    <span style={{ position: 'absolute', top: 4, right: 4, width: 8, height: 8,
                      borderRadius: 99, background: 'var(--accent)', border: '2px solid var(--surface)' }} />
                  )}
                </button>
                <NotifDropdown notifications={notifications} open={showNotif} onClose={() => setShowNotif(false)} onRead={markNotifRead} lang={lang} />
              </div>

              <Btn variant="ghost" icon="sparkles" onClick={() => setAiOpen(true)}>{T.ask_ai}</Btn>
            </div>

            <div className="scroll" key={routeKey}>
              {route === 'dashboard' && <Dashboard lang={lang} go={go} openAI={() => setAiOpen(true)} user={user} />}
              {route === 'import' && <ImportScreen lang={lang} go={go} user={user} />}
              {route === 'processing' && <ProcessingScreen lang={lang} go={go} />}
              {route === 'clips' && <ClipsScreen lang={lang} go={go} project={project} openClip={openClip} user={user} />}
              {route === 'templates' && <TemplatesScreen lang={lang} openClip={openClip} />}
              {route === 'schedule' && <ScheduleScreen lang={lang} openAI={() => setAiOpen(true)} />}
              {route === 'analytics' && <AnalyticsScreen lang={lang} user={user} />}
            </div>
          </div>
        </div>
      )}

      {route === 'editor' && clip && (
        <EditorScreen clip={clip} lang={lang} onClose={() => setRoute('clips')} openAI={() => setAiOpen(true)}
          captionStyleId={t.capStyle} onPickStyle={(id) => setTweak('capStyle', id)} />
      )}

      {/* AI */}
      {!aiOpen && route !== 'editor' && (
        <button className="ai-fab" onClick={() => setAiOpen(true)}>
          <span className="spark"><Icon name="sparkles" size={15} /></span>{T.ai_assistant}
        </button>
      )}
      <AIChat open={aiOpen} onClose={() => setAiOpen(false)} lang={lang} context={{ clip: route === 'editor' ? clip : null, user }} msgs={aiMsgs} onMsgs={setAiMsgs} />

      {/* TWEAKS */}
      <TweaksPanel title="Tweaks">
        <TweakSection label={lang === 'en' ? 'Brand' : 'Marca'} />
        <TweakColor label={lang === 'en' ? 'Accent' : 'Acento'} value={t.accent}
          options={['#e8543b', '#7c5cff', '#2563eb', '#1f9d6b']} onChange={v => setTweak('accent', v)} />
        <TweakSection label={lang === 'en' ? 'Type' : 'Tipografia'} />
        <TweakSelect label={lang === 'en' ? 'Font' : 'Fonte'} value={t.font}
          options={['Schibsted Grotesk', 'Space Grotesk', 'Hanken Grotesk']} onChange={v => setTweak('font', v)} />
        <TweakSection label={lang === 'en' ? 'Layout' : 'Layout'} />
        <TweakToggle label={lang === 'en' ? 'Dark mode' : 'Modo escuro'} value={t.dark} onChange={v => setTweak('dark', v)} />
        <TweakRadio label={lang === 'en' ? 'Density' : 'Densidade'} value={t.density}
          options={['compact', 'regular', 'comfy']} onChange={v => setTweak('density', v)} />
        <TweakSection label={lang === 'en' ? 'Content' : 'Conteúdo'} />
        <TweakSelect label={lang === 'en' ? 'Caption style' : 'Estilo de legenda'} value={t.capStyle}
          options={CAPTION_STYLES.map(s => s.id)} onChange={v => setTweak('capStyle', v)} />
        <TweakRadio label={lang === 'en' ? 'Language' : 'Idioma'} value={t.lang}
          options={['pt', 'en']} onChange={v => setTweak('lang', v)} />
      </TweaksPanel>

      {showTimeoutWarning && (
        <div style={{position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'grid', placeItems: 'center', zIndex: 9999}}>
          <div className="card fade-up" style={{padding: 24, width: 320, textAlign: 'center'}}>
            <h3 style={{marginBottom: 8}}>{lang === 'en' ? 'Session expiring' : 'Sessão expirando'}</h3>
            <p style={{marginBottom: 24, color: 'var(--muted)', fontSize: 14}}>{lang === 'en' ? 'Your session will expire in 5 minutes due to inactivity.' : 'Sua sessão vai expirar em 5 minutos por inatividade.'}</p>
            <Btn variant="primary" style={{width: '100%'}} onClick={() => setShowTimeoutWarning(false)}>{lang === 'en' ? 'Stay logged in' : 'Continuar conectado'}</Btn>
          </div>
        </div>
      )}

      {showUpgrade && window.UpgradeModal && (
        <window.UpgradeModal 
          lang={lang} 
          currentPlan={user?.plan} 
          user={user} 
          onClose={() => setShowUpgrade(false)} 
        />
      )}

      {showOnboarding && user && window.OnboardingWizard && (
        <window.OnboardingWizard
          lang={lang}
          user={user}
          onComplete={() => {
            setShowOnboarding(false);
            Supa.getUser().then(u => setUser(u));
          }}
        />
      )}
      <ToastContainer />
      {/* Help Center Modal */}
      {showHelp && window.HelpCenter && (
        <window.HelpCenter
          lang={lang}
          onClose={() => setShowHelp(false)}
        />
      )}
    </React.Fragment>
  );
}

// Lightweight analytics screen
function AnalyticsScreen({ lang, user }) {
  const T = STR[lang];
  const [stats, setStats] = useState(null);
  const [topClips, setTopClips] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!Supa.client || !user) {
        setStats(STATS);
        setTopClips([...CLIPS].sort((a,b) => b.score - a.score).slice(0,5));
        setLoading(false);
        return;
      }
      const [clipsRes, publishedRes, projectsRes] = await Promise.all([
        Supa.client.from('clips').select('id, score, title, niche, views_count')
          .eq('user_id', user.id).order('score', { ascending: false }),
        Supa.client.from('schedule').select('id', { count: 'exact', head: true })
          .eq('user_id', user.id).eq('status', 'published'),
        Supa.client.from('projects').select('duration')
          .eq('user_id', user.id)
      ]);

      const clips = clipsRes.data || [];
      const publishedCount = publishedRes.count || 0;
      const totalViews = clips.reduce((s, c) => s + (c.views_count || 0), 0);
      const totalDuration = (projectsRes.data || []).reduce((s,p) => s + (p.duration || 0), 0);
      const hoursSaved = Math.round((totalDuration / 3600) * 0.7);

      setStats([
        { key: 'views',  label: { pt: 'Visualizações', en: 'Views' },
          num: totalViews > 999 ? (totalViews/1000).toFixed(1)+'k' : String(totalViews),
          delta: '', dir: 'up', icon: 'eye' },
        { key: 'clips',  label: { pt: 'Cortes criados', en: 'Clips made' },
          num: String(clips.length), delta: '', dir: 'up', icon: 'scissors' },
        { key: 'posted', label: { pt: 'Publicados', en: 'Published' },
          num: String(publishedCount), delta: '', dir: 'up', icon: 'send' },
        { key: 'time',   label: { pt: 'Horas economizadas', en: 'Hours saved' },
          num: hoursSaved+'h', delta: '', dir: 'up', icon: 'clock' },
      ]);
      setTopClips(clips.slice(0,5));
      setLoading(false);
    }
    load();
  }, [user]);

  const bars = [42, 58, 35, 71, 64, 88, 96, 74, 82, 60, 91, 78];
  return (
    <div className="page page-wide">
      <div className="section-head fade-up">
        <div>
          <div className="h-eyebrow">{lang === 'en' ? 'Last 30 days' : 'Últimos 30 dias'}</div>
          <h1 className="h1">{T.nav_analytics}</h1>
          <p className="sub">{lang === 'en' ? 'How your clips are performing across networks.' : 'Como seus cortes estão performando nas redes.'}</p>
        </div>
      </div>
      <div className="stat-row stagger" style={{ marginBottom: 24 }}>
        {loading ? (
          [1,2,3,4].map(i => (
            <div key={i} className="stat" style={{ background: 'var(--surface-3)', height: 80, borderRadius: 'var(--r-lg)', animation: 'pulse 1.5s infinite' }} />
          ))
        ) : (
          stats.map(s => (
            <div key={s.key} className="stat">
              <div className="label"><Icon name={s.icon} size={15} />{s.label[lang] || s.label}</div>
              <div className="num">{s.num}</div>
              <div className={`delta ${s.dir}`}>↑ {s.delta}</div>
            </div>
          ))
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 22, alignItems: 'start' }}>
        <div className="card" style={{ padding: 20 }}>
          <h3 className="h3" style={{ marginBottom: 18 }}>{lang === 'en' ? 'Views by week' : 'Visualizações por semana'}</h3>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 180 }}>
            {bars.map((b, i) => (
              <div key={i} style={{ flex: 1, height: `${b}%`, background: i === 6 ? 'var(--accent)' : 'var(--surface-3)', borderRadius: '6px 6px 0 0', transition: 'height .4s' }} title={`${b}%`} />
            ))}
          </div>
        </div>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <h3 className="h3" style={{ padding: '16px 16px 12px' }}>{lang === 'en' ? 'Top clips' : 'Melhores cortes'}</h3>
          {loading ? (
            <div style={{ padding: 20 }}>Carregando...</div>
          ) : topClips.map((c, i) => (
            <div key={c.id} className="queue-item">
              <span className="mono" style={{ fontSize: 13, color: 'var(--muted)', width: 16 }}>{i + 1}</span>
              <Thumb niche={c.niche} className="qthumb" label={false} />
              <div className="grow" style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.title}</div>
                <div className="mono" style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{c.views_count ? c.views_count : (c.score * 1.2).toFixed(0)+'k'} {lang === 'en' ? 'views' : 'views'}</div>
              </div>
              <Score value={c.score} size={34} showCap={false} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
