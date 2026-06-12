import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk";
import OpenAI from "npm:openai";
import ffmpeg from "npm:fluent-ffmpeg";
import path from "node:path";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ─────────────────────────────────────────────────────────────────────────────
// UTILITÁRIOS BASE
// ─────────────────────────────────────────────────────────────────────────────

function calcCreditCost(durationSeconds: number): number {
  if (durationSeconds <= 1800) return 5;
  if (durationSeconds <= 3600) return 10;
  if (durationSeconds <= 7200) return 20;
  return 40;
}

function wordsToSrt(words: Array<{ word: string; start: number; end: number }>): string {
  let srt = '';
  let idx = 1;
  const WORDS_PER_LINE = 4;
  for (let i = 0; i < words.length; i += WORDS_PER_LINE) {
    const chunk = words.slice(i, i + WORDS_PER_LINE);
    if (!chunk.length) continue;
    const fmt = (s: number) => new Date(s * 1000).toISOString().substr(11, 12).replace('.', ',');
    srt += `${idx}\n${fmt(chunk[0].start)} --> ${fmt(chunk[chunk.length - 1].end)}\n${chunk.map(w => w.word).join(' ')}\n\n`;
    idx++;
  }
  return srt;
}

function buildSubtitleFilter(
  srtPath: string,
  style: string,
  isFree: boolean,
  brandPrefs?: {
    logo_url?: string | null;
    brand_color?: string;
    brand_font?: string;
    logo_position?: string;
    logo_size?: number;
    cta_text?: string;
    cta_enabled?: boolean;
    logoLocalPath?: string; // caminho local do logo já baixado
  }
): string {
  // ── Legenda ──────────────────────────────────────────────────────
  const fontName = brandPrefs?.brand_font
    ? ({
        'Schibsted Grotesk': 'SchibstedGrotesk',
        'Anton':  'Anton',
        'Poppins':'Poppins',
      }[brandPrefs.brand_font] ?? 'Arial')
    : 'Arial';

  const STYLES: Record<string, string> = {
    hormozi:    `FontName=${fontName},FontSize=28,Bold=1,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,Outline=2,Shadow=1,Uppercase=1,Alignment=10`,
    clean:      `FontName=${fontName},FontSize=22,Bold=1,PrimaryColour=&H00FFFFFF,Outline=0,Shadow=0,Alignment=2`,
    karaoke:    `FontName=${fontName},FontSize=26,Bold=1,PrimaryColour=&H00FFFFFF,OutlineColour=&H00E8543B,Outline=3,Shadow=1,Uppercase=1,Alignment=10`,
    minimal:    `FontName=${fontName},FontSize=22,Bold=0,PrimaryColour=&H00FFFFFF,BackColour=&H80000000,BorderStyle=4,Outline=0,Alignment=2`,
    neon:       `FontName=${fontName},FontSize=28,Bold=1,PrimaryColour=&H00FFFFFF,OutlineColour=&H005EF1FF,Outline=3,Shadow=2,Uppercase=1,Alignment=10`,
    'bold-bar': `FontName=${fontName},FontSize=26,Bold=1,PrimaryColour=&H00111111,BackColour=&H00E8543B,BorderStyle=4,Outline=0,Uppercase=1,Alignment=2`,
  };

  const subtitleFilter = `subtitles=${srtPath}:force_style='${STYLES[style] ?? STYLES['hormozi']}'`;

  // ── Filtros a empilhar ────────────────────────────────────────────
  const filters: string[] = [subtitleFilter];

  // ── Watermark corta.vc (só plano free) ───────────────────────────
  if (isFree) {
    filters.push(
      `drawtext=text='corta.vc':fontcolor=white@0.6:fontsize=20:x=w-tw-16:y=h-th-16:shadowcolor=black:shadowx=1:shadowy=1`
    );
  }

  // ── Logo da marca (planos pagos, se brand_prefs tiver logo) ───────
  const logoPath = brandPrefs?.logoLocalPath;
  if (!isFree && logoPath) {
    const size = brandPrefs?.logo_size ?? 10;    // % da largura
    const pos  = brandPrefs?.logo_position ?? 'br';

    // Dimensão: size% da largura do vídeo (iw)
    const logoW = `iw*${(size / 100).toFixed(3)}`;
    const logoH = -1; // -1 = mantém proporção

    // Margem fixa de 24px dos cantos
    const MARGIN = 24;
    const xMap: Record<string, string> = {
      tl: `${MARGIN}`,
      tr: `W-w-${MARGIN}`,
      bl: `${MARGIN}`,
      br: `W-w-${MARGIN}`,
    };
    const yMap: Record<string, string> = {
      tl: `${MARGIN}`,
      tr: `${MARGIN}`,
      bl: `H-h-${MARGIN}`,
      br: `H-h-${MARGIN}`,
    };

    const ox = xMap[pos] ?? xMap['br'];
    const oy = yMap[pos] ?? yMap['br'];

    // movie filter: carrega o logo como stream separado, redimensiona e faz overlay
    // Nota: fluent-ffmpeg usa -vf para filter_complex simples — para overlay com
    // input adicional usamos a sintaxe de input inline do movie filter
    filters.push(
      `movie=${logoPath}[logo];[logo]scale=${logoW}:${logoH}[slogo];[in][slogo]overlay=${ox}:${oy}`
    );
  }

  // ── CTA text (planos pagos, se habilitado) ────────────────────────
  if (!isFree && brandPrefs?.cta_enabled && brandPrefs?.cta_text) {
    const ctaText = brandPrefs.cta_text
      .replace(/'/g, "'")     // escapa aspas simples
      .replace(/:/g, '\\:')   // escapa dois-pontos (FFmpeg)
      .replace(/\[/g, '\\[')  // escapa colchetes
      .replace(/\]/g, '\\]')
      .substring(0, 60);

    // Cor da marca em formato ARGB do FFmpeg (0xAARRGGBB)
    const hex = (brandPrefs.brand_color ?? '#e8543b').replace('#', '');
    const r = hex.slice(0,2), g = hex.slice(2,4), b = hex.slice(4,6);
    const ffColor = `0x${r}${g}${b}`;

    // CTA fixo no rodapé: y = H - 80 (acima do último quinto do vídeo)
    filters.push(
      `drawtext=text='${ctaText}':fontcolor=${ffColor}:fontsize=22:` +
      `x=(w-text_w)/2:y=H-80:shadowcolor=black@0.6:shadowx=1:shadowy=1:` +
      `box=1:boxcolor=black@0.3:boxborderw=8`
    );
  }

  // Se só tem o subtitle filter (sem overlay de logo), usa -vf simples
  // Se tem overlay (movie filter), o filtro já está em formato filter_complex
  return filters.join(',');
}

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS COMPARTILHADOS
// ─────────────────────────────────────────────────────────────────────────────

type Word = { word: string; start: number; end: number };

// Um intervalo de tempo no vídeo original que deve ser REMOVIDO
interface RemovalSegment {
  start: number;  // segundos
  end: number;
  reason: 'silence' | 'filler';
}

// ─────────────────────────────────────────────────────────────────────────────
// MÓDULO 1 — SILENCEDETECT via FFmpeg
//
// Usa o filtro silencedetect nativo do FFmpeg para detectar trechos de áudio
// abaixo de um limiar de dB por um mínimo de segundos.
// Retorna apenas pausas DENTRO de segmentos de fala — não os inícios/fins.
// ─────────────────────────────────────────────────────────────────────────────

interface SilenceRange {
  start: number;
  end: number;
}

async function detectSilences(
  audioPath: string,
  opts: {
    noiseDb?: number;       // limiar de dB (default: -35 dB)
    minDuration?: number;   // duração mínima de silêncio em segundos (default: 1.5s)
    totalDuration: number;
  }
): Promise<SilenceRange[]> {
  const noiseDb      = opts.noiseDb      ?? -35;
  const minDuration  = opts.minDuration  ?? 1.5;
  const { totalDuration } = opts;

  // FFmpeg silencedetect grava no stderr, não no stdout
  const ffprobeCmd = new Deno.Command('ffmpeg', {
    args: [
      '-i', audioPath,
      '-af', `silencedetect=noise=${noiseDb}dB:duration=${minDuration}`,
      '-f', 'null', '-'
    ],
    stderr: 'piped',
    stdout: 'null',
  });

  const { stderr } = await ffprobeCmd.output();
  const log = new TextDecoder().decode(stderr);

  // Parse do output: "silence_start: 12.34" e "silence_end: 15.67 | silence_duration: 3.33"
  const silences: SilenceRange[] = [];
  const startRe = /silence_start:\s*([\d.]+)/g;
  const endRe   = /silence_end:\s*([\d.]+)/g;

  const starts: number[] = [];
  const ends: number[]   = [];

  let m: RegExpExecArray | null;
  while ((m = startRe.exec(log)) !== null) starts.push(parseFloat(m[1]));
  while ((m = endRe.exec(log)) !== null)   ends.push(parseFloat(m[1]));

  for (let i = 0; i < starts.length; i++) {
    const s = starts[i];
    const e = ends[i] ?? totalDuration; // silêncio que vai até o fim

    // Ignora silêncio que começa nos primeiros 0.3s (intro natural)
    // e silêncio que termina nos últimos 0.3s (outro natural)
    if (s < 0.3 || e > totalDuration - 0.3) continue;

    silences.push({ start: s, end: e });
  }

  return silences;
}

// ─────────────────────────────────────────────────────────────────────────────
// MÓDULO 2 — FILLER WORD REMOVAL via words[] do Whisper
//
// Identifica palavras de preenchimento no array words[] por regex por idioma.
// NÃO depende do silencedetect — opera independentemente.
// ─────────────────────────────────────────────────────────────────────────────

const FILLER_RE: Record<string, RegExp> = {
  pt: /^(hm+|hum+|ahn*|ah+|oh+|eh+|ih+|né|então|tipo|assim|sabe|cara|mano|gente|tá|certo|beleza|enfim|ué|pois\s*é|aí|ô|ó|opa|uai|e\s*aí|eai|é\s*isso|é\s*isso\s*aí|vou\s*te\s*falar|olha\s*só|sim|bom|bem)$/i,
  en: /^(um+|uh+|ah+|oh+|er+|hm+|like|you\s*know|i\s*mean|basically|literally|actually|right|okay|so+|well+|anyway|yeah+|yep|hmm+|erm+)$/i,
  es: /^(eh+|ah+|hm+|um+|uh+|o\s*sea|pues+|bueno|este+|mhm+|tipo|ósea|digamos)$/i,
};

function detectFillerWords(
  words: Word[],
  lang: string
): RemovalSegment[] {
  const re = FILLER_RE[lang] ?? FILLER_RE['pt'];
  const segments: RemovalSegment[] = [];

  for (const w of words) {
    const normalized = w.word.trim().replace(/[.,!?;:]+$/, '');
    if (re.test(normalized)) {
      segments.push({ start: w.start, end: w.end + 0.05, reason: 'filler' });
    }
  }

  return segments;
}

// ─────────────────────────────────────────────────────────────────────────────
// MÓDULO 3 — MERGE + APPLY
//
// Recebe segmentos de silêncio (FFmpeg) e fillers (Whisper) separados,
// une os sobrepostos, e gera:
//   - cleanWords: words[] reindexados com timestamps ajustados
//   - activeVideoPath: vídeo re-renderizado sem os trechos removidos
// ─────────────────────────────────────────────────────────────────────────────

function mergeRemovalSegments(segments: RemovalSegment[]): RemovalSegment[] {
  if (!segments.length) return [];

  const sorted = [...segments].sort((a, b) => a.start - b.start);
  const merged: RemovalSegment[] = [{ ...sorted[0] }];

  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    const cur  = sorted[i];
    // Une se a distância entre eles for menor que 0.25s
    if (cur.start - last.end < 0.25) {
      last.end    = Math.max(last.end, cur.end);
      last.reason = last.reason === cur.reason ? last.reason : 'silence'; // mixed → silence
    } else {
      merged.push({ ...cur });
    }
  }

  return merged;
}

