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


function ratioConfig(ratio: string): { w: number; h: number; scaleFilter: string } {
  const [rW, rH] = ratio.split(':').map(Number);
  let w: number, h: number;

  if (!rW || !rH || rW === rH) {
    w = 1080; h = 1080;
  } else if (rH > rW) {
    w = 1080; h = 1920;
  } else {
    w = 1920; h = 1080;
  }

  const scaleFilter =
    `scale=${w}:${h}:force_original_aspect_ratio=decrease,` +
    `pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:black,setsar=1`;

  return { w, h, scaleFilter };
}

function buildSubtitleFilter(srtPath: string, style: string, isFree: boolean): string {
  const watermark = isFree
    ? `,drawtext=text='corta.vc':fontcolor=white@0.6:fontsize=20:x=w-tw-16:y=h-th-16:shadowcolor=black:shadowx=1:shadowy=1`
    : '';
  const STYLES: Record<string, string> = {
    hormozi:    `FontName=Arial,FontSize=28,Bold=1,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,Outline=2,Shadow=1,Uppercase=1,Alignment=10`,
    clean:      `FontName=Arial,FontSize=22,Bold=1,PrimaryColour=&H00FFFFFF,Outline=0,Shadow=0,Alignment=2`,
    karaoke:    `FontName=Arial,FontSize=26,Bold=1,PrimaryColour=&H00FFFFFF,OutlineColour=&H00E8543B,Outline=3,Shadow=1,Uppercase=1,Alignment=10`,
    minimal:    `FontName=Arial,FontSize=22,Bold=0,PrimaryColour=&H00FFFFFF,BackColour=&H80000000,BorderStyle=4,Outline=0,Alignment=2`,
    neon:       `FontName=Arial,FontSize=28,Bold=1,PrimaryColour=&H00FFFFFF,OutlineColour=&H005EF1FF,Outline=3,Shadow=2,Uppercase=1,Alignment=10`,
    'bold-bar': `FontName=Arial,FontSize=26,Bold=1,PrimaryColour=&H00111111,BackColour=&H00E8543B,BorderStyle=4,Outline=0,Uppercase=1,Alignment=2`,
  };
  return `subtitles=${srtPath}:force_style='${STYLES[style] ?? STYLES['hormozi']}'${watermark}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS COMPARTILHADOS
// ─────────────────────────────────────────────────────────────────────────────

type Word = { word: string; start: number; end: number };

interface RemovalSegment {
  start: number;
  end: number;
  reason: 'silence' | 'filler';
}

// ─────────────────────────────────────────────────────────────────────────────
// MÓDULO SILENCEDETECT + FILLER REMOVAL (inalterado)
// ─────────────────────────────────────────────────────────────────────────────

interface SilenceRange { start: number; end: number; }

async function detectSilences(
  audioPath: string,
  opts: { noiseDb?: number; minDuration?: number; totalDuration: number }
): Promise<SilenceRange[]> {
  const noiseDb = opts.noiseDb ?? -35;
  const minDuration = opts.minDuration ?? 1.5;
  const { totalDuration } = opts;

  const ffprobeCmd = new Deno.Command('ffmpeg', {
    args: ['-i', audioPath, '-af', `silencedetect=noise=${noiseDb}dB:duration=${minDuration}`, '-f', 'null', '-'],
    stderr: 'piped', stdout: 'null',
  });
  const { stderr } = await ffprobeCmd.output();
  const log = new TextDecoder().decode(stderr);

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
    const e = ends[i] ?? totalDuration;
    if (s < 0.3 || e > totalDuration - 0.3) continue;
    silences.push({ start: s, end: e });
  }
  return silences;
}

const FILLER_RE: Record<string, RegExp> = {
  pt: /^(hm+|hum+|ahn*|ah+|oh+|eh+|ih+|né|então|tipo|assim|sabe|cara|mano|gente|tá|certo|beleza|enfim|ué|pois\s*é|aí|ô|ó|opa|uai|e\s*aí|eai|é\s*isso|é\s*isso\s*aí|vou\s*te\s*falar|olha\s*só|sim|bom|bem)$/i,
  en: /^(um+|uh+|ah+|oh+|er+|hm+|like|you\s*know|i\s*mean|basically|literally|actually|right|okay|so+|well+|anyway|yeah+|yep|hmm+|erm+)$/i,
  es: /^(eh+|ah+|hm+|um+|uh+|o\s*sea|pues+|bueno|este+|mhm+|tipo|ósea|digamos)$/i,
};

function detectFillerWords(words: Word[], lang: string): RemovalSegment[] {
  const re = FILLER_RE[lang] ?? FILLER_RE['pt'];
  return words
    .filter(w => re.test(w.word.trim().replace(/[.,!?;:]+$/, '')))
    .map(w => ({ start: w.start, end: w.end + 0.05, reason: 'filler' as const }));
}

function mergeRemovalSegments(segments: RemovalSegment[]): RemovalSegment[] {
  if (!segments.length) return [];
  const sorted = [...segments].sort((a, b) => a.start - b.start);
  const merged: RemovalSegment[] = [{ ...sorted[0] }];
  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    const cur  = sorted[i];
    if (cur.start - last.end < 0.25) {
      last.end    = Math.max(last.end, cur.end);
      last.reason = last.reason === cur.reason ? last.reason : 'silence';
    } else { merged.push({ ...cur }); }
  }
  return merged;
}

function adjustWordTimestamps(words: Word[], removals: RemovalSegment[]): Word[] {
  return words
    .filter(w => !removals.some(r => w.start >= r.start && w.end <= r.end + 0.05))
    .map(w => {
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

async function applyRemovals(
  inputPath: string,
  removals: RemovalSegment[],
  totalDuration: number,
  tmpDir: string
): Promise<string> {
  if (!removals.length) return inputPath;
  const totalRemoved = removals.reduce((acc, r) => acc + (r.end - r.start), 0);
  if (totalRemoved < 2.0) return inputPath;

  const keeps: Array<{ start: number; end: number }> = [];
  let cursor = 0;
  for (const r of removals) {
    if (r.start > cursor + 0.05) keeps.push({ start: cursor, end: r.start });
    cursor = r.end;
  }
  if (cursor < totalDuration - 0.05) keeps.push({ start: cursor, end: totalDuration });
  if (!keeps.length) return inputPath;

  const selectExpr = keeps
    .map(k => `between(t,${k.start.toFixed(3)},${k.end.toFixed(3)})`)
    .join('+');
  const outputPath = path.join(tmpDir, 'clean.mp4');

  await new Promise<void>((resolve) => {
    ffmpeg(inputPath)
      .outputOptions([
        `-vf select='${selectExpr}',setpts=N/FRAME_RATE/TB`,
        `-af aselect='${selectExpr}',asetpts=N/SR/TB`,
        '-c:v libx264', '-preset fast', '-crf 22',
        '-c:a aac', '-b:a 128k', '-movflags +faststart',
      ])
      .output(outputPath)
      .on('end', () => resolve())
      .on('error', () => resolve())
      .run();
  });

  try {
    const stat = await Deno.stat(outputPath);
    if (stat.size > 50_000) return outputPath;
  } catch (_) {}
  return inputPath;
}

// ─────────────────────────────────────────────────────────────────────────────
// MÓDULO FACE TRACKING
// ─────────────────────────────────────────────────────────────────────────────

interface FacePoint {
  t:    number;  // timestamp em segundos (relativo ao início do vídeo processado)
  cx:   number;  // centro X normalizado [0, 1]
  cy:   number;  // centro Y normalizado [0, 1]
  fw:   number;  // largura do rosto normalizada [0, 1]
  fh:   number;  // altura do rosto normalizada [0, 1]
  conf: number;  // confiança da detecção [0, 1]
}

// 1 — Extrai frames do vídeo (1 fps, resolução reduzida para análise rápida)
async function extractFramesForTracking(
  videoPath: string,
  framesDir: string,
  maxSeconds: number = 300   // analisa no máximo 5 min para respeitar timeout
): Promise<number> {
  await Deno.mkdir(framesDir, { recursive: true });

  const durationArgs = maxSeconds > 0 ? ['-t', String(maxSeconds)] : [];

  const { code } = await new Deno.Command('ffmpeg', {
    args: [
      '-i', videoPath,
      ...durationArgs,
      '-vf', 'fps=1,scale=480:-2',  // 1 fps, 480px de largura, altura proporcional
      '-q:v', '4',                   // qualidade JPEG razoável, arquivo menor
      path.join(framesDir, 'f%04d.jpg'),
    ],
    stdout: 'null',
    stderr: 'null',
  }).output();

  if (code !== 0) return 0;

  let count = 0;
  try {
    for await (const _ of Deno.readDir(framesDir)) count++;
  } catch (_) {}
  return count;
}

// 2 — Chama o script Python detect-faces.py via subprocess
async function runFaceDetector(
  framesDir: string,
  facesJsonPath: string,
  videoW: number,
  videoH: number
): Promise<FacePoint[]> {
  // O script Python está no mesmo diretório da Edge Function
  const scriptDir  = path.dirname(new URL(import.meta.url).pathname);
  const scriptPath = path.join(scriptDir, 'detect-faces.py');

  // Verifica se o script existe
  try { await Deno.stat(scriptPath); } catch (_) {
    console.warn('detect-faces.py não encontrado em:', scriptPath);
    return [];
  }

  const { code, stdout, stderr } = await new Deno.Command('python3', {
    args: [
      scriptPath,
      '--frames',     framesDir,
      '--out',        facesJsonPath,
      '--video-w',    String(videoW),
      '--video-h',    String(videoH),
      '--confidence', '0.50',
      '--fps',        '1',
    ],
  }).output();

  if (code !== 0) {
    const errText = new TextDecoder().decode(stderr);
    console.warn('detect-faces.py saiu com código', code, ':', errText.slice(0, 200));
    return [];
  }

  // O script escreve o JSON no arquivo e um resumo no stdout
  try {
    const jsonText = await Deno.readTextFile(facesJsonPath);
    const parsed = JSON.parse(jsonText);
    console.log(
      `Face tracking: ${parsed.faces_found ?? 0} rostos` +
      ` em ${parsed.total_frames ?? 0} frames`
    );
    return (parsed.faces ?? []) as FacePoint[];
  } catch (e) {
    console.warn('Falha ao ler faces.json:', e);
    return [];
  }
}

// 3 — Suaviza a trajetória do rosto com média móvel (elimina jitter)
function smoothTrack(faces: FacePoint[], windowSec: number = 2.5): FacePoint[] {
  if (faces.length < 2) return faces;
  return faces.map((f, i) => {
    const near = faces.filter(g => Math.abs(g.t - f.t) <= windowSec / 2);
    const avg  = (key: keyof FacePoint) =>
      near.reduce((s, g) => s + (g[key] as number), 0) / near.length;
    return { t: f.t, cx: avg('cx'), cy: avg('cy'), fw: avg('fw'), fh: avg('fh'), conf: f.conf };
  });
}

// 4 — Converte posições de rosto em parâmetros de crop absolutos (pixels)
//     Para 9:16: o vídeo já está em 1080×1920 — centraliza X no rosto, Y fixo
//     Para 16:9: o vídeo já está em 1920×1080 — centraliza Y no rosto, X fixo
//     Para 1:1:  centraliza X e Y no rosto, crop quadrado
function faceToAbsoluteCrop(
  face: FacePoint,
  vW: number,
  vH: number,
  targetRatio: string
): { x: number; y: number; w: number; h: number } {
  const [rW, rH] = targetRatio.split(':').map(Number);
  const faceCX   = Math.round(face.cx * vW);
  const faceCY   = Math.round(face.cy * vH);

  // Padding extra acima do rosto (mostra um pouco da cabeça)
  const HEAD_PADDING = Math.round(face.fh * vH * 0.6);

  if (rH > rW) {
    // 9:16 — vídeo já está na altura correta, cropamos a largura
    const cropW = Math.min(vW, Math.round(vH * rW / rH));
    const rawX  = faceCX - Math.round(cropW / 2);
    const x     = Math.max(0, Math.min(vW - cropW, rawX));
    return { x, y: 0, w: cropW, h: vH };
  } else if (rW > rH) {
    // 16:9 — cropamos a altura
    const cropH = Math.min(vH, Math.round(vW * rH / rW));
    const rawY  = (faceCY - HEAD_PADDING) - Math.round(cropH * 0.35);
    const y     = Math.max(0, Math.min(vH - cropH, rawY));
    return { x: 0, y, w: vW, h: cropH };
  } else {
    // 1:1 — crop quadrado centralizado no rosto
    const side = Math.min(vW, vH);
    const rawX = faceCX - Math.round(side / 2);
    const rawY = (faceCY - HEAD_PADDING) - Math.round(side * 0.35);
    const x    = Math.max(0, Math.min(vW - side, rawX));
    const y    = Math.max(0, Math.min(vH - side, rawY));
    return { x, y, w: side, h: side };
  }
}

// 5 — Gera o arquivo sendcmd.txt para FFmpeg
//     Formato: "TEMPO crop x X, crop y Y, crop w W, crop h H;"
async function writeSendcmd(
  faces: FacePoint[],
  sendcmdPath: string,
  vW: number,
  vH: number,
  targetRatio: string,
  clipStartS: number,  // timestamp de início do clip no vídeo fonte
  clipEndS: number
): Promise<boolean> {
  // Filtra apenas os rostos dentro da janela do clip
  const inWindow = faces.filter(f => f.t >= clipStartS - 0.5 && f.t <= clipEndS + 0.5);
  if (inWindow.length < 2) return false;

  const lines: string[] = [];
  for (const face of inWindow) {
    const { x, y, w, h } = faceToAbsoluteCrop(face, vW, vH, targetRatio);
    // Timestamp relativo ao início do clip
    const relT = Math.max(0, face.t - clipStartS);
    lines.push(`${relT.toFixed(3)} crop x ${x}, crop y ${y}, crop w ${w}, crop h ${h};`);
  }

  await Deno.writeTextFile(sendcmdPath, lines.join('\n'));
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// FACE DETECTION — Google Vision API (fallback quando Python indisponível)
// ─────────────────────────────────────────────────────────────────────────────

// Verifica se python3 está disponível no container uma única vez.
// Cache em módulo — só testa na primeira chamada.
let _pythonAvailableCache: boolean | null = null;

async function pythonAvailable(): Promise<boolean> {
  if (_pythonAvailableCache !== null) return _pythonAvailableCache;
  try {
    const { code } = await new Deno.Command('python3', {
      args: ['--version'],
      stdout: 'null',
      stderr: 'null',
    }).output();
    _pythonAvailableCache = code === 0;
  } catch (_) {
    _pythonAvailableCache = false;
  }
  return _pythonAvailableCache;
}

// Detecta rostos via Google Vision API usando frames JPEG já extraídos.
// Retorna FacePoint[] com a mesma forma que detectFaces() —
// substituto direto quando Python não está disponível.
//
// Custo aproximado: $0.0015 por imagem (Vision API, tier FACE_DETECTION).
// Com maxFrames=60 → máx $0.09 por processamento.
//
// Documentação: https://cloud.google.com/vision/docs/faces
async function detectFacesVisionAPI(
  framesDir: string,
  videoW: number,
  videoH: number,
  maxFrames: number = 60   // limite de custo: ~$0.09 por job
): Promise<FacePoint[]> {
  const apiKey = Deno.env.get('GOOGLE_API_KEY');
  if (!apiKey) {
    console.log('Face tracking Vision API: GOOGLE_API_KEY não configurado — pulando');
    return [];
  }

  // Coleta os frames disponíveis (ordenados por nome)
  const entries: string[] = [];
  try {
    for await (const e of Deno.readDir(framesDir)) {
      if (e.name.endsWith('.jpg')) entries.push(e.name);
    }
  } catch (_) { return []; }

  entries.sort();

  // Amostra uniforme se houver mais frames do que o limite
  // Ex: 300 frames, maxFrames=60 → pega 1 a cada 5
  const step = entries.length > maxFrames ? Math.ceil(entries.length / maxFrames) : 1;
  const sampled = entries.filter((_, i) => i % step === 0).slice(0, maxFrames);

  if (sampled.length === 0) return [];

  console.log(`Face tracking Vision API: analisando ${sampled.length} frames (step=${step})`);

  const results: FacePoint[] = [];
  let apiErrors = 0;

  for (let i = 0; i < sampled.length; i++) {
    const fname = sampled[i];
    // Índice original no array total → timestamp em segundos (1 fps)
    const originalIdx = entries.indexOf(fname);
    const t = originalIdx; // 1fps → índice == segundos

    try {
      const imgBytes = Deno.readFileSync(`${framesDir}/${fname}`);
      const b64 = btoa(String.fromCharCode(...new Uint8Array(imgBytes)));

      const res = await fetch(
        `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requests: [{
              image: { content: b64 },
              features: [{ type: 'FACE_DETECTION', maxResults: 5 }],
            }],
          }),
        }
      );

      if (!res.ok) {
        apiErrors++;
        // Se muitos erros consecutivos, para de chamar (evita custo)
        if (apiErrors >= 5) {
          console.warn('Vision API: muitos erros consecutivos — abortando');
          break;
        }
        continue;
      }

      apiErrors = 0; // reset se voltou a funcionar
      const data = await res.json();
      const annotations = data.responses?.[0]?.faceAnnotations ?? [];

      if (annotations.length === 0) continue;

      // Usa a face com maior confiança de detecção
      // Vision API ordena por confiança decrescente — primeira é a melhor
      const best = annotations[0];

      // boundingPoly: polígono ao redor do rosto
      // fdBoundingPoly: polígono mais apertado (skin/feature bounding)
      // Preferimos fdBoundingPoly quando disponível — mais preciso para crop
      const poly = best.fdBoundingPoly ?? best.boundingPoly;
      const verts = poly?.vertices ?? [];

      if (verts.length < 3) continue;

      // Calcula bounding box a partir dos vértices
      const xs = verts.map((v: { x?: number }) => v.x ?? 0);
      const ys = verts.map((v: { y?: number }) => v.y ?? 0);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      const maxX = Math.max(...xs);
      const maxY = Math.max(...ys);
      const bw   = maxX - minX;
      const bh   = maxY - minY;

      // Vision API retorna coordenadas no espaço do frame extraído (480×854 ou similar)
      // Precisamos normalizar para [0,1] em relação ao vídeo real (videoW × videoH)
      // Os frames foram extraídos com -s 480x854, então o espaço dos verts é 480×854
      const frameW = 480;
      const frameH = 854;

      // Fator de escala do frame para o vídeo original
      const scaleX = videoW / frameW;
      const scaleY = videoH / frameH;

      // Mapeia para o vídeo original e normaliza
      const cx = ((minX + bw / 2) * scaleX) / videoW;
      const cy = ((minY + bh / 2) * scaleY) / videoH;
      const fw = (bw * scaleX) / videoW;
      const fh = (bh * scaleY) / videoH;

      // Converte likelihood string da Vision API para score numérico
      const likelihoodMap: Record<string, number> = {
        VERY_LIKELY: 0.95,
        LIKELY: 0.80,
        POSSIBLE: 0.60,
        UNLIKELY: 0.30,
        VERY_UNLIKELY: 0.10,
        UNKNOWN: 0.50,
      };
      const conf = likelihoodMap[best.detectionConfidence ?? 'UNKNOWN'] ??
                   parseFloat(best.detectionConfidence ?? '0.5');

      results.push({
        t:    round3(t),
        cx:   round4(Math.max(0, Math.min(1, cx))),
        cy:   round4(Math.max(0, Math.min(1, cy))),
        fw:   round4(Math.max(0, Math.min(1, fw))),
        fh:   round4(Math.max(0, Math.min(1, fh))),
        conf: round3(conf),
      });

      // Pequena pausa entre requisições para respeitar rate limit da Vision API
      // (600 req/min no tier free, >1000/min no pago — 50ms é mais que suficiente)
      if (i < sampled.length - 1) {
        await new Promise(r => setTimeout(r, 50));
      }

    } catch (frameErr) {
      console.warn(`Vision API: erro no frame ${fname}:`, frameErr);
    }
  }

  console.log(`Face tracking Vision API: ${results.length}/${sampled.length} frames com rosto`);
  return results;
}

