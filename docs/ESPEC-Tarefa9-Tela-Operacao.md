# Especificação — Tela de Operação da Coleta (Tarefa 9, rodada 1)

| Item | Valor |
|---|---|
| Destinatário | Cursor / Composer (repo `secretaria-virtual-panel`) |
| Escopo | **Somente leitura**: mapa ao vivo + fila do operador com SLA |
| Fora de escopo | Override (reatribuir, assumir, cancelar) — rodada 2, via função SQL atômica + webhook n8n |
| Banco | Supabase `oocyvlhvuqpoyxdzimjv` (LabVet Homol). Views e RLS **já aplicados** |
| Mapa | **Leaflet + OpenStreetMap** (confirmado pelo Fabiano em 26/09/2026) |
| SQL a versionar | `coleta_panel_views.sql` e `panel_permissions_coleta.sql` em `supabase/` |

---

## 1. O que já está pronto no banco

Aplicado em 26/09/2026, migrações `operacao_views_v1`, `operacao_rbac_coleta_v1`, `views_security_invoker_v1`, `coleta_rls_fecha_anon_v1`.

**4 views**, todas com `security_invoker = on`, com `grant select` só para `authenticated` e `revoke` de `anon`:

| View | Conteúdo |
|---|---|
| `operacao_mapa_entregadores` | 1 linha por entregador: posição, status, frescor da posição, carga, cerca atual |
| `operacao_mapa_pontos` | pontos fixos: unidades de clínica geocodificadas e o laboratório |
| `operacao_fila_coletas` | coletas em aberto (exclui `entregue` e `cancelada`) com SLA e prioridade |
| `operacao_resumo` | 1 linha de contadores |

**RBAC:** `coleta.read` e `coleta.update` em `panel_permissions`, vinculadas a `admin` e `operador`. Policies `for select to authenticated using (has_panel_permission('coleta.read'))` em `entregadores`, `coletas`, `coleta_eventos` e `traccar_geofences`.

**Importante:** as policies `anon_all_*` foram removidas. Sem `coleta.read` a consulta devolve **zero linhas, não erro**. Por isso a rota precisa checar a permissão explicitamente e responder 403, como `/api/usuarios` faz.

---

## 2. Rotas de API

Duas rotas, ambas `GET`, ambas no padrão `{ ok: true, data }` / `{ ok: false, message }`.

### 2.1 `GET /api/coleta/mapa`

```ts
// src/app/api/coleta/mapa/route.ts
export const dynamic = "force-dynamic";
```

1. `createSupabaseServerClient()` → `auth.getUser()`. Sem usuário: **401**.
2. `supabase.rpc("has_panel_permission", { permission_key: "coleta.read" })`. Falso: **403 "Sem permissão"**.
3. Duas consultas em paralelo, com o mesmo client de sessão:
   - `.from("operacao_mapa_entregadores").select("*")`
   - `.from("operacao_mapa_pontos").select("*")`
4. Resposta:

```json
{
  "ok": true,
  "data": {
    "entregadores": [ /* linhas de operacao_mapa_entregadores */ ],
    "pontos": [ /* linhas de operacao_mapa_pontos */ ],
    "gerado_em": "2026-09-26T19:22:00.000Z"
  }
}
```

`gerado_em` é do servidor e serve para a tela mostrar "atualizado há X s" sem depender do relógio do cliente.

### 2.2 `GET /api/coleta/fila`

Mesmos passos 1 e 2. Consultas:
- `.from("operacao_fila_coletas").select("*").order("prioridade").order("desde")`
- `.from("operacao_resumo").select("*").single()`

```json
{
  "ok": true,
  "data": {
    "coletas": [ /* linhas de operacao_fila_coletas */ ],
    "resumo": { /* 1 linha */ },
    "gerado_em": "2026-09-26T19:22:00.000Z"
  }
}
```

**Não** filtrar nem recalcular SLA no front. Se precisar de filtro por status, aceitar `?status=` na query e aplicar no `.eq()`/`.in()`, nunca em memória.

---

## 3. Contratos de exemplo (linhas reais do teste com fixtures)

### `entregadores[]`

