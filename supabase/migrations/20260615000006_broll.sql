-- Campo para rastrear se B-roll foi aplicado no clip
ALTER TABLE public.clips
  ADD COLUMN IF NOT EXISTS broll_applied boolean NOT NULL DEFAULT false;

-- Index para analytics de uso do feature
CREATE INDEX IF NOT EXISTS idx_clips_broll
  ON public.clips (broll_applied)
  WHERE broll_applied = true;
