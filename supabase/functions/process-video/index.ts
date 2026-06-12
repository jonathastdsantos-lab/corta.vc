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
// SERVE — PIPELINE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // ── Health check: verifica se Python + OpenCV estão disponíveis ──
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

    // ── 5. Conversão de aspect ratio ──────────────────────────────
    const targetRatio = project.ratio || '9:16';
    const [rW, rH] = targetRatio.split(':').map(Number);
    let sourceVideoPath = videoPath;
    let videoW = 1080;
    let videoH = 1920;

    if (rW && rH) {
      videoW = rH > rW ? 1080 : 1920;
      videoH = rH > rW ? 1920 : 1080;
      if (rW === rH) { videoW = 1080; videoH = 1080; }

      const scaleFilter  = `scale=${videoW}:${videoH}:force_original_aspect_ratio=decrease,pad=${videoW}:${videoH}:(ow-iw)/2:(oh-ih)/2:black`;
      const convertedPath = path.join(tmpDir, 'converted.mp4');
      await new Promise<void>((resolve, reject) => {
        ffmpeg(videoPath)
          .outputOptions([`-vf ${scaleFilter}`, '-c:a copy', '-movflags +faststart'])
          .output(convertedPath)
          .on('end', resolve).on('error', reject).run();
      });
      sourceVideoPath = convertedPath;
    }

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
    const anthropic    = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });
    const maxClips     = Math.min(15, Math.max(5, Math.floor(durationSeconds / 180)));
    const cleanFullText = activeWords.map(w => w.word).join(' ');

    const claudePrompt = `Você é um especialista em conteúdo viral para redes sociais brasileiras (TikTok, Reels, Shorts).
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
    let successCount = 0;

    for (const moment of moments) {
      const clipId    = crypto.randomUUID();
      const clipPath  = path.join(tmpDir, `${clipId}.mp4`);
      const thumbPath = path.join(tmpDir, `${clipId}.jpg`);
      const srtPath   = path.join(tmpDir, `${clipId}.srt`);

      try {
        const clipWords = activeWords.filter(w => w.start >= moment.start_s && w.end <= moment.end_s + 1);
        Deno.writeTextFileSync(srtPath, wordsToSrt(clipWords));

        // ── Monta o -vf: face tracking + legendas ──────────────────
        let vfFilter: string;

        if (faceTrackEnabled && smoothedFaces.length > 0) {
          // Gera sendcmd.txt específico para este clip (timestamps relativos ao início)
          const sendcmdPath = path.join(tmpDir, `sendcmd_${clipId}.txt`);
          const hasSendcmd  = await writeSendcmd(
            smoothedFaces,
            sendcmdPath,
            videoW, videoH,
            targetRatio,
            moment.start_s,
            moment.end_s
          );

          if (hasSendcmd) {
            // Filtro completo:
            //   1. sendcmd aplica crop dinâmico baseado no rosto
            //   2. scale normaliza para resolução alvo
            //   3. setsar garante SAR 1:1 após crop
            //   4. subtitles renderiza legendas
            vfFilter = [
              `sendcmd=f=${sendcmdPath}`,
              `crop=iw:ih:0:0`,                             // crop inicial "neutro" (atualizado pelo sendcmd)
              `scale=${videoW}:${videoH}:force_original_aspect_ratio=decrease`,
              `pad=${videoW}:${videoH}:(ow-iw)/2:(oh-ih)/2:black`,
              `setsar=1`,
              buildSubtitleFilter(srtPath, project.caption_style || 'hormozi', isFree),
            ].join(',');
          } else {
            // Menos de 2 keyframes no clip — usa scale+pad normal
            vfFilter = buildSubtitleFilter(srtPath, project.caption_style || 'hormozi', isFree);
          }
        } else {
          // Sem face tracking — comportamento existente
          vfFilter = buildSubtitleFilter(srtPath, project.caption_style || 'hormozi', isFree);
        }

        await new Promise<void>((resolve, reject) => {
          ffmpeg(activeVideoPath)
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

        await new Promise<void>((resolve, reject) => {
          ffmpeg(clipPath)
            .setStartTime(Math.min(2, (moment.end_s - moment.start_s) * 0.15))
            .frames(1)
            .output(thumbPath)
            .on('end', resolve).on('error', reject).run();
        });

        const storagePath = `${user_id}/${project_id}/${clipId}.mp4`;
        await supabase.storage.from('clips').upload(
          storagePath, Deno.readFileSync(clipPath), { contentType: 'video/mp4' }
        );

        let thumbnailUrl: string | null = null;
        try {
          const thumbStorage = `${user_id}/${project_id}/${clipId}.jpg`;
          await supabase.storage.from('clips').upload(
            thumbStorage, Deno.readFileSync(thumbPath), { contentType: 'image/jpeg' }
          );
          const { data: { publicUrl } } = supabase.storage.from('clips').getPublicUrl(thumbStorage);
          thumbnailUrl = publicUrl;
        } catch (_) {}

        await supabase.from('clips').insert({
          id:                      clipId,
          project_id,
          user_id,
          title:                   moment.title,
          caption:                 moment.caption,
          hashtags:                moment.hashtags,
          niche:                   moment.niche,
          start_s:                 moment.start_s,
          end_s:                   moment.end_s,
          duration:                Math.round(moment.end_s - moment.start_s),
          score:                   moment.score,
          hook:                    moment.hook,
          storage_path:            storagePath,
          thumbnail_url:           thumbnailUrl,
          caption_style:           project.caption_style || 'hormozi',
          status:                  'rendered',
          silences_removed:        isPaid ? silencesRemoved : 0,
          fillers_removed:         isPaid ? fillersRemoved  : 0,
          seconds_saved:           isPaid ? secondsSaved    : 0,
          face_tracking_applied:   faceTrackEnabled,
          transcript:              clipWords.map(w => ({
            w: w.word,
            s: parseFloat((w.start - moment.start_s).toFixed(3)),
            e: parseFloat((w.end   - moment.start_s).toFixed(3)),
          })),
        });

        successCount++;
      } catch (clipErr) {
        console.error(`Erro no clip ${clipId}:`, clipErr);
      }
    }

    if (successCount === 0) throw new Error('Nenhum corte renderizado com sucesso');

    // ── 11. Update projeto ────────────────────────────────────────
    await supabase.from('projects').update({
      status:                  'ready',
      clips_count:             successCount,
      silence_removal_applied: isPaid && silencesRemoved > 0,
      filler_removal_applied:  isPaid && fillersRemoved  > 0,
      total_seconds_saved:     isPaid ? secondsSaved : 0,
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
    if (isPaid && secondsSaved > 0) extras.push(`${secondsSaved}s removidos ✂️`);
    if (faceTrackEnabled)           extras.push('câmera inteligente ativada 🎯');

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
        success:              true,
        clips_count:          successCount,
        credit_cost:          creditCost,
        silences_removed:     silencesRemoved,
        fillers_removed:      fillersRemoved,
        seconds_saved:        secondsSaved,
        face_tracking_applied: faceTrackEnabled,
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
