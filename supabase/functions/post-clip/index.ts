import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MAX_RETRY = 3;

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    // Buscar posts agendados vencidos e com retry disponível
    const { data: schedules } = await supabase
      .from('schedule')
      .select('*, clips(title, storage_path, caption, hashtags, niche)')
      .eq('status', 'queued')
      .lte('scheduled_at', new Date().toISOString())
      .lt('retry_count', MAX_RETRY)
      .order('scheduled_at', { ascending: true })
      .limit(10);

    if (!schedules?.length) {
      return new Response(JSON.stringify({ processed: 0, message: 'Nenhum post para publicar' }), { status: 200 });
    }

    let published = 0;
    let failed = 0;

    for (const schedule of schedules) {
      try {
        const clip = schedule.clips as any;
        if (!clip?.storage_path) {
          await supabase.from('schedule').update({
            status: 'failed',
            last_error: 'Arquivo do clip não encontrado'
          }).eq('id', schedule.id);
          failed++;
          continue;
        }

        // Buscar token da rede social
        const { data: social } = await supabase
          .from('social_connections')
          .select('*')
          .eq('user_id', schedule.user_id)
          .eq('platform', schedule.platform)
          .single();

        if (!social) {
          await supabase.from('schedule').update({
            status: 'failed',
            last_error: `Conta ${schedule.platform} não conectada`
          }).eq('id', schedule.id);
          failed++;
          continue;
        }

        // Verificar se o token está expirado
        const tokenExpiry = social.token_expires_at ? new Date(social.token_expires_at) : null;
        if (tokenExpiry && tokenExpiry < new Date()) {
          await supabase.from('schedule').update({
            status: 'failed',
            last_error: `Token ${schedule.platform} expirado. Reconecte a conta.`
          }).eq('id', schedule.id);
          // Notificar usuário
          await supabase.from('notifications').insert({
            user_id: schedule.user_id,
            type: 'post_published',
            title: `Reconecte o ${schedule.platform}`,
            body: `O token de acesso expirou. Acesse Configurações > Redes Sociais para reconectar.`
          });
          failed++;
          continue;
        }

        // Baixar vídeo do storage
        const { data: videoBlob, error: dlErr } = await supabase.storage
          .from('clips').download(clip.storage_path);

        if (dlErr || !videoBlob) {
          throw new Error(`Download falhou: ${dlErr?.message}`);
        }

        const videoBuffer = await videoBlob.arrayBuffer();
        const caption = buildCaption(clip.caption, clip.hashtags, schedule.platform);
        let externalUrl = '';

        // Publicar na plataforma correspondente
        if (schedule.platform === 'tiktok') {
          externalUrl = await postToTikTok(social.access_token, videoBuffer, caption);
        } else if (schedule.platform === 'instagram') {
          externalUrl = await postToInstagram(social.access_token, social.profile_id, videoBuffer, caption);
        } else if (schedule.platform === 'youtube') {
          const title = clip.title ?? clip.caption?.replace(/\{|\}/g, '') ?? 'Corte';
          externalUrl = await postToYouTube(social.access_token, videoBuffer, title, caption);
        } else {
          // Outras plataformas ainda não implementadas
          throw new Error(`Plataforma ${schedule.platform} ainda não suportada para autopost`);
        }

        // Marcar como publicado
        await supabase.from('schedule').update({
          status: 'published',
          external_url: externalUrl,
          posted_at: new Date().toISOString()
        }).eq('id', schedule.id);

        // Atualizar status do clip
        await supabase.from('clips').update({ status: 'published' }).eq('id', schedule.clip_id);

        // Notificação de sucesso
        await supabase.from('notifications').insert({
          user_id: schedule.user_id,
          type: 'post_published',
          title: `Publicado no ${schedule.platform}! ✅`,
          body: `"${clip.title}" foi publicado com sucesso.`,
          action_url: externalUrl
        });

        published++;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        const newRetry = (schedule.retry_count ?? 0) + 1;

        await supabase.from('schedule').update({
          retry_count: newRetry,
          last_error: errMsg,
          status: newRetry >= MAX_RETRY ? 'failed' : 'queued'
        }).eq('id', schedule.id);

        if (newRetry >= MAX_RETRY) {
          await supabase.from('notifications').insert({
            user_id: schedule.user_id,
            type: 'post_published',
            title: `Falha ao publicar no ${schedule.platform}`,
            body: `Não foi possível publicar após ${MAX_RETRY} tentativas: ${errMsg}`
          });
        }

        console.error(`Falha no schedule ${schedule.id}:`, errMsg);
        failed++;
      }
    }

    return new Response(JSON.stringify({ published, failed, total: schedules.length }), { status: 200 });

  } catch (err) {
    console.error('post-clip error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500 }
    );
  }
});

