import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import ffmpeg from "npm:fluent-ffmpeg";
import path from "node:path";

// trim-clip — re-renderiza um clip removendo intervalos de tempo específicos
//
// Recebe:
//   clip_id      : string  — UUID do clip na tabela clips
//   removals     : Array<{ s: number, e: number }>
//                  Intervalos em segundos RELATIVOS ao início do clip
//                  que devem ser removidos.
//
// Fluxo:
//   1. Baixa o MP4 original do bucket clips
//   2. Aplica FFmpeg select filter para remover os intervalos
//   3. Gera novo thumbnail no frame 2s
//   4. Faz upload do novo MP4 (sobrescreve) e do thumbnail
//   5. Atualiza clips.duration, clips.transcript (reindexado) e clips.status
//   6. Retorna { success, new_duration, removed_seconds }

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type TWord = { w: string; s: number; e: number };
type Removal = { s: number; e: number };

// Recalcula timestamps das words após cortes
function reindexWords(words: TWord[], removals: Removal[]): TWord[] {
  const sorted = [...removals].sort((a, b) => a.s - b.s);
  return words
    .filter(w => !sorted.some(r => w.s >= r.s && w.e <= r.e + 0.05))
    .map(w => {
      const shift = sorted
        .filter(r => r.e <= w.s)
        .reduce((acc, r) => acc + (r.e - r.s), 0);
      return { w: w.w, s: parseFloat((w.s - shift).toFixed(3)), e: parseFloat((w.e - shift).toFixed(3)) };
    });
}

