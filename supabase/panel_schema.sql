-- Schema mínimo para o login CPF + senha do painel
-- Ajuste nomes/constrangimentos se você quiser padronizar diferente.

-- Necessário para gen_random_uuid
create extension if not exists pgcrypto;

create table if not exists public.panel_roles (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.panel_permissions (
  id uuid primary key default gen_random_uuid(),
  chave text not null unique, -- ex.: "clientes.read", "clientes.create"
  descricao text,
  created_at timestamptz not null default now()
);

create table if not exists public.panel_role_permissions (
  role_id uuid not null references public.panel_roles(id) on delete cascade,
  permission_id uuid not null references public.panel_permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

-- Login: campo `login` (único). `email_interno` = e-mail no Supabase Auth (normalmente = email).
-- `cpf` é opcional (legado).
create table if not exists public.panel_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid references auth.users(id) on delete set null,
  cpf text unique,
  email_interno text not null unique,
  nome_completo text not null default 'Usuário',
  email text,
  login text not null,
  role_id uuid not null references public.panel_roles(id),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Índices únicos (case-insensitive) em instalações novas: ver `panel_users_login_fields.sql`
-- ou execute os create index do final desse arquivo após garantir colunas `login`/`email`.

-- (Opcional) mantenha updated_at
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists panel_users_set_updated_at on public.panel_users;
create trigger panel_users_set_updated_at
before update on public.panel_users
for each row execute function public.set_updated_at();

