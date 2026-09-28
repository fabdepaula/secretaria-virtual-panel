-- =====================================================================
-- coleta_panel_views.sql
-- Views de leitura que o painel consome na tela de operação da coleta.
-- Destino no repo: secretaria-virtual-panel/supabase/coleta_panel_views.sql
--
-- APLICADO em 26/09/2026 no Supabase oocyvlhvuqpoyxdzimjv (LabVet Homol),
-- migração `operacao_views_v1` (+ `views_security_invoker_v1` no fim).
-- Idempotente. Ordem: depois de panel_rls.sql.
--
-- security_invoker = on em todas: sem isso a view roda com os direitos do
-- dono, ignora o RLS de quem consulta e fura o RBAC do painel (é o advisory
-- 0010_security_definer_view do Supabase).
-- =====================================================================

create or replace view public.operacao_mapa_entregadores
with (security_invoker = on) as
select
  e.id,
  e.nome,
  e.status::text                        as status,
  e.ativo,
  e.lat_atual::float8                   as latitude,
  e.lng_atual::float8                   as longitude,
  e.pos_atualizada_em,
  case when e.pos_atualizada_em is null then null
       else floor(extract(epoch from (now() - e.pos_atualizada_em)))::int
  end                                   as segundos_desde_posicao,
  (e.lat_atual is null
     or e.lng_atual is null
     or e.pos_atualizada_em is null
     or e.pos_atualizada_em < now() - interval '10 minutes') as posicao_incerta,
  e.coletas_ativas,
  e.capacidade_max,
  (e.coletas_ativas >= e.capacidade_max) as sem_vaga,
  e.geofence_atual_id,
  g.papel                               as geofence_papel,
  g.descricao                           as geofence_descricao,
  e.geofence_desde,
  e.id_dispositivo_gps
from public.entregadores e
left join public.traccar_geofences g on g.geofence_id = e.geofence_atual_id;

comment on view public.operacao_mapa_entregadores is
  'Marcadores de entregador para o mapa da tela de operacao. posicao_incerta = sem coordenada ou leitura com mais de 10 min, mesmo limite que o W2 usa na roteirizacao. Nao filtra inativos: a coluna ativo fica exposta para a API decidir.';


create or replace view public.operacao_mapa_pontos
with (security_invoker = on) as
with lab as (
  select * from public.laboratorios where ativo order by created_at limit 1
)
select
  'clinica'::text                                             as tipo,
  en.id                                                       as id,
  coalesce(nullif(btrim(c.nome_fantasia), ''), c.nome)::text  as nome,
  en.tipo_endereco::text                                      as unidade,
  c.id                                                        as cliente_id,
  en.latitude::float8                                         as latitude,
  en.longitude::float8                                        as longitude,
  en.geo_status,
  en.geo_precisao,
  coalesce(en.aceita_coleta, true)                            as aceita_coleta,
  nullif(concat_ws(', ',
    nullif(btrim(concat_ws(' ', en.logradouro, en.numero)), ''),
    nullif(btrim(en.bairro), ''),
    nullif(btrim(en.cidade), '')), '')                        as endereco_resumo,
  g.geofence_id,
  (select raio_geofence_m from lab)                           as raio_geofence_m
from public.enderecos en
join public.clientes c on c.id = en.cliente_id
left join public.traccar_geofences g on g.endereco_id = en.id and g.papel = 'clinica'
where en.latitude is not null and en.longitude is not null
union all
select
  'laboratorio'::text,
  l.id,
  l.nome::text,
  null::text,
  null::uuid,
  l.latitude::float8,
  l.longitude::float8,
  l.geo_status,
  l.geo_precisao,
  null::boolean,
  nullif(concat_ws(', ',
    nullif(btrim(concat_ws(' ', l.logradouro, l.numero)), ''),
    nullif(btrim(l.bairro), ''),
    nullif(btrim(l.cidade), '')), ''),
  l.traccar_geofence_id,
  l.raio_geofence_m
from lab l
where l.latitude is not null and l.longitude is not null;

comment on view public.operacao_mapa_pontos is
  'Pontos fixos do mapa: unidades de clinica geocodificadas (tipo=clinica, id = enderecos.id) e o laboratorio (tipo=laboratorio, id = laboratorios.id). raio_geofence_m serve para desenhar a cerca. Endereco sem coordenada nao aparece: conferir em enderecos_geo_revisar.';


