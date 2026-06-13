/* ============================================================
   HELP CENTER — guia, tour e FAQ do Corta.vc
   ============================================================ */

function HelpCenter({ lang, onClose }) {
  const en = lang === 'en';
  const [tab, setTab] = React.useState('tour');

  const tabs = [
    { id: 'tour',          label: en ? '🎬 Quick tour'    : '🎬 Tour rápido'    },
    { id: 'passo-a-passo', label: en ? '📋 Step by step'  : '📋 Passo a passo'  },
    { id: 'dicas',         label: en ? '💡 Pro tips'       : '💡 Dicas pro'      },
    { id: 'faq',           label: en ? '❓ FAQ'             : '❓ FAQ'             },
    { id: 'planos',        label: en ? '⚡ Plans'           : '⚡ Planos'          },
  ];

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)',
      zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
    }} onClick={onClose}>
      <div className="card fade-up" style={{
        width: '100%', maxWidth: 640, maxHeight: '85vh',
        display: 'flex', flexDirection: 'column', overflow: 'hidden'
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{
          padding: '18px 20px 0', display: 'flex',
          justifyContent: 'space-between', alignItems: 'center', flexShrink: 0
        }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-.02em' }}>
              {en ? 'Help Center' : 'Central de Ajuda'}
            </h2>
            <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
              {en ? 'Guides, tips and frequently asked questions' : 'Guias, dicas e perguntas frequentes'}
            </p>
          </div>
          <IconBtn name="x" size={18} onClick={onClose} />
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex', gap: 4, padding: '14px 20px 0',
          flexShrink: 0, flexWrap: 'wrap', borderBottom: '1px solid var(--border)'
        }}>
          {tabs.map(t => (
            <button key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: '6px 12px', borderRadius: 99, fontSize: 12, fontWeight: 500,
                border: '.5px solid transparent', cursor: 'pointer',
                background: tab === t.id ? 'var(--surface-3)' : 'transparent',
                color: tab === t.id ? 'var(--ink)' : 'var(--muted)',
                borderColor: tab === t.id ? 'var(--border-strong)' : 'transparent',
                transition: '.12s', marginBottom: 10,
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ overflowY: 'auto', padding: '18px 20px', flex: 1 }}>

          {/* TAB: TOUR */}
          {tab === 'tour' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
                {[
                  { icon: '✂️', title: en ? 'Auto clips with AI' : 'Cortes automáticos com IA', text: en ? 'Paste a YouTube link. AI transcribes, finds the best moments and generates clips with captions.' : 'Cole um link do YouTube. A IA transcreve, encontra os melhores momentos e gera clips com legenda.' },
                  { icon: '📅', title: en ? 'Schedule posts' : 'Agendar publicações', text: en ? 'Schedule clips to post automatically on TikTok, Reels, Shorts, LinkedIn and more.' : 'Agende cortes para publicar automaticamente no TikTok, Reels, Shorts, LinkedIn e mais.' },
                  { icon: '🎨', title: en ? 'Edit captions & style' : 'Editar legendas e estilo', text: en ? 'Choose from 6 caption styles, edit text word by word, and apply your brand kit.' : 'Escolha entre 6 estilos de legenda, edite o texto palavra por palavra e aplique o brand kit.' },
                  { icon: '📊', title: en ? 'Track performance' : 'Acompanhar performance', text: en ? 'See projects, clips and posts. Views and likes synced from social networks.' : 'Veja projetos, cortes e publicações. Views e likes sincronizados das redes sociais.' },
                ].map((c, i) => (
                  <div key={i} style={{ background: 'var(--surface-2)', borderRadius: 'var(--r)', padding: 14 }}>
                    <div style={{ fontSize: 20, marginBottom: 8 }}>{c.icon}</div>
                    <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>{c.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>{c.text}</div>
                  </div>
                ))}
              </div>

              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 10 }}>
                {en ? 'Main flow' : 'Fluxo principal'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
                {[
                  en ? '1. Import' : '1. Importar',
                  en ? '2. AI processes' : '2. IA processa',
                  en ? '3. Review clips' : '3. Ver cortes',
                  en ? '4. Edit' : '4. Editar',
                  en ? '5. Publish' : '5. Publicar',
                ].map((s, i) => (
                  <React.Fragment key={i}>
                    <span style={{
                      padding: '6px 12px', background: i === 4 ? 'var(--accent)' : 'var(--surface-2)',
                      color: i === 4 ? '#fff' : 'var(--ink)', borderRadius: 99, fontSize: 12, fontWeight: 500
                    }}>{s}</span>
                    {i < 4 && <span style={{ color: 'var(--faint)', fontSize: 14 }}>→</span>}
                  </React.Fragment>
                ))}
              </div>

              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 10 }}>
                {en ? 'Navigation' : 'Navegação'}
              </div>
              {[
                { icon: '🏠', name: en ? 'Home' : 'Início', desc: en ? 'Overview, import shortcut and recent projects' : 'Visão geral, atalho de importação e projetos recentes' },
                { icon: '🎬', name: en ? 'Clips' : 'Cortes', desc: en ? 'All generated clips, filters, download and editing' : 'Todos os clips gerados, filtros, download e edição' },
                { icon: '🗂️', name: 'Templates', desc: en ? 'Caption styles, layouts and niche templates' : 'Estilos de legenda, layouts e templates por nicho' },
                { icon: '📅', name: en ? 'Schedule' : 'Agenda', desc: en ? 'Publication calendar and platform scheduling' : 'Calendário de publicações e agendamento por plataforma' },
                { icon: '📊', name: en ? 'Analytics' : 'Análises', desc: en ? 'Metrics for projects, clips and publications' : 'Métricas de projetos, cortes e publicações' },
              ].map((n, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 12px', background: 'var(--surface-2)', borderRadius: 'var(--r-sm)', marginBottom: 5 }}>
                  <span style={{ fontSize: 16 }}>{n.icon}</span>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{n.name}</span>
                    <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 8 }}>{n.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB: PASSO A PASSO */}
          {tab === 'passo-a-passo' && (
            <div>
              {[
                { n: 1, title: en ? 'Click "New clip" in sidebar' : 'Clique em "Novo corte" na sidebar', desc: en ? 'The orange button at the top of the left sidebar opens the import screen.' : 'O botão laranja no topo da sidebar esquerda abre a tela de importação.' },
                { n: 2, title: en ? 'Paste link or upload video' : 'Cole o link ou faça upload', desc: en ? 'YouTube, Google Drive and Twitch links. Or click "File" for direct MP4 upload.' : 'Links do YouTube, Google Drive e Twitch. Ou clique em "Arquivo" para MP4 direto.', tip: en ? '💡 5-60 minute videos produce the best results. Podcasts, lives and interviews work great.' : '💡 Vídeos de 5-60 minutos geram os melhores resultados. Podcasts, lives e entrevistas funcionam muito bem.' },
                { n: 3, title: en ? 'Configure options' : 'Configure as opções', desc: en ? 'Choose language (PT/EN/ES), format (9:16 or 16:9), niche and content intent.' : 'Escolha idioma (PT/EN/ES), formato (9:16 ou 16:9), nicho e intenção do conteúdo.', tip: en ? '💡 Fill in the "Intent" field to filter by theme: "only moments with data" or "funniest parts".' : '💡 Preencha o campo "Intenção" para filtrar por tema: "só momentos com dados" ou "partes mais engraçadas".' },
                { n: 4, title: en ? 'Wait for processing' : 'Aguarde o processamento', desc: en ? 'AI transcribes with Whisper, selects moments with Claude and renders each clip. You get a notification when done.' : 'A IA transcreve com Whisper, seleciona momentos com Claude e renderiza cada clip. Você recebe notificação quando terminar.', tip: en ? '⏱️ Average: 2-5 min for videos up to 30 min.' : '⏱️ Média: 2-5 minutos para vídeos de até 30 min.' },
                { n: 5, title: en ? 'Review generated clips' : 'Revise os cortes gerados', desc: en ? 'Each clip has a virality score (0-100). Hover the score ring to see breakdown: Hook, Rhythm, Trend, Emotion.' : 'Cada clip tem score de viralização (0-100). Passe o mouse no anel para ver breakdown: Gancho, Ritmo, Tendência, Emoção.' },
                { n: 6, title: en ? 'Edit in the editor' : 'Edite no editor', desc: en ? 'Change caption style, edit text word by word, generate 3 AI variations, trim via transcript, set brand kit.' : 'Troque estilo de legenda, edite texto palavra por palavra, gere 3 variações com IA, faça trim pela transcrição, configure brand kit.', tip: en ? '💡 Delete speech: click words in Transcript tab to mark red, then "Remove words" — video is re-rendered.' : '💡 Para deletar uma fala: clique nas palavras na aba Transcrição para marcar em vermelho, depois "Remover palavras".' },
                { n: 7, title: en ? 'Download or schedule' : 'Baixe ou agende', desc: en ? 'Click Download to save MP4, or Schedule to choose platform, date and time for automatic posting.' : 'Clique Baixar para salvar MP4, ou Agendar para escolher plataforma, data e horário de publicação automática.' },
              ].map(s => (
                <div key={s.n} style={{ display: 'flex', gap: 12, paddingBottom: 16, marginBottom: 16, borderBottom: '1px solid var(--border)' }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: 99, background: 'var(--accent)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: 12, fontWeight: 700, flex: 'none', marginTop: 1
                  }}>{s.n}</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>{s.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>{s.desc}</div>
                    {s.tip && (
                      <div style={{ fontSize: 12, background: 'var(--surface-2)', borderLeft: '2px solid var(--accent)', padding: '6px 10px', borderRadius: '0 6px 6px 0', marginTop: 8, color: 'var(--muted)', lineHeight: 1.5 }}>
                        {s.tip}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB: DICAS */}
          {tab === 'dicas' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { icon: '🎯', title: en ? 'Use the "Intent" field' : 'Use o campo "Intenção"', text: en ? 'Guide the AI with specific instructions like "only moments with concrete data" or "funniest parts".' : 'Guie a IA com instruções específicas como "só momentos com dados concretos" ou "partes mais engraçadas".' },
                { icon: '✂️', title: en ? 'Edit via transcript' : 'Edite pela transcrição', text: en ? 'Click words in the Transcript tab to mark for removal. Perfect for removing filler words without watching the whole video.' : 'Clique nas palavras na aba Transcrição para marcar remoção. Perfeito para tirar vícios de linguagem sem assistir o vídeo.' },
                { icon: '🔄', title: en ? 'Generate 3 caption variations' : 'Gere 3 variações de legenda', text: en ? 'In the editor\'s Caption tab, click "3 variations". AI creates emotional, intriguing and educational versions.' : 'Na aba Legenda do editor, clique em "3 variações". A IA cria versões emocional, intrigante e didática.' },
                { icon: '📦', title: en ? 'Batch selection' : 'Seleção em lote', text: en ? 'Hover clip cards to reveal checkboxes. Select multiple and use the floating bar to download all or batch schedule.' : 'Passe o mouse nos cards para aparecer o checkbox. Selecione vários e use a barra flutuante para baixar todos ou agendar em lote.' },
                { icon: '🏷️', title: en ? 'Set up Brand Kit' : 'Configure o Brand Kit', text: en ? 'In editor → Brand tab: upload your logo, set brand color and font. All future clips will use your visual identity.' : 'No editor → aba Brand: faça upload do logo, escolha cor e fonte. Todos os próximos clips usarão sua identidade visual.' },
                { icon: '⚡', title: en ? 'Virality score' : 'Score de viralização', text: en ? 'Hover the score ring to see breakdown: Hook (first 3s), Rhythm, Trend and Emotion. Prioritize clips above 75.' : 'Passe o mouse no anel de score para ver: Gancho (primeiros 3s), Ritmo, Tendência e Emoção. Priorize clips acima de 75.' },
              ].map((t, i) => (
                <div key={i} style={{ background: 'var(--surface-2)', borderRadius: 'var(--r)', padding: 14 }}>
                  <div style={{ fontSize: 20, marginBottom: 8 }}>{t.icon}</div>
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>{t.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>{t.text}</div>
                </div>
              ))}
            </div>
          )}

          {/* TAB: FAQ */}
          {tab === 'faq' && (() => {
            const [open, setOpen] = React.useState(null);
            const faqs = en ? [
              { q: 'How long does processing take?', a: 'Videos up to 30 min take 2-5 minutes on average. 1-hour videos take 5-10 minutes. You can close the browser — you\'ll get a notification when done.' },
              { q: 'What are credits?', a: 'Credits are consumed per video: up to 30 min = 5 credits, 30-60 min = 10, 60-120 min = 20, over 120 min = 40. Free plan has 10/month. Pro and Business have unlimited.' },
              { q: 'Why isn\'t my YouTube video working?', a: 'Check: (1) video is public or unlisted (private videos don\'t work), (2) link starts with https://, (3) no age or geographic restrictions, (4) not on a channel with copyright protection.' },
              { q: 'Can I edit clips after they\'re generated?', a: 'Yes. Click any clip to open the editor. You can change caption style, edit text, generate AI variations, delete speech via transcript, and apply your brand kit.' },
              { q: 'Does the watermark appear on videos?', a: 'Only on the Free plan. Starting from Starter (R$49/month) the watermark is removed and you can add your own logo via Brand Kit.' },
            ] : [
              { q: 'Quanto tempo demora para processar?', a: 'Vídeos de até 30 min levam 2-5 minutos em média. Vídeos de 1 hora levam 5-10 minutos. Você pode fechar o navegador — receberá uma notificação quando terminar.' },
              { q: 'O que são créditos?', a: 'Créditos são consumidos por vídeo: até 30 min = 5, 30-60 min = 10, 60-120 min = 20, acima de 120 min = 40. Plano Gratuito tem 10/mês. Pro e Business têm ilimitados.' },
              { q: 'Por que meu vídeo do YouTube não funciona?', a: 'Verifique: (1) vídeo é público ou não-listado, (2) link começa com https://, (3) sem restrições de idade ou geográficas, (4) não está em canal com proteção de copyright.' },
              { q: 'Posso editar os clips depois?', a: 'Sim. Clique em qualquer clip para abrir o editor. Você pode trocar estilo de legenda, editar texto, gerar variações com IA, deletar trechos pela transcrição e aplicar brand kit.' },
              { q: 'A marca d\'água "corta.vc" aparece nos vídeos?', a: 'Apenas no plano Gratuito. A partir do Starter (R$49/mês) a marca d\'água é removida e você pode adicionar seu logo via Brand Kit.' },
              { q: 'O agendamento funciona com computador desligado?', a: 'Sim. O agendamento roda nos servidores do Corta.vc — você não precisa deixar o computador ligado. O post será publicado no horário marcado automaticamente.' },
            ];
            return faqs.map((f, i) => (
              <div key={i} style={{ borderBottom: '1px solid var(--border)', paddingBottom: 12, marginBottom: 12 }}>
                <button onClick={() => setOpen(open === i ? null : i)}
                  style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>
                  {f.q}
                  <span style={{ color: 'var(--muted)', flexShrink: 0 }}>{open === i ? '−' : '+'}</span>
                </button>
                {open === i && <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, marginTop: 8 }}>{f.a}</p>}
              </div>
            ));
          })()}

          {/* TAB: PLANOS */}
          {tab === 'planos' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                {[
                  { name: en ? 'Free' : 'Gratuito', price: 'R$ 0', feats: en ? ['10 credits/month','Videos up to 30 min','5 clips per video','Watermark'] : ['10 créditos/mês','Vídeos até 30 min','5 cortes por vídeo','Marca d\'água'] },
                  { name: 'Starter', price: 'R$ 49', pro: true, feats: en ? ['60 credits/month','Videos up to 60 min','15 clips per video','No watermark','Silence + filler removal','Face tracking'] : ['60 créditos/mês','Vídeos até 60 min','15 cortes por vídeo','Sem marca d\'água','Silence + filler removal','Face tracking'] },
                  { name: 'Pro', price: 'R$ 149', feats: en ? ['Unlimited credits','Videos up to 3 hours','Multi-format (9:16+1:1)','Auto B-roll','Full brand kit','All networks'] : ['Créditos ilimitados','Vídeos até 3 horas','Multi-formato (9:16+1:1)','B-roll automático','Brand kit completo','Todas as redes'] },
                  { name: 'Business', price: 'R$ 399', feats: en ? ['Everything in Pro','No duration limit','Up to 5 users','White-label','99.9% SLA'] : ['Tudo do Pro','Sem limite de duração','Até 5 usuários','White-label','SLA 99,9%'] },
                ].map((p, i) => (
                  <div key={i} style={{
                    background: 'var(--surface-2)', borderRadius: 'var(--r)', padding: 14,
                    border: p.pro ? '1.5px solid var(--accent)' : '.5px solid var(--border)',
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>{p.name}</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent)', marginBottom: 10 }}>{p.price}<span style={{ fontSize: 11, fontWeight: 400, color: 'var(--muted)' }}>/mês</span></div>
                    {p.feats.map((f, j) => (
                      <div key={j} style={{ display: 'flex', gap: 5, fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>
                        <span style={{ color: 'var(--accent)', fontWeight: 700, flexShrink: 0 }}>✓</span>{f}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              <Btn variant="primary" style={{ width: '100%' }} onClick={() => { window.showUpgrade?.(); onClose(); }}>
                {en ? 'Upgrade plan' : 'Fazer upgrade'}
              </Btn>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

window.HelpCenter = HelpCenter;
