/* ============================================================
   AUTH SCREEN — login / cadastro (Supabase ou modo demo)
   ============================================================ */

function AuthScreen({ lang, onAuth }) {
  const en = lang === 'en';
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e?.preventDefault();
    setErr('');
    if (!email || !pw || (mode === 'signup' && !name)) { setErr(en ? 'Fill in all fields.' : 'Preencha todos os campos.'); return; }
    setBusy(true);
    const r = mode === 'signup'
      ? await Supa.signUp({ email, password: pw, name })
      : await Supa.signIn({ email, password: pw });
    setBusy(false);
    if (r.error) { setErr(r.error); return; }
    onAuth(r.user);
  }

  async function demo() {
    setBusy(true);
    const r = await Supa.signInDemo();
    setBusy(false);
    onAuth(r.user);
  }

  const feats = en
    ? [['scissors', 'Turn any long video into dozens of clips'], ['sparkles', 'AI captions, titles & hashtags'], ['send', 'Schedule & post to every network']]
    : [['scissors', 'Vire qualquer vídeo longo em dezenas de cortes'], ['sparkles', 'Legendas, títulos e hashtags com IA'], ['send', 'Agende e publique em todas as redes']];

  return (
    <div className="auth">
      <div className="auth-brand">
        <div className="auth-logo">
          <div className="brand-mark"><Icon name="scissors" size={18} /></div>
          Corta<span style={{ opacity: .6 }}>.vc</span>
        </div>
        <div className="auth-head">
          <h2>{en ? 'Your long videos, a hundred viral clips.' : 'Seus vídeos longos viram cem cortes virais.'}</h2>
          <p>{en ? 'AI finds the best moments, captions them and gets you ready to post — in minutes, not hours.' : 'A IA acha os melhores momentos, legenda e deixa tudo pronto pra postar — em minutos, não horas.'}</p>
          <div className="auth-feats">
            {feats.map(([ic, txt]) => (
              <div key={txt} className="auth-feat"><span className="fic"><Icon name={ic} size={18} /></span>{txt}</div>
            ))}
          </div>
        </div>
        <div className="auth-foot">corta.vc · {en ? 'AI clip studio' : 'estúdio de cortes com IA'}</div>
      </div>

      <div className="auth-form">
        <div className="auth-card fade-up">
          <h1>{mode === 'signup' ? (en ? 'Create your account' : 'Crie sua conta') : (en ? 'Welcome back' : 'Bem-vindo de volta')}</h1>
          <p className="sub">{mode === 'signup' ? (en ? 'Start clipping for free.' : 'Comece a cortar de graça.') : (en ? 'Log in to keep clipping.' : 'Entre para continuar cortando.')}</p>

          <div className="auth-tabs">
            <button className={mode === 'login' ? 'on' : ''} onClick={() => { setMode('login'); setErr(''); }}>{en ? 'Log in' : 'Entrar'}</button>
            <button className={mode === 'signup' ? 'on' : ''} onClick={() => { setMode('signup'); setErr(''); }}>{en ? 'Sign up' : 'Criar conta'}</button>
          </div>

          {err && <div className="auth-err">{err}</div>}

          <form onSubmit={submit}>
            {mode === 'signup' && (
              <div className="auth-field">
                <label className="auth-l">{en ? 'Name' : 'Nome'}</label>
                <input className="auth-input" value={name} onChange={e => setName(e.target.value)} placeholder={en ? 'Your name' : 'Seu nome'} />
              </div>
            )}
            <div className="auth-field">
              <label className="auth-l">{en ? 'Email' : 'E-mail'}</label>
              <input className="auth-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="voce@email.com" />
            </div>
            <div className="auth-field">
              <label className="auth-l">{en ? 'Password' : 'Senha'}</label>
              <input className="auth-input" type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="••••••••" />
            </div>
            <Btn variant="primary" size="lg" type="submit" disabled={busy} style={{ width: '100%' }} icon={busy ? 'refresh' : undefined}>
              <span className={busy ? 'spin' : ''} style={{ display: busy ? 'inline-flex' : 'none' }} />
              {busy ? (en ? 'One sec…' : 'Um instante…') : mode === 'signup' ? (en ? 'Create account' : 'Criar conta') : (en ? 'Log in' : 'Entrar')}
            </Btn>
          </form>

          <div className="auth-div">{en ? 'OR' : 'OU'}</div>
          <button className="auth-oauth" onClick={demo}>
            <span style={{ width: 18, height: 18, borderRadius: 99, background: 'conic-gradient(#ea4335,#fbbc05,#34a853,#4285f4,#ea4335)', flex: 'none' }} />
            {en ? 'Continue with Google' : 'Continuar com Google'}
          </button>

          <div className="demo-banner">
            <Icon name="zap" size={16} fill="current" />
            <div>
              {Supa.mode === 'live'
                ? (en ? 'Connected to Supabase — real auth is on.' : 'Conectado à Supabase — login real ativo.')
                : (en ? <React.Fragment>Running in <b>demo mode</b> — any login works, nothing leaves your browser. Add your anon key in <span className="mono">config.js</span> to go live.</React.Fragment>
                      : <React.Fragment>Rodando em <b>modo demo</b> — qualquer login entra, nada sai do navegador. Adicione sua anon key em <span className="mono">config.js</span> para ativar o real.</React.Fragment>)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

window.AuthScreen = AuthScreen;
