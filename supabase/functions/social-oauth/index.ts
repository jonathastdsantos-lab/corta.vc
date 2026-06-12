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
  },
  facebook: {
    tokenUrl: 'https://graph.facebook.com/v18.0/oauth/access_token',
    profileUrl: 'https://graph.facebook.com/me?fields=id,name,picture',
    clientIdKey: 'FACEBOOK_APP_ID',
    clientSecretKey: 'FACEBOOK_APP_SECRET'
  },
  linkedin: {
    tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
    profileUrl: 'https://api.linkedin.com/v2/me',
    clientIdKey: 'LINKEDIN_CLIENT_ID',
    clientSecretKey: 'LINKEDIN_CLIENT_SECRET'
  },
  kwai: {
    // Kwai Open Platform
    tokenUrl: 'https://open.kwai.com/oauth2/connect/token',
    profileUrl: 'https://open.kwai.com/v1/user/info',
    clientIdKey: 'KWAI_APP_ID',
    clientSecretKey: 'KWAI_APP_SECRET'
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
    // GET: listar conexões do usuário
    if (req.method === 'GET' && !action) {
      const authHeader = req.headers.get('Authorization') ?? '';
      const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
      if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });

      const { data: connections } = await supabase
        .from('social_connections')
        .select('platform, profile_name, profile_pic, token_expires_at, updated_at')
        .eq('user_id', user.id);

      return new Response(JSON.stringify({ connections: connections || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

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
      } else if (platform === 'facebook') {
        authUrl = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=pages_show_list,pages_read_engagement,pages_manage_posts,video_upload&state=${state}&response_type=code`;
      } else if (platform === 'linkedin') {
        authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=openid profile w_member_social&state=${state}`;
      } else if (platform === 'kwai') {
        authUrl = `https://open.kwai.com/oauth2/connect/authorize?app_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=user_info,video_upload&response_type=code&state=${state}`;
      }

      // Salva state temporário no banco (expira em 10 minutos)
      await supabase.from('oauth_states').insert({
        state, user_id: userId, platform,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString()
      }).catch(() => {}); // falha silenciosa — não bloqueia o fluxo

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

      // Valida que o state existe e não expirou
      const { data: stateRow } = await supabase
        .from('oauth_states')
        .select('user_id, platform')
        .eq('state', state)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (!stateRow) {
        return Response.redirect(`${APP_URL}/index.html?social=error&reason=invalid_state`, 302);
      }

      // Usa userId validado do banco (não do state string)
      const userId = stateRow.user_id;
      const platform = stateRow.platform;

      // Deleta o state após uso (one-time use)
      await supabase.from('oauth_states').delete().eq('state', state);
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
      } else if (platform === 'facebook') {
        const res = await fetch(`${cfg.tokenUrl}?client_id=${clientId}&client_secret=${clientSecret}&redirect_uri=${encodeURIComponent(redirectUri)}&code=${code}`);
        tokenData = await res.json();
      } else if (platform === 'linkedin') {
        const res = await fetch(cfg.tokenUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'authorization_code', code,
            redirect_uri: redirectUri, client_id: clientId, client_secret: clientSecret
          })
        });
        tokenData = await res.json();
      } else if (platform === 'kwai') {
        const res = await fetch(cfg.tokenUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            app_id: clientId, app_secret: clientSecret,
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
        } else if (platform === 'facebook') {
          profileName = profileData.name ?? platform;
          profileId = profileData.id ?? '';
          profilePic = profileData.picture?.data?.url ?? '';
        } else if (platform === 'linkedin') {
          profileName = `${profileData.localizedFirstName ?? ''} ${profileData.localizedLastName ?? ''}`.trim() || platform;
          profileId = profileData.id ?? '';
        } else if (platform === 'kwai') {
          profileName = profileData.data?.user?.user_name ?? platform;
          profileId = profileData.data?.user?.user_id ?? '';
          profilePic = profileData.data?.user?.head_url ?? '';
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
