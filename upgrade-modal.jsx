const { useState } = React;

function UpgradeModal({ lang, currentPlan, onClose, user }) {
  const [annual, setAnnual] = useState(false);
  const [busy, setBusy] = useState(null);

  const plans = Object.values(window.CORTA_PLANS || {});

  async function checkout(planId) {
    if (!window.Supa?.client) {
      alert("Modo Demo: checkout simulado. No plano real, iria para o Mercado Pago.");
      return;
    }
    setBusy(planId);
    try {
      const { data: { session } } = await window.Supa.client.auth.getSession();
      const res = await fetch(window.CORTA_CONFIG.SUPABASE_URL + '/functions/v1/create-checkout', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${session?.access_token}` 
        },
        body: JSON.stringify({ 
          plan_id: planId, 
          user_id: user?.id, 
          success_url: window.location.origin + '?payment=success', 
          cancel_url: window.location.origin + '?payment=cancel' 
        })
      });
      const data = await res.json();
      if (data.checkout_url) window.location.href = data.checkout_url;
      else throw new Error("Erro ao criar checkout");
    } catch(err) {
      console.error(err);
      alert('Falha ao iniciar pagamento.');
    }
    setBusy(null);
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className="card fade-up" style={{ width: '100%', maxWidth: 960, maxHeight: '90vh', overflow: 'auto', padding: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)' }}>✕</button>
        </div>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h2 style={{ fontSize: 28, marginBottom: 8 }}>{lang === 'en' ? 'Upgrade your plan' : 'Faça upgrade do seu plano'}</h2>
          <p className="sub">{lang === 'en' ? 'Get more credits, advanced styles and auto-posting.' : 'Tenha mais créditos, estilos avançados e autopostagem.'}</p>
          <div style={{ display: 'inline-flex', background: 'var(--surface-3)', borderRadius: 99, padding: 4, marginTop: 16 }}>
            <button className={`chip-toggle ${!annual ? 'on' : ''}`} onClick={() => setAnnual(false)}>{lang === 'en' ? 'Monthly' : 'Mensal'}</button>
            <button className={`chip-toggle ${annual ? 'on' : ''}`} onClick={() => setAnnual(true)}>
              {lang === 'en' ? 'Annually (-20%)' : 'Anual (-20%)'}
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          {plans.map(p => {
            const price = annual ? Math.floor((p.price_brl * 0.8) / 100) : p.price_brl / 100;
            const isCurrent = currentPlan === p.id;
            return (
              <div key={p.id} className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', border: p.id === 'pro' ? '2px solid var(--accent)' : '1px solid var(--border)' }}>
                <h3 style={{ textTransform: 'capitalize', fontSize: 18, marginBottom: 4 }}>{p.name}</h3>
                <div style={{ fontSize: 32, fontWeight: 800, marginBottom: 16 }}>
                  R$ {price} <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--muted)' }}>/mês</span>
                </div>
                <div style={{ flex: 1 }}>
                  {p.features.map(f => (
                    <div key={f} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, marginBottom: 8 }}>
                      <span style={{ color: 'var(--good)' }}>✓</span> {f}
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 24 }}>
                  <Btn variant={p.id === 'pro' ? 'primary' : 'ghost'} style={{ width: '100%', border: '1px solid var(--border)' }} disabled={isCurrent || busy === p.id} onClick={() => checkout(p.id)}>
                    {busy === p.id ? '...' : isCurrent ? (lang === 'en' ? 'Current plan' : 'Plano atual') : (lang === 'en' ? 'Subscribe' : 'Assinar')}
                  </Btn>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
window.UpgradeModal = UpgradeModal;
