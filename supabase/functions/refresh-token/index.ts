import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  // Buscar tokens que expiram nas próximas 2 horas
  const expiryThreshold = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  const { data: connections } = await supabase
    .from('social_connections')
    .select('*')
    .not('refresh_token', 'is', null)
    .lt('token_expires_at', expiryThreshold);

  if (!connections?.length) {
    return new Response(JSON.stringify({ refreshed: 0 }), { status: 200 });
  }

  let refreshed = 0;
  let failed = 0;

  for (const conn of connections) {
    try {
      let newToken: string | null = null;
      let newRefresh: string | null = conn.refresh_token;
      let newExpiry: string | null = null;

      if (conn.platform === 'youtube') {
        // Google OAuth2 refresh
        const res = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: Deno.env.get('YOUTUBE_CLIENT_ID') ?? '',
            client_secret: Deno.env.get('YOUTUBE_CLIENT_SECRET') ?? '',
            refresh_token: conn.refresh_token,
            grant_type: 'refresh_token'
          })
        });
        const data = await res.json();
        if (data.access_token) {
          newToken = data.access_token;
          newExpiry = new Date(Date.now() + (data.expires_in ?? 3600) * 1000).toISOString();
        }
      } else if (conn.platform === 'tiktok') {
        // TikTok token refresh
        const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_key: Deno.env.get('TIKTOK_CLIENT_KEY') ?? '',
            client_secret: Deno.env.get('TIKTOK_CLIENT_SECRET') ?? '',
            grant_type: 'refresh_token',
            refresh_token: conn.refresh_token
          })
        });
        const data = await res.json();
        if (data.data?.access_token) {
          newToken = data.data.access_token;
          newRefresh = data.data.refresh_token ?? conn.refresh_token;
          newExpiry = new Date(Date.now() + (data.data.expires_in ?? 86400) * 1000).toISOString();
        }
      } else if (conn.platform === 'linkedin') {
        const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: conn.refresh_token,
            client_id: Deno.env.get('LINKEDIN_CLIENT_ID') ?? '',
            client_secret: Deno.env.get('LINKEDIN_CLIENT_SECRET') ?? ''
          })
        });
        const data = await res.json();
        if (data.access_token) {
          newToken = data.access_token;
          newRefresh = data.refresh_token ?? conn.refresh_token;
          newExpiry = new Date(Date.now() + (data.expires_in ?? 5183944) * 1000).toISOString();
        }
      }
      // Instagram tokens são de longa duração (60 dias) — apenas renovar se tiver refresh_token
      // Facebook page tokens não expiram normalmente — pular

      if (newToken) {
        await supabase.from('social_connections').update({
          access_token: newToken,
          refresh_token: newRefresh,
          token_expires_at: newExpiry,
          updated_at: new Date().toISOString()
        }).eq('id', conn.id);
        refreshed++;
      }
    } catch (e) {
      console.error(`Falha ao renovar token ${conn.platform} para user ${conn.user_id}:`, e);
      // Notificar usuário que precisa reconectar
      await supabase.from('notifications').insert({
        user_id: conn.user_id,
        type: 'post_published',
        title: `Reconecte o ${conn.platform}`,
        body: `Não foi possível renovar o token. Acesse Configurações > Redes Sociais para reconectar.`
      }).catch(() => {});
      failed++;
    }
  }

  return new Response(JSON.stringify({
    total: connections.length, refreshed, failed
  }), { status: 200 });
});
