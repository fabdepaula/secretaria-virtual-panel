-- Executar no Supabase SQL Editor (após backup).
-- Adiciona nome, e-mail e login; login substitui CPF na autenticação.
-- Usuários existentes: login = cpf (somente dígitos), nome = placeholder.

alter table public.panel_users
  add column if not exists nome_completo text;

alter table public.panel_users
  add column if not exists email text;

alter table public.panel_users
  add column if not exists login text;

-- Preencher linhas antigas
update public.panel_users
set nome_completo = coalesce(nullif(trim(nome_completo), ''), 'Usuário')
where nome_completo is null or trim(nome_completo) = '';

update public.panel_users
set login = cpf
where login is null and cpf is not null;

-- Caso raro sem cpf
update public.panel_users
set login = replace(gen_random_uuid()::text, '-', '')
where login is null;

-- Exibir e-mail na lista: copiar do Auth quando a coluna ainda estiver vazia
update public.panel_users
set email = email_interno
where (email is null or trim(email) = '')
  and email_interno is not null
  and trim(email_interno) <> '';

alter table public.panel_users
  alter column nome_completo set not null;

alter table public.panel_users
  alter column login set not null;

alter table public.panel_users
  alter column cpf drop not null;

create unique index if not exists panel_users_login_lower_idx
  on public.panel_users (lower(login));

create unique index if not exists panel_users_email_lower_idx
  on public.panel_users (lower(email))
  where email is not null and trim(email) <> '';

comment on column public.panel_users.login is 'Identificador único de acesso (substitui CPF no login).';
comment on column public.panel_users.email is 'E-mail de contato opcional (informativo). O Supabase Auth usa email_interno.';
comment on column public.panel_users.nome_completo is 'Nome para exibição no painel.';
