-- projects: rastrear quantos formatos foram renderizados
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS formats_rendered int NOT NULL DEFAULT 1;

-- clips: ratio já existe (criado no init.sql como 'text default 9:16')
-- Garante que o índice existe para filtrar por ratio na UI
CREATE INDEX IF NOT EXISTS idx_clips_ratio
  ON public.clips (ratio, user_id);

-- View utilitária: clips agrupados por momento (start_s/end_s/project_id)
-- Útil para a UI mostrar "mesmo corte, dois formatos"
CREATE OR REPLACE VIEW public.clip_variants AS
SELECT
  project_id,
  start_s,
  end_s,
  title,
  score,
  array_agg(ratio ORDER BY ratio)         AS ratios,
  array_agg(id    ORDER BY ratio)         AS clip_ids,
  array_agg(storage_path ORDER BY ratio)  AS storage_paths,
  count(*)::int                           AS variant_count
FROM public.clips
WHERE status = 'rendered'
GROUP BY project_id, start_s, end_s, title, score;

-- RLS na view (herda do RLS de clips via SECURITY INVOKER)
ALTER VIEW public.clip_variants SET (security_invoker = true);
