-- Campos de face tracking nos clips e projetos
ALTER TABLE public.clips
  ADD COLUMN IF NOT EXISTS face_tracking_applied boolean NOT NULL DEFAULT false;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS face_tracking_applied boolean NOT NULL DEFAULT false;

-- Índice para analytics de uso do feature
CREATE INDEX IF NOT EXISTS idx_clips_face_tracking
  ON public.clips (face_tracking_applied)
  WHERE face_tracking_applied = true;
