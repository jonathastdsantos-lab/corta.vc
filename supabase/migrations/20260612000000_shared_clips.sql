DROP TABLE IF EXISTS public.shared_clips CASCADE;
CREATE TABLE IF NOT EXISTS public.shared_clips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clip_id uuid NOT NULL REFERENCES public.clips(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text UNIQUE NOT NULL,
  views int DEFAULT 0,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.shared_clips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner" ON public.shared_clips FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "public read by token" ON public.shared_clips FOR SELECT USING (expires_at > now());
