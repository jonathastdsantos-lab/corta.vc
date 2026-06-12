-- Armazena o prompt de intenção do usuário no projeto
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS clip_prompt text;

-- Índice parcial para projetos com prompt ativo
-- (útil para analytics: quantos usuários usam o campo)
CREATE INDEX IF NOT EXISTS idx_projects_clip_prompt
  ON public.projects (user_id, created_at DESC)
  WHERE clip_prompt IS NOT NULL AND clip_prompt <> '';
