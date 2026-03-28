-- Seeds iniciais de módulos/ações (RBAC) e papéis
-- Recomendado executar após `panel_schema.sql`

insert into public.panel_roles (nome, ativo)
values
  ('admin', true),
  ('operador', true),
  ('viewer', true)
on conflict (nome) do nothing;

-- Permissões: módulo.ação
insert into public.panel_permissions (chave, descricao)
values
  -- usuários (admin)
  ('usuarios.read', 'Listar usuários do painel'),
  ('usuarios.create', 'Criar usuários do painel'),
  ('usuarios.update', 'Atualizar usuários do painel'),
  ('usuarios.delete', 'Excluir/desativar usuários do painel'),

  -- contatos
  ('contatos.read', 'Listar/consultar contatos'),
  ('contatos.create', 'Criar contatos'),
  ('contatos.update', 'Atualizar contatos'),
  ('contatos.delete', 'Excluir contatos'),

  -- clientes
  ('clientes.read', 'Listar/consultar clientes'),
  ('clientes.create', 'Criar clientes'),
  ('clientes.update', 'Atualizar clientes'),
  ('clientes.delete', 'Excluir clientes'),

  -- serviços
  ('servicos.read', 'Listar/consultar serviços'),
  ('servicos.create', 'Criar serviços'),
  ('servicos.update', 'Atualizar serviços'),
  ('servicos.delete', 'Excluir serviços'),

  -- planos
  ('planos.read', 'Listar/consultar planos e vínculos plano-serviço'),
  ('planos.create', 'Criar planos e vínculos plano-serviço'),
  ('planos.update', 'Atualizar planos e vínculos plano-serviço'),
  ('planos.delete', 'Excluir planos e vínculos plano-serviço')
on conflict (chave) do nothing;

-- Vincula todas as permissões para admin
insert into public.panel_role_permissions (role_id, permission_id)
select r.id, p.id
from public.panel_roles r
cross join public.panel_permissions p
where r.nome = 'admin'
on conflict (role_id, permission_id) do nothing;

-- Vincula permissões CRM para operador (sem usuários.* por padrão)
insert into public.panel_role_permissions (role_id, permission_id)
select r.id, p.id
from public.panel_roles r
join public.panel_permissions p on true
where r.nome = 'operador'
  and (
    p.chave like 'contatos.%'
    or p.chave like 'clientes.%'
    or p.chave like 'servicos.%'
    or p.chave like 'planos.%'
  )
on conflict (role_id, permission_id) do nothing;