// Recalcula timestamps das words após cortes no vídeo
function adjustWordTimestamps(words: Word[], removals: RemovalSegment[]): Word[] {
  return words
    .filter(w => {
      // Remove words que caem inteiramente dentro de um segmento de remoção
      return !removals.some(r => w.start >= r.start && w.end <= r.end + 0.05);
    })
    .map(w => {
      // Calcula quanto tempo foi removido antes desta word
      const removedBefore = removals
        .filter(r => r.end <= w.start)
        .reduce((acc, r) => acc + (r.end - r.start), 0);
      return {
        word: w.word,
        start: parseFloat((w.start - removedBefore).toFixed(3)),
        end:   parseFloat((w.end   - removedBefore).toFixed(3)),
      };
    });
}

// Aplica os cortes físicos no vídeo via FFmpeg select filter
async function applyRemovals(
  inputPath: string,
  removals: RemovalSegment[],
  totalDuration: number,
  tmpDir: string
): Promise<string> {
  if (!removals.length) return inputPath;

  // Calcula a duração total removida — se < 2s, não vale re-renderizar
  const totalRemoved = removals.reduce((acc, r) => acc + (r.end - r.start), 0);
  if (totalRemoved < 2.0) {
    console.log(`applyRemovals: apenas ${totalRemoved.toFixed(1)}s a remover — pulando re-render`);
    return inputPath;
  }

  // Inverte os removals para obter os segmentos de KEEP
  const keeps: Array<{ start: number; end: number }> = [];
  let cursor = 0;
  for (const r of removals) {
    if (r.start > cursor + 0.05) {
      keeps.push({ start: cursor, end: r.start });
    }
    cursor = r.end;
  }
  if (cursor < totalDuration - 0.05) {
    keeps.push({ start: cursor, end: totalDuration });
  }

  if (!keeps.length) return inputPath;

  // Monta o filtro select com os segmentos de keep
  const selectExpr = keeps
    .map(k => `between(t,${k.start.toFixed(3)},${k.end.toFixed(3)})`)
    .join('+');

  const outputPath = path.join(tmpDir, 'clean.mp4');

  await new Promise<void>((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        `-vf select='${selectExpr}',setpts=N/FRAME_RATE/TB`,
        `-af aselect='${selectExpr}',asetpts=N/SR/TB`,
        '-c:v libx264', '-preset fast', '-crf 22',
        '-c:a aac', '-b:a 128k',
        '-movflags +faststart',
      ])
      .output(outputPath)
      .on('end', () => resolve())
      .on('error', (err) => {
        // Se o filtro falhar (ex: muitos segmentos), usa vídeo original
        console.warn('applyRemovals falhou no FFmpeg, usando vídeo original:', err.message);
        resolve();
      })
      .run();
  });

  // Verifica integridade do arquivo gerado
  try {
    const stat = await Deno.stat(outputPath);
    if (stat.size > 50_000) return outputPath; // > 50 KB = válido
  } catch (_) { /* arquivo não gerado */ }

  console.warn('applyRemovals: outputPath inválido, retornando inputPath');
  return inputPath;
}

