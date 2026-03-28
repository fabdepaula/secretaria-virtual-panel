-- Ativa RLS e cria policies para RBAC por módulo/ação (painel)
-- Recomendado executar após:
--   1) panel_schema.sql
--   2) panel_permissions_seed.sql
--
-- Observação: se seu Supabase já tiver RLS/Policies, ajuste conflitos manualmente.

create or replace function public.current_panel_role_id()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  rid uuid;
begin
  select pu.role_id into rid
  from public.panel_users pu
  where pu.auth_user_id = auth.uid()
    and pu.ativo = true
  limit 1;

  return rid;
end;
$$;

create or replace function public.has_panel_permission(permission_key text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.panel_role_permissions prp
    join public.panel_permissions pp on pp.id = prp.permission_id
    where prp.role_id = public.current_panel_role_id()
      and pp.chave = permission_key
  );
$$;

-- =========================
-- Tabelas de controle (RBAC)
-- =========================

alter table public.panel_users enable row level security;
alter table public.panel_roles enable row level security;
alter table public.panel_permissions enable row level security;
alter table public.panel_role_permissions enable row level security;

-- panel_roles
create policy "panel_roles_select" on public.panel_roles
for select using (public.has_panel_permission('usuarios.read'));
create policy "panel_roles_insert" on public.panel_roles
for insert with check (public.has_panel_permission('usuarios.create'));
create policy "panel_roles_update" on public.panel_roles
for update using (public.has_panel_permission('usuarios.update'))
with check (public.has_panel_permission('usuarios.update'));
create policy "panel_roles_delete" on public.panel_roles
for delete using (public.has_panel_permission('usuarios.delete'));

-- panel_permissions
create policy "panel_permissions_select" on public.panel_permissions
for select using (public.has_panel_permission('usuarios.read'));
create policy "panel_permissions_insert" on public.panel_permissions
for insert with check (public.has_panel_permission('usuarios.create'));
create policy "panel_permissions_update" on public.panel_permissions
for update using (public.has_panel_permission('usuarios.update'))
with check (public.has_panel_permission('usuarios.update'));
create policy "panel_permissions_delete" on public.panel_permissions
for delete using (public.has_panel_permission('usuarios.delete'));

-- panel_role_permissions
create policy "panel_role_permissions_select" on public.panel_role_permissions
for select using (public.has_panel_permission('usuarios.read'));
create policy "panel_role_permissions_insert" on public.panel_role_permissions
for insert with check (public.has_panel_permission('usuarios.create'));
create policy "panel_role_permissions_update" on public.panel_role_permissions
for update using (public.has_panel_permission('usuarios.update'))
with check (public.has_panel_permission('usuarios.update'));
create policy "panel_role_permissions_delete" on public.panel_role_permissions
for delete using (public.has_panel_permission('usuarios.delete'));

-- panel_users
create policy "panel_users_select" on public.panel_users
for select using (public.has_panel_permission('usuarios.read'));
create policy "panel_users_insert" on public.panel_users
for insert with check (public.has_panel_permission('usuarios.create'));
create policy "panel_users_update" on public.panel_users
for update using (public.has_panel_permission('usuarios.update'))
with check (public.has_panel_permission('usuarios.update'));
create policy "panel_users_delete" on public.panel_users
for delete using (public.has_panel_permission('usuarios.delete'));

-- =========================
-- CRM: Contatos
-- =========================

alter table public.contatos enable row level security;
alter table public.telefones enable row level security;
alter table public.contato_telefone enable row level security;

create policy "contatos_select" on public.contatos
for select using (public.has_panel_permission('contatos.read'));
create policy "contatos_insert" on public.contatos
for insert with check (public.has_panel_permission('contatos.create'));
create policy "contatos_update" on public.contatos
for update using (public.has_panel_permission('contatos.update'))
with check (public.has_panel_permission('contatos.update'));
create policy "contatos_delete" on public.contatos
for delete using (public.has_panel_permission('contatos.delete'));