```json
{
  "id": "eabaa008-5c05-4f0f-b411-4d37e7ac0990",
  "nome": "Entregador Teste",
  "status": "ocupado",
  "ativo": true,
  "latitude": -22.72,
  "longitude": -47.63,
  "pos_atualizada_em": "2026-09-26T19:21:20.000Z",
  "segundos_desde_posicao": 40,
  "posicao_incerta": false,
  "coletas_ativas": 2,
  "capacidade_max": 5,
  "sem_vaga": false,
  "geofence_atual_id": 1,
  "geofence_papel": "clinica",
  "geofence_descricao": "Amor Pet - Vila Independencia",
  "geofence_desde": "2026-09-26T19:19:00.000Z",
  "id_dispositivo_gps": "entregador-teste-9f3a1c7b"
}
```

`status` ∈ `disponivel | ocupado | offline`. `latitude`/`longitude` podem ser `null` (entregador que nunca reportou GPS): nesse caso **não desenhar marcador**, listar na legenda como "sem posição".

### `pontos[]`

```json
{
  "tipo": "clinica",
  "id": "fbc0cecd-9513-493a-9a42-d7542813fdde",
  "nome": "Amor Pet",
  "unidade": "Unidade - Vila Independência",
  "cliente_id": "b5923c57-e749-41d8-86e0-39d257897057",
  "latitude": -22.7192577,
  "longitude": -47.6284599,
  "geo_status": "ok",
  "geo_precisao": "ROOFTOP",
  "aceita_coleta": true,
  "endereco_resumo": "Rua Dona Eugênia 2379, Vila Independência, Piracicaba",
  "geofence_id": 1,
  "raio_geofence_m": 100
}
```

`tipo` ∈ `clinica | laboratorio`. Na linha do laboratório, `unidade`, `cliente_id` e `aceita_coleta` vêm `null`.

### `coletas[]`

```json
{
  "id": "…",
  "protocolo": "2609261622140007",
  "status": "atribuida",
  "urgencia": "urgente",
  "janela_horario": null,
  "tentativas_atribuicao": 1,
  "clinica_id": "b5923c57-…",
  "clinica": "Amor Pet",
  "endereco_id": "fbc0cecd-…",
  "unidade": "Unidade - Vila Independência",
  "endereco_resumo": "Rua Dona Eugênia 2379, Vila Independência, Piracicaba",
  "coleta_latitude": -22.7192577,
  "coleta_longitude": -47.6284599,
  "entregador_id": "eabaa008-…",
  "entregador": "Entregador Teste",
  "entregador_status": "ocupado",
  "entregador_latitude": -22.72,
  "entregador_longitude": -47.63,
  "entregador_pos_em": "2026-09-26T19:21:20.000Z",
  "criada_em": "2026-09-26T19:14:00.000Z",
  "atribuida_em": "2026-09-26T19:16:00.000Z",
  "aceita_em": null,
  "coletando_em": null,
  "coletado_em": null,
  "desde": "2026-09-26T19:16:00.000Z",
  "minutos_no_status": 6,
  "ultimo_evento_em": "2026-09-26T19:16:02.000Z",
  "sla_limite_min": 5,
  "sla_estourado": true,
  "exige_operador": false,
  "prioridade": 2
}
```

`status` ∈ `solicitada | aguardando_unidade | atribuida | aceita | coletando | coletado | sem_entregador`.

`sla_limite_min` é `null` nos status que não têm SLA nesta fase (`solicitada`, `aguardando_unidade`, `sem_entregador`); nesses casos `sla_estourado` é sempre `false` e o que chama atenção é `exige_operador`.

### `resumo`

```json
{
  "coletas_abertas": 6, "exigem_operador": 2, "sla_estourado": 2,
  "solicitadas": 1, "atribuidas": 1, "em_curso": 2,
  "entregadores_disponiveis": 0, "entregadores_ocupados": 1,
  "entregadores_offline": 0, "entregadores_posicao_incerta": 0
}
```

---

## 4. Tela

Rota `/dashboard/coleta`. Layout em duas colunas no desktop (mapa à esquerda ocupando o maior espaço, fila à direita), empilhado no mobile com o mapa em altura fixa (~320px) e a fila abaixo. Cabeçalho com os contadores do `resumo` e a hora da última atualização.

### 4.1 Atualização

`setInterval` de **25 s** disparando as duas rotas, com três cuidados:

1. Pausar quando `document.visibilityState !== "visible"` e refazer a busca imediatamente ao voltar. O W4 roda de 1 em 1 min; não há razão para bater na API com a aba em segundo plano.
2. `AbortController` na troca de ciclo, para não aplicar resposta antiga.
3. Falha de rede não limpa a tela: manter os dados anteriores e mostrar um aviso discreto "sem atualizar desde HH:MM".

