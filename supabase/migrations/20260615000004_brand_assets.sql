-- Bucket público para logos e assets de marca
INSERT INTO storage.buckets (id, name, public)
VALUES ('brand-assets', 'brand-assets', true)
ON CONFLICT DO NOTHING;

-- Policy: usuário só acessa sua própria pasta brand-assets/<uid>/
CREATE POLICY "brand assets owner"
  ON storage.objects FOR ALL
  USING  (bucket_id = 'brand-assets' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'brand-assets' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Garante que brand_prefs existe com estrutura correta
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS brand_prefs jsonb NOT NULL DEFAULT '{}';

-- RPC: salvar brand_prefs atomicamente (evita race condition de SELECT+UPDATE)
CREATE OR REPLACE FUNCTION save_brand_prefs(
  p_user_id uuid,
  p_prefs   jsonb
)
RETURNS void
LANGUAGE sql SECURITY DEFINER
AS $$
  UPDATE public.profiles
  SET brand_prefs = p_prefs
  WHERE id = p_user_id;
$$;
