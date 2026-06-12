-- Garante que a coluna transcript existe e está indexada
-- (já existe no init.sql como jsonb, esta migration é idempotente)
ALTER TABLE public.clips
  ADD COLUMN IF NOT EXISTS transcript jsonb;

-- Índice GIN para buscas dentro do transcript (futuro: busca por palavra)
CREATE INDEX IF NOT EXISTS idx_clips_transcript
  ON public.clips USING gin(transcript)
  WHERE transcript IS NOT NULL;

-- RPC auxiliar: recebe clip_id + user_id, retorna transcript
-- (evita SELECT no frontend — autorizado via RLS)
CREATE OR REPLACE FUNCTION get_clip_transcript(
  p_clip_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT transcript
  FROM public.clips
  WHERE id = p_clip_id AND user_id = p_user_id
  LIMIT 1;
$$;
