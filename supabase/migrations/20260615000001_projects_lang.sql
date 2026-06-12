ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS lang text NOT NULL DEFAULT 'pt';
