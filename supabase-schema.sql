-- ============================================================
-- Corta.vc — Supabase schema
-- Rode isto no SQL Editor do seu projeto:
--   https://shzjchiortfrnpsoirrb.supabase.co  (Project ID: shzjchiortfrnpsoirrb)
--
-- IMPORTANTE: este arquivo NÃO contém nenhuma chave secreta.
-- Rotacione a senha do banco e o service_role antes de ir para produção.
-- ============================================================

-- ---------- Extensões ----------
create extension if not exists "pgcrypto";

-- ============================================================
-- PERFIS  (1:1 com auth.users)
-- ============================================================
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text,
  avatar_url  text,
  plan        text not null default 'free',          -- free | starter | pro | business
  credits     int  not null default 60,
  lang        text not null default 'pt',            -- pt | en | es
  created_at  timestamptz not null default now()
);

-- cria o profile automaticamente quando um usuário se cadastra
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)));
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- PROJETOS  (vídeo longo importado)
-- ============================================================
create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null,
  source_url  text,                                   -- link YouTube/Drive/etc
  source_type text default 'upload',                  -- upload | youtube | drive | twitch | zoom
  storage_path text,                                  -- caminho no bucket "videos"
  niche       text,                                   -- podcast | games | noticias | fe | financas | educacao | fitness
  duration    int,                                    -- segundos
  status      text not null default 'processing',     -- processing | ready | failed
  created_at  timestamptz not null default now()
);
create index if not exists projects_user_idx on public.projects(user_id, created_at desc);

-- ============================================================
-- CORTES  (clipe curto gerado pela IA)
-- ============================================================
create table if not exists public.clips (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  title        text not null,
  caption      text,                                  -- legenda com {palavra} destacada
  transcript   jsonb,                                 -- [{t, text}]
  hashtags     text[],
  niche        text,
  start_s      numeric,                               -- início do corte no vídeo original
  end_s        numeric,
  duration     int,
  score        int default 0,                         -- nota de viralização 0-100
  hook         text,
  caption_style text default 'hormozi',
  ratio        text default '9:16',
  layout       text default 'fill',
  storage_path text,                                  -- mp4 renderizado no bucket "clips"
  status       text not null default 'draft',         -- draft | rendered | published
  created_at   timestamptz not null default now()
);
create index if not exists clips_user_idx on public.clips(user_id, score desc);
create index if not exists clips_project_idx on public.clips(project_id);

-- ============================================================
-- TEMPLATES  (user_id null = template global da plataforma)
-- ============================================================
create table if not exists public.templates (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade,
  kind        text not null,                          -- caption | layout | niche | format
  name        text not null,
  config      jsonb not null default '{}',            -- fonte, cores, animação, posição...
  created_at  timestamptz not null default now()
);
create index if not exists templates_kind_idx on public.templates(kind);

-- ============================================================
-- AGENDA  (publicações programadas)
-- ============================================================
create table if not exists public.schedule (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  clip_id       uuid not null references public.clips(id) on delete cascade,
  platform      text not null,                        -- tiktok | youtube | instagram | x | linkedin | facebook | kwai
  scheduled_at  timestamptz not null,
  status        text not null default 'queued',       -- queued | published | failed
  external_url  text,
  created_at    timestamptz not null default now()
);
create index if not exists schedule_user_idx on public.schedule(user_id, scheduled_at);

-- ============================================================
-- ROW LEVEL SECURITY — cada usuário só vê o que é dele
-- ============================================================
alter table public.profiles  enable row level security;
alter table public.projects  enable row level security;
alter table public.clips     enable row level security;
alter table public.templates enable row level security;
alter table public.schedule  enable row level security;

-- profiles
create policy "own profile - select" on public.profiles for select using (auth.uid() = id);
create policy "own profile - update" on public.profiles for update using (auth.uid() = id);

-- helper macro: políticas padrão "dono da linha"
create policy "projects owner"  on public.projects  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "clips owner"     on public.clips     for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "schedule owner"  on public.schedule  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- templates: lê os globais (user_id null) + os próprios; só edita os próprios
create policy "templates read"   on public.templates for select using (user_id is null or auth.uid() = user_id);
create policy "templates write"  on public.templates for insert with check (auth.uid() = user_id);
create policy "templates update" on public.templates for update using (auth.uid() = user_id);
create policy "templates delete" on public.templates for delete using (auth.uid() = user_id);

-- ============================================================
-- STORAGE — buckets privados
-- ============================================================
insert into storage.buckets (id, name, public) values ('videos', 'videos', false) on conflict do nothing;
insert into storage.buckets (id, name, public) values ('clips',  'clips',  false) on conflict do nothing;

-- usuário só acessa arquivos dentro da pasta com o próprio uid (ex: videos/<uid>/arquivo.mp4)
create policy "videos owner" on storage.objects for all
  using (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "clips owner" on storage.objects for all
  using (bucket_id = 'clips' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'clips' and (storage.foldername(name))[1] = auth.uid()::text);