function round3(n: number): number { return Math.round(n * 1000) / 1000; }
function round4(n: number): number { return Math.round(n * 10000) / 10000; }

// ─────────────────────────────────────────────────────────────────────────────
// MÓDULO B-ROLL
// Pipeline: Claude analisa segmento → Pexels API → download → FFmpeg concat
// ─────────────────────────────────────────────────────────────────────────────

interface BrollSegment {
  start_s: number;    // início relativo ao clip (não ao vídeo original)
  end_s:   number;    // fim relativo ao clip
  keyword: string;    // termo de busca gerado pelo Claude
  localPath?: string; // caminho do MP4 baixado localmente
}

interface BrollPlan {
  segments: BrollSegment[];
  totalGapSeconds: number;
}

// 1. Claude analisa o transcript do clip e decide ONDE inserir B-roll e com qual keyword.
// Retorna até maxSegments posições, priorizando menções a conceitos visuais.
async function planBroll(
  clipWords: Array<{ word: string; start: number; end: number }>,
  clipDurationS: number,
  niche: string,
  anthropic: Anthropic,
  maxSegments: number = 3
): Promise<BrollPlan> {
  if (clipWords.length < 5 || clipDurationS < 10) {
    return { segments: [], totalGapSeconds: 0 };
  }

  // Reconstrói o texto do clip com timestamps para facilitar análise
  const wordList = clipWords
    .map(w => `[${w.start.toFixed(1)}s] ${w.word}`)
    .join(' ');

  const prompt = `Você analisa transcrições de vídeos curtos para decidir onde inserir B-roll (imagens de fundo).

TRANSCRIPT (${clipDurationS.toFixed(0)}s total):
${wordList}

NICHO: ${niche}

Identifique até ${maxSegments} momentos onde B-roll visual enriqueceria o conteúdo.
Priorize: menções a lugares, objetos, ações, conceitos abstratos, estatísticas.
Evite: início (<3s), fim (>duração-3s), durante frases incompletas.
Cada segmento deve ter entre 2s e 5s de duração.

Responda SOMENTE com JSON válido, sem markdown:
[{
  "start_s": number,
  "end_s": number,
  "keyword": "termo em inglês para buscar no Pexels (1-3 palavras, sem aspas)"
}]

Se não houver bons momentos, retorne: []`;

  try {
    const res = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = res.content[0].type === 'text' ? res.content[0].text : '';
    const jStart = raw.indexOf('[');
    const jEnd   = raw.lastIndexOf(']');
    if (jStart === -1) return { segments: [], totalGapSeconds: 0 };

    const parsed: Array<{ start_s: number; end_s: number; keyword: string }> =
      JSON.parse(raw.substring(jStart, jEnd + 1));

    // Valida e sanitiza cada segmento
    const valid = parsed
      .filter(s =>
        typeof s.start_s === 'number' &&
        typeof s.end_s   === 'number' &&
        typeof s.keyword === 'string' &&
        s.end_s - s.start_s >= 1.5 &&
        s.end_s - s.start_s <= 6 &&
        s.start_s >= 2 &&
        s.end_s <= clipDurationS - 2 &&
        s.keyword.trim().length > 0
      )
      .slice(0, maxSegments)
      .map(s => ({
        start_s: parseFloat(s.start_s.toFixed(3)),
        end_s:   parseFloat(s.end_s.toFixed(3)),
        keyword: s.keyword.trim().toLowerCase().replace(/[^a-z0-9 ]/g, '').substring(0, 50),
      }));

    const totalGapSeconds = valid.reduce((a, s) => a + (s.end_s - s.start_s), 0);
    console.log(`B-roll plan: ${valid.length} segmentos (${totalGapSeconds.toFixed(1)}s)`);

    return { segments: valid, totalGapSeconds };
  } catch (e) {
    console.warn('planBroll falhou:', e);
    return { segments: [], totalGapSeconds: 0 };
  }
}

