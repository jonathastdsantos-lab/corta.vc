/* ============================================================
   AI — real Claude-powered assistant + helpers
   ============================================================ */

async function askClaude(prompt, { json = false } = {}) {
  try {
    if (!window.claude || !window.claude.complete) throw new Error('no-claude');
    const out = await window.claude.complete(prompt);
    if (json) {
      const m = out.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      return m ? JSON.parse(m[0]) : null;
    }
    return out.trim();
  } catch (e) {
    return null;
  }
}

// Generate title + hashtags + a caption suggestion for a clip
async function aiClipMeta(clip, lang) {
  const prompt = `Você é um especialista em redes sociais brasileiras. Para um corte de vídeo curto (Reels/TikTok/Shorts) com este tema: "${clip.title}" — fala central: "${clip.cap.replace(/[{}]/g, '')}".
Responda em ${lang === 'en' ? 'English' : 'português do Brasil'} APENAS com um JSON válido neste formato:
{"title":"título chamativo de até 60 caracteres com 1 emoji","hashtags":["#tag1","#tag2","#tag3","#tag4","#tag5"],"caption":"frase de legenda curta e impactante, com a palavra mais forte entre {chaves}"}`;
  const r = await askClaude(prompt, { json: true });
  if (r && r.title) return r;
  // fallback
  return {
    title: clip.title + (lang === 'en' ? ' 🔥' : ' 🔥'),
    hashtags: ['#cortes', '#viral', `#${(NICHES[clip.niche]?.label || 'video').toLowerCase()}`, '#reels', '#shorts'],
    caption: clip.cap,
  };
}

async function aiImproveCaption(text, lang) {
  const prompt = `Reescreva esta legenda de vídeo curto para ficar mais magnética e com melhor gancho, mantendo o sentido. ${lang === 'en' ? 'Answer in English.' : 'Responda em português do Brasil.'} Marque a palavra/expressão mais impactante entre {chaves}. Responda só com a frase, sem aspas. Legenda: "${text.replace(/[{}*]/g, '')}"`;
  const r = await askClaude(prompt);
  return r || text;
}

// ---------- AI Chat Drawer ----------
function AIChat({ open, onClose, lang, context, msgs, onMsgs }) {
  const T = STR[lang];
  const defaultMsgs = [{ role: 'bot', text: T.ai_greeting }];
  const [localMsgs, setLocalMsgs] = useState(msgs || defaultMsgs);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const bodyRef = useRef(null);

  useEffect(() => {
    if (onMsgs) onMsgs(localMsgs);
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [localMsgs, busy]);

  const quick = React.useMemo(() => {
    const en = lang === 'en';
    if (context?.clip) {
      const niche = NICHES[context?.clip?.niche]?.label || 'vídeo';
      return en
        ? [`Improve this caption`, `3 title variations`, `Best hashtags for ${niche}`, `What makes this viral?`]
        : [`Melhorar esta legenda`, `3 variações de título`, `Hashtags para ${niche}`, `Por que esse corte viraliza?`];
    }
    if (context?.user?.credits <= 3) {
      return en
        ? ['How many credits do I have?', 'What can I do with free plan?', 'How to upgrade?', 'Best use of my last credits']
        : ['Quantos créditos tenho?', 'O que faço com o plano free?', 'Como fazer upgrade?', 'Melhor uso dos meus créditos'];
    }
    return en
      ? ['How to import from YouTube?', 'Which niche has more views?', 'Best time to post in Brazil', 'How to make viral hooks?']
      : ['Como importar do YouTube?', 'Qual nicho tem mais views?', 'Melhor horário para postar no BR', 'Como fazer ganchos virais?'];
  }, [lang, context]);

  async function send(text) {
    const q = (text ?? input).trim();
    if (!q || busy) return;
    setInput('');
    const next = [...localMsgs, { role: 'user', text: q }];
    setLocalMsgs(next);
    setBusy(true);
    let systemContext = 'Você é a IA assistente do Corta.vc.';
    if (context?.clip) systemContext += `\nEstamos editando o clip "${context.clip.title}". Ele foca no nicho de ${NICHES[context.clip.niche]?.label} com nota de viralização ${context.clip.score}/100.`;
    if (context?.user) systemContext += `\nO usuário está no plano ${context.user.plan} e tem ${context.user.credits} créditos. Ajude-o a otimizar o uso.`;
    const prompt = `${systemContext}\nSeja prático, direto e animado, como um editor parceiro.\nResponda em ${lang === 'en' ? 'English' : 'português do Brasil'}, em no máximo 90 palavras. Use quebras de linha curtas. Pergunta do usuário: "${q}"`;
    const r = await askClaude(prompt);
    setLocalMsgs(m => [...m, { role: 'bot', text: r || (lang === 'en' ? 'I had trouble reaching the AI just now — try again in a sec.' : 'Tive um problema pra falar com a IA agora — tenta de novo em instantes.') }]);
    setBusy(false);
  }

  return (
    <React.Fragment>
      <div className={`scrim ${open ? 'show' : ''}`} onClick={onClose} />
      <aside className={`ai-drawer ${open ? 'open' : ''}`} aria-hidden={!open}>
        <div className="ai-head">
          <div className="spark"><Icon name="sparkles" size={17} /></div>
          <div className="grow">
            <div style={{ fontWeight: 700, fontSize: 14.5 }}>{T.ai_assistant} <span className="ai-chip" style={{ marginLeft: 4 }}><Icon name="zap" size={11} fill="current" />IA</span></div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>{lang === 'en' ? 'Powered by AI · always on' : 'Com IA · sempre disponível'}</div>
          </div>
          <IconBtn name="x" onClick={onClose} />
        </div>

        <div className="ai-body" ref={bodyRef}>
          {localMsgs.map((m, i) => (
            <div key={i} className={`ai-msg ${m.role}`}>
              {m.role === 'bot' && <div className="av" style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}><Icon name="sparkles" size={15} /></div>}
              <div className="ai-bubble">
                {m.text.split('\n').filter(Boolean).map((line, j) => <p key={j}>{line}</p>)}
              </div>
            </div>
          ))}
          {busy && (
            <div className="ai-msg bot">
              <div className="av" style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}><Icon name="sparkles" size={15} /></div>
              <div className="ai-bubble"><span className="typing"><i /><i /><i /></span></div>
            </div>
          )}
        </div>

        {(msgs?.length || 0) <= 1 && (
          <div className="ai-quick">
            {quick.map(q => <button key={q} onClick={() => send(q)}>{q}</button>)}
          </div>
        )}

        <div className="ai-foot">
          <div className="ai-input">
            <textarea rows={1} value={input} placeholder={T.ai_ph}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
            <button className="ai-send" disabled={!input.trim() || busy} onClick={() => send()}><Icon name="send" size={17} /></button>
          </div>
        </div>
      </aside>
    </React.Fragment>
  );
}

Object.assign(window, { askClaude, aiClipMeta, aiImproveCaption, AIChat });
