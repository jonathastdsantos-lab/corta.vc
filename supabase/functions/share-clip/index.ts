// POST /functions/v1/share-clip
// Body: { clip_id: string }
// Headers: Authorization: Bearer <user_token>
// Retorna: { share_url: string, token: string, expires_at: string }

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    if (req.method === 'GET') {
      const token = new URL(req.url).searchParams.get('t');
      if (!token) return new Response(JSON.stringify({ error: 'token required' }), { status: 400, headers: corsHeaders });

      const { data: share } = await supabase
        .from('shared_clips')
        .select('*, clips(title, caption, storage_path, thumbnail_url)')
        .eq('token', token)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (!share) return new Response(JSON.stringify({ error: 'Link inválido ou expirado' }), { status: 404, headers: corsHeaders });

      // Incrementa views de forma assíncrona (não bloqueia a resposta)
      supabase.from('shared_clips').update({ views: (share.views ?? 0) + 1 }).eq('token', token).then(() => {});

      const { data: { publicUrl } } = supabase.storage.from('clips').getPublicUrl(share.clips.storage_path ?? '');

      return new Response(JSON.stringify({
        title: share.clips.title,
        caption: share.clips.caption,
        thumbnail_url: share.clips.thumbnail_url,
        video_url: publicUrl,
        expires_at: share.expires_at,
        views: share.views
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Autentica o usuário via JWT
    const authHeader = req.headers.get('Authorization') ?? '';
    const { data: { user }, error: authErr } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authErr || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });

    const { clip_id, duration_hours = 24 } = await req.json();
    if (!clip_id) return new Response(JSON.stringify({ error: 'clip_id required' }), { status: 400, headers: corsHeaders });

    // Verifica que o clip pertence ao usuário
    const { data: clip } = await supabase
      .from('clips').select('id, title, storage_path, thumbnail_url')
      .eq('id', clip_id).eq('user_id', user.id).single();
    if (!clip) return new Response(JSON.stringify({ error: 'Clip not found' }), { status: 404, headers: corsHeaders });

    // Gera token único e salva em shared_clips
    const token = crypto.randomUUID().replace(/-/g, '');
    const validHours = Math.min(Math.max(duration_hours, 1), 168); // entre 1h e 7 dias
    const expiresAt = new Date(Date.now() + validHours * 60 * 60 * 1000).toISOString();

    await supabase.from('shared_clips').insert({
      clip_id, user_id: user.id, token, expires_at: expiresAt, duration_hours: validHours
    });

    const shareUrl = `${Deno.env.get('APP_URL') ?? 'https://corta.vc'}/preview.html?t=${token}`;

    return new Response(JSON.stringify({ share_url: shareUrl, token, expires_at: expiresAt }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
