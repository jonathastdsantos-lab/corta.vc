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

// Custo dinâmico baseado na duração do vídeo
function calcCreditCost(durationSeconds: number): number {
  if (durationSeconds <= 1800) return 5;   // até 30min
  if (durationSeconds <= 3600) return 10;  // 30–60min
  if (durationSeconds <= 7200) return 20;  // 1–2h
  return 40;                               // acima de 2h
}

// Converte array de palavras Whisper para formato SRT
function wordsToSrt(words: Array<any>): string {
  let srt = '';
  let idx = 1;
  const WORDS_PER_LINE = 4;
  for (let i = 0; i < words.length; i += WORDS_PER_LINE) {
    const chunk = words.slice(i, i + WORDS_PER_LINE);
    if (!chunk.length) continue;
    const fmt = (s: number) => new Date(s * 1000).toISOString().substr(11, 12).replace('.', ',');
    srt += `${idx}\n${fmt(chunk[0].start)} --> ${fmt(chunk[chunk.length-1].end)}\n${chunk.map(w => w.word).join(' ')}\n\n`;
    idx++;
  }
  return srt;
}

function buildSubtitleFilter(srtPath: string, style: string, isFree: boolean): string {
  const watermark = isFree
    ? `,drawtext=text='corta.vc':fontcolor=white@0.6:fontsize=20:x=w-tw-16:y=h-th-16:shadowcolor=black:shadowx=1:shadowy=1`
    : '';

  const STYLES: Record<string, string> = {
    hormozi:  `FontName=Arial,FontSize=28,Bold=1,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,Outline=2,Shadow=1,Uppercase=1,Alignment=10`,
    clean:    `FontName=Arial,FontSize=22,Bold=1,PrimaryColour=&H00FFFFFF,Outline=0,Shadow=0,Alignment=2`,
    karaoke:  `FontName=Arial,FontSize=26,Bold=1,PrimaryColour=&H00FFFFFF,OutlineColour=&H00E8543B,Outline=3,Shadow=1,Uppercase=1,Alignment=10`,
    minimal:  `FontName=Arial,FontSize=22,Bold=0,PrimaryColour=&H00FFFFFF,BackColour=&H80000000,BorderStyle=4,Outline=0,Alignment=2`,
    neon:     `FontName=Arial,FontSize=28,Bold=1,PrimaryColour=&H00FFFFFF,OutlineColour=&H005EF1FF,Outline=3,Shadow=2,Uppercase=1,Alignment=10`,
    'bold-bar': `FontName=Arial,FontSize=26,Bold=1,PrimaryColour=&H00111111,BackColour=&H00E8543B,BorderStyle=4,Outline=0,Uppercase=1,Alignment=2`,
  };

  const styleParams = STYLES[style] || STYLES['hormozi'];
  return `subtitles=${srtPath}:force_style='${styleParams}'${watermark}`;
}

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

    // Marca início do processamento
    await supabase.from('projects').update({ status: 'processing' }).eq('id', project_id);

    // 1. Buscar projeto
    const { data: project, error: projErr } = await supabase
      .from('projects').select('*').eq('id', project_id).single();
    if (projErr || !project) throw new Error('Projeto não encontrado');

    // 2. Verificar perfil e créditos
    const { data: profile } = await supabase
      .from('profiles').select('credits, plan').eq('id', user_id).single();
    if (!profile) throw new Error('Perfil não encontrado');

    tmpDir = await Deno.makeTempDir();
    const videoPath = path.join(tmpDir, 'input.mp4');
    let videoReady = false;

    // 3a. Download por storage_path (upload direto)
    if (project.storage_path) {
      const { data: videoBlob, error: dlErr } = await supabase.storage
        .from('videos').download(project.storage_path);
      if (dlErr || !videoBlob) throw new Error('Falha ao baixar vídeo do storage');
      Deno.writeFileSync(videoPath, new Uint8Array(await videoBlob.arrayBuffer()));
      videoReady = true;
    }
    // 3b. Download por source_url (YouTube, Drive, Twitch)
    else if (project.source_url) {
      const isYouTube = project.source_url.includes('youtube.com') || project.source_url.includes('youtu.be');
      if (isYouTube) {
        // yt-dlp via subprocess
        const ytCmd = new Deno.Command('yt-dlp', {
          args: [
            '--no-playlist',
            '--format', 'bestvideo[height<=1080]+bestaudio/best[height<=1080]',
            '--merge-output-format', 'mp4',
            '--output', videoPath,
            project.source_url
          ]
        });
        const { code } = await ytCmd.output();
        if (code !== 0) throw new Error('Falha ao baixar vídeo do YouTube');
        videoReady = true;
      } else if (project.source_url.includes('drive.google.com')) {
        // Extrai file ID do link
        const driveMatch = project.source_url.match(/\/d\/([a-zA-Z0-9_-]+)/);
        const fileId = driveMatch?.[1];
        if (!fileId) throw new Error('Não foi possível extrair o ID do arquivo do Google Drive');
        
        const driveApiKey = Deno.env.get('GOOGLE_API_KEY');
        if (!driveApiKey) throw new Error('GOOGLE_API_KEY não configurado para Drive');
        
        const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${driveApiKey}`;
        const driveRes = await fetch(downloadUrl);
        if (!driveRes.ok) throw new Error(`Google Drive download falhou: ${driveRes.status}. O arquivo precisa ser público.`);
        
        Deno.writeFileSync(videoPath, new Uint8Array(await driveRes.arrayBuffer()));
        videoReady = true;
      } else if (project.source_url.includes('twitch.tv/videos/')) {
        const vodMatch = project.source_url.match(/videos\/(\d+)/);
        const vodId = vodMatch?.[1];
        if (!vodId) throw new Error('ID do VOD Twitch não encontrado na URL');
        
        // yt-dlp suporta Twitch com a mesma sintaxe do YouTube
        const twitchCmd = new Deno.Command('yt-dlp', {
          args: [
            '--no-playlist',
            '--format', 'bestvideo[height<=1080]+bestaudio/best[height<=1080]',
            '--merge-output-format', 'mp4',
            '--output', videoPath,
            project.source_url
          ]
        });
        const { code: twitchCode } = await twitchCmd.output();
        if (twitchCode !== 0) throw new Error('Falha ao baixar VOD do Twitch via yt-dlp');
        videoReady = true;
      } else if (project.source_url.includes('zoom.us/rec/') || project.source_url.includes('zoom.us/share/')) {
        throw new Error('Gravações do Zoom precisam ser baixadas manualmente e enviadas via upload. Links do Zoom requerem autenticação.');
      } else {
        // Fallback: tenta com yt-dlp que suporta 1000+ plataformas
        console.log(`Tentando yt-dlp para URL: ${project.source_url}`);
        const genericCmd = new Deno.Command('yt-dlp', {
          args: ['--no-playlist', '--format', 'mp4/best', '--output', videoPath, project.source_url]
        });
        const { code: genericCode } = await genericCmd.output();
        if (genericCode !== 0) throw new Error(`Fonte não suportada: ${project.source_url}`);
        videoReady = true;
      }
    }

    if (!videoReady) throw new Error('Nenhuma fonte de vídeo disponível');

    // 4. Obter duração real do vídeo com ffprobe
    let durationSeconds = 300; // fallback 5min
    try {
      const ffprobe = new Deno.Command('ffprobe', {
        args: ['-v', 'quiet', '-print_format', 'json', '-show_format', videoPath]
      });
      const { stdout } = await ffprobe.output();
      const info = JSON.parse(new TextDecoder().decode(stdout));
      durationSeconds = parseFloat(info.format?.duration ?? '300');
    } catch (e) { console.warn('ffprobe falhou, usando fallback de duração'); }

    // Verificar créditos após saber a duração real
    const creditCost = calcCreditCost(durationSeconds);
    if (profile.credits !== -1 && profile.credits < creditCost) {
      throw new Error(`Créditos insuficientes: precisa de ${creditCost}, tem ${profile.credits}`);
    }

    // Salvar duração no projeto
    await supabase.from('projects').update({ duration_seconds: Math.round(durationSeconds) }).eq('id', project_id);

    // Converte vídeo para o ratio solicitado (default 9:16 para mobile)
    const targetRatio = project.ratio || '9:16';
    const convertedPath = path.join(tmpDir, 'converted.mp4');

    const [rW, rH] = targetRatio.split(':').map(Number);
    let scaleFilter = '';
    if (rW && rH) {
      // Padding para manter aspect ratio sem cortar
      // Para 9:16: scala para largura 1080, adiciona barras laterais se necessário
      const targetW = rH > rW ? 1080 : 1920;
      const targetH = rH > rW ? 1920 : 1080;
      scaleFilter = `scale=${targetW}:${targetH}:force_original_aspect_ratio=decrease,pad=${targetW}:${targetH}:(ow-iw)/2:(oh-ih)/2:black`;
    }

    if (scaleFilter) {
      await new Promise<void>((resolve, reject) => {
        ffmpeg(videoPath)
          .outputOptions([`-vf ${scaleFilter}`, '-c:a copy', '-movflags +faststart'])
          .output(convertedPath)
          .on('end', resolve)
          .on('error', reject)
          .run();
      });
    }
    const sourceVideoPath = scaleFilter ? convertedPath : videoPath;

    // 5. Extrair áudio para Whisper
    const audioPath = path.join(tmpDir, 'audio.mp3');
    await new Promise((resolve, reject) => {
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

    // 6. Transcrição Whisper
    const openai = new OpenAI({ apiKey: Deno.env.get('OPENAI_API_KEY') });
    const audioFile = new File([Deno.readFileSync(audioPath)], 'audio.mp3', { type: 'audio/mpeg' });
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      response_format: 'verbose_json',
      timestamp_granularities: ['word'],
      language: (['pt','en','es','fr','de','it','ja','ko','zh'].includes(project.lang)
  ? project.lang
  : 'pt')
    });

    const words = transcription.words ?? [];
    const fullText = transcription.text;

    if (!fullText || fullText.trim().length < 50) {
      throw new Error('Transcrição muito curta ou sem fala detectada');
    }

    // 7. Claude seleciona os melhores momentos
    // MODELO ATUALIZADO: claude-sonnet-4-6 (mais rápido e mais barato que opus)
    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });

    const maxClips = Math.min(15, Math.max(5, Math.floor(durationSeconds / 180)));
    const prompt = `Você é um especialista em conteúdo viral para redes sociais brasileiras (TikTok, Reels, Shorts).
Analise esta transcrição e selecione os ${maxClips} melhores momentos para cortes virais.

TRANSCRIÇÃO COMPLETA:
${fullText}

TIMESTAMPS DAS PALAVRAS (use para calcular start_s e end_s precisos):
${JSON.stringify(words.slice(0, 500))}

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
      messages: [{ role: 'user', content: prompt }]
    });

    const rawJson = claudeRes.content[0].type === 'text' ? claudeRes.content[0].text : '';
    const jsonStart = rawJson.indexOf('[');
    const jsonEnd = rawJson.lastIndexOf(']');
    if (jsonStart === -1 || jsonEnd === -1) throw new Error('Claude não retornou JSON válido');

    const moments: Array<any> = JSON.parse(rawJson.substring(jsonStart, jsonEnd + 1));

    if (!moments.length) throw new Error('Nenhum momento selecionado pela IA');

    // 8. Renderizar cada corte
    const isFree = profile.plan === 'free';
    let successCount = 0;

    for (const moment of moments) {
      const clipId = crypto.randomUUID();
      const clipPath = path.join(tmpDir, `${clipId}.mp4`);
      const thumbPath = path.join(tmpDir, `${clipId}.jpg`);
      const srtPath = path.join(tmpDir, `${clipId}.srt`);

      try {
        // Filtra palavras do trecho
        const clipWords = words.filter((w: any) => w.start >= moment.start_s && w.end <= moment.end_s + 1);
        Deno.writeTextFileSync(srtPath, wordsToSrt(clipWords));

        const watermark = isFree;

        // Render com legendas
        await new Promise((resolve, reject) => {
          ffmpeg(sourceVideoPath)
            .setStartTime(moment.start_s)
            .setDuration(moment.end_s - moment.start_s)
            .outputOptions([
              `-vf ${buildSubtitleFilter(srtPath, project.caption_style || 'hormozi', isFree)}`,
              '-c:a aac', '-b:a 128k', '-movflags +faststart'
            ])
            .output(clipPath)
            .on('end', resolve)
            .on('error', reject)
            .run();
        });

        // Thumbnail no frame 2s
        await new Promise((resolve, reject) => {
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
        } catch (e) { console.warn('Thumbnail upload falhou:', e); }

        // Inserir clip no banco
        await supabase.from('clips').insert({
          id: clipId,
          project_id,
          user_id,
          title: moment.title,
          caption: moment.caption,
          hashtags: moment.hashtags,
          niche: moment.niche,
          start_s: moment.start_s,
          end_s: moment.end_s,
          duration: Math.round(moment.end_s - moment.start_s),
          score: moment.score,
          hook: moment.hook,
          storage_path: storagePath,
          thumbnail_url: thumbnailUrl,
          caption_style: project.caption_style || 'hormozi',
          status: 'rendered'
        });

        successCount++;
      } catch (clipErr) {
        console.error(`Erro no clip ${clipId}:`, clipErr);
        // Continua para o próximo clip sem abortar tudo
      }
    }

    if (successCount === 0) throw new Error('Nenhum corte foi renderizado com sucesso');

    // 9. Atualizar projeto
    await supabase.from('projects').update({
      status: 'ready',
      clips_count: successCount
    }).eq('id', project_id);

    // 10. Decrementar créditos atomicamente
    const { error: rpcErr } = await supabase.rpc('decrement_credits', {
      user_id_param: user_id,
      amount: creditCost
    });
    if (rpcErr) {
      console.warn('RPC decrement_credits falhou, usando fallback:', rpcErr);
      if (profile.credits !== -1) {
        await supabase.from('profiles')
          .update({ credits: Math.max(0, profile.credits - creditCost) })
          .eq('id', user_id);
      }
    }

    // 11. Criar notificação para o usuário
    await supabase.from('notifications').insert({
      user_id,
      type: 'processing_done',
      title: `${successCount} cortes prontos! 🎬`,
      body: `Seu vídeo "${project.title}" foi processado com sucesso.`,
      action_url: `/clips?project=${project_id}`
    });

    if (tmpDir) {
      try { await Deno.remove(tmpDir, { recursive: true }); }
      catch (e) { console.warn('Falha ao limpar tmpDir:', e); }
    }

    return new Response(
      JSON.stringify({ success: true, clips_count: successCount, credit_cost: creditCost }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('process-video error:', err);
    if (projectId) {
      await supabase.from('projects').update({
        status: 'failed',
        error_message: err instanceof Error ? err.message : String(err)
      }).eq('id', projectId);
    }
    
    if (tmpDir) {
      try { await Deno.remove(tmpDir, { recursive: true }); }
      catch (e) { console.warn('Falha ao limpar tmpDir:', e); }
    }
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