// 2. Busca vídeo no Pexels API e baixa localmente.
// Retorna o caminho local ou null se falhar.
async function fetchPexelsVideo(
  keyword: string,
  targetDurationS: number,
  targetW: number,
  targetH: number,
  destPath: string,
  pexelsKey: string
): Promise<string | null> {
  try {
    // Orientação: portrait para 9:16, landscape para 16:9 e 1:1
    const orientation = targetH > targetW ? 'portrait' : 'landscape';

    const searchRes = await fetch(
      `https://api.pexels.com/videos/search?` +
      `query=${encodeURIComponent(keyword)}&` +
      `orientation=${orientation}&` +
      `size=medium&` +
      `per_page=10&` +
      `page=1`,
      { headers: { Authorization: pexelsKey } }
    );

    if (!searchRes.ok) {
      console.warn(`Pexels search falhou para "${keyword}": ${searchRes.status}`);
      return null;
    }

    const data = await searchRes.json();
    const videos: Array<any> = data.videos ?? [];

    if (!videos.length) {
      console.log(`Pexels: nenhum resultado para "${keyword}"`);
      return null;
    }

    // Escolhe o vídeo com duração mais próxima do target (±2s de tolerância)
    // Se nenhum for próximo, pega o mais curto que seja >= targetDuration
    const target = targetDurationS;
    const sorted = videos
      .filter(v => v.duration >= target - 1)
      .sort((a, b) => Math.abs(a.duration - target) - Math.abs(b.duration - target));

    const chosen = sorted[0] ?? videos.sort((a, b) => b.duration - a.duration)[0];
    if (!chosen) return null;

    // Escolhe o arquivo de vídeo com resolução mais próxima do target
    const files: Array<any> = chosen.video_files ?? [];
    const targetPixels = targetW * targetH;

    const bestFile = files
      .filter(f => f.file_type === 'video/mp4' && f.link)
      .sort((a, b) => {
        const diffA = Math.abs((a.width * a.height) - targetPixels);
        const diffB = Math.abs((b.width * b.height) - targetPixels);
        return diffA - diffB;
      })[0];

    if (!bestFile?.link) return null;

    // Download do arquivo de vídeo
    const dlRes = await fetch(bestFile.link);
    if (!dlRes.ok) {
      console.warn(`Pexels download falhou: ${dlRes.status}`);
      return null;
    }

    const bytes = new Uint8Array(await dlRes.arrayBuffer());
    if (bytes.length < 10_000) return null; // arquivo suspeito

    Deno.writeFileSync(destPath, bytes);
    console.log(`Pexels: baixado "${keyword}" (${(bytes.length / 1024).toFixed(0)}KB)`);
    return destPath;

  } catch (e) {
    console.warn(`fetchPexelsVideo "${keyword}" falhou:`, e);
    return null;
  }
}

