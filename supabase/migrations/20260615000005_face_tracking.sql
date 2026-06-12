-- Campo para rastrear se face tracking foi aplicado no clip
ALTER TABLE public.clips
  ADD COLUMN IF NOT EXISTS face_tracking_applied boolean NOT NULL DEFAULT false;

-- Campo no projeto para armazenar os dados de face (cache para re-render)
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS face_data jsonb;