### 4.2 Mapa

`react-leaflet` + `leaflet`. No App Router o Leaflet toca `window` no import, então o componente do mapa precisa de `dynamic(() => import("./MapaColeta"), { ssr: false })` e o CSS do Leaflet importado uma única vez. Tiles: `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`, com a atribuição obrigatória do OSM visível.

Camadas:

- **Laboratório** (`tipo="laboratorio"`): marcador distinto, mais pesado, e `Circle` com `raio_geofence_m`.
- **Unidades de clínica** (`tipo="clinica"`): marcador padrão + `Circle` com `raio_geofence_m`. `aceita_coleta === false` fica com opacidade reduzida. `geo_status` diferente de `ok` e `manual` ganha um aviso no popup ("coordenada a revisar").
- **Entregadores**: marcador por cor de status, `disponivel`, `ocupado`, `offline`. `posicao_incerta === true` desenha com traço tracejado e o popup informa "posição de N min atrás". Sem coordenada, não desenha.
- Popup do entregador: nome, status, carga `coletas_ativas/capacidade_max`, frescor da posição, cerca atual quando houver.
- Popup da unidade: nome, unidade, endereço, e as coletas em aberto daquela unidade (cruzar `pontos.id` com `coletas[].endereco_id`, no cliente, que é só associação de chave, não regra de negócio).

Enquadramento inicial: `fitBounds` de todos os pontos e entregadores com posição. Guardar o enquadramento escolhido pelo usuário e **não** reenquadrar a cada ciclo de polling, senão o mapa "pula" a cada 25 s. Reenquadrar só num botão explícito.

### 4.3 Fila

Tabela ordenada por `prioridade` e depois por `desde`, no padrão de listagem das outras telas.

Colunas: protocolo, status, clínica + unidade, entregador, "parado há" (`minutos_no_status`), urgência.

Realce por linha: `exige_operador` em destaque forte (é a linha que espera ação humana), `sla_estourado` em alerta, `urgencia = "urgente"` com marcador próprio. Um chip no topo para filtrar "só o que exige atenção" (`exige_operador || sla_estourado`).

Clique na linha centraliza o mapa no ponto da coleta e abre o popup. Nesta rodada a fila é só leitura: nenhum botão de ação.

Datas em `America/Sao_Paulo`. "Parado há" vem de `minutos_no_status`, que o banco calcula: não recalcular a partir de `desde` no cliente, para a tela não divergir do W5.

### 4.4 Estados

- Carregando: skeleton na fila e mapa vazio com spinner.
- Vazio: "nenhuma coleta em aberto" na fila; o mapa continua mostrando unidades e laboratório.
- 403: mensagem de sem permissão, sem quebrar o layout (não deveria acontecer, porque o menu esconde o módulo).

---

## 5. RBAC e menu

1. `DashboardNavModule` ganha `coleta`; item no `DashboardAside` visível com qualquer `coleta.*`, como nos outros módulos.
2. Card em `/dashboard` seguindo o padrão por permissão.
3. As rotas checam `coleta.read` e devolvem 403. Não confiar no RLS para negar, porque sem permissão a view devolve lista vazia e a tela pareceria "sem dados" em vez de "sem acesso".
4. Tipos: regerar o arquivo de tipos do Supabase depois de aplicar o SQL, para as 4 views entrarem.

---

## 6. Pré-requisito que não é desta tela

O PATCH de cliente (e o DELETE) precisam parar de apagar e recriar endereços **antes** de clínicas reais serem editadas no painel. Desde 26/09/2026 a FK `traccar_geofences.endereco_id` é `ON DELETE RESTRICT`, então o comportamento mudou: onde antes a cerca perdia o vínculo em silêncio, agora a exclusão **falha**. Combinado com a FK de `coletas.endereco_id`, isso significa que editar uma clínica que já teve coleta vai estourar erro no salvamento até o upsert por `id` existir. O 409 com mensagem clara é o mínimo.

---

## 7. Fora de escopo nesta rodada

Override do operador, histórico de trajeto (exigiria proxy para o Traccar), métricas por entregador, resumo diário e qualquer escrita. A rodada 2 entrega funções SQL atômicas (`op_reatribui`, `op_assume`, `op_cancela`) chamadas por um webhook do n8n que encadeia o W2/W3, e a tela ganha os botões com `coleta.update`.
