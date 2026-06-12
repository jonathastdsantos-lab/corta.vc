/* ============================================================
   SUPA — camada de integração Supabase com fallback "modo demo"
   ------------------------------------------------------------
   Em produção: usa supabase-js (auth + storage) só com a anon key.
   Sem chave válida: simula tudo via localStorage (preview funciona).
   ============================================================ */

const CFG = window.CORTA_CONFIG || {};
const _placeholder = !CFG.SUPABASE_ANON_KEY
  || CFG.SUPABASE_ANON_KEY.startsWith('COLE')
  || CFG.SUPABASE_ANON_KEY.length < 40;
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

  async getUser() {
    if (this.client) {
      const { data } = await this.client.auth.getUser();
      if (!data?.user) return null;
      const u = data.user;
      return { id: u.id, email: u.email, name: u.user_metadata?.name || u.email.split('@')[0], initials: _initials(u.user_metadata?.name, u.email) };
    }
    return _demoRead();
  },

  async signUp({ email, password, name }) {
    if (this.client) {
      const { data, error } = await this.client.auth.signUp({ email, password, options: { data: { name } } });
      if (error) return { error: error.message };
      const u = data.user;
      return { user: { id: u?.id, email, name: name || email.split('@')[0], initials: _initials(name, email) } };
    }
    await new Promise(r => setTimeout(r, 500)); // simula latência
    const user = { id: 'demo-' + Date.now(), email, name: name || email.split('@')[0], initials: _initials(name, email), demo: true };
    _demoWrite(user);
    return { user };
  },

  async signIn({ email, password }) {
    if (this.client) {
      const { data, error } = await this.client.auth.signInWithPassword({ email, password });
      if (error) return { error: error.message };
      const u = data.user;
      return { user: { id: u.id, email: u.email, name: u.user_metadata?.name || u.email.split('@')[0], initials: _initials(u.user_metadata?.name, u.email) } };
    }
    await new Promise(r => setTimeout(r, 500));
    const user = { id: 'demo-' + Date.now(), email, name: email.split('@')[0], initials: _initials('', email), demo: true };
    _demoWrite(user);
    return { user };
  },

  async signInDemo() {
    const user = { id: 'demo-rafa', email: 'rafa@corta.vc', name: 'Rafael Alves', initials: 'RA', demo: true };
    _demoWrite(user);
    return { user };
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
};

window.Supa = Supa;
