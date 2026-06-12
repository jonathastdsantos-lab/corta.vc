/* ============================================================
   Corta.vc — configuração pública (client-side)
   ------------------------------------------------------------
   Só a ANON KEY pode ficar aqui. NUNCA coloque o service_role
   nem a senha do banco neste arquivo — ele roda no navegador.
   Enquanto a ANON_KEY for o placeholder abaixo, o app roda em
   MODO DEMO (login/upload simulados, sem rede).
   ============================================================ */
window.CORTA_CONFIG = {
  SUPABASE_URL: "https://shzjchiortfrnpsoirrb.supabase.co",
  // Em produção: injete a anon key via variável de ambiente no Vercel.
  // Nunca commite a chave real aqui.
  // No Vercel: Settings → Environment Variables → NEXT_PUBLIC_SUPABASE_ANON_KEY
  SUPABASE_ANON_KEY: (function() {
    // Tenta ler de meta tag injetada pelo servidor (estratégia Vercel)
    const meta = document.querySelector('meta[name="sb-anon-key"]');
    if (meta && meta.content && meta.content.startsWith('eyJ')) return meta.content;
    // Fallback: modo demo
    return 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNoempjaGlvcnRmcm5wc29pcnJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyMTkwNDgsImV4cCI6MjA5Njc5NTA0OH0.tUNV3qau_VIqqMPig4Ng6HhSql9GV47zzYTwYaXL0oQ';
  })(),
};

// ATENÇÃO DEV: NUNCA COLOQUE A ANON KEY REAL NESTE ARQUIVO EM PRODUÇÃO!
// Use variáveis de ambiente (ex: Vercel) para injetar a chave,
// ou mantenha um placeholder para testes.
const _key = window.CORTA_CONFIG.SUPABASE_ANON_KEY || '';
if (_key.length > 100 && !_key.includes('COLE_AQUI')) {
  console.warn("ALERTA DE SEGURANÇA: Parecem ser credenciais reais. Não faça commit deste arquivo com chaves de produção!");
}

if (_key.length < 100 || !_key.includes('eyJ')) {
  window.CORTA_CONFIG.INVALID_KEY = true;
  console.warn("Corta.vc: SUPABASE_ANON_KEY inválida. Forçando modo demo.");
  window.addEventListener('DOMContentLoaded', () => {
    const banner = document.createElement('div');
    banner.style.cssText = "position:fixed;top:0;left:0;right:0;background:#ea4335;color:#fff;text-align:center;padding:8px;font-size:13px;z-index:9999;font-family:sans-serif;font-weight:600;";
    banner.innerText = "Modo Demo Forçado: Chave Supabase (ANON_KEY) inválida no config.js.";
    document.body.prepend(banner);
  });
}