// ---- Helpers de publicação por plataforma ----

function buildCaption(caption: string, hashtags: string[], platform: string): string {
  const clean = (caption ?? '').replace(/\{|\}/g, '');
  const tags = (hashtags ?? []).join(' ');
  if (platform === 'youtube') return clean; // YouTube não usa hashtags na descrição da mesma forma
  return `${clean}\n\n${tags}`.trim();
}

async function postToTikTok(token: string, video: ArrayBuffer, caption: string): Promise<string> {
  // TikTok Content Posting API v2
  const initRes = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      post_info: { title: caption.slice(0, 150), privacy_level: 'PUBLIC_TO_EVERYONE', disable_duet: false, disable_comment: false, disable_stitch: false },
      source_info: { source: 'FILE_UPLOAD', video_size: video.byteLength, chunk_size: video.byteLength, total_chunk_count: 1 }
    })
  });
  const init = await initRes.json();
  if (!init.data?.upload_url) throw new Error(`TikTok init falhou: ${JSON.stringify(init)}`);

  await fetch(init.data.upload_url, {
    method: 'PUT',
    headers: { 'Content-Type': 'video/mp4', 'Content-Range': `bytes 0-${video.byteLength - 1}/${video.byteLength}` },
    body: video
  });

  return `https://tiktok.com/@me/video/${init.data.publish_id ?? 'posted'}`;
}

async function postToInstagram(token: string, igUserId: string, video: ArrayBuffer, caption: string): Promise<string> {
  // Instagram Graph API - Reels upload
  const containerRes = await fetch(`https://graph.instagram.com/v18.0/${igUserId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      media_type: 'REELS',
      caption,
      share_to_feed: true,
      access_token: token
    })
  });
  const container = await containerRes.json();
  if (!container.id) throw new Error(`Instagram container error: ${JSON.stringify(container)}`);

  // Publicar
  const publishRes = await fetch(`https://graph.instagram.com/v18.0/${igUserId}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creation_id: container.id, access_token: token })
  });
  const publish = await publishRes.json();
  if (!publish.id) throw new Error(`Instagram publish error: ${JSON.stringify(publish)}`);

  return `https://instagram.com/p/${publish.id}`;
}

async function postToYouTube(token: string, video: ArrayBuffer, title: string, description: string): Promise<string> {
  // YouTube Data API v3 - resumable upload
  const initRes = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Upload-Content-Type': 'video/mp4',
      'X-Upload-Content-Length': String(video.byteLength)
    },
    body: JSON.stringify({
      snippet: { title: title.slice(0, 100), description, categoryId: '22' },
      status: { privacyStatus: 'public', selfDeclaredMadeForKids: false }
    })
  });
  const uploadUrl = initRes.headers.get('Location');
  if (!uploadUrl) throw new Error('YouTube não retornou upload URL');

  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'video/mp4', 'Content-Length': String(video.byteLength) },
    body: video
  });
  const uploaded = await uploadRes.json();
  if (!uploaded.id) throw new Error(`YouTube upload error: ${JSON.stringify(uploaded)}`);

  return `https://youtube.com/shorts/${uploaded.id}`;
}