// ─────────────────────────────────────────────────────────────────────────────
// SERVE — PIPELINE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  let projectId: string | null = null;
  let tmpDir: string | null = null;

  try {
    const { project_id, user_id } = await req.json();
    if (!project_id || !user_id) throw new Error('Missing project_id or user_id');
    projectId = project_id;

    await supabase.from('projects').update({ status: 'processing' }).eq('id', project_id);

    // ── 1. Buscar projeto ──────────────────────────────────────────
    const { data: project, error: projErr } = await supabase
      .from('projects').select('*').eq('id', project_id).single();
    if (projErr || !project) throw new Error('Projeto não encontrado');

    // ── 2. Verificar perfil e créditos ────────────────────────────
    const { data: profile } = await supabase
      .from('profiles').select('credits, plan, brand_prefs').eq('id', user_id).single();
    if (!profile) throw new Error('Perfil não encontrado');

    tmpDir = await Deno.makeTempDir();
    const videoPath = path.join(tmpDir, 'input.mp4');
    let videoReady = false;

    // ── 3. Download do vídeo ──────────────────────────────────────
    if (project.storage_path) {
      const { data: videoBlob, error: dlErr } = await supabase.storage
        .from('videos').download(project.storage_path);
      if (dlErr || !videoBlob) throw new Error('Falha ao baixar vídeo do storage');
      Deno.writeFileSync(videoPath, new Uint8Array(await videoBlob.arrayBuffer()));
      videoReady = true;
    } else if (project.source_url) {
      const url = project.source_url;
      const isYouTube = url.includes('youtube.com') || url.includes('youtu.be');
      const isTwitch  = url.includes('twitch.tv/videos/');
      const isDrive   = url.includes('drive.google.com');
      const isZoom    = url.includes('zoom.us/rec/') || url.includes('zoom.us/share/');

      if (isZoom) {
        throw new Error('Gravações do Zoom precisam ser baixadas manualmente. Links do Zoom requerem autenticação.');
      } else if (isDrive) {
        const fileId = url.match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1];
        if (!fileId) throw new Error('ID do arquivo Google Drive não encontrado na URL');
        const key = Deno.env.get('GOOGLE_API_KEY');
        if (!key) throw new Error('GOOGLE_API_KEY não configurado');
        const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${key}`);
        if (!res.ok) throw new Error(`Google Drive download falhou: ${res.status}. O arquivo precisa ser público.`);
        Deno.writeFileSync(videoPath, new Uint8Array(await res.arrayBuffer()));
        videoReady = true;
      } else {
        // YouTube, Twitch e qualquer outra plataforma via yt-dlp
        const ytArgs = isYouTube || isTwitch
          ? ['--no-playlist', '--format', 'bestvideo[height<=1080]+bestaudio/best[height<=1080]', '--merge-output-format', 'mp4', '--output', videoPath, url]
          : ['--no-playlist', '--format', 'mp4/best', '--output', videoPath, url];
        const { code } = await new Deno.Command('yt-dlp', { args: ytArgs }).output();
        if (code !== 0) throw new Error(`Falha ao baixar vídeo via yt-dlp: ${url}`);
        videoReady = true;
      }
    }

    if (!videoReady) throw new Error('Nenhuma fonte de vídeo disponível');

    // ── 4. ffprobe: duração real ──────────────────────────────────
    let durationSeconds = 300;
    try {
      const { stdout } = await new Deno.Command('ffprobe', {
        args: ['-v', 'quiet', '-print_format', 'json', '-show_format', videoPath]
      }).output();
      const info = JSON.parse(new TextDecoder().decode(stdout));
      durationSeconds = parseFloat(info.format?.duration ?? '300');
    } catch (_) { console.warn('ffprobe falhou, usando fallback 300s'); }

    const creditCost = calcCreditCost(durationSeconds);
    if (profile.credits !== -1 && profile.credits < creditCost) {
      throw new Error(`Créditos insuficientes: precisa de ${creditCost}, tem ${profile.credits}`);
    }

    await supabase.from('projects')
      .update({ duration_seconds: Math.round(durationSeconds) })
      .eq('id', project_id);

    // ── 5. Conversão de aspect ratio ──────────────────────────────
    const targetRatio = project.ratio || '9:16';
    const [rW, rH] = targetRatio.split(':').map(Number);
    let sourceVideoPath = videoPath;

    if (rW && rH) {
      const targetW    = rH > rW ? 1080 : 1920;
      const targetH    = rH > rW ? 1920 : 1080;
      const scaleFilter = `scale=${targetW}:${targetH}:force_original_aspect_ratio=decrease,pad=${targetW}:${targetH}:(ow-iw)/2:(oh-ih)/2:black`;
      const convertedPath = path.join(tmpDir, 'converted.mp4');

      await new Promise<void>((resolve, reject) => {
        ffmpeg(videoPath)
          .outputOptions([`-vf ${scaleFilter}`, '-c:a copy', '-movflags +faststart'])
          .output(convertedPath)
          .on('end', resolve)
          .on('error', reject)
          .run();
      });
      sourceVideoPath = convertedPath;
    }

    // ── 6. Extração de áudio para Whisper ─────────────────────────
    const audioPath = path.join(tmpDir, 'audio.mp3');
    await new Promise<void>((resolve, reject) => {
      ffmpeg(sourceVideoPath)
        .noVideo()
        .audioCodec('libmp3lame')
        .audioFrequency(16000)
        .audioChannels(1)
        .audioBitrate('64k')
        .save(audioPath)
        .on('end', resolve)
        .on('error', reject);
    });

    // ── 7. Whisper: transcrição com timestamps por palavra ─────────
    const openai   = new OpenAI({ apiKey: Deno.env.get('OPENAI_API_KEY') });
    const audioFile = new File([Deno.readFileSync(audioPath)], 'audio.mp3', { type: 'audio/mpeg' });
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      response_format: 'verbose_json',
      timestamp_granularities: ['word'],
      language: (['pt','en','es','fr','de','it','ja','ko','zh'].includes(project.lang)
        ? project.lang : 'pt'),
    });

    const words: Word[] = transcription.words ?? [];
    const fullText = transcription.text;

    if (!fullText || fullText.trim().length < 50) {
      throw new Error('Transcrição muito curta ou sem fala detectada');
    }

    // ── 8. SILENCE DETECTION + FILLER REMOVAL ─────────────────────
    //
    // Só aplica em planos pagos (starter+).
    // free: skip — economia de CPU e tempo de processamento.
    //
    // Pipeline:
    //   8a. silencedetect → pausas longas (FFmpeg, opera no áudio)
    //   8b. filler words  → vocais/vícios de linguagem (Whisper words[])
    //   8c. merge         → une os dois, remove sobrepostos
    //   8d. applyRemovals → re-render FFmpeg com select filter
    //   8e. adjustWords   → reindexar timestamps do SRT
    // ──────────────────────────────────────────────────────────────

    const isPaid = profile.plan !== 'free';
    let activeVideoPath = sourceVideoPath;
    let activeWords: Word[] = words;
    let silencesRemoved  = 0;
    let fillersRemoved   = 0;
    let secondsSaved     = 0;

    if (isPaid && words.length > 10) {
      const lang = (['pt','en','es'].includes(project.lang) ? project.lang : 'pt') as string;

      // 8a — silencedetect FFmpeg
      // Limiar -35dB remove silêncios reais sem cutting respirações (que ficam por volta de -50dB)
      // minDuration 1.5s: só remove pausas que o espectador percebe como "travamento"
      const silenceRanges = await detectSilences(audioPath, {
        noiseDb: -35,
        minDuration: 1.5,
        totalDuration: durationSeconds,
      });

      const silenceRemovals: RemovalSegment[] = silenceRanges.map(s => ({
        start: s.start,
        end: s.end,
        reason: 'silence' as const,
      }));

      // 8b — filler words via Whisper words[]
      const fillerRemovals = detectFillerWords(words, lang);

      // Contadores brutos (antes do merge)
      silencesRemoved = silenceRemovals.length;
      fillersRemoved  = fillerRemovals.length;

      // 8c — merge: une os dois arrays, funde sobrepostos
      const allRemovals = mergeRemovalSegments([...silenceRemovals, ...fillerRemovals]);

      secondsSaved = parseFloat(
        allRemovals.reduce((acc, r) => acc + (r.end - r.start), 0).toFixed(1)
      );

      console.log(
        `Cleanup: ${silencesRemoved} silêncios + ${fillersRemoved} fillers → ` +
        `${allRemovals.length} cortes, ${secondsSaved}s removidos`
      );

      if (allRemovals.length > 0 && secondsSaved >= 2.0) {
        // 8d — re-render físico do vídeo
        activeVideoPath = await applyRemovals(
          sourceVideoPath,
          allRemovals,
          durationSeconds,
          tmpDir
        );

        // 8e — reindexar timestamps das words para o vídeo limpo
        if (activeVideoPath !== sourceVideoPath) {
          activeWords = adjustWordTimestamps(words, allRemovals);
          // Atualiza durationSeconds para o vídeo limpo
          try {
            const { stdout } = await new Deno.Command('ffprobe', {
              args: ['-v', 'quiet', '-print_format', 'json', '-show_format', activeVideoPath]
            }).output();
            const info = JSON.parse(new TextDecoder().decode(stdout));
            durationSeconds = parseFloat(info.format?.duration ?? String(durationSeconds));
          } catch (_) { /* mantém duração anterior */ }
        }
      } else if (fillersRemoved > 0) {
        // Poucos gaps: só filtra as words do SRT sem re-renderizar
        activeWords = words.filter(w =>
          !fillerRemovals.some(r => w.start >= r.start && w.end <= r.end + 0.05)
        );
        console.log(`Cleanup: só SRT limpo (${fillersRemoved} fillers), vídeo original mantido`);
      }
    }

    // ── 9. Claude: seleciona os melhores momentos ─────────────────
    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });
    const maxClips  = Math.min(15, Math.max(5, Math.floor(durationSeconds / 180)));

    // Reconstrói fullText limpo a partir das activeWords
    const cleanFullText = activeWords.map(w => w.word).join(' ');

    const prompt = `Você é um especialista em conteúdo viral para redes sociais brasileiras (TikTok, Reels, Shorts).
Analise esta transcrição e selecione os ${maxClips} melhores momentos para cortes virais.

TRANSCRIÇÃO COMPLETA:
${cleanFullText}

TIMESTAMPS DAS PALAVRAS (use para calcular start_s e end_s precisos):
${JSON.stringify(activeWords.slice(0, 500))}

NICHO: ${project.niche || 'geral'}
DURAÇÃO ALVO: 30–90 segundos por corte

Retorne SOMENTE um JSON array válido, sem markdown, sem texto antes ou depois:
[{
  "start_s": number,
  "end_s": number,
  "title": "título com até 60 chars e 1 emoji",
  "caption": "frase impactante com a palavra mais forte entre {chaves}",
  "hook": "tipo do gancho",
  "score": number entre 0 e 100,
  "hashtags": ["#tag1","#tag2","#tag3","#tag4","#tag5"],
  "niche": "${project.niche || 'geral'}"
}]

Critérios de score alto: gancho nos 3s iniciais, dado surpreendente, emoção forte, pergunta curiosa.
Excluir: silêncios >5s, apresentações genéricas, frases incompletas.`;

    const claudeRes = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });

    const rawJson  = claudeRes.content[0].type === 'text' ? claudeRes.content[0].text : '';
    const jStart   = rawJson.indexOf('[');
    const jEnd     = rawJson.lastIndexOf(']');
    if (jStart === -1 || jEnd === -1) throw new Error('Claude não retornou JSON válido');

    const moments: Array<any> = JSON.parse(rawJson.substring(jStart, jEnd + 1));
    if (!moments.length) throw new Error('Nenhum momento selecionado pela IA');

    // ── 10. Brand prefs: baixar logo localmente (uma vez, fora do loop) ──
    const isFree    = profile.plan === 'free';
    const brandPrefs: {
      logo_url?: string | null;
      brand_color?: string;
      brand_font?: string;
      logo_position?: string;
      logo_size?: number;
      cta_text?: string;
      cta_enabled?: boolean;
      logoLocalPath?: string;
    } = profile.brand_prefs || {};

    // Baixa o logo uma única vez para tmpDir (evita N downloads no loop)
    if (!isFree && brandPrefs.logo_url) {
      try {
        const logoRes = await fetch(brandPrefs.logo_url);
        if (logoRes.ok) {
          const ext = brandPrefs.logo_url.split('.').pop()?.split('?')[0]?.toLowerCase() ?? 'png';
          const logoLocalPath = path.join(tmpDir, `brand_logo.${ext}`);
          Deno.writeFileSync(logoLocalPath, new Uint8Array(await logoRes.arrayBuffer()));
          brandPrefs.logoLocalPath = logoLocalPath;
          console.log(`Brand logo baixado: ${logoLocalPath}`);
        }
      } catch (e) {
        console.warn('Falha ao baixar logo da marca, seguindo sem watermark personalizado:', e);
        // Não falha o processamento — logo é opcional
      }
    }

    let successCount = 0;

    for (const moment of moments) {
      const clipId   = crypto.randomUUID();
      const clipPath = path.join(tmpDir, `${clipId}.mp4`);
      const thumbPath= path.join(tmpDir, `${clipId}.jpg`);
      const srtPath  = path.join(tmpDir, `${clipId}.srt`);

      try {
        const clipWords = activeWords.filter(w =>
          w.start >= moment.start_s && w.end <= moment.end_s + 1
        );
        Deno.writeTextFileSync(srtPath, wordsToSrt(clipWords));

        // Render com legendas estilizadas
        await new Promise<void>((resolve, reject) => {
          ffmpeg(activeVideoPath)          // ← usa o vídeo limpo
            .setStartTime(moment.start_s)
            .setDuration(moment.end_s - moment.start_s)
            .outputOptions([
              `-vf ${buildSubtitleFilter(srtPath, project.caption_style || 'hormozi', isFree, brandPrefs)}`,
              '-c:a aac', '-b:a 128k', '-movflags +faststart',
            ])
            .output(clipPath)
            .on('end', resolve)
            .on('error', reject)
            .run();
        });

        // Thumbnail no frame 2s
        await new Promise<void>((resolve, reject) => {
          ffmpeg(clipPath)
            .setStartTime(2).frames(1)
            .output(thumbPath)
            .on('end', resolve)
            .on('error', reject)
            .run();
        });

        // Upload clip
        const storagePath = `${user_id}/${project_id}/${clipId}.mp4`;
        await supabase.storage.from('clips').upload(
          storagePath, Deno.readFileSync(clipPath), { contentType: 'video/mp4' }
        );

        // Upload thumbnail
        let thumbnailUrl: string | null = null;
        try {
          const thumbStorage = `${user_id}/${project_id}/${clipId}.jpg`;
          await supabase.storage.from('clips').upload(
            thumbStorage, Deno.readFileSync(thumbPath), { contentType: 'image/jpeg' }
          );
          const { data: { publicUrl } } = supabase.storage.from('clips').getPublicUrl(thumbStorage);
          thumbnailUrl = publicUrl;
        } catch (_) { console.warn('Thumbnail upload falhou'); }

        // Insert clip
        await supabase.from('clips').insert({
          id: clipId,
          project_id,
          user_id,
          title:          moment.title,
          caption:        moment.caption,
          hashtags:       moment.hashtags,
          niche:          moment.niche,
          start_s:        moment.start_s,
          end_s:          moment.end_s,
          duration:       Math.round(moment.end_s - moment.start_s),
          score:          moment.score,
          hook:           moment.hook,
          storage_path:   storagePath,
          thumbnail_url:  thumbnailUrl,
          caption_style:  project.caption_style || 'hormozi',
          status:         'rendered',
          transcript: (() => {
            const clipW = activeWords.filter(
              (w: Word) => w.start >= moment.start_s - 0.1 && w.end <= moment.end_s + 0.5
            );
            return clipW.map((w: Word) => ({
              w: w.word,
              s: parseFloat((w.start - moment.start_s).toFixed(3)),
              e: parseFloat((w.end   - moment.start_s).toFixed(3)),
            }));
          })(),
          // ★ novos campos de cleanup
          silences_removed:  isPaid ? silencesRemoved : 0,
          fillers_removed:   isPaid ? fillersRemoved  : 0,
          seconds_saved:     isPaid ? secondsSaved    : 0,
        });

        successCount++;
      } catch (clipErr) {
        console.error(`Erro no clip ${clipId}:`, clipErr);
      }
    }

    if (successCount === 0) throw new Error('Nenhum corte foi renderizado com sucesso');

    // ── 11. Update projeto ────────────────────────────────────────
    await supabase.from('projects').update({
      status:                  'ready',
      clips_count:             successCount,
      silence_removal_applied: isPaid && silencesRemoved > 0,
      filler_removal_applied:  isPaid && fillersRemoved  > 0,
      total_seconds_saved:     isPaid ? secondsSaved : 0,
    }).eq('id', project_id);

    // ── 12. Decremento de créditos ────────────────────────────────
    const { error: rpcErr } = await supabase.rpc('decrement_credits', {
      user_id_param: user_id,
      amount: creditCost,
    });
    if (rpcErr) {
      console.warn('RPC decrement_credits falhou, fallback manual:', rpcErr);
      if (profile.credits !== -1) {
        await supabase.from('profiles')
          .update({ credits: Math.max(0, profile.credits - creditCost) })
          .eq('id', user_id);
      }
    }

    // ── 13. Notificação ───────────────────────────────────────────
    const cleanupMsg = isPaid && secondsSaved > 0
      ? ` • ${secondsSaved}s de silêncio/fillers removidos ✂️`
      : '';

    await supabase.from('notifications').insert({
      user_id,
      type:       'processing_done',
      title:      `${successCount} cortes prontos! 🎬`,
      body:       `Seu vídeo "${project.title}" foi processado com sucesso.${cleanupMsg}`,
      action_url: `/clips?project=${project_id}`,
    });

    if (tmpDir) {
      try { await Deno.remove(tmpDir, { recursive: true }); }
      catch (_) { console.warn('Falha ao limpar tmpDir'); }
    }

    return new Response(
      JSON.stringify({
        success:          true,
        clips_count:      successCount,
        credit_cost:      creditCost,
        silences_removed: silencesRemoved,
        fillers_removed:  fillersRemoved,
        seconds_saved:    secondsSaved,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('process-video error:', err);
    if (projectId) {
      await supabase.from('projects').update({
        status:        'failed',
        error_message: err instanceof Error ? err.message : String(err),
      }).eq('id', projectId);
    }
    if (tmpDir) {
      try { await Deno.remove(tmpDir, { recursive: true }); }
      catch (_) { console.warn('Falha ao limpar tmpDir'); }
    }
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
