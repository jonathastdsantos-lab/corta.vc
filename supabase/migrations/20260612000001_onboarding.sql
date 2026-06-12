ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_done boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_preferences jsonb DEFAULT '{}';
