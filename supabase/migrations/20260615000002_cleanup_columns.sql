-- Novos campos nos clips para rastrear o que foi limpo
ALTER TABLE public.clips
  ADD COLUMN IF NOT EXISTS silences_removed  int     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fillers_removed   int     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS seconds_saved     numeric(6,1) NOT NULL DEFAULT 0;

-- Novos campos nos projetos para flags de pipeline
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS silence_removal_applied boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS filler_removal_applied  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS total_seconds_saved     numeric(6,1) NOT NULL DEFAULT 0;

-- Índice para analytics
CREATE INDEX IF NOT EXISTS idx_clips_seconds_saved
  ON public.clips (seconds_saved)
  WHERE seconds_saved > 0;
