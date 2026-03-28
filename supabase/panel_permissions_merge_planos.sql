-- Migração (executar uma vez no SQL Editor do Supabase, após backup):
-- Unifica RBAC: vínculos plano-serviço passam a usar apenas permissões `planos.*`
-- e remove chaves legadas `plano_servicos.*`.

-- 1) Copiar vínculos role ↔ permissão: quem tinha plano_servicos.* ganha o par planos.* equivalente
insert into public.panel_role_permissions (role_id, permission_id)
select distinct rp.role_id, p_planos.id
from public.panel_role_permissions rp
join public.panel_permissions p_ps on p_ps.id = rp.permission_id
  and p_ps.chave like 'plano_servicos.%'
join public.panel_permissions p_planos on p_planos.chave = replace(p_ps.chave, 'plano_servicos.', 'planos.')
on conflict (role_id, permission_id) do nothing;

-- 2) Remover permissões legadas (cascade em panel_role_permissions)
delete from public.panel_permissions where chave like 'plano_servicos.%';

-- 3) Atualizar descrições do módulo planos (opcional)
update public.panel_permissions set descricao = 'Listar/consultar planos e vínculos plano-serviço' where chave = 'planos.read';
update public.panel_permissions set descricao = 'Criar planos e vínculos plano-serviço' where chave = 'planos.create';
update public.panel_permissions set descricao = 'Atualizar planos e vínculos plano-serviço' where chave = 'planos.update';
update public.panel_permissions set descricao = 'Excluir planos e vínculos plano-serviço' where chave = 'planos.delete';

-- 4) RLS: tabela plano_servicos alinhada a planos.*
drop policy if exists plano_servicos_select on public.plano_servicos;
drop policy if exists plano_servicos_insert on public.plano_servicos;
drop policy if exists plano_servicos_update on public.plano_servicos;
drop policy if exists plano_servicos_delete on public.plano_servicos;

create policy "plano_servicos_select" on public.plano_servicos
for select using (public.has_panel_permission('planos.read'));

create policy "plano_servicos_insert" on public.plano_servicos
for insert with check (public.has_panel_permission('planos.create'));

create policy "plano_servicos_update" on public.plano_servicos
for update using (public.has_panel_permission('planos.update'))
with check (public.has_panel_permission('planos.update'));

create policy "plano_servicos_delete" on public.plano_servicos
for delete using (public.has_panel_permission('planos.delete'));
