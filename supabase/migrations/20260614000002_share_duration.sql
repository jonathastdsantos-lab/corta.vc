-- Adicionar duração configurável para links compartilhados
ALTER TABLE public.shared_clips
  ADD COLUMN IF NOT EXISTS duration_hours int NOT NULL DEFAULT 24,
  ADD COLUMN IF NOT EXISTS views int NOT NULL DEFAULT 0;

-- Atualizar política de leitura para considerar expiração
DROP POLICY IF EXISTS "public read by token" ON public.shared_clips;
CREATE POLICY "public read by token" ON public.shared_clips
  FOR SELECT USING (expires_at > now());
