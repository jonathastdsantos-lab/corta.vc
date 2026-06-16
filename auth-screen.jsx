/* ============================================================
   AUTH SCREEN — login / cadastro (Supabase ou modo demo)
   ============================================================ */

function AuthScreen({ lang, onAuth }) {
  const en = lang === 'en';
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [resetMode, setResetMode] = useState(false);
  const [resetOk, setResetOk] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const pwStrength = React.useMemo(() => {
    let s = 0;
    if (pw.length >= 8) s++;
    if (/[0-9]/.test(pw)) s++;
    if (/[^A-Za-z0-9]/.test(pw)) s++;
    return s;
  }, [pw]);

  async function submit(e) {
    e?.preventDefault();
    setErr(''); setResetOk(false);
    
    if (resetMode) {
      if (!email) { setErr(en ? 'Fill in your email.' : 'Preencha o e-mail.'); return; }
      setBusy(true);
      if (Supa.client) {
        const { error } = await Supa.client.auth.resetPasswordForEmail(email);
        if (error) setErr(Supa._translateErr(error.message));
        else setResetOk(true);
      } else {
        await new Promise(r => setTimeout(r, 500));
        setResetOk(true);
      }
      setBusy(false);
      return;
    }

    if (!email || !pw || (mode === 'signup' && !name)) { setErr(en ? 'Fill in all fields.' : 'Preencha todos os campos.'); return; }
    
    if (mode === 'signup') {
      if (pw.length < 8 || !/[0-9]/.test(pw)) {
        setErr(en ? 'Password must be at least 8 chars and contain a number.' : 'A senha deve ter no mínimo 8 caracteres e conter 1 número.');
        return;
      }
      if (pw !== confirmPw) {
        setErr(en ? 'Passwords do not match.' : 'As senhas não coincidem.');
        return;
      }
    }

    setBusy(true);
    let refCode = null;
    try { refCode = new URLSearchParams(window.location.search).get('ref') || localStorage.getItem('corta_ref_code'); } catch {}
    if (refCode) try { localStorage.setItem('corta_ref_code', refCode); } catch {}

    const r = mode === 'signup'
      ? await Supa.signUp({ email, password: pw, name, referred_by: refCode })
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
        <div className="auth-logo" style={{ display: 'flex', justifyContent: 'center', marginBottom: '40px' }}>
          <img src="/logo.png" alt="Corta.vc" width="160" height="56"
            style={{ height: 56, width: 'auto' }} />
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
          <h1>{resetMode ? (en ? 'Reset password' : 'Redefinir senha') : mode === 'signup' ? (en ? 'Create your account' : 'Crie sua conta') : (en ? 'Welcome back' : 'Bem-vindo de volta')}</h1>
          <p className="sub">{resetMode ? (en ? 'Enter your email to receive a link.' : 'Digite seu e-mail para receber um link.') : mode === 'signup' ? (en ? 'Start clipping for free.' : 'Comece a cortar de graça.') : (en ? 'Log in to keep clipping.' : 'Entre para continuar cortando.')}</p>

          {!resetMode && (
            <div className="auth-tabs">
              <button className={mode === 'login' ? 'on' : ''} onClick={() => { setMode('login'); setErr(''); }}>{en ? 'Log in' : 'Entrar'}</button>
              <button className={mode === 'signup' ? 'on' : ''} onClick={() => { setMode('signup'); setErr(''); }}>{en ? 'Sign up' : 'Criar conta'}</button>
            </div>
          )}

          {resetOk && <div className="auth-err" style={{background:'var(--good-bg)', color:'var(--good)', borderColor:'var(--good)'}}>{en ? 'We sent a reset link to your email.' : 'Enviamos um link de redefinição para seu e-mail.'}</div>}
          {err && <div className="auth-err">{err}</div>}

          <form onSubmit={submit}>
            {resetMode ? (
              <div className="auth-field">
                <label className="auth-l">{en ? 'Email' : 'E-mail'}</label>
                <input className="auth-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="voce@email.com" />
              </div>
            ) : (
              <React.Fragment>
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
                  <label className="auth-l" style={{display:'flex',justifyContent:'space-between'}}>
                    {en ? 'Password' : 'Senha'}
                    {mode === 'login' && <button type="button" onClick={() => {setResetMode(true); setErr(''); setResetOk(false);}} style={{background:'none',border:'none',color:'#c73d24',fontSize:12,cursor:'pointer',padding:0}}>{en ? 'Forgot password?' : 'Esqueci minha senha'}</button>}
                  </label>
                  <input className="auth-input" type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="••••••••" />
                  {mode === 'signup' && (
                    <div style={{display:'flex', gap:4, marginTop:6}}>
                      <div style={{height:4, flex:1, background: pwStrength>0?'var(--good)':'var(--surface-3)', borderRadius:2, transition:'background .2s'}} />
                      <div style={{height:4, flex:1, background: pwStrength>1?'var(--good)':'var(--surface-3)', borderRadius:2, transition:'background .2s'}} />
                      <div style={{height:4, flex:1, background: pwStrength>2?'var(--good)':'var(--surface-3)', borderRadius:2, transition:'background .2s'}} />
                    </div>
                  )}
                </div>
                {mode === 'signup' && (
                  <div className="auth-field">
                    <label className="auth-l">{en ? 'Confirm Password' : 'Confirmar senha'}</label>
                    <input className="auth-input" type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} placeholder="••••••••" />
                  </div>
                )}
              </React.Fragment>
            )}

            <Btn variant="primary" size="lg" type="submit" disabled={busy} style={{ width: '100%' }} icon={busy ? 'refresh' : undefined}>
              <span className={busy ? 'spin' : ''} style={{ display: busy ? 'inline-flex' : 'none' }} />
              {busy ? (en ? 'One sec…' : 'Um instante…') : resetMode ? (en ? 'Reset password' : 'Redefinir senha') : mode === 'signup' ? (en ? 'Create account' : 'Criar conta') : (en ? 'Log in' : 'Entrar')}
            </Btn>
            
            {resetMode && (
              <button type="button" onClick={() => {setResetMode(false); setErr(''); setResetOk(false);}} style={{background:'none',border:'none',color:'var(--muted)',fontSize:13,cursor:'pointer',padding:0,marginTop:16,width:'100%'}}>
                {en ? 'Back to login' : 'Voltar ao login'}
              </button>
            )}
          </form>

          {!resetMode && (
            <React.Fragment>
              <div className="auth-div">{en ? 'OR' : 'OU'}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button className="auth-oauth" onClick={() => Supa.signInWithProvider('google')}>
                  <span style={{ width: 18, height: 18, borderRadius: 99, background: 'conic-gradient(#ea4335,#fbbc05,#34a853,#4285f4,#ea4335)', flex: 'none' }} />
                  {en ? 'Continue with Google' : 'Continuar com Google'}
                </button>
                <button className="auth-oauth" onClick={() => Supa.signInWithProvider('apple')}>
                  <Icon name="apple" size={18} />
                  {en ? 'Continue with Apple' : 'Continuar com Apple'}
                </button>
                <button className="auth-oauth" onClick={() => Supa.signInWithProvider('discord')}>
                  <Icon name="gamepad" size={18} style={{ color: '#5865F2' }} />
                  {en ? 'Continue with Discord' : 'Continuar com Discord'}
                </button>
                <button className="auth-oauth" onClick={() => Supa.signInWithProvider('github')}>
                  <Icon name="github" size={18} />
                  {en ? 'Continue with GitHub' : 'Continuar com GitHub'}
                </button>
                {Supa.mode === 'demo' && (
                  <button className="auth-oauth" onClick={demo}>
                    <Icon name="zap" size={16} />
                    {en ? 'Enter demo mode' : 'Entrar em modo demonstração'}
                  </button>
                )}
              </div>
            </React.Fragment>
          )}

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
