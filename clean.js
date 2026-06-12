const fs = require('fs');

const file = 'd:/Corte.vc/corta.vc/supabase/functions/process-video/index.ts';
const content = fs.readFileSync(file, 'utf8');

// Find start of step 8
const step8Marker = '    // ── 8. Silence detection + filler removal ─────────────────────';
const claudeResMarker = '    const claudeRes = await anthropic.messages.create({';

const startIdx = content.indexOf(step8Marker);
const endIdx = content.indexOf(claudeResMarker);

if (startIdx === -1 || endIdx === -1) {
    console.error("Could not find markers");
    process.exit(1);
}

const newMiddle = `    // ── 8. Silence detection + filler removal ─────────────────────
    let activeVideoPath = sourceVideoPath;
    let activeWords: Word[] = words;
    let silencesRemoved = 0;
    let fillersRemoved  = 0;
    let secondsSaved    = 0;

    if (isPaid && words.length > 10) {
      const lang = (['pt','en','es'].includes(project.lang) ? project.lang : 'pt') as string;

      const silenceRanges  = await detectSilences(audioPath, { noiseDb: -35, minDuration: 1.5, totalDuration: durationSeconds });
      const silenceRemovals: RemovalSegment[] = silenceRanges.map(s => ({ start: s.start, end: s.end, reason: 'silence' as const }));
      const fillerRemovals = detectFillerWords(words, lang);

      silencesRemoved = silenceRanges.length;
      fillersRemoved  = fillerRemovals.length;

      const allRemovals = mergeRemovalSegments([...silenceRemovals, ...fillerRemovals]);
      secondsSaved = parseFloat(allRemovals.reduce((a, r) => a + (r.end - r.start), 0).toFixed(1));

      console.log(\`Cleanup: \${silencesRemoved} silêncios + \${fillersRemoved} fillers → \${secondsSaved}s\`);

      if (allRemovals.length > 0 && secondsSaved >= 2.0) {
        activeVideoPath = await applyRemovals(sourceVideoPath, allRemovals, durationSeconds, tmpDir);
        if (activeVideoPath !== sourceVideoPath) {
          activeWords = adjustWordTimestamps(words, allRemovals);
          try {
            const { stdout } = await new Deno.Command('ffprobe', {
              args: ['-v', 'quiet', '-print_format', 'json', '-show_format', activeVideoPath],
            }).output();
            durationSeconds = parseFloat(JSON.parse(new TextDecoder().decode(stdout)).format?.duration ?? String(durationSeconds));
          } catch (_) {}
        }
      } else if (fillersRemoved > 0) {
        activeWords = words.filter(w => !fillerRemovals.some(r => w.start >= r.start && w.end <= r.end + 0.05));
      }
    }

    // ── 9. Claude: seleciona os melhores momentos ─────────────────
    const anthropic     = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });
    const maxClips      = Math.min(15, Math.max(5, Math.floor(durationSeconds / 180)));
    const cleanFullText = activeWords.map(w => w.word).join(' ');

    // Intenção do usuário (campo clip_prompt do projeto)
    const userIntent = (project.clip_prompt ?? '').trim();
    const hasIntent  = userIntent.length > 0;

    // ── Seção de intenção: instrução extra quando o usuário preencheu o prompt
    //
    // Com intenção: Claude PRIORIZA momentos que correspondem ao tema pedido.
    //   O maxClips é reduzido se necessário para manter relevância.
    //   Se não encontrar momentos suficientes, pode incluir os melhores disponíveis.
    //
    // Sem intenção: comportamento padrão — seleciona os mais virais.
    // ────────────────────────────────────────────────────────────────────────────

    const intentSection = hasIntent ? \`
INTENÇÃO DO USUÁRIO (PRIORIDADE MÁXIMA):
"\${userIntent}"

INSTRUÇÕES PARA A INTENÇÃO:
- Selecione APENAS momentos que correspondam diretamente à intenção acima
- Se a intenção especifica um tema (ex: "finanças"), inclua SOMENTE trechos sobre esse tema
- Se a intenção especifica uma emoção (ex: "engraçado"), inclua SOMENTE os momentos com essa emoção
- Se a intenção especifica um formato (ex: "apenas dados e estatísticas"), filtre rigorosamente
- Se não houver momentos suficientes que satisfaçam a intenção, inclua os mais próximos e reduza o count
- O campo "hook" deve descrever como este momento específico satisfaz a intenção do usuário
- NÃO inclua momentos que não se relacionem com a intenção, mesmo que sejam viralmente fortes
\` : \`
SEM INTENÇÃO ESPECÍFICA: selecione os \${maxClips} momentos mais virais do vídeo.
\`;

    const claudePrompt = \`Você é um especialista em conteúdo viral para redes sociais brasileiras (TikTok, Reels, Shorts).
Analise esta transcrição e selecione os melhores momentos para cortes virais.
\${intentSection}
TRANSCRIÇÃO COMPLETA:
\${cleanFullText}

TIMESTAMPS DAS PALAVRAS (use para calcular start_s e end_s precisos):
\${JSON.stringify(activeWords.slice(0, 500))}

NICHO: \${project.niche || 'geral'}
DURAÇÃO ALVO: 30–90 segundos por corte
QUANTIDADE ALVO: \${hasIntent ? "até " + maxClips + " (pode ser menos se a intenção filtrar muito)" : maxClips}

Retorne SOMENTE um JSON array válido, sem markdown, sem texto antes ou depois:
[{
  "start_s": number,
  "end_s": number,
  "title": "título com até 60 chars e 1 emoji",
  "caption": "frase impactante com a palavra mais forte entre {chaves}",
  "hook": "\${hasIntent ? 'como este momento satisfaz a intenção do usuário' : 'tipo do gancho'}",
  "score": number entre 0 e 100,
  "hashtags": ["#tag1","#tag2","#tag3","#tag4","#tag5"],
  "niche": "\${project.niche || 'geral'}"
}]

Critérios de score alto: gancho nos 3s iniciais, dado surpreendente, emoção forte, pergunta curiosa.
Excluir: silêncios >5s, apresentações genéricas, frases incompletas.\`;

`;

const newContent = content.substring(0, startIdx) + newMiddle + content.substring(endIdx);
fs.writeFileSync(file, newContent, 'utf8');
console.log('Fixed clean!');
