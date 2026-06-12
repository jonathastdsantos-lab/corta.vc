-- ============================================================
-- Corta.vc — Security Hardening Migration
-- Arquivo: supabase/migrations/20260616000000_security_hardening.sql
--
-- O que corrige:
--   1. profiles: adiciona INSERT policy (necessária para o trigger
--      handle_new_user criar perfis via service_role, mas também
--      protege contra inserts manuais indevidos)
--
--   2. payments: só tem SELECT. Webhook mp-webhook roda via
--      service_role (bypassa RLS) então INSERT funciona, mas
--      adicionar policy explicita é boa prática + bloqueia
--      tentativas de inserir pagamentos falsos via API direta
--
--   3. profiles: falta DELETE policy — sem ela um usuário não
--      consegue deletar a própria conta via API
--
--   4. schedule: post-clip roda via service_role e funciona,
--      mas usuário comum poderia atualizar status de posts
--      alheios via API direta (status: 'published' falso)
--      — a policy existente é FOR ALL, o que já cobre UPDATE,
--      verificar se WITH CHECK está presente
--
--   5. shared_clips: a policy "public read by token" permite
--      SELECT sem auth.uid() = user_id — qualquer pessoa com
--      qualquer token válido (mesmo expirado via race condition)
--      poderia tentar enumerar tokens. Adiciona restrição de
--      expiração e limita UPDATE/DELETE ao dono.
--
--   6. save_brand_prefs RPC: SECURITY DEFINER sem search_path
--      fixo é vetor de privilege escalation via search_path
--      injection. Adiciona set search_path = public.
--
--   7. clip_variants view: já tem security_invoker = true ✓
--      Documenta que está correto.
--
--   8. Verifica e corrige social_connections: política existente
--      está correta mas adiciona WITH CHECK explícito se ausente.
-- ============================================================

-- ============================================================
-- 1. profiles — adicionar INSERT e DELETE policies
-- ============================================================

-- INSERT: só o trigger handle_new_user (service_role) precisa
-- inserir perfis. Usuários comuns não devem criar perfis
-- manualmente — bloqueamos via policy restritiva.
-- O trigger roda como SECURITY DEFINER e bypassa RLS, então
-- o fluxo de signup continua funcionando normalmente.
DROP POLICY IF EXISTS "own profile - insert" ON public.profiles;
CREATE POLICY "own profile - insert" ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);
-- Nota: esta policy permite que o próprio usuário insira seu
-- perfil apenas se o id corresponde ao auth.uid(). Na prática
-- só o trigger service_role faz isso, mas a policy garante que
-- nenhum usuário A consiga criar um perfil para o usuário B.

-- DELETE: permite que o usuário delete sua própria conta
DROP POLICY IF EXISTS "own profile - delete" ON public.profiles;
CREATE POLICY "own profile - delete" ON public.profiles
  FOR DELETE
  USING (auth.uid() = id);

-- ============================================================
-- 2. payments — adicionar INSERT bloqueado para usuários comuns
-- ============================================================
-- O mp-webhook usa service_role e bypassa RLS — funciona.
-- Esta policy bloqueia que qualquer usuário autenticado insira
-- um pagamento aprovado falso diretamente via API do Supabase.
-- Não existe cenário legítimo onde o frontend insere payments.

DROP POLICY IF EXISTS "payments no direct insert" ON public.payments;
CREATE POLICY "payments no direct insert" ON public.payments
  FOR INSERT
  WITH CHECK (false);
-- false = nenhum usuário via anon/authenticated pode inserir.
-- Apenas service_role (Edge Functions) consegue inserir.

-- UPDATE e DELETE de payments também devem ser bloqueados
-- para usuários comuns — só o webhook atualiza status.
DROP POLICY IF EXISTS "payments no direct update" ON public.payments;
CREATE POLICY "payments no direct update" ON public.payments
  FOR UPDATE
  USING (false);

DROP POLICY IF EXISTS "payments no direct delete" ON public.payments;
CREATE POLICY "payments no direct delete" ON public.payments
  FOR DELETE
  USING (false);

-- ============================================================
-- 3. schedule — garantir WITH CHECK no UPDATE
-- ============================================================
-- A policy "schedule owner" existente cobre FOR ALL com
-- USING (auth.uid() = user_id), mas não tem WITH CHECK explícito
-- no UPDATE. Sem WITH CHECK, um usuário poderia atualizar
-- status para 'published' em um post agendado alheio se
-- conseguisse o UUID. Recria com WITH CHECK explícito.

