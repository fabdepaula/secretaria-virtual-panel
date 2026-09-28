-- =====================================================================
-- panel_permissions_coleta.sql
-- Módulo 'coleta' no RBAC do painel + RLS das tabelas da coleta.
-- Destino no repo: secretaria-virtual-panel/supabase/panel_permissions_coleta.sql
--
-- APLICADO em 26/09/2026 no Supabase oocyvlhvuqpoyxdzimjv (LabVet Homol),
-- migrações `operacao_rbac_coleta_v1` e `coleta_rls_fecha_anon_v1`.
-- Ordem: depois de panel_permissions_seed.sql e panel_rls.sql.
--
-- Os CREATE POLICY não são idempotentes. Em reaplicação, rodar antes os
-- DROP POLICY IF EXISTS correspondentes.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Permissões do módulo
-- ---------------------------------------------------------------------

insert into public.panel_permissions (chave, descricao)
values
  ('coleta.read',   'Visualizar a tela de operacao da coleta: mapa ao vivo e fila de coletas'),
  ('coleta.update', 'Agir sobre coletas na tela de operacao: reatribuir, assumir, cancelar')
on conflict (chave) do nothing;

-- Vínculo por papel: admin e operador. O papel viewer nasce sem permissão
-- alguma no seed do painel, então segue fora até decisão em contrário.
insert into public.panel_role_permissions (role_id, permission_id)
select r.id, p.id
from public.panel_roles r
join public.panel_permissions p on p.chave in ('coleta.read','coleta.update')
where r.nome in ('admin','operador')
on conflict do nothing;


-- ---------------------------------------------------------------------
-- 2. Leitura autenticada das tabelas da coleta
-- ---------------------------------------------------------------------

create policy coleta_read_entregadores on public.entregadores
  for select to authenticated using (public.has_panel_permission('coleta.read'));

create policy coleta_read_coletas on public.coletas
  for select to authenticated using (public.has_panel_permission('coleta.read'));

create policy coleta_read_coleta_eventos on public.coleta_eventos
  for select to authenticated using (public.has_panel_permission('coleta.read'));

create policy coleta_read_traccar_geofences on public.traccar_geofences
  for select to authenticated using (public.has_panel_permission('coleta.read'));


-- ---------------------------------------------------------------------
-- 3. Remoção das policies permissivas
-- Estado anterior: USING (true) para anon/public, ou seja, qualquer um com
-- a anon key lia E ESCREVIA estas tabelas sem login, incluindo posição de
-- pessoas em tempo real e os dados do contratante (CNPJ, e-mail).
-- Autorizado pelo Cursor em 26/09/2026: nada no painel acessa estas tabelas
-- pela anon key. O n8n usa conexão direta ao Postgres com o papel `postgres`,
-- que tem rolbypassrls e é dono das tabelas, e nenhuma tabela usa FORCE ROW
-- LEVEL SECURITY, portanto a automação não é afetada.
-- ---------------------------------------------------------------------

drop policy if exists anon_all_entregadores        on public.entregadores;
drop policy if exists anon_all_coletas             on public.coletas;
drop policy if exists anon_all_coleta_eventos      on public.coleta_eventos;
drop policy if exists anon_all_traccar_geofences   on public.traccar_geofences;
drop policy if exists anon_all_laboratorios        on public.laboratorios;
drop policy if exists anon_all_contratantes        on public.contratantes;
drop policy if exists anon_all_clinica_laboratorio on public.clinica_laboratorio;

-- As três tabelas de cadastro seguem legíveis para a sessão do painel.
-- laboratorios usa USING (true) porque o laboratório é um ponto do mapa e não
-- carrega dado sensível de pessoa; ajustar para has_panel_permission se a
-- configuração do lab virar tela com dado sensível.
create policy lab_read_authenticated on public.laboratorios
  for select to authenticated using (true);

create policy contratante_read_authenticated on public.contratantes
  for select to authenticated using (public.has_panel_permission('usuarios.read'));

create policy clinica_lab_read_authenticated on public.clinica_laboratorio
  for select to authenticated using (public.has_panel_permission('clientes.read'));


-- ---------------------------------------------------------------------
-- 4. Contador do protocolo
-- Só o trigger do banco usa. Não precisa estar exposta no PostgREST.
-- Atenção para a rodada 2: se algum dia uma inserção em `coletas` vier pelo
-- PostgREST (sessão do painel), o trigger gera_protocolo_coleta vai precisar
-- ser SECURITY DEFINER, senão o INSERT no contador falha por falta de grant.
-- Hoje só o n8n insere, como `postgres`, e por isso não há problema.
-- ---------------------------------------------------------------------

alter table public.coleta_contador_diario enable row level security;
revoke all on public.coleta_contador_diario from anon, authenticated;


-- ---------------------------------------------------------------------
-- 5. Endurecimento da FK do mapeamento de cercas
-- ON DELETE SET NULL transformava a exclusão de um endereço em falha
-- SILENCIOSA: a cerca perdia o endereco_id e o W4 parava de casar a unidade,
-- sem erro nenhum. Com RESTRICT a exclusão falha alto e o painel consegue
-- devolver 409 no PATCH/DELETE de cliente.
-- ---------------------------------------------------------------------

alter table public.traccar_geofences
  drop constraint traccar_geofences_endereco_id_fkey;

alter table public.traccar_geofences
  add constraint traccar_geofences_endereco_id_fkey
  foreign key (endereco_id) references public.enderecos(id) on delete restrict;
