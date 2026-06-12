-- Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Cron: post-clip a cada 5 minutos
SELECT cron.schedule('post-scheduled-clips', '*/5 * * * *', $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/post-clip',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||current_setting('app.service_role_key')),
    body := '{}'::jsonb
  );
$$);

-- Cron: refresh de tokens expirados — diariamente às 3h
SELECT cron.schedule('refresh-social-tokens', '0 3 * * *', $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/refresh-token',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||current_setting('app.service_role_key')),
    body := '{}'::jsonb
  );
$$);

-- Cron: sync de analytics — diariamente às 6h
SELECT cron.schedule('sync-analytics', '0 6 * * *', $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/analytics-sync',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||current_setting('app.service_role_key')),
    body := '{}'::jsonb
  );
$$);

-- Cron: cleanup semanal — toda segunda às 2h
SELECT cron.schedule('cleanup-storage', '0 2 * * 1', $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/cleanup-storage',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||current_setting('app.service_role_key')),
    body := '{}'::jsonb
  );
$$);
