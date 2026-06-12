/* ============================================================
   SUPA — camada de integração Supabase com fallback "modo demo"
   ------------------------------------------------------------
   Em produção: usa supabase-js (auth + storage) só com a anon key.
   Sem chave válida: simula tudo via localStorage (preview funciona).
   ============================================================ */

const CFG = window.CORTA_CONFIG || {};
const _placeholder = CFG.INVALID_KEY || !CFG.SUPABASE_ANON_KEY
  || CFG.SUPABASE_ANON_KEY.startsWith('COLE')
  || CFG.SUPABASE_ANON_KEY.length < 100
  || !CFG.SUPABASE_ANON_KEY.includes('eyJ');
const _lib = window.supabase && window.supabase.createClient ? window.supabase : null;
const LIVE = !_placeholder && !!_lib;

let _client = null;
if (LIVE) {
  try { _client = _lib.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY); }
  catch (e) { console.warn('Supabase init falhou, caindo pro modo demo', e); }
}

const DEMO_KEY = 'corta_auth_v1';
function _demoRead() { try { return JSON.parse(localStorage.getItem(DEMO_KEY) || 'null'); } catch { return null; } }
function _demoWrite(u) { try { u ? localStorage.setItem(DEMO_KEY, JSON.stringify(u)) : localStorage.removeItem(DEMO_KEY); } catch {} }
function _initials(name = '', email = '') {
  const base = (name || email || 'U').trim();
  const p = base.split(/[ @.]/).filter(Boolean);
  return ((p[0]?.[0] || 'U') + (p[1]?.[0] || '')).toUpperCase();
}

const Supa = {
  mode: _client ? 'live' : 'demo',
  client: _client,

  _translateErr(msg) {
    if (!msg) return 'Erro desconhecido.';
    const s = msg.toLowerCase();
    if (s.includes('already registered')) return 'Este e-mail já está cadastrado.';
    if (s.includes('invalid login credentials')) return 'E-mail ou senha incorretos.';
    if (s.includes('password should be at least')) return 'A senha deve ter pelo menos 6 caracteres.';
    if (s.includes('rate limit')) return 'Muitas tentativas. Tente novamente mais tarde.';
    return 'Erro: ' + msg;
  },

  async getUser() {
    if (this.client) {
      const { data } = await this.client.auth.getUser();
      if (!data?.user) return null;
      const u = data.user;
      const { data: prof } = await this.client.from('profiles').select('plan, credits, avatar_url, onboarding_done, onboarding_preferences, brand_prefs').eq('id', u.id).single();
      return { id: u.id, email: u.email, name: u.user_metadata?.name || u.email.split('@')[0], initials: _initials(u.user_metadata?.name, u.email), plan: prof?.plan || 'free', credits: prof?.credits ?? 0, avatar: prof?.avatar_url, onboarding_done: prof?.onboarding_done ?? false, onboarding_preferences: prof?.onboarding_preferences || {}, brand_prefs: prof?.brand_prefs || {} };
    }
    return _demoRead();
  },

  async signUp({ email, password, name, referred_by }) {
    const cleanEmail = email?.trim().toLowerCase() || '';
    const cleanName = name?.trim().replace(/<[^>]*>?/gm, '').substring(0, 100) || '';
    if (this.client) {
      const meta = { name: cleanName };
      if (referred_by) meta.referred_by = referred_by;
      const { data, error } = await this.client.auth.signUp({ email: cleanEmail, password, options: { data: meta } });
      if (error) return { error: this._translateErr(error.message) };
      const u = data.user;
      return { user: { id: u?.id, email, name: name || email.split('@')[0], initials: _initials(name, email), plan: 'free', credits: 60 } };
    }
    await new Promise(r => setTimeout(r, 500)); // simula latência
    const user = { id: 'demo-' + Date.now(), email, name: name || email.split('@')[0], initials: _initials(name, email), demo: true, plan: 'free', credits: 60 };
    _demoWrite(user);
    return { user };
  },

  async signIn({ email, password }) {
    const cleanEmail = email?.trim().toLowerCase() || '';
    if (this.client) {
      const { data, error } = await this.client.auth.signInWithPassword({ email: cleanEmail, password });
      if (error) return { error: this._translateErr(error.message) };
      const u = data.user;
      const { data: prof } = await this.client.from('profiles').select('plan, credits, avatar_url, onboarding_done, onboarding_preferences, brand_prefs').eq('id', u.id).single();
      return { user: { id: u.id, email: u.email, name: u.user_metadata?.name || u.email.split('@')[0], initials: _initials(u.user_metadata?.name, u.email), plan: prof?.plan || 'free', credits: prof?.credits ?? 0, avatar: prof?.avatar_url, onboarding_done: prof?.onboarding_done ?? false, onboarding_preferences: prof?.onboarding_preferences || {}, brand_prefs: prof?.brand_prefs || {} } };
    }
    await new Promise(r => setTimeout(r, 500));
    const user = { id: 'demo-' + Date.now(), email, name: email.split('@')[0], initials: _initials('', email), demo: true, plan: 'free', credits: 10, onboarding_done: false, brand_prefs: {} };
    _demoWrite(user);
    return { user };
  },

  async signInDemo() {
    const user = { id: 'demo-rafa', email: 'rafa@corta.vc', name: 'Rafael Alves', initials: 'RA', demo: true, brand_prefs: {} };
    _demoWrite(user);
    return { user };
  },

  async signInWithProvider(provider) {
    if (this.client) {
      const { data, error } = await this.client.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: window.location.origin + window.location.pathname
        }
      });
      if (error) return { error: this._translateErr(error.message) };
      return { data };
    }
    return this.signInDemo();
  },

  async signOut() {
    if (this.client) await this.client.auth.signOut();
    _demoWrite(null);
  },

  // upload de vídeo para o bucket "videos/<uid>/arquivo"
  async uploadVideo(file, uid) {
    if (this.client) {
      const path = `${uid}/${Date.now()}-${file.name}`;
      const { error } = await this.client.storage.from('videos').upload(path, file);
      if (error) return { error: error.message };
      return { path };
    }
    await new Promise(r => setTimeout(r, 800));
    return { path: `demo/${file?.name || 'video.mp4'}` };
  },
  // Salva brand_prefs no banco via RPC
  async saveBrandPrefs(userId, prefs) {
    if (this.client) {
      const { error } = await this.client.rpc('save_brand_prefs', {
        p_user_id: userId,
        p_prefs: prefs,
      });
      if (error) throw new Error(error.message);
    } else {
      // Demo: persiste no localStorage junto com o user
      const u = _demoRead();
      if (u) { u.brand_prefs = prefs; _demoWrite(u); }
    }
  },

  // Faz upload do logo para brand-assets/<uid>/<filename>
  // Retorna a URL pública do arquivo
  async uploadBrandLogo(file, uid) {
    if (this.client) {
      const ext  = file.name.split('.').pop()?.toLowerCase() || 'png';
      const path = `${uid}/logo-${Date.now()}.${ext}`;
      const { error } = await this.client.storage
        .from('brand-assets')
        .upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw new Error(error.message);
      const { data: { publicUrl } } = this.client.storage
        .from('brand-assets')
        .getPublicUrl(path);
      return publicUrl;
    }
    // Demo: cria URL de objeto temporária
    return URL.createObjectURL(file);
  },
};

window.Supa = Supa;