// Inverte removals → lista de segmentos a manter
function buildKeepSegments(
  removals: Removal[],
  totalDuration: number
): Array<{ start: number; end: number }> {
  const sorted = [...removals].sort((a, b) => a.s - b.s);
  const keeps: Array<{ start: number; end: number }> = [];
  let cursor = 0;
  for (const r of sorted) {
    if (r.s > cursor + 0.05) keeps.push({ start: cursor, end: r.s });
    cursor = r.e;
  }
  if (cursor < totalDuration - 0.05) keeps.push({ start: cursor, end: totalDuration });
  return keeps;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  let tmpDir: string | null = null;

  try {
    // ── Auth ──────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization') ?? '';
    const { data: { user }, error: authErr } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401, headers: cors });
    }

    // ── Payload ───────────────────────────────────────────────────
    const { clip_id, removals } = await req.json() as {
      clip_id: string;
      removals: Removal[];
    };

    if (!clip_id)              throw new Error('clip_id é obrigatório');
    if (!removals?.length)     throw new Error('removals não pode ser vazio');
    if (removals.length > 200) throw new Error('Máximo de 200 remoções por chamada');

    // Valida que cada remoção tem s < e e duração mínima de 0.05s
    for (const r of removals) {
      if (typeof r.s !== 'number' || typeof r.e !== 'number') throw new Error('Remoção inválida: s e e devem ser números');
      if (r.s >= r.e) throw new Error(`Remoção inválida: s(${r.s}) >= e(${r.e})`);
      if (r.e - r.s < 0.05) throw new Error('Remoção muito curta (mín 50ms)');
    }

    // ── Busca clip ────────────────────────────────────────────────
    const { data: clip, error: clipErr } = await supabase
      .from('clips')
      .select('id, user_id, storage_path, duration, transcript, project_id')
      .eq('id', clip_id)
      .single();

    if (clipErr || !clip) throw new Error('Clip não encontrado');
    if (clip.user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Acesso negado' }), { status: 403, headers: cors });
    }
    if (!clip.storage_path) throw new Error('Clip sem storage_path');

    const totalDuration = clip.duration ?? 60;

    // ── Valida que removals não excedem a duração ─────────────────
    const totalRemoved = removals.reduce((acc, r) => acc + (r.e - r.s), 0);
    if (totalRemoved >= totalDuration - 1) {
      throw new Error('As remoções eliminariam o clip inteiro (mín 1s restante)');
    }

    // ── Download do clip original ─────────────────────────────────
    const { data: videoBlob, error: dlErr } = await supabase.storage
      .from('clips')
      .download(clip.storage_path);
    if (dlErr || !videoBlob) throw new Error(`Falha ao baixar clip: ${dlErr?.message}`);

    tmpDir = await Deno.makeTempDir();
    const inputPath  = path.join(tmpDir, 'input.mp4');
    const outputPath = path.join(tmpDir, 'output.mp4');
    const thumbPath  = path.join(tmpDir, 'thumb.jpg');

    Deno.writeFileSync(inputPath, new Uint8Array(await videoBlob.arrayBuffer()));

    // ── Monta segmentos de keep ───────────────────────────────────
    const keeps = buildKeepSegments(removals, totalDuration);
    if (!keeps.length) throw new Error('Nenhum segmento de vídeo restante após remoções');

    // ── FFmpeg: remove intervalos via select filter ───────────────
    const selectExpr = keeps
      .map(k => `between(t,${k.start.toFixed(3)},${k.end.toFixed(3)})`)
      .join('+');

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
        .on('end', resolve)
        .on('error', reject)
        .run();
    });

    // Verifica integridade
    const stat = await Deno.stat(outputPath);
    if (stat.size < 10_000) throw new Error('Output corrompido (< 10KB)');

    // ── Calcula nova duração via ffprobe ──────────────────────────
    let newDuration = totalDuration - totalRemoved;
    try {
      const { stdout } = await new Deno.Command('ffprobe', {
        args: ['-v', 'quiet', '-print_format', 'json', '-show_format', outputPath]
      }).output();
      const info = JSON.parse(new TextDecoder().decode(stdout));
      newDuration = parseFloat(info.format?.duration ?? String(newDuration));
    } catch (_) { /* usa estimativa */ }

    // ── Gera novo thumbnail ───────────────────────────────────────
    await new Promise<void>((resolve) => {
      ffmpeg(outputPath)
        .setStartTime(Math.min(2, newDuration * 0.1))
        .frames(1)
        .output(thumbPath)
        .on('end', resolve)
        .on('error', resolve) // thumbnail não é crítico
        .run();
    });

    // ── Upload: sobrescreve o clip no bucket ──────────────────────
    const { error: uploadErr } = await supabase.storage
      .from('clips')
      .upload(clip.storage_path, Deno.readFileSync(outputPath), {
        contentType: 'video/mp4',
        upsert: true,
      });
    if (uploadErr) throw new Error(`Upload falhou: ${uploadErr.message}`);

    // Upload do thumbnail (melhor esforço)
    let newThumbUrl: string | null = null;
    try {
      const thumbExistsCheck = await Deno.stat(thumbPath);
      if (thumbExistsCheck.size > 1000) {
        const thumbStoragePath = clip.storage_path.replace('.mp4', '_thumb.jpg');
        await supabase.storage.from('clips').upload(
          thumbStoragePath, Deno.readFileSync(thumbPath),
          { contentType: 'image/jpeg', upsert: true }
        );
        const { data: { publicUrl } } = supabase.storage.from('clips').getPublicUrl(thumbStoragePath);
        newThumbUrl = publicUrl;
      }
    } catch (_) { /* thumbnail opcional */ }

    // ── Reindexar transcript ──────────────────────────────────────
    const existingTranscript: TWord[] = Array.isArray(clip.transcript) ? clip.transcript : [];
    const newTranscript = reindexWords(existingTranscript, removals);

    // ── Update no banco ───────────────────────────────────────────
    const updatePayload: Record<string, unknown> = {
      duration:   Math.round(newDuration),
      transcript: newTranscript,
      status:     'rendered',
    };
    if (newThumbUrl) updatePayload.thumbnail_url = newThumbUrl;

    const { error: updateErr } = await supabase
      .from('clips')
      .update(updatePayload)
      .eq('id', clip_id);

    if (updateErr) throw new Error(`Update falhou: ${updateErr.message}`);

    return new Response(
      JSON.stringify({
        success:         true,
        new_duration:    Math.round(newDuration),
        removed_seconds: parseFloat(totalRemoved.toFixed(1)),
        words_remaining: newTranscript.length,
      }),
      { headers: { ...cors, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('trim-clip error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  } finally {
    if (tmpDir) {
      try { await Deno.remove(tmpDir, { recursive: true }); } catch (_) {}
    }
  }
});
