import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Importações simuladas para Edge (npm specifiers no Deno)
import ffmpeg from "npm:fluent-ffmpeg";
import OpenAI from "npm:openai";
import Anthropic from "npm:@anthropic-ai/sdk";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  let projectId = null;

  try {
    const { project_id, user_id } = await req.json();
    if (!project_id || !user_id) throw new Error("Missing project_id or user_id");
    projectId = project_id;

    // 1. Busca o projeto no banco
    const { data: project, error: projErr } = await supabase
      .from('projects')
      .select('*')
      .eq('id', project_id)
      .single();

    if (projErr || !project) throw new Error('Projeto não encontrado');

    // Verifica créditos (custo fixo simulado de 10 créditos)
    const { data: profile } = await supabase
      .from('profiles')
      .select('credits, plan')
      .eq('id', user_id)
      .single();
      
    if (!profile || profile.credits < 10) {
      throw new Error("Créditos insuficientes");
    }

    // 2. Baixa o vídeo do Storage
    const { data: videoData, error: dlErr } = await supabase.storage
      .from('videos')
      .download(project.storage_path);

    if (dlErr || !videoData) throw new Error('Falha ao baixar vídeo do storage');

    // Cria diretório temporário
    const tmpDir = Deno.makeTempDirSync();
    const videoPath = path.join(tmpDir, 'input.mp4');
    const audioPath = path.join(tmpDir, 'audio.mp3');
    
    // Salva o vídeo localmente no edge
    const videoBuffer = await videoData.arrayBuffer();
    Deno.writeFileSync(videoPath, new Uint8Array(videoBuffer));

    // 3. Extrai áudio com FFmpeg
    await new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .noVideo()
        .audioCodec('libmp3lame')
        .audioFrequency(16000)
        .save(audioPath)
        .on('end', resolve)
        .on('error', reject);
    });

    // 4. Transcreve com Whisper API
    const openai = new OpenAI({ apiKey: Deno.env.get('OPENAI_API_KEY') });
    // Simulando chamada de audio (na prática precisa de fs.createReadStream ou blob no node compat)
    const transcription = await openai.audio.transcriptions.create({
      file: new File([Deno.readFileSync(audioPath)], 'audio.mp3', { type: 'audio/mp3' }),
      model: 'whisper-1',
      response_format: 'verbose_json',
      timestamp_granularities: ['word']
    });

    const transcriptText = transcription.text;
    const words = transcription.words; // timestamps por palavra

    // 5. Envia transcript para Claude
    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });
    
    const prompt = `Você é um especialista em conteúdo viral para redes sociais brasileiras (TikTok, Reels, Shorts).
Analise esta transcrição de vídeo e selecione os 5 a 15 melhores momentos para cortes virais.

TRANSCRIÇÃO COM TIMESTAMPS:
${JSON.stringify(words)}

NICHO DO CONTEÚDO: ${project.niche || 'geral'}
DURAÇÃO ALVO DOS CORTES: 30-60 segundos

Para cada corte retorne um JSON array com este formato exato:
[
  {
    "start_s": 45.2,
    "end_s": 83.7,
    "title": "Título chamativo de até 60 chars com 1 emoji",
    "caption": "Frase de legenda curta com a palavra mais impactante entre {chaves}",
    "hook": "Tipo do gancho (ex: Revelação, Polêmico, Emocional, Dado surpreendente)",
    "score": 87,
    "score_reason": "Motivo em 1 frase",
    "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"],
    "niche": "${project.niche || 'geral'}"
  }
]

Critérios para score alto (70-100):
- Gancho forte nos primeiros 3 segundos
- Informação surpreendente ou contraintuitiva
- Emoção intensa (raiva, admiração, riso)
- Pergunta que gera curiosidade
- Transformação ou reviravolta

Critérios para excluir um trecho:
- Mais de 5 segundos sem fala
- Apresentações e agradecimentos genéricos
- Conteúdo incompleto que não faz sentido sozinho

Responda APENAS com o JSON array, sem texto adicional.`;

    const claudeRes = await anthropic.messages.create({
      model: "claude-3-opus-20240229",
      max_tokens: 4000,
      messages: [{ role: "user", content: prompt }]
    });

    const momentsStr = claudeRes.content[0].text;
    const moments = JSON.parse(momentsStr.substring(momentsStr.indexOf('['), momentsStr.lastIndexOf(']') + 1));

    // Helper function para converter transcript pra SRT
    function toSrt(words) {
      let srt = '';
      let i = 1;
      // Simplificação: agrupar palavras a cada 3
      for (let j = 0; j < words.length; j+=3) {
        const chunk = words.slice(j, j+3);
        if (!chunk.length) continue;
        const start = new Date(chunk[0].start * 1000).toISOString().substr(11, 12).replace('.', ',');
        const end = new Date(chunk[chunk.length-1].end * 1000).toISOString().substr(11, 12).replace('.', ',');
        const text = chunk.map(w => w.word).join(' ');
        srt += `${i}\n${start} --> ${end}\n${text}\n\n`;
        i++;
      }
      return srt;
    }

    // 6 & 7. Renderiza cortes e envia pro Storage
    for (const moment of moments) {
      const clipId = crypto.randomUUID();
      const clipPath = path.join(tmpDir, `${clipId}.mp4`);
      const thumbPath = path.join(tmpDir, `${clipId}.jpg`);
      const srtPath = path.join(tmpDir, `${clipId}.srt`);

      // Filtra as palavras para o intervalo deste corte
      const clipWords = words.filter(w => w.start >= moment.start_s && w.end <= moment.end_s);
      Deno.writeTextFileSync(srtPath, toSrt(clipWords));
      
      const isFree = profile.plan === 'free';
      const watermarkFilter = isFree ? ",drawtext=text='Corta.vc':fontcolor=white@0.5:fontsize=24:x=w-tw-10:y=h-th-10" : "";

      // Extrai o corte com ffmpeg e queima legenda
      await new Promise((resolve, reject) => {
        ffmpeg(videoPath)
          .setStartTime(moment.start_s)
          .setDuration(moment.end_s - moment.start_s)
          .outputOptions([
            `-vf subtitles=${srtPath}:force_style='FontName=SchibstedGrotesk,FontSize=28,PrimaryColour=&H00FFFFFF,Outline=2'${watermarkFilter}`
          ])
          .output(clipPath)
          .on('end', resolve)
          .on('error', reject)
          .run();
      });

      // Extrai thumbnail (frame no 2 segundo)
      await new Promise((resolve, reject) => {
        ffmpeg(clipPath)
          .setStartTime(2)
          .frames(1)
          .output(thumbPath)
          .on('end', resolve)
          .on('error', reject)
          .run();
      });

      // Upload Clip
      const clipBytes = Deno.readFileSync(clipPath);
      const storagePath = `${user_id}/${project_id}/${clipId}.mp4`;
      await supabase.storage.from('clips').upload(storagePath, clipBytes, { contentType: 'video/mp4' });

      // Upload Thumb
      let thumbUrl = null;
      try {
        const thumbBytes = Deno.readFileSync(thumbPath);
        const thumbStoragePath = `${user_id}/${project_id}/${clipId}.jpg`;
        await supabase.storage.from('clips').upload(thumbStoragePath, thumbBytes, { contentType: 'image/jpeg' });
        
        const { data: pubUrl } = supabase.storage.from('clips').getPublicUrl(thumbStoragePath);
        thumbUrl = pubUrl.publicUrl;
      } catch (e) { console.error('Erro thumbnail', e); }

      // 8. Insere registros na tabela clips
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
        score: moment.score,
        hook: moment.hook,
        storage_path: storagePath,
        thumbnail_url: thumbUrl,
        status: 'rendered'
      });
    }

    // 9. Atualiza status do projeto para ready
    await supabase.from('projects').update({ status: 'ready' }).eq('id', project_id);

    // 10. Decrementa créditos
    const { error: decrErr } = await supabase.rpc('decrement_credits', { user_id_param: user_id, amount: 10 });
    if (decrErr) {
       // fallback update (less safe than rpc but works if rpc not created)
       await supabase.from('profiles').update({ credits: profile.credits - 10 }).eq('id', user_id);
    }

    return new Response(JSON.stringify({ success: true, clips_count: moments.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error(err);
    if (projectId) {
      // Atualiza erro no projeto
      await supabase.from('projects').update({ status: 'failed' }).eq('id', projectId);
    }
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