create policy "telefones_select" on public.telefones
for select using (public.has_panel_permission('contatos.read'));
create policy "telefones_insert" on public.telefones
for insert with check (public.has_panel_permission('contatos.create'));
create policy "telefones_update" on public.telefones
for update using (public.has_panel_permission('contatos.update'))
with check (public.has_panel_permission('contatos.update'));
create policy "telefones_delete" on public.telefones
for delete using (public.has_panel_permission('contatos.delete'));

create policy "contato_telefone_select" on public.contato_telefone
for select using (public.has_panel_permission('contatos.read'));
create policy "contato_telefone_insert" on public.contato_telefone
for insert with check (public.has_panel_permission('contatos.create'));
create policy "contato_telefone_update" on public.contato_telefone
for update using (public.has_panel_permission('contatos.update'))
with check (public.has_panel_permission('contatos.update'));
create policy "contato_telefone_delete" on public.contato_telefone
for delete using (public.has_panel_permission('contatos.delete'));

-- =========================
-- CRM: Clientes
-- =========================

alter table public.clientes enable row level security;
alter table public.enderecos enable row level security;
alter table public.cliente_contato enable row level security;

create policy "clientes_select" on public.clientes
for select using (public.has_panel_permission('clientes.read'));
create policy "clientes_insert" on public.clientes
for insert with check (public.has_panel_permission('clientes.create'));
create policy "clientes_update" on public.clientes
for update using (public.has_panel_permission('clientes.update'))
with check (public.has_panel_permission('clientes.update'));
create policy "clientes_delete" on public.clientes
for delete using (public.has_panel_permission('clientes.delete'));

create policy "enderecos_select" on public.enderecos
for select using (public.has_panel_permission('clientes.read'));
create policy "enderecos_insert" on public.enderecos
for insert with check (public.has_panel_permission('clientes.create'));
create policy "enderecos_update" on public.enderecos
for update using (public.has_panel_permission('clientes.update'))
with check (public.has_panel_permission('clientes.update'));
create policy "enderecos_delete" on public.enderecos
for delete using (public.has_panel_permission('clientes.delete'));

create policy "cliente_contato_select" on public.cliente_contato
for select using (public.has_panel_permission('clientes.read'));
create policy "cliente_contato_insert" on public.cliente_contato
for insert with check (public.has_panel_permission('clientes.create'));
create policy "cliente_contato_update" on public.cliente_contato
for update using (public.has_panel_permission('clientes.update'))
with check (public.has_panel_permission('clientes.update'));
create policy "cliente_contato_delete" on public.cliente_contato
for delete using (public.has_panel_permission('clientes.delete'));

-- =========================
-- CRM: Serviços
-- =========================

alter table public."Services" enable row level security;

create policy "services_select" on public."Services"
for select using (public.has_panel_permission('servicos.read'));
create policy "services_insert" on public."Services"
for insert with check (public.has_panel_permission('servicos.create'));
create policy "services_update" on public."Services"
for update using (public.has_panel_permission('servicos.update'))
with check (public.has_panel_permission('servicos.update'));
create policy "services_delete" on public."Services"
for delete using (public.has_panel_permission('servicos.delete'));

-- =========================
-- CRM: Planos
-- =========================

alter table public.planos enable row level security;
alter table public.plano_servicos enable row level security;

create policy "planos_select" on public.planos
for select using (public.has_panel_permission('planos.read'));
create policy "planos_insert" on public.planos
for insert with check (public.has_panel_permission('planos.create'));
create policy "planos_update" on public.planos
for update using (public.has_panel_permission('planos.update'))
with check (public.has_panel_permission('planos.update'));
create policy "planos_delete" on public.planos
for delete using (public.has_panel_permission('planos.delete'));

-- Vínculos plano ↔ serviço seguem as mesmas permissões do módulo Planos (tela unificada).
create policy "plano_servicos_select" on public.plano_servicos
for select using (public.has_panel_permission('planos.read'));
create policy "plano_servicos_insert" on public.plano_servicos
for insert with check (public.has_panel_permission('planos.create'));
create policy "plano_servicos_update" on public.plano_servicos
for update using (public.has_panel_permission('planos.update'))
with check (public.has_panel_permission('planos.update'));
create policy "plano_servicos_delete" on public.plano_servicos
for delete using (public.has_panel_permission('planos.delete'));