// 3. Baixa todos os B-rolls necessários para um clip (paralelo, com timeout).
// Retorna o plano com `localPath` preenchido onde o download funcionou.
async function downloadBrolls(
  plan: BrollPlan,
  tmpDir: string,
  clipId: string,
  targetW: number,
  targetH: number,
  pexelsKey: string
): Promise<BrollPlan> {
  if (!plan.segments.length) return plan;

  // Downloads em paralelo com Promise.allSettled (falhas individuais não cancelam os outros)
  const downloads = plan.segments.map(async (seg, i) => {
    const destPath = path.join(tmpDir, `broll_${clipId}_${i}.mp4`);
    const localPath = await fetchPexelsVideo(
      seg.keyword,
      seg.end_s - seg.start_s,
      targetW,
      targetH,
      destPath,
      pexelsKey
    );
    return { ...seg, localPath: localPath ?? undefined };
  });

  // Timeout de 20s para todos os downloads juntos
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('B-roll download timeout')), 20_000)
  );

  let results: BrollSegment[];
  try {
    results = await Promise.race([
      Promise.all(downloads),
      timeoutPromise,
    ]) as BrollSegment[];
  } catch (_) {
    // Timeout ou falha geral: usa o que já foi concluído
    const settled = await Promise.allSettled(downloads);
    results = settled
      .filter(r => r.status === 'fulfilled')
      .map(r => (r as PromiseFulfilledResult<BrollSegment>).value);
  }

  const successCount = results.filter(r => r.localPath).length;
  console.log(`B-roll downloads: ${successCount}/${plan.segments.length} OK`);

  return {
    segments: results,
    totalGapSeconds: results
      .filter(r => r.localPath)
      .reduce((a, s) => a + (s.end_s - s.start_s), 0),
  };
}

