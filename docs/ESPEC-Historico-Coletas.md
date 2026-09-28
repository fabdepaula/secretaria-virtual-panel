# Especificação — Histórico de coletas

| Item | Valor |
|---|---|
| Destinatário | Cursor / Composer (`secretaria-virtual-panel`) |
| Depende de | Tela de operação (rodada 1) e ações do operador (rodada 2), ambas já implementadas |
| Banco | Migração `operacao_historico_v1` **já aplicada** em `oocyvlhvuqpoyxdzimjv` |
| SQL a versionar | `coleta_historico_views.sql` em `supabase/` |
| Permissão | `coleta.read` (já existe) |

---

## 1. O problema

`operacao_fila_coletas` exclui `entregue` e `cancelada`, porque é a fila do que exige ação agora. O efeito colateral não foi previsto: **a coleta desaparece da tela quando termina**. Hoje o painel não responde "a coleta de ontem da clínica X chegou que horas?", nem mostra o que aconteceu com uma coleta cancelada.

Isso aparece já no primeiro teste de campo: no instante em que o GPS marcar `entregue`, a linha some.

---

## 2. O que já está no banco

Duas views, mesmo padrão das outras (`security_invoker = on`, `revoke` de `anon`, `grant select` para `authenticated`), então o RLS e a permissão `coleta.read` continuam decidindo o conteúdo.

### `operacao_historico_coletas`

Coletas encerradas. Traz os mesmos campos de identificação da fila (protocolo, clínica, unidade, endereço, entregador) mais:

| Campo | O que é |
|---|---|
| `encerrada_em` | entrega, ou o último evento quando cancelada |
| `min_ate_aceite` | da atribuição até o entregador aceitar |
| `min_ate_retirada` | do aceite até sair da clínica com o material |
| `min_ate_entrega` | da retirada até chegar ao laboratório |
| `min_total` | do pedido da clínica até o encerramento |
| `cancelamento_motivo`, `cancelamento_operador` | preenchidos quando cancelada |
| `qtd_eventos` | tamanho da linha do tempo |

As durações vêm **null** quando a etapa não aconteceu, por exemplo numa coleta cancelada antes da retirada. Não exibir como zero: zero é uma afirmação falsa sobre algo que não ocorreu.

Isto não é tela de métricas. É o registro por coleta. Métrica agregada segue fora de escopo, mas estes quatro tempos são a matéria-prima dela.

### `operacao_coleta_eventos`

Linha do tempo de uma coleta: `criado_em`, `evento`, `ator`, `operador`, `motivo` e `entregador` (já resolvido do id que está no payload). Filtrar por `coleta_id`.

---

## 3. Rotas

### `GET /api/coleta/historico`
Sessão obrigatória (401) e checagem explícita de `coleta.read` (403), como nas outras rotas de coleta.

Parâmetros: `de` e `ate` (filtram `encerrada_em`; padrão últimos 7 dias), `q` (busca por protocolo ou nome da clínica), `limit`/`offset`. Ordenar por `encerrada_em desc`.

```json
{ "ok": true, "data": { "coletas": [ /* linhas da view */ ], "total": 42 } }
```

Filtro e busca no `.from(...)`, nunca em memória.

### `GET /api/coleta/[id]/eventos`
Mesmas checagens. Serve `operacao_coleta_eventos` da coleta, ordenado por `criado_em asc`.

---

## 4. Tela

Aba ou seção **Histórico** ao lado da fila, na mesma rota `/dashboard/coleta`. Filtro de período, campo de busca e a lista ordenada da mais recente para a mais antiga.

Colunas: protocolo, encerrada em, clínica e unidade, entregador, status (entregue ou cancelada) e os tempos. Na linha cancelada, mostrar o motivo.

Diferente da fila, o histórico **não precisa de polling**: é passado, não muda sozinho. Buscar ao abrir a aba e ao trocar o filtro, e só.

**Detalhe da coleta com a linha do tempo**, aberto tanto da fila quanto do histórico. Sem ela o operador vê o estado mas não a história, e é a história que explica por que a coleta está onde está: quem reatribuiu, quem cancelou e por quê, quantas vezes foi recusada, se o GPS marcou a chegada ou se foi o operador que agiu.
