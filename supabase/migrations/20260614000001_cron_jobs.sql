CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove jobs anteriores se existirem (idempotente)
SELECT cron.unschedule('post-scheduled-clips')   WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'post-scheduled-clips');
SELECT cron.unschedule('refresh-social-tokens')  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh-social-tokens');
SELECT cron.unschedule('sync-analytics')         WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-analytics');
SELECT cron.unschedule('cleanup-storage')        WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-storage');

-- Cron: post-clip a cada 5 minutos
SELECT cron.schedule(
  'post-scheduled-clips',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://shzjchiortfrnpsoirrb.supabase.co/functions/v1/post-clip',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer COLE_SERVICE_ROLE_AQUI"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- Cron: refresh de tokens — diariamente às 3h (horário de Brasília = UTC-3, portanto 6h UTC)
SELECT cron.schedule(
  'refresh-social-tokens',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://shzjchiortfrnpsoirrb.supabase.co/functions/v1/refresh-token',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer COLE_SERVICE_ROLE_AQUI"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- Cron: sync de analytics — diariamente às 9h (6h UTC)
SELECT cron.schedule(
  'sync-analytics',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := 'https://shzjchiortfrnpsoirrb.supabase.co/functions/v1/analytics-sync',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer COLE_SERVICE_ROLE_AQUI"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- Cron: cleanup semanal — toda segunda às 5h UTC
SELECT cron.schedule(
  'cleanup-storage',
  '0 5 * * 1',
  $$
  SELECT net.http_post(
    url := 'https://shzjchiortfrnpsoirrb.supabase.co/functions/v1/cleanup-storage',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer COLE_SERVICE_ROLE_AQUI"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- Verificar jobs criados
SELECT jobname, schedule, active FROM cron.job ORDER BY jobname;