// 4. Monta o clip final com B-roll intercalado usando FFmpeg concat.
// Estratégia: divide o clip original em segmentos, intercala os B-rolls,
// depois adiciona as legendas sobre o resultado final.
async function renderWithBroll(
  sourceVideo: string,
  srtPath: string,
  plan: BrollPlan,
  clipStartS: number,  // start no vídeo fonte
  clipEndS: number,    // end no vídeo fonte
  targetW: number,
  targetH: number,
  vfSubtitleFilter: string,  // filtro de legendas já montado
  outputPath: string,
  tmpDir: string,
  clipId: string
): Promise<boolean> {
  const activeBrolls = plan.segments.filter(s => s.localPath);
  if (!activeBrolls.length) return false;

  // Etapa A: extrai o clip original em segmentos (evitando os slots de B-roll)
  const clipDuration = clipEndS - clipStartS;
  const scaleFilter  = `scale=${targetW}:${targetH}:force_original_aspect_ratio=decrease,pad=${targetW}:${targetH}:(ow-iw)/2:(oh-ih)/2:black,setsar=1`;

  // Ordena segmentos por tempo
  const sorted = [...activeBrolls].sort((a, b) => a.start_s - b.start_s);

  // Constrói a lista de partes: alternando main video e B-roll
  interface Part { type: 'main' | 'broll'; start: number; end: number; localPath?: string; }
  const parts: Part[] = [];
  let cursor = 0;

  for (const seg of sorted) {
    // Parte do vídeo principal antes deste B-roll
    if (seg.start_s > cursor + 0.1) {
      parts.push({ type: 'main', start: cursor, end: seg.start_s });
    }
    // B-roll
    parts.push({ type: 'broll', start: seg.start_s, end: seg.end_s, localPath: seg.localPath });
    cursor = seg.end_s;
  }
  // Parte final do vídeo principal
  if (cursor < clipDuration - 0.1) {
    parts.push({ type: 'main', start: cursor, end: clipDuration });
  }

  // Etapa B: extrai cada parte em um arquivo temporário
  const partPaths: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const partPath = path.join(tmpDir, `part_${clipId}_${i}.mp4`);

    if (part.type === 'main') {
      // Extrai segmento do vídeo original
      const segDuration = part.end - part.start;
      const absStart    = clipStartS + part.start;

      await new Promise<void>((resolve, reject) => {
        ffmpeg(sourceVideo)
          .setStartTime(absStart)
          .setDuration(segDuration)
          .outputOptions([
            `-vf ${scaleFilter}`,
            '-c:v libx264', '-preset fast', '-crf 22',
            '-c:a aac', '-b:a 128k', '-movflags +faststart',
            '-avoid_negative_ts', 'make_zero',
          ])
          .output(partPath)
          .on('end', resolve)
          .on('error', reject)
          .run();
      });
    } else {
      // Prepara o B-roll: recorta para a duração exata, escala para o ratio alvo
      const brollDuration = part.end - part.start;
      const brollDur      = brollDuration;

      await new Promise<void>((resolve, reject) => {
        ffmpeg(part.localPath!)
          .setStartTime(0)
          .setDuration(brollDur)
          .outputOptions([
            // Escala B-roll para o ratio alvo + pads se necessário
            `-vf ${scaleFilter}`,
            // Sem áudio no B-roll — mantém o áudio original do clip principal
            '-an',
            '-c:v libx264', '-preset fast', '-crf 22',
            '-movflags +faststart',
            '-avoid_negative_ts', 'make_zero',
          ])
          .output(partPath)
          .on('end', resolve)
          .on('error', (err) => {
            console.warn(`B-roll part ${i} falhou:`, err.message);
            resolve(); // não rejeita — parte será ignorada no concat
          })
          .run();
      });

      // Verifica se a parte foi gerada com sucesso
      try {
        const stat = await Deno.stat(partPath);
        if (stat.size < 5_000) {
          // Arquivo suspeito — substitui por preto mudo de mesma duração
          await new Promise<void>((resolve, reject) => {
            ffmpeg()
              .input(`color=black:size=${targetW}x${targetH}:rate=30`)
              .inputOption('-f lavfi')
              .setDuration(brollDur)
              .outputOptions([
                `-vf scale=${targetW}:${targetH}`,
                '-c:v libx264', '-preset fast', '-crf 22',
                '-movflags +faststart',
              ])
              .output(partPath)
              .on('end', resolve).on('error', reject).run();
          });
        }
      } catch (_) {}
    }

    // Verifica se a parte existe antes de adicionar ao concat
    try {
      const st = await Deno.stat(partPath);
      if (st.size > 1_000) partPaths.push(partPath);
    } catch (_) {}
  }

  if (partPaths.length < 2) return false;

  // Etapa C: concat de todas as partes em um único arquivo intermediário
  const concatListPath  = path.join(tmpDir, `concat_${clipId}.txt`);
  const concatVideoPath = path.join(tmpDir, `concat_${clipId}.mp4`);

  // Arquivo de lista para ffmpeg concat demuxer
  const concatLines = partPaths.map(p => `file '${p}'`).join('\n');
  Deno.writeTextFileSync(concatListPath, concatLines);

  await new Promise<void>((resolve, reject) => {
    ffmpeg()
      .input(concatListPath)
      .inputOptions(['-f concat', '-safe 0'])
      .outputOptions([
        '-c:v libx264', '-preset fast', '-crf 22',
        '-c:a aac', '-b:a 128k',
        '-movflags +faststart',
      ])
      .output(concatVideoPath)
      .on('end', resolve)
      .on('error', reject)
      .run();
  });

  // Verifica integridade do concat
  try {
    const stat = await Deno.stat(concatVideoPath);
    if (stat.size < 50_000) return false;
  } catch (_) { return false; }

  // Etapa D: adiciona legendas sobre o vídeo com B-roll
  await new Promise<void>((resolve, reject) => {
    ffmpeg(concatVideoPath)
      .outputOptions([
        `-vf ${vfSubtitleFilter}`,
        '-c:a copy', '-movflags +faststart',
      ])
      .output(outputPath)
      .on('end', resolve)
      .on('error', reject)
      .run();
  });

  // Verifica output final
  try {
    const stat = await Deno.stat(outputPath);
    return stat.size > 50_000;
  } catch (_) {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SERVE — PIPELINE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // ── Health check ──────────────────────────────────────────────
  if (req.method === 'GET') {
    const check = new URL(req.url).searchParams.get('check');
    if (check === 'face') {
      try {
        const { code, stdout } = await new Deno.Command('python3', {
          args: ['-c', 'import cv2; print(cv2.__version__)'],
        }).output();
        const version = new TextDecoder().decode(stdout).trim();
        return new Response(
          JSON.stringify({ python: code === 0, opencv: code === 0 ? version : null }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (e) {
        return new Response(
          JSON.stringify({ python: false, error: String(e) }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    if (check === 'worker') {
      // Verifica se o Worker Contabo está online
      const workerUrl = Deno.env.get('WORKER_URL');
      const workerSecret = Deno.env.get('WORKER_SECRET');
      if (!workerUrl) return new Response(JSON.stringify({ worker: false, reason: 'WORKER_URL não configurado' }), { headers: corsHeaders });
      try {
        const res = await fetch(`${workerUrl}/health`, {
          headers: { 'x-worker-secret': workerSecret ?? '' },
          signal: AbortSignal.timeout(5000),
        });
        const data = await res.json();
        return new Response(JSON.stringify({ worker: true, ...data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      } catch (e) {
        return new Response(JSON.stringify({ worker: false, error: String(e) }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }
  }

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

    // ── MODO WORKER (Contabo) ──────────────────────────────────
    // Se WORKER_URL estiver configurado, despacha o job para o VPS.
    // O Worker processa de forma assíncrona e salva os clips diretamente
    // no Supabase Storage. Sem timeout, sem limitação de CPU.
    const workerUrl    = Deno.env.get('WORKER_URL');
    const workerSecret = Deno.env.get('WORKER_SECRET');

    if (workerUrl && workerSecret) {
      // Marca projeto como processing imediatamente
      await supabase.from('projects')
        .update({ status: 'processing' })
        .eq('id', project_id);

      // Despacha para o Worker — não espera o processamento terminar
      const workerRes = await fetch(`${workerUrl}/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-worker-secret': workerSecret,
        },
        body: JSON.stringify({ project_id, user_id }),
        signal: AbortSignal.timeout(10_000), // só aguarda o ACK (10s)
      });

      if (!workerRes.ok) {
        const errText = await workerRes.text();
        throw new Error(`Worker recusou o job: ${workerRes.status} — ${errText}`);
      }

      const ack = await workerRes.json();
      console.log('Worker ACK:', ack);

      return new Response(
        JSON.stringify({
          success: true,
          mode: 'worker',
          message: 'Job enviado para o Worker Contabo',
          worker_url: workerUrl,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── MODO LOCAL (fallback se WORKER_URL não configurado) ────
    await supabase.from('projects').update({ status: 'processing' }).eq('id', project_id);

    // ── 1. Buscar projeto ──────────────────────────────────────────
    const { data: project, error: projErr } = await supabase
      .from('projects').select('*').eq('id', project_id).single();
    if (projErr || !project) throw new Error('Projeto não encontrado');

    // ── 2. Verificar perfil e créditos ────────────────────────────
    const { data: profile } = await supabase
      .from('profiles').select('credits, plan').eq('id', user_id).single();
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
        throw new Error('Gravações do Zoom precisam ser baixadas manualmente.');
      } else if (isDrive) {
        const fileId = url.match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1];
        if (!fileId) throw new Error('ID do Google Drive não encontrado na URL');
        const key = Deno.env.get('GOOGLE_API_KEY');
        if (!key) throw new Error('GOOGLE_API_KEY não configurado');
        const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${key}`);
        if (!res.ok) throw new Error(`Google Drive download falhou: ${res.status}`);
        Deno.writeFileSync(videoPath, new Uint8Array(await res.arrayBuffer()));
        videoReady = true;
      } else {
        const ytArgs = isYouTube || isTwitch
          ? ['--no-playlist', '--format', 'bestvideo[height<=1080]+bestaudio/best[height<=1080]', '--merge-output-format', 'mp4', '--output', videoPath, url]
          : ['--no-playlist', '--format', 'mp4/best', '--output', videoPath, url];
        const { code } = await new Deno.Command('yt-dlp', { args: ytArgs }).output();
        if (code !== 0) throw new Error(`Falha ao baixar vídeo: ${url}`);
        videoReady = true;
      }
    }
    if (!videoReady) throw new Error('Nenhuma fonte de vídeo disponível');

    // ── 4. ffprobe: duração real ──────────────────────────────────
    let durationSeconds = 300;
    try {
      const { stdout } = await new Deno.Command('ffprobe', {
        args: ['-v', 'quiet', '-print_format', 'json', '-show_format', videoPath],
      }).output();
      durationSeconds = parseFloat(JSON.parse(new TextDecoder().decode(stdout)).format?.duration ?? '300');
    } catch (_) {}

    const creditCost = calcCreditCost(durationSeconds);
    if (profile.credits !== -1 && profile.credits < creditCost) {
      throw new Error(`Créditos insuficientes: precisa ${creditCost}, tem ${profile.credits}`);
    }
    await supabase.from('projects')
      .update({ duration_seconds: Math.round(durationSeconds) })
      .eq('id', project_id);

    // ── 5. Conversão de aspect ratio — prepara todos os formatos ──
    const primaryRatio = project.ratio || '9:16';
    const canMultiFormat = ['pro', 'business', 'ultra'].includes(profile.plan);
    const extraRatios: string[] = [];

    if (canMultiFormat) {
      if (primaryRatio !== '9:16') extraRatios.push('9:16');
      if (primaryRatio !== '1:1')  extraRatios.push('1:1');
    }

    const allRatios = [primaryRatio, ...extraRatios];
    const ratioSources = new Map<string, { videoPath: string; w: number; h: number }>();

    await Promise.all(allRatios.map(async (ratio) => {
      const cfg = ratioConfig(ratio);
      const convertedPath = path.join(tmpDir, `converted_${ratio.replace(':', 'x')}.mp4`);

      await new Promise<void>((resolve, reject) => {
        ffmpeg(videoPath)
          .outputOptions([
            `-vf ${cfg.scaleFilter}`,
            '-c:a copy',
            '-movflags +faststart',
          ])
          .output(convertedPath)
          .on('end', resolve)
          .on('error', (err: any) => {
            console.warn(`Conversão ${ratio} falhou:`, err.message);
            resolve();
          })
          .run();
      });

      try {
        const stat = await Deno.stat(convertedPath);
        if (stat.size > 10_000) {
          ratioSources.set(ratio, { videoPath: convertedPath, w: cfg.w, h: cfg.h });
        }
      } catch (_) {}
    }));

    if (!ratioSources.has(primaryRatio)) {
      const cfg = ratioConfig(primaryRatio);
      ratioSources.set(primaryRatio, { videoPath, w: cfg.w, h: cfg.h });
    }

    const sourceVideoPath = ratioSources.get(primaryRatio)!.videoPath;
    const { w: videoW, h: videoH } = ratioConfig(primaryRatio);
    const targetRatio = primaryRatio;

    // ── 5.5. Face tracking ────────────────────────────────────────
    //
    // Ativa para planos pagos. Processo:
    //   a) Extrai 1fps como JPEGs (máx 300 frames = 5 min)
    //   b) Python + YuNet/Haar detecta rostos por frame → JSON
    //   c) Smooth da trajetória (moving average 2.5s)
    //   d) No render, gera sendcmd.txt por clip → crop dinâmico FFmpeg
    //
    // Falha não cancela o processamento — usa scale+pad como fallback.
    // ─────────────────────────────────────────────────────────────

    const isPaid             = profile.plan !== 'free';
    const framesDir          = path.join(tmpDir, 'frames');
    const facesJsonPath      = path.join(tmpDir, 'faces.json');
    let   smoothedFaces: FacePoint[] = [];
    let   faceTrackEnabled   = false;

    if (isPaid) {
      try {
        const frameCount = await extractFramesForTracking(sourceVideoPath, framesDir, 300);
        console.log(`Face tracking: extraídos ${frameCount} frames`);

        if (frameCount > 2) {
          // ── Tenta Python primeiro, Vision API como fallback ──────
          let rawFaces: FacePoint[] = [];
          const hasPython = await pythonAvailable();

          if (hasPython) {
            console.log('Face tracking: usando Python/YuNet');
            rawFaces = await runFaceDetector(framesDir, facesJsonPath, videoW, videoH);
          }

          // Fallback Vision API se:
          //   a) Python não disponível, OU
          //   b) Python disponível mas não detectou rostos suficientes
          if (rawFaces.length < 3 && Deno.env.get('GOOGLE_API_KEY')) {
            const reason = hasPython
              ? `Python retornou ${rawFaces.length} rostos — tentando Vision API`
              : 'Python indisponível — usando Vision API';
            console.log(`Face tracking: ${reason}`);
            rawFaces = await detectFacesVisionAPI(framesDir, videoW, videoH);
          }

          if (rawFaces.length > 2) {
            smoothedFaces    = smoothTrack(rawFaces, 2.5);
            faceTrackEnabled = true;
            console.log(
              `Face tracking ativo: ${rawFaces.length} rostos, ` +
              `backend=${hasPython && rawFaces.length >= 3 ? 'python' : 'vision-api'}`
            );
          } else {
            console.log(`Face tracking: ${rawFaces.length} rostos insuficientes — scale+pad`);
          }
        } else {
          console.log('Face tracking: poucos frames — scale+pad');
        }
      } catch (ftErr) {
        // Face tracking é opcional — nunca cancela o job
        console.warn('Face tracking falhou (não crítico):', ftErr);
      }
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
        .on('end', resolve).on('error', reject);
    });

    // ── 7. Whisper: transcrição com timestamps por palavra ─────────
    const openai    = new OpenAI({ apiKey: Deno.env.get('OPENAI_API_KEY') });
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

    // ── 8. Silence detection + filler removal ─────────────────────
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

      console.log(`Cleanup: ${silencesRemoved} silêncios + ${fillersRemoved} fillers → ${secondsSaved}s`);

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

    const intentSection = hasIntent ? `
INTENÇÃO DO USUÁRIO (PRIORIDADE MÁXIMA):
"${userIntent}"

INSTRUÇÕES PARA A INTENÇÃO:
- Selecione APENAS momentos que correspondam diretamente à intenção acima
- Se a intenção especifica um tema (ex: "finanças"), inclua SOMENTE trechos sobre esse tema
- Se a intenção especifica uma emoção (ex: "engraçado"), inclua SOMENTE os momentos com essa emoção
- Se a intenção especifica um formato (ex: "apenas dados e estatísticas"), filtre rigorosamente
- Se não houver momentos suficientes que satisfaçam a intenção, inclua os mais próximos e reduza o count
- O campo "hook" deve descrever como este momento específico satisfaz a intenção do usuário
- NÃO inclua momentos que não se relacionem com a intenção, mesmo que sejam viralmente fortes
` : `
SEM INTENÇÃO ESPECÍFICA: selecione os ${maxClips} momentos mais virais do vídeo.
`;

    const claudePrompt = `Você é um especialista em conteúdo viral para redes sociais brasileiras (TikTok, Reels, Shorts).
Analise esta transcrição e selecione os melhores momentos para cortes virais.
${intentSection}
TRANSCRIÇÃO COMPLETA:
${cleanFullText}

TIMESTAMPS DAS PALAVRAS (use para calcular start_s e end_s precisos):
${JSON.stringify(activeWords.slice(0, 500))}

NICHO: ${project.niche || 'geral'}
DURAÇÃO ALVO: 30–90 segundos por corte
QUANTIDADE ALVO: ${hasIntent ? "até " + maxClips + " (pode ser menos se a intenção filtrar muito)" : maxClips}

Retorne SOMENTE um JSON array válido, sem markdown, sem texto antes ou depois:
[{
  "start_s": number,
  "end_s": number,
  "title": "título com até 60 chars e 1 emoji",
  "caption": "frase impactante com a palavra mais forte entre {chaves}",
  "hook": "${hasIntent ? 'como este momento satisfaz a intenção do usuário' : 'tipo do gancho'}",
  "score": number entre 0 e 100,
  "hashtags": ["#tag1","#tag2","#tag3","#tag4","#tag5"],
  "niche": "${project.niche || 'geral'}"
}]

Critérios de score alto: gancho nos 3s iniciais, dado surpreendente, emoção forte, pergunta curiosa.
Excluir: silêncios >5s, apresentações genéricas, frases incompletas.`;

    const claudeRes = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [{ role: 'user', content: claudePrompt }],
    });

    const rawJson = claudeRes.content[0].type === 'text' ? claudeRes.content[0].text : '';
    const jStart  = rawJson.indexOf('[');
    const jEnd    = rawJson.lastIndexOf(']');
    if (jStart === -1 || jEnd === -1) throw new Error('Claude não retornou JSON válido');

    const moments: Array<any> = JSON.parse(rawJson.substring(jStart, jEnd + 1));
    if (!moments.length) throw new Error('Nenhum momento selecionado pela IA');

    // ── 10. Render de cada clip ───────────────────────────────────
    const isFree = profile.plan === 'free';
    // ── B-roll setup (uma vez por projeto, fora do loop) ─────────
    const pexelsKey   = Deno.env.get('PEXELS_API_KEY') ?? '';
    const enableBroll = !isFree && pexelsKey.length > 0;

    // Dimensões do vídeo alvo (usadas para busca de orientação no Pexels)
    const [brollW, brollH] = (() => {
      const [rW, rH] = (project.ratio || '9:16').split(':').map(Number);
      if (!rW || !rH) return [1080, 1920];
      if (rH > rW)  return [1080, 1920]; // 9:16 portrait
      if (rW > rH)  return [1920, 1080]; // 16:9 landscape
      return [1080, 1080];               // 1:1 square
    })();

    let brollAppliedCount = 0;

    let successCount = 0;
    const momentsCount = moments.length;
    const formatsCount = allRatios.length;

    for (const moment of moments) {
      const clipWords = activeWords.filter(w =>
        w.start >= moment.start_s && w.end <= moment.end_s + 1
      );
      
      const transcriptData = (() => {
        const clipW = activeWords.filter(
          (w: Word) => w.start >= moment.start_s - 0.1 && w.end <= moment.end_s + 0.5
        );
        return clipW.map((w: Word) => ({
          w: w.word,
          s: parseFloat((w.start - moment.start_s).toFixed(3)),
          e: parseFloat((w.end   - moment.start_s).toFixed(3)),
        }));
      })();

      // ── B-roll setup (compartilhado entre formatos) ─────────────
      let planWithFiles: any = null;
      if (enableBroll) {
        try {
          const plan = await planBroll(
            clipWords,
            moment.end_s - moment.start_s,
            project.niche || 'geral',
            anthropic,
            2
          );
          if (plan.segments.length > 0) {
            planWithFiles = await downloadBrolls(
              plan,
              tmpDir,
              crypto.randomUUID(),
              brollW,
              brollH,
              pexelsKey
            );
            if (!planWithFiles.segments.some((s: any) => s.localPath)) {
              planWithFiles = null;
            }
          }
        } catch (brollErr) {
          console.warn(`B-roll setup falhou (não crítico):`, brollErr);
        }
      }

      const renderResults = await Promise.allSettled(
        allRatios.map(async (ratio) => {
          const src = ratioSources.get(ratio);
          if (!src) throw new Error(`Source não encontrado para ratio ${ratio}`);

          const clipId    = crypto.randomUUID();
          const clipPath  = path.join(tmpDir, `${clipId}.mp4`);
          const thumbPath = path.join(tmpDir, `${clipId}.jpg`);
          const srtPath   = path.join(tmpDir, `${clipId}.srt`);
          
          Deno.writeTextFileSync(srtPath, wordsToSrt(clipWords));

          let vfFilter: string;
          const isPrimaryRatio = ratio === primaryRatio;

          if (isPrimaryRatio && faceTrackEnabled && smoothedFaces.length > 0) {
            const sendcmdPath = path.join(tmpDir, `sendcmd_${clipId}.txt`);
            const hasSendcmd  = await writeSendcmd(
              smoothedFaces,
              sendcmdPath,
              src.w, src.h,
              targetRatio,
              moment.start_s,
              moment.end_s
            );

            if (hasSendcmd) {
              vfFilter = [
                `sendcmd=f=${sendcmdPath}`,
                `crop=iw:ih:0:0`,
                `scale=${src.w}:${src.h}:force_original_aspect_ratio=decrease`,
                `pad=${src.w}:${src.h}:(ow-iw)/2:(oh-ih)/2:black`,
                `setsar=1`,
                buildSubtitleFilter(srtPath, project.caption_style || 'hormozi', isFree),
              ].join(',');
            } else {
              vfFilter = buildSubtitleFilter(srtPath, project.caption_style || 'hormozi', isFree);
            }
          } else {
            vfFilter = buildSubtitleFilter(srtPath, project.caption_style || 'hormozi', isFree);
          }

          let brollSuccess = false;
          if (planWithFiles) {
            brollSuccess = await renderWithBroll(
              src.videoPath,
              srtPath,
              planWithFiles,
              moment.start_s,
              moment.end_s,
              src.w,
              src.h,
              vfFilter,
              clipPath,
              tmpDir,
              clipId
            );
            if (brollSuccess && isPrimaryRatio) {
              brollAppliedCount++;
            }
          }

          if (!brollSuccess) {
            await new Promise<void>((resolve, reject) => {
              ffmpeg(src.videoPath)
                .setStartTime(moment.start_s)
                .setDuration(moment.end_s - moment.start_s)
                .outputOptions([
                  `-vf ${vfFilter}`,
                  '-c:a aac', '-b:a 128k', '-movflags +faststart',
                ])
                .output(clipPath)
                .on('end', resolve)
                .on('error', reject)
                .run();
            });
          }

          let thumbnailUrl: string | null = null;
          if (isPrimaryRatio) {
            await new Promise<void>((resolve, reject) => {
              ffmpeg(clipPath)
                .setStartTime(Math.min(2, (moment.end_s - moment.start_s) * 0.15))
                .frames(1)
                .output(thumbPath)
                .on('end', resolve)
                .on('error', reject)
                .run();
            });

            try {
              const thumbStorage = `${user_id}/${project_id}/${clipId}.jpg`;
              await supabase.storage.from('clips').upload(
                thumbStorage, Deno.readFileSync(thumbPath), { contentType: 'image/jpeg' }
              );
              const { data: { publicUrl } } = supabase.storage.from('clips').getPublicUrl(thumbStorage);
              thumbnailUrl = publicUrl;
            } catch (_) {}
          }

          const storagePath = `${user_id}/${project_id}/${clipId}.mp4`;
          await supabase.storage.from('clips').upload(
            storagePath, Deno.readFileSync(clipPath), { contentType: 'video/mp4' }
          );

          const titleSuffix = ratio === primaryRatio ? '' : ` · ${ratio}`;

          await supabase.from('clips').insert({
            id:                    clipId,
            project_id,
            user_id,
            title:                 moment.title + titleSuffix,
            caption:               moment.caption,
            hashtags:              moment.hashtags,
            niche:                 moment.niche,
            start_s:               moment.start_s,
            end_s:                 moment.end_s,
            duration:              Math.round(moment.end_s - moment.start_s),
            score:                 moment.score,
            hook:                  moment.hook,
            storage_path:          storagePath,
            thumbnail_url:         thumbnailUrl,
            caption_style:         project.caption_style || 'hormozi',
            ratio:                 ratio,
            status:                'rendered',
            transcript:            transcriptData,
            silences_removed:      isPaid ? silencesRemoved : 0,
            fillers_removed:       isPaid ? fillersRemoved  : 0,
            seconds_saved:         isPaid ? secondsSaved    : 0,
            face_tracking_applied: isPrimaryRatio ? faceTrackEnabled : false,
            broll_applied:         brollSuccess,
          });

          return { clipId, ratio };
        })
      );

      const successThisRound = renderResults.filter(r => r.status === 'fulfilled').length;
      if (successThisRound > 0) successCount += successThisRound;

      renderResults.forEach((result: any, i: number) => {
        if (result.status === 'rejected') {
          console.error(`Render falhou: momento ${moment.title}, ratio ${allRatios[i]}:`, result.reason);
        }
      });
    }

    if (successCount === 0) throw new Error('Nenhum corte renderizado com sucesso');

    // ── 11. Update projeto ────────────────────────────────────────
    await supabase.from('projects').update({
      status:                  'ready',
      clips_count:             successCount,
      silence_removal_applied: isPaid && silencesRemoved > 0,
      filler_removal_applied:  isPaid && fillersRemoved  > 0,
      total_seconds_saved:     isPaid ? secondsSaved : 0,
      formats_rendered:        formatsCount,
      face_tracking_applied:   faceTrackEnabled,
    }).eq('id', project_id);

    // ── 12. Decremento de créditos ────────────────────────────────
    const { error: rpcErr } = await supabase.rpc('decrement_credits', {
      user_id_param: user_id,
      amount: creditCost,
    });
    if (rpcErr) {
      if (profile.credits !== -1) {
        await supabase.from('profiles')
          .update({ credits: Math.max(0, profile.credits - creditCost) })
          .eq('id', user_id);
      }
    }

    // ── 13. Notificação ───────────────────────────────────────────
    const extras: string[] = [];
    if (isPaid && secondsSaved > 0)   extras.push(`${secondsSaved}s removidos ✂️`);
    if (faceTrackEnabled)              extras.push('câmera inteligente 🎯');
    if (brollAppliedCount > 0)         extras.push(`${brollAppliedCount} clips com B-roll 🎥`);
    if (formatsCount > 1)              extras.push(`${formatsCount} formatos: ${allRatios.join(' + ')}`);

    await supabase.from('notifications').insert({
      user_id,
      type:       'processing_done',
      title:      `${successCount} cortes prontos! 🎬`,
      body:       `"${project.title}" processado.${extras.length ? ' • ' + extras.join(' • ') : ''}`,
      action_url: `/clips?project=${project_id}`,
    });

    if (tmpDir) {
      try { await Deno.remove(tmpDir, { recursive: true }); } catch (_) {}
    }

    return new Response(
      JSON.stringify({
        success:          true,
        clips_count:      successCount,
        moments_count:    momentsCount,
        formats_rendered: formatsCount,
        ratios:           allRatios,
        credit_cost:      creditCost,
        silences_removed: silencesRemoved,
        fillers_removed:  fillersRemoved,
        seconds_saved:    secondsSaved,
        face_tracking_applied: faceTrackEnabled,
        broll_applied_count: brollAppliedCount,
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
      try { await Deno.remove(tmpDir, { recursive: true }); } catch (_) {}
    }
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