create or replace view public.operacao_fila_coletas
with (security_invoker = on) as
with lab as (
  select * from public.laboratorios where ativo order by created_at limit 1
)
select
  co.id,
  co.protocolo,
  co.status::text                       as status,
  co.urgencia::text                     as urgencia,
  co.janela_horario,
  co.tentativas_atribuicao,
  c.id                                  as clinica_id,
  coalesce(nullif(btrim(c.nome_fantasia), ''), c.nome)::text as clinica,
  en.id                                 as endereco_id,
  en.tipo_endereco::text                as unidade,
  coalesce(
    nullif(concat_ws(', ',
      nullif(btrim(concat_ws(' ', en.logradouro, en.numero)), ''),
      nullif(btrim(en.bairro), ''),
      nullif(btrim(en.cidade), '')), ''),
    co.endereco_coleta)                 as endereco_resumo,
  en.latitude::float8                   as coleta_latitude,
  en.longitude::float8                  as coleta_longitude,
  e.id                                  as entregador_id,
  e.nome                                as entregador,
  e.status::text                        as entregador_status,
  e.lat_atual::float8                   as entregador_latitude,
  e.lng_atual::float8                   as entregador_longitude,
  e.pos_atualizada_em                   as entregador_pos_em,
  co.criada_em,
  co.atribuida_em,
  co.aceita_em,
  co.coletando_em,
  co.coletado_em,
  d.desde,
  floor(extract(epoch from (now() - d.desde)) / 60)::int as minutos_no_status,
  ev.ultimo_evento_em,
  s.sla_limite_min,
  (s.sla_limite_min is not null
     and now() > d.desde + make_interval(mins => s.sla_limite_min)) as sla_estourado,
  (co.status in ('sem_entregador','aguardando_unidade'))            as exige_operador,
  case
    when co.status in ('sem_entregador','aguardando_unidade') then 1
    when s.sla_limite_min is not null
         and now() > d.desde + make_interval(mins => s.sla_limite_min) then 2
    when co.urgencia = 'urgente' then 3
    else 4
  end                                   as prioridade
from public.coletas co
join public.clientes c        on c.id  = co.clinica_id
left join public.enderecos en on en.id = co.endereco_id
left join public.entregadores e on e.id = co.entregador_id
cross join lateral (
  select coalesce(co.coletado_em, co.coletando_em, co.aceita_em, co.atribuida_em, co.criada_em) as desde
) d
cross join lateral (
  select case
    when co.status = 'atribuida' then (select sla_aceite_min from lab)
    when co.status in ('aceita','coletando','coletado') then (select sla_parada_min from lab)
    else null::int
  end as sla_limite_min
) s
left join lateral (
  select max(ce.criado_em) as ultimo_evento_em
  from public.coleta_eventos ce
  where ce.coleta_id = co.id
) ev on true
where co.status not in ('entregue','cancelada');

comment on view public.operacao_fila_coletas is
  'Fila do operador: coletas em aberto (exclui entregue e cancelada). desde = ultima transicao conhecida pelos timestamps da coleta, mesma base que o W5 usa; minutos_no_status deriva dela. sla_limite_min vem de laboratorios (sla_aceite_min para atribuida, sla_parada_min para aceita/coletando/coletado). prioridade: 1 exige operador, 2 SLA estourado, 3 urgente, 4 normal.';


create or replace view public.operacao_resumo
with (security_invoker = on) as
select
  (select count(*) from public.operacao_fila_coletas)                                  as coletas_abertas,
  (select count(*) from public.operacao_fila_coletas where exige_operador)             as exigem_operador,
  (select count(*) from public.operacao_fila_coletas where sla_estourado)              as sla_estourado,
  (select count(*) from public.operacao_fila_coletas where status = 'solicitada')      as solicitadas,
  (select count(*) from public.operacao_fila_coletas where status = 'atribuida')       as atribuidas,
  (select count(*) from public.operacao_fila_coletas where status in ('aceita','coletando','coletado')) as em_curso,
  (select count(*) from public.entregadores where ativo and status = 'disponivel')     as entregadores_disponiveis,
  (select count(*) from public.entregadores where ativo and status = 'ocupado')        as entregadores_ocupados,
  (select count(*) from public.entregadores where ativo and status = 'offline')        as entregadores_offline,
  (select count(*) from public.operacao_mapa_entregadores where ativo and posicao_incerta) as entregadores_posicao_incerta;

comment on view public.operacao_resumo is
  'Contadores do cabecalho da tela de operacao. Uma linha.';


-- A anon key e publica (vai no bundle). As views sao superficie interna:
-- so o papel authenticated le, e o RLS das tabelas base decide o conteudo.
revoke all on public.operacao_mapa_entregadores from anon;
revoke all on public.operacao_mapa_pontos       from anon;
revoke all on public.operacao_fila_coletas      from anon;
revoke all on public.operacao_resumo            from anon;

grant select on public.operacao_mapa_entregadores to authenticated;
grant select on public.operacao_mapa_pontos       to authenticated;
grant select on public.operacao_fila_coletas      to authenticated;
grant select on public.operacao_resumo            to authenticated;

-- Higiene: as duas views antigas da coleta rodavam como SECURITY DEFINER.
alter view public.enderecos_geo_revisar       set (security_invoker = on);
alter view public.coletas_aguardando_unidade  set (security_invoker = on);
