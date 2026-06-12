function LandingPage({ onLogin }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--stage)', color: 'var(--text)', overflowY: 'auto' }}>
      <header style={{ padding: '24px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--surface-2)' }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: '-1px' }}>Corta.vc</h1>
        <Btn variant="primary" onClick={onLogin}>Entrar</Btn>
      </header>
      <main style={{ textAlign: 'center', padding: '100px 20px 80px', maxWidth: 900, margin: '0 auto' }}>
        <div className="fade-up">
          <div className="h-eyebrow" style={{ display: 'inline-block', marginBottom: 16 }}>O Futuro da Criação de Conteúdo</div>
          <h2 style={{ fontSize: 64, fontWeight: 800, lineHeight: 1.1, marginBottom: 24, letterSpacing: '-2px' }}>
            Vídeos longos em cortes virais com IA
          </h2>
          <p style={{ fontSize: 22, color: 'var(--muted)', marginBottom: 48, maxWidth: 700, margin: '0 auto 48px' }}>
            Nossa inteligência artificial encontra os melhores momentos, gera legendas animadas estilo Hormozi e agenda nas redes sociais em minutos.
          </p>
          <Btn variant="primary" size="lg" icon="sparkles" onClick={onLogin} style={{ transform: 'scale(1.1)' }}>Começar gratuitamente</Btn>
        </div>
        
        <div style={{ marginTop: 120, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 24, textAlign: 'left' }}>
          <div className="card fade-up" style={{ padding: 32 }}>
            <Icon name="mic" size={40} style={{ marginBottom: 24, color: 'var(--accent)' }} />
            <h3 style={{ fontSize: 20, marginBottom: 12 }}>Transcrição Whisper</h3>
            <p style={{ color: 'var(--muted)', lineHeight: 1.5 }}>Áudio convertido para texto com precisão impressionante, suportando mais de 50 idiomas e filtragem de ruídos.</p>
          </div>
          <div className="card fade-up" style={{ padding: 32, animationDelay: '100ms' }}>
            <Icon name="target" size={40} style={{ marginBottom: 24, color: 'var(--accent)' }} />
            <h3 style={{ fontSize: 20, marginBottom: 12 }}>Curadoria Claude 3.5</h3>
            <p style={{ color: 'var(--muted)', lineHeight: 1.5 }}>Análise semântica profunda para encontrar os trechos com maior potencial de retenção e engajamento emocional.</p>
          </div>
          <div className="card fade-up" style={{ padding: 32, animationDelay: '200ms' }}>
            <Icon name="zap" size={40} style={{ marginBottom: 24, color: 'var(--accent)' }} />
            <h3 style={{ fontSize: 20, marginBottom: 12 }}>Auto-Publicação</h3>
            <p style={{ color: 'var(--muted)', lineHeight: 1.5 }}>Conecte TikTok, Reels e Shorts. Agende meses de conteúdo diretamente pelo painel e deixe no piloto automático.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
window.LandingPage = LandingPage;
