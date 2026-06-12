import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const APP_URL = Deno.env.get('APP_URL') ?? 'https://corta.vc';

// Configurações OAuth por plataforma
const OAUTH_CONFIG: Record<string, any> = {
  tiktok: {
    tokenUrl: 'https://open.tiktokapis.com/v2/oauth/token/',
    profileUrl: 'https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url',
    clientIdKey: 'TIKTOK_CLIENT_KEY',
    clientSecretKey: 'TIKTOK_CLIENT_SECRET'
  },
  instagram: {
    tokenUrl: 'https://api.instagram.com/oauth/access_token',
    profileUrl: 'https://graph.instagram.com/me?fields=id,username,account_type',
    clientIdKey: 'INSTAGRAM_APP_ID',
    clientSecretKey: 'INSTAGRAM_APP_SECRET'
  },
  youtube: {
    tokenUrl: 'https://oauth2.googleapis.com/token',
    profileUrl: 'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
    clientIdKey: 'YOUTUBE_CLIENT_ID',
    clientSecretKey: 'YOUTUBE_CLIENT_SECRET'
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const url = new URL(req.url);
  const action = url.searchParams.get('action'); // 'init' ou 'callback'

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    // INIT: gerar URL de autorização
    if (action === 'init' || req.method === 'POST') {
      const body = req.method === 'POST' ? await req.json() : {};
      const platform = body.platform ?? url.searchParams.get('platform');
      const userId = body.user_id ?? url.searchParams.get('user_id');

      if (!platform || !userId) throw new Error('platform e user_id são obrigatórios');

      const cfg = OAUTH_CONFIG[platform];
      if (!cfg) throw new Error(`Plataforma não suportada: ${platform}`);

      const clientId = Deno.env.get(cfg.clientIdKey);
      if (!clientId) throw new Error(`${cfg.clientIdKey} não configurado`);

      const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/social-oauth?action=callback`;
      const state = `${platform}_${userId}_${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`;

      let authUrl = '';
      if (platform === 'tiktok') {
        authUrl = `https://www.tiktok.com/v2/auth/authorize/?client_key=${clientId}&response_type=code&scope=user.info.basic,video.upload,video.list&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;
      } else if (platform === 'instagram') {
        authUrl = `https://api.instagram.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=user_profile,user_media&response_type=code&state=${state}`;
      } else if (platform === 'youtube') {
        authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=https://www.googleapis.com/auth/youtube.upload+https://www.googleapis.com/auth/youtube.readonly&state=${state}&access_type=offline`;
      }

      return new Response(JSON.stringify({ auth_url: authUrl, state }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // CALLBACK: receber código e trocar por token
    if (action === 'callback') {
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state') ?? '';
      const error = url.searchParams.get('error');

      if (error) {
        return Response.redirect(`${APP_URL}/index.html?social=error&reason=${encodeURIComponent(error)}`, 302);
      }

      if (!code || !state) throw new Error('Parâmetros ausentes no callback');

      const [platform, userId] = state.split('_');
      const cfg = OAUTH_CONFIG[platform];
      if (!cfg) throw new Error(`Plataforma inválida no state: ${platform}`);

      const clientId = Deno.env.get(cfg.clientIdKey) ?? '';
      const clientSecret = Deno.env.get(cfg.clientSecretKey) ?? '';
      const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/social-oauth?action=callback`;

      // Trocar código por token
      let tokenData: Record<string, any> = {};
      if (platform === 'tiktok') {
        const res = await fetch(cfg.tokenUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_key: clientId, client_secret: clientSecret,
            code, grant_type: 'authorization_code', redirect_uri: redirectUri
          })
        });
        tokenData = await res.json();
      } else if (platform === 'instagram') {
        const form = new FormData();
        form.append('client_id', clientId); form.append('client_secret', clientSecret);
        form.append('grant_type', 'authorization_code');
        form.append('redirect_uri', redirectUri); form.append('code', code);
        const res = await fetch(cfg.tokenUrl, { method: 'POST', body: form });
        tokenData = await res.json();
      } else if (platform === 'youtube') {
        const res = await fetch(cfg.tokenUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: clientId, client_secret: clientSecret,
            code, grant_type: 'authorization_code', redirect_uri: redirectUri
          })
        });
        tokenData = await res.json();
      }

      if (tokenData.error) throw new Error(`Token error: ${tokenData.error_description ?? tokenData.error}`);

      const accessToken = tokenData.access_token;
      const refreshToken = tokenData.refresh_token;
      const expiresIn = tokenData.expires_in ?? 3600;

      // Buscar perfil da rede
      let profileName = platform;
      let profileId = '';
      let profilePic = '';
      try {
        const profileRes = await fetch(cfg.profileUrl, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        const profileData = await profileRes.json();
        if (platform === 'tiktok') {
          profileName = profileData.data?.user?.display_name ?? platform;
          profileId = profileData.data?.user?.open_id ?? '';
          profilePic = profileData.data?.user?.avatar_url ?? '';
        } else if (platform === 'instagram') {
          profileName = profileData.username ?? platform;
          profileId = profileData.id ?? '';
        } else if (platform === 'youtube') {
          profileName = profileData.items?.[0]?.snippet?.title ?? platform;
          profileId = profileData.items?.[0]?.id ?? '';
          profilePic = profileData.items?.[0]?.snippet?.thumbnails?.default?.url ?? '';
        }
      } catch (e) { console.warn('Falha ao buscar perfil:', e); }

      // Salvar conexão no banco
      await supabase.from('social_connections').upsert({
        user_id: userId,
        platform,
        access_token: accessToken,
        refresh_token: refreshToken ?? null,
        token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
        profile_id: profileId,
        profile_name: profileName,
        profile_pic: profilePic,
        scopes: tokenData.scope?.split(',') ?? [],
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,platform' });

      return Response.redirect(`${APP_URL}/index.html?social=success&platform=${platform}`, 302);
    }

    return new Response(JSON.stringify({ error: 'action inválida' }), {
      status: 400, headers: corsHeaders
    });

  } catch (err) {
    console.error('social-oauth error:', err);
    const msg = err instanceof Error ? err.message : String(err);
    return Response.redirect(`${APP_URL}/index.html?social=error&reason=${encodeURIComponent(msg)}`, 302);
  }
});