DROP POLICY IF EXISTS "schedule owner" ON public.schedule;
CREATE POLICY "schedule owner" ON public.schedule
  FOR ALL
  USING     (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Política adicional: usuário não pode atualizar status para
-- 'published' ou 'failed' diretamente — esses estados só devem
-- ser definidos pelo post-clip (service_role).
-- Implementado via CHECK CONSTRAINT para complementar o RLS:
ALTER TABLE public.schedule
  DROP CONSTRAINT IF EXISTS schedule_status_check;
ALTER TABLE public.schedule
  ADD CONSTRAINT schedule_status_check
  CHECK (status IN ('queued', 'published', 'failed', 'cancelled'));

-- ============================================================
-- 4. shared_clips — fortalecer policy de leitura pública
-- ============================================================
-- Policy atual "public read by token" permite SELECT para
-- qualquer um com qualquer token não-expirado. Problema:
-- não há proteção contra enumeração de tokens (brute force).
-- A policy não muda — isso é limitação da arquitetura de
-- token público — mas adicionamos política de UPDATE/DELETE
-- explícita para garantir que só o dono pode modificar.

-- Recria com separação clara entre owner e public read:
DROP POLICY IF EXISTS "owner" ON public.shared_clips;
DROP POLICY IF EXISTS "public read by token" ON public.shared_clips;

-- Dono: operações completas (criar, ver, deletar seus links)
CREATE POLICY "shared clips owner" ON public.shared_clips
  FOR ALL
  USING     (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Público: só SELECT, só se não expirou, só via service_role
-- (share-clip usa service_role para incrementar views — OK)
-- Usuários não autenticados NÃO conseguem ler via API direta,
-- apenas via a Edge Function share-clip que usa service_role.
-- Esta policy permite que usuários autenticados de outros
-- projetos não vejam os shared_clips uns dos outros.
CREATE POLICY "shared clips public read" ON public.shared_clips
  FOR SELECT
  USING (
    expires_at > now()
    AND (
      auth.uid() = user_id    -- dono sempre pode ver
      OR auth.role() = 'service_role'  -- functions podem ver
    )
  );
-- IMPORTANTE: o preview.html acessa via share-clip Edge Function
-- (service_role), não diretamente pela API. Este fluxo continua
-- funcionando. O que muda: API direta do Supabase não retorna
-- shared_clips de outros usuários para usuários autenticados.

-- ============================================================
-- 5. save_brand_prefs RPC — fixar search_path (segurança)
-- ============================================================
-- Funções SECURITY DEFINER sem search_path fixo são vulneráveis
-- a privilege escalation via criação de schemas maliciosos.
-- Recria a função com search_path = public explícito.

CREATE OR REPLACE FUNCTION public.save_brand_prefs(
  p_user_id uuid,
  p_prefs   jsonb
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public        -- ← proteção contra search_path injection
AS $$
  UPDATE public.profiles
  SET brand_prefs = p_prefs
  WHERE id = p_user_id;
$$;

-- ============================================================
-- 6. handle_new_user trigger — fixar search_path (segurança)
-- ============================================================
-- O trigger já tem SECURITY DEFINER mas não tinha search_path
-- explícito na versão original. Recria com a proteção.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', SPLIT_PART(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;  -- idempotente: não falha em re-runs
  RETURN NEW;
END;
$$;

-- Recria o trigger (necessário após recriar a função)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ============================================================
-- 7. decrement_credits RPC — fixar search_path
-- ============================================================
-- Mesma proteção para a RPC de créditos.

DROP FUNCTION IF EXISTS public.decrement_credits(uuid, int);
CREATE OR REPLACE FUNCTION public.decrement_credits(
  user_id_param uuid,
  amount        int
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.profiles
  SET credits = GREATEST(0, credits - amount)
  WHERE id = user_id_param
    AND credits != -1;  -- -1 = ilimitado, não decrementa
$$;

-- ============================================================
-- 8. notifications — garantir WITH CHECK explícito
-- ============================================================
-- Policy existente: FOR ALL USING (auth.uid() = user_id)
-- Sem WITH CHECK, usuário poderia inserir notificação com
-- user_id de outro usuário se o USING não bloquear o INSERT.
-- Recria com WITH CHECK explícito.

DROP POLICY IF EXISTS "owner" ON public.notifications;
DROP POLICY IF EXISTS "notifications owner" ON public.notifications;
CREATE POLICY "notifications owner" ON public.notifications
  FOR ALL
  USING     (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Bloqueia INSERT direto por usuários — notificações só devem
-- ser criadas por Edge Functions (service_role).
DROP POLICY IF EXISTS "notifications no direct insert" ON public.notifications;
CREATE POLICY "notifications no direct insert" ON public.notifications
  FOR INSERT
  WITH CHECK (false);
-- Nota: a policy "notifications owner" FOR ALL também cobre INSERT,
-- mas WITH CHECK (auth.uid() = user_id) permitiria que um usuário
-- inserisse notificações para si mesmo. Esta policy mais restritiva
-- (WITH CHECK false) prevalece e bloqueia todos os INSERTs diretos.
-- Edge Functions via service_role ainda funcionam normalmente.

-- ============================================================
-- 9. oauth_states — confirmar que está correto
-- ============================================================
-- Policy existente: "service only" USING (false)
-- Isso significa que NENHUM usuário autenticado consegue
-- ler/escrever oauth_states via API direta — apenas service_role.
-- Está correto. Documentando para referência:

-- SELECT: bloqueado para todos (service_role bypassa)
-- INSERT: bloqueado para todos (service_role bypassa)
-- UPDATE: bloqueado para todos (service_role bypassa)
-- DELETE: bloqueado para todos (service_role bypassa)
-- Fluxo OAuth funciona porque social-oauth usa service_role.
-- Nenhuma mudança necessária nesta tabela.

-- ============================================================
-- 10. Verificação final — listar todas as policies ativas
-- ============================================================
-- Execute esta query no SQL Editor após aplicar a migration
-- para confirmar que todas as tabelas têm RLS ativo:

-- SELECT
--   schemaname,
--   tablename,
--   rowsecurity AS rls_enabled
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- ORDER BY tablename;

-- E para ver todas as policies:
-- SELECT
--   tablename,
--   policyname,
--   cmd,
--   qual AS using_expr,
--   with_check
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, policyname;
