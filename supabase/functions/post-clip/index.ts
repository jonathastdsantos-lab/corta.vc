import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    // Essa função deve ser chamada via Cron Job no Supabase pg_cron
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Buscar posts agendados para agora que estão pendentes
    const { data: schedules } = await supabase
      .from('schedule')
      .select('*, clips(*)')
      .eq('status', 'queued')
      .lte('scheduled_at', new Date().toISOString());

    if (!schedules || schedules.length === 0) {
      return new Response('No posts to publish', { status: 200 });
    }

    for (const schedule of schedules) {
      // 1. Pega credenciais da tabela social_connections
      const { data: social } = await supabase
        .from('social_connections')
        .select('*')
        .eq('user_id', schedule.user_id)
        .eq('platform', schedule.platform)
        .single();
        
      if (!social) {
        await supabase.from('schedule').update({ status: 'failed' }).eq('id', schedule.id);
        continue;
      }

      // 2. Faz o download do vídeo do bucket
      // const videoBlob = await supabase.storage.from('clips').download(schedule.clips.storage_path);
      
      // 3. Posta na respectiva API (TikTok, Instagram, YouTube) usando o social.access_token
      // (Mock)
      const externalUrl = `https://${schedule.platform}.com/v/mock_${schedule.id}`;

      // 4. Atualiza status
      await supabase.from('schedule').update({ 
        status: 'published',
        external_url: externalUrl 
      }).eq('id', schedule.id);
    }

    return new Response(JSON.stringify({ processed: schedules.length }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
