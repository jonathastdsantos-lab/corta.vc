-- Coluna de erro nos projetos (para diagnóstico de falhas)
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS error_message text,
  ADD COLUMN IF NOT EXISTS clips_count int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS duration_seconds int;

-- Views e métricas nos clips
ALTER TABLE public.clips
  ADD COLUMN IF NOT EXISTS views_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS likes_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shares_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS thumbnail_url text,
  ADD COLUMN IF NOT EXISTS caption_style text DEFAULT 'hormozi',
  ADD COLUMN IF NOT EXISTS brand_prefs jsonb DEFAULT '{}';

-- Retry e controle de publicação na agenda
ALTER TABLE public.schedule
  ADD COLUMN IF NOT EXISTS retry_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS posted_at timestamptz;

-- Uses counter nos templates
ALTER TABLE public.templates
  ADD COLUMN IF NOT EXISTS uses_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS preview_url text;

-- Expiração de plano no perfil
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plan_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS subscription_id text,
  ADD COLUMN IF NOT EXISTS mp_customer_id text;

-- ============================================================
-- TABELA: social_connections (OAuth das redes sociais)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.social_connections (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform        text NOT NULL,
  access_token    text NOT NULL,
  refresh_token   text,
  token_expires_at timestamptz,
  profile_id      text,
  profile_name    text,
  profile_pic     text,
  scopes          text[],
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, platform)
);
CREATE INDEX IF NOT EXISTS social_conn_user_idx ON public.social_connections(user_id);
ALTER TABLE public.social_connections ENABLE ROW LEVEL SECURITY;
drop policy if exists "social owner" on public.social_connections;
CREATE POLICY "social owner" ON public.social_connections FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- TABELA: payments (histórico de pagamentos)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.payments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id         text NOT NULL,
  amount_brl      int NOT NULL,
  status          text NOT NULL DEFAULT 'pending', -- pending | approved | rejected | refunded
  mp_payment_id   text UNIQUE,
  mp_preference_id text,
  external_ref    text,
  paid_at         timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payments_user_idx ON public.payments(user_id, created_at DESC);
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
drop policy if exists "payments owner" on public.payments;
CREATE POLICY "payments owner" ON public.payments FOR SELECT USING (auth.uid() = user_id);

-- ============================================================
-- CRON JOB: disparar post-clip a cada 5 minutos
-- ============================================================
SELECT cron.schedule(
  'post-scheduled-clips',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/post-clip',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
