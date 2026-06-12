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
    // Autentica o usuário via JWT
    const authHeader = req.headers.get('Authorization') ?? '';
    const { data: { user }, error: authErr } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authErr || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });

    const { clip_id } = await req.json();
    if (!clip_id) return new Response(JSON.stringify({ error: 'clip_id required' }), { status: 400, headers: corsHeaders });

    // Verifica que o clip pertence ao usuário
    const { data: clip } = await supabase
      .from('clips').select('id, title, storage_path, thumbnail_url')
      .eq('id', clip_id).eq('user_id', user.id).single();
    if (!clip) return new Response(JSON.stringify({ error: 'Clip not found' }), { status: 404, headers: corsHeaders });

    // Gera token único e salva em shared_clips
    const token = crypto.randomUUID().replace(/-/g, '');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24h

    await supabase.from('shared_clips').insert({
      clip_id, user_id: user.id, token, expires_at: expiresAt
    });

    const shareUrl = `${Deno.env.get('APP_URL') ?? 'https://corta.vc'}/preview.html?t=${token}`;

    return new Response(JSON.stringify({ share_url: shareUrl, token, expires_at: expiresAt }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
