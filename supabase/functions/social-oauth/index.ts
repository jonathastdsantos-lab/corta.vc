import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state'); // platform_userId
    
    if (!code || !state) throw new Error("Missing code or state");
    
    const [platform, userId] = state.split('_');

    // Em produção, isso faria a troca do código (OAuth token exchange) 
    // nas APIs do TikTok / Instagram / YouTube usando CLIENT_ID e CLIENT_SECRET
    // const tokenResponse = await fetch('https://open-api.tiktok.com/oauth/access_token/', { ... });
    
    // Mock token
    const accessToken = `mock_access_token_${platform}_${crypto.randomUUID()}`;
    const username = `mock_user_${platform}`;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Salvar na base
    await supabase.from('social_connections').upsert({
      user_id: userId,
      platform: platform,
      access_token: accessToken,
      username: username,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id,platform' });

    // Redirecionar de volta para o app
    return Response.redirect(`https://corta.vc/?social=success&platform=${platform}`, 302);
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
