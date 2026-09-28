-- =====================================================================
-- coleta_historico_views.sql
-- Histórico de coletas encerradas e linha do tempo para o painel.
-- Destino: secretaria-virtual-panel/supabase/coleta_historico_views.sql
--
-- APLICADO em 27/09/2026 no Supabase oocyvlhvuqpoyxdzimjv,
-- migração `operacao_historico_v1`.
-- Idempotente. Ordem: depois de coleta_panel_views.sql.
--
-- security_invoker = on: a view respeita o RLS de quem consulta.
-- =====================================================================

create or replace view public.operacao_historico_coletas
with (security_invoker = on) as
select
  base.id,
  base.protocolo,
  base.status,
  base.urgencia,
  base.tentativas_atribuicao,
  base.clinica_id,
  base.clinica,
  base.endereco_id,
  base.unidade,
  base.endereco_resumo,
  base.entregador_id,
  base.entregador,
  base.criada_em,
  base.atribuida_em,
  base.aceita_em,
  base.coletando_em,
  base.coletado_em,
  base.entregue_em,
  base.encerrada_em,
  base.min_ate_aceite,
  base.min_ate_retirada,
  base.min_ate_entrega,
  case
    when base.encerrada_em is not null and base.criada_em is not null
      then floor(extract(epoch from (base.encerrada_em - base.criada_em)) / 60)::int
    else null
  end as min_total,
  base.cancelamento_motivo,
  base.cancelamento_operador,
  base.qtd_eventos
from (
  select
    co.id,
    co.protocolo,
    co.status::text as status,
    co.urgencia::text as urgencia,
    co.tentativas_atribuicao,
    c.id as clinica_id,
    coalesce(nullif(btrim(c.nome_fantasia), ''), c.nome)::text as clinica,
    en.id as endereco_id,
    en.tipo_endereco::text as unidade,
    coalesce(
      nullif(concat_ws(', ',
        nullif(btrim(concat_ws(' ', en.logradouro, en.numero)), ''),
        nullif(btrim(en.bairro), ''),
        nullif(btrim(en.cidade), '')), ''),
      co.endereco_coleta
    ) as endereco_resumo,
    e.id as entregador_id,
    e.nome as entregador,
    co.criada_em,
    co.atribuida_em,
    co.aceita_em,
    co.coletando_em,
    co.coletado_em,
    co.entregue_em,
    case
      when co.status = 'entregue' then coalesce(co.entregue_em, fim.criado_em)
      else coalesce(cancel.criado_em, fim.criado_em)
    end as encerrada_em,
    case
      when co.atribuida_em is not null and co.aceita_em is not null
        then floor(extract(epoch from (co.aceita_em - co.atribuida_em)) / 60)::int
      else null
    end as min_ate_aceite,
    case
      when co.aceita_em is not null and co.coletado_em is not null
        then floor(extract(epoch from (co.coletado_em - co.aceita_em)) / 60)::int
      else null
    end as min_ate_retirada,
    case
      when co.coletado_em is not null and co.entregue_em is not null
        then floor(extract(epoch from (co.entregue_em - co.coletado_em)) / 60)::int
      else null
    end as min_ate_entrega,
    cancel.motivo as cancelamento_motivo,
    cancel.operador as cancelamento_operador,
    coalesce(fim.qtd, 0) as qtd_eventos
  from public.coletas co
  join public.clientes c on c.id = co.clinica_id
  left join public.enderecos en on en.id = co.endereco_id
  left join public.entregadores e on e.id = co.entregador_id
  left join lateral (
    select
      ce.criado_em,
      ce.payload->>'motivo' as motivo,
      ce.payload->>'operador' as operador
    from public.coleta_eventos ce
    where ce.coleta_id = co.id
      and ce.evento = 'cancelada'
    order by ce.criado_em desc
    limit 1
  ) cancel on true
  left join lateral (
    select max(ce.criado_em) as criado_em, count(*)::bigint as qtd
    from public.coleta_eventos ce
    where ce.coleta_id = co.id
  ) fim on true
  where co.status in ('entregue', 'cancelada')
) base;

comment on view public.operacao_historico_coletas is
  'Coletas encerradas (entregue ou cancelada). Duracoes null quando a etapa nao ocorreu. encerrada_em = entregue_em, ou o evento de cancelamento.';


create or replace view public.operacao_coleta_eventos
with (security_invoker = on) as
select
  ce.coleta_id,
  ce.id as evento_id,
  ce.criado_em,
  ce.evento,
  ce.ator::text as ator,
  ce.payload,
  nullif(btrim(ce.payload->>'operador'), '') as operador,
  nullif(btrim(ce.payload->>'motivo'), '') as motivo,
  ent.nome as entregador
from public.coleta_eventos ce
left join public.entregadores ent
  on ent.id::text = ce.payload->>'entregador_id';

comment on view public.operacao_coleta_eventos is
  'Linha do tempo de uma coleta. operador e motivo saem do payload; entregador resolve o id do payload.';


revoke all on public.operacao_historico_coletas from anon;
revoke all on public.operacao_coleta_eventos from anon;

grant select on public.operacao_historico_coletas to authenticated;
grant select on public.operacao_coleta_eventos to authenticated;
