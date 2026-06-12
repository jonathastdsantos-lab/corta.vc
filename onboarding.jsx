/* ============================================================
   ONBOARDING — wizard 3 passos para novos usuários
   ============================================================ */

function OnboardingWizard({ lang, user, onComplete }) {
  const en = lang === 'en';
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [prefs, setPrefs] = useState({
    niche: 'podcast',
    caption_lang: 'pt',
    caption_style: 'hormozi',
  });

  const niches = Object.entries(NICHES).map(([id, n]) => ({ id, label: n.label }));
  const styles = CAPTION_STYLES.map(s => ({ id: s.id, label: s.name }));

  async function saveAndFinish() {
    setBusy(true);
    if (Supa.client) {
      await Supa.client.from('profiles').update({
        onboarding_done: true,
        onboarding_preferences: prefs,
      }).eq('id', user.id);
    }
    setBusy(false);
    onComplete();
  }

  const steps = [
    {
      title: en ? 'Welcome to Corta.vc! 🎬' : 'Bem-vindo ao Corta.vc! 🎬',
      subtitle: en ? 'Paste a YouTube link to create your first clip' : 'Cole um link do YouTube para criar seu primeiro corte',
      content: (
        <div style={{ marginTop: 20 }}>
          <div className="import-field" style={{ marginBottom: 12 }}>
            <Icon name="link" />
            <input placeholder={en ? 'Paste YouTube, Drive or Twitch link...' : 'Cole link do YouTube, Drive ou Twitch...'}
              style={{ flex: 1, border: 'none', background: 'none', outline: 'none', fontSize: 15, color: 'var(--ink)' }} />
          </div>
          <p style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center' }}>
            {en ? 'Or skip for now and explore the platform' : 'Ou pule por agora e explore a plataforma'}
          </p>
        </div>
      )
    },
    {
      title: en ? 'Configure your preferences' : 'Configure suas preferências',
      subtitle: en ? 'This helps the AI create better clips for you' : 'Isso ajuda a IA a criar cortes melhores para você',
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 20 }}>
          <div>
            <div className="pg-label" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 8 }}>
              {en ? 'Main niche' : 'Nicho principal'}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {niches.map(n => (
                <button key={n.id}
                  className={`chip-toggle ${prefs.niche === n.id ? 'on' : ''}`}
                  onClick={() => setPrefs(p => ({ ...p, niche: n.id }))}>
                  {n.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="pg-label" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 8 }}>
              {en ? 'Caption style' : 'Estilo de legenda'}
            </div>
            <div className="seg">
              {styles.slice(0, 4).map(s => (
                <button key={s.id}
                  className={prefs.caption_style === s.id ? 'on' : ''}
                  onClick={() => setPrefs(p => ({ ...p, caption_style: s.id }))}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )
    },
    {
      title: en ? 'Connect your social networks' : 'Conecte suas redes sociais',
      subtitle: en ? 'Schedule and post directly from Corta.vc' : 'Agende e publique direto do Corta.vc',
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 20 }}>
          {['tiktok', 'instagram', 'youtube', 'linkedin'].map(plat => (
            <div key={plat} className="field-row" style={{ background: 'var(--surface-2)', borderRadius: 'var(--r)', padding: '10px 14px' }}>
              <span className={`plat ${plat}`} style={{ width: 28, height: 28 }}><Icon plat={plat} size={14} /></span>
              <span style={{ fontSize: 14, fontWeight: 500, flex: 1 }}>
                {{ tiktok: 'TikTok', instagram: 'Instagram', youtube: 'YouTube Shorts', linkedin: 'LinkedIn' }[plat]}
              </span>
              <Btn variant="ghost" size="sm">
                {en ? 'Connect' : 'Conectar'}
              </Btn>
            </div>
          ))}
          <p style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', marginTop: 4 }}>
            {en ? 'You can connect later in settings' : 'Você pode conectar depois nas configurações'}
          </p>
        </div>
      )
    }
  ];

  const current = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className="card fade-up" style={{ width: '100%', maxWidth: 480, padding: '32px 28px' }}>
        {/* Progress dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 24 }}>
          {steps.map((_, i) => (
            <div key={i} style={{
              width: i === step ? 20 : 7, height: 7, borderRadius: 99,
              background: i <= step ? 'var(--accent)' : 'var(--surface-3)',
              transition: 'all .2s'
            }} />
          ))}
        </div>

        <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.02em', margin: '0 0 6px' }}>
          {current.title}
        </h2>
        <p style={{ fontSize: 14, color: 'var(--muted)', margin: 0 }}>{current.subtitle}</p>

        {current.content}

        <div style={{ display: 'flex', gap: 10, marginTop: 28, justifyContent: 'space-between' }}>
          <Btn variant="ghost" size="sm" onClick={saveAndFinish} disabled={busy}>
            {en ? 'Skip all' : 'Pular tudo'}
          </Btn>
          <Btn variant="primary" size="lg" onClick={() => isLast ? saveAndFinish() : setStep(s => s + 1)} disabled={busy}>
            {busy ? (en ? 'Saving...' : 'Salvando...') : isLast ? (en ? 'Start now 🚀' : 'Começar agora 🚀') : (en ? 'Next' : 'Próximo')}
          </Btn>
        </div>
      </div>
    </div>
  );
}

window.OnboardingWizard = OnboardingWizard;
