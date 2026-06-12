CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL, -- processing_done | post_published | credits_low | new_feature | welcome
  title text NOT NULL,
  body text,
  read boolean DEFAULT false,
  action_url text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notif_user_idx ON public.notifications(user_id, created_at DESC);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner" ON public.notifications FOR ALL USING (auth.uid() = user_id);
