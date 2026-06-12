import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  // Buscar posts publicados com external_url das últimas 48h
  const { data: schedules } = await supabase
    .from('schedule')
    .select('*, clips(id, niche)')
    .eq('status', 'published')
    .not('external_url', 'is', null)
    .gte('posted_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
    .limit(50);

  if (!schedules?.length) {
    return new Response(JSON.stringify({ synced: 0 }), { status: 200 });
  }

  let synced = 0;

  for (const schedule of schedules) {
    try {
      const { data: social } = await supabase
        .from('social_connections')
        .select('platform, access_token, profile_id')
        .eq('user_id', schedule.user_id)
        .eq('platform', schedule.platform)
        .single();

      if (!social) continue;

      let views = 0, likes = 0, shares = 0;

      if (schedule.platform === 'youtube') {
        // Extrai video ID da URL
        const videoId = schedule.external_url.split('/').pop();
        const res = await fetch(
          `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoId}&key=${Deno.env.get('YOUTUBE_API_KEY') ?? ''}`,
          { headers: { 'Authorization': `Bearer ${social.access_token}` } }
        );
        const data = await res.json();
        const stats = data.items?.[0]?.statistics;
        if (stats) {
          views = parseInt(stats.viewCount ?? '0');
          likes = parseInt(stats.likeCount ?? '0');
          shares = parseInt(stats.favoriteCount ?? '0');
        }
      } else if (schedule.platform === 'tiktok') {
        const videoId = schedule.external_url.split('/').pop();
        const res = await fetch('https://open.tiktokapis.com/v2/video/query/', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${social.access_token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filters: { video_ids: [videoId] },
            fields: ['view_count', 'like_count', 'share_count']
          })
        });
        const data = await res.json();
        const video = data.data?.videos?.[0];
        if (video) {
          views = video.view_count ?? 0;
          likes = video.like_count ?? 0;
          shares = video.share_count ?? 0;
        }
      } else if (schedule.platform === 'instagram') {
        const mediaId = schedule.external_url.split('/p/').pop()?.split('/')[0];
        const res = await fetch(
          `https://graph.instagram.com/v18.0/${mediaId}/insights?metric=impressions,reach,likes,shares&access_token=${social.access_token}`
        );
        const data = await res.json();
        if (data.data) {
          data.data.forEach((m: any) => {
            if (m.name === 'impressions') views = m.values?.[0]?.value ?? 0;
            if (m.name === 'likes') likes = m.values?.[0]?.value ?? 0;
            if (m.name === 'shares') shares = m.values?.[0]?.value ?? 0;
          });
        }
      }

      if (views > 0 || likes > 0) {
        await supabase.from('clips').update({
          views_count: views,
          likes_count: likes,
          shares_count: shares
        }).eq('id', schedule.clip_id);
        synced++;
      }
    } catch (e) {
      console.error(`Analytics sync falhou para schedule ${schedule.id}:`, e);
    }
  }

  return new Response(JSON.stringify({ total: schedules.length, synced }), { status: 200 });
});
