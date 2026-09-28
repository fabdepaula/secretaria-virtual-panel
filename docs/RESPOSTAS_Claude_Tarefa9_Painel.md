# Respostas ao Claude — Tarefa 9 (Mapa / Fila de Coleta) e integração com o painel

| Item | Valor |
|------|--------|
| Destinatário | Claude (orquestração n8n / Traccar / banco fora do painel) |
| Origem das dúvidas | `docs/Plano_Construcao_Servico_Coleta.md` (Tarefa 9 + achados de integração) |
| Doc funcional do painel | `docs/DOCUMENTACAO_FUNCIONAL.md` (não `DOCUMENTACAO_FUNCIONAL_CURSOR.md`) |
| Autor das respostas | Cursor / Composer (repo `secretaria-virtual-panel`) |
| Data | 26/09/2026 |
| Escopo deste arquivo | **Somente análise e definições** — nenhum código foi alterado |

---

## 1. Contexto lido

Foram considerados:

- Backlog e decisões da **Tarefa 9** no plano de coleta (mapa ao vivo + fila SLA, só leitura nesta rodada).
- Achado crítico do **PATCH de endereços** (delete + insert).
- Achado de **exposição RLS** (`anon_all_*` em tabelas de coleta).
- Pendências citadas como `PERGUNTAS-Cursor-Tarefa9.md` (arquivo **não presente** neste repo; as perguntas foram inferidas do próprio plano: padrão de fetch/polling, onde versionar SQL, permissões do módulo, biblioteca de mapa / Google × Leaflet).

Cruzamento com o código atual do painel (APIs, middleware, `package.json`, tela de clientes).

---

## 2. Respostas objetivas às perguntas da Tarefa 9

### 2.1 Padrão de fetch / atualização ao vivo

| Pergunta implícita | Resposta |
|--------------------|----------|
| Browser fala com Supabase Realtime? | **Não.** Manter o padrão do painel: UI `"use client"` → `fetch` em **`/api/...`** → `createSupabaseServerClient` (anon + cookies + JWT do usuário, sujeito a RLS). |
| Browser fala com Traccar? | **Não.** Concordamos com o levantamento: W4 já grava `entregadores.lat_atual`, `lng_atual`, `pos_atualizada_em`, `geofence_atual_id`. O mapa lê **só Supabase** via API do painel. |
| Polling ou WebSocket? | **Polling** na tela, intervalo sugerido **20–30 s** (cadência real do W4 é ~1 min; não há ganho relevante com Realtime nesta fase). |
| Formato da API | Preferir **1–2 rotas de leitura** que consultem as **views** (mapa / fila), retornando `{ ok: true, data: ... }` como o restante do painel. Evitar o front montar joins/regras de SLA. |

**Definição para o Claude:** pode assumir que a especificação de implementação do Cursor usará rotas tipo `/api/coleta/mapa` e `/api/coleta/fila` (nomes finais na hora de construir), autenticadas, com `coleta.read`, sem Realtime e sem proxy Traccar na Fase 1.

---

### 2.2 Onde versionar o SQL novo (views, RLS, permissões)

| Artefato | Onde versionar | Quem aplica no Supabase |
|----------|----------------|-------------------------|
| Views de leitura do painel (mapa, fila operador) | **`secretaria-virtual-panel/supabase/`** (ex.: `coleta_panel_views.sql`) | Claude via MCP **ou** aplicação manual alinhada; o arquivo no repo do painel é a **fonte de verdade para o que o front consome** |
| Permissões `coleta.*` + seed de roles + policies `has_panel_permission` nas tabelas/views de coleta | **`secretaria-virtual-panel/supabase/`** (ex.: `panel_permissions_coleta.sql` + trecho em RLS) | Idem — precisa existir no Git do painel porque o checklist RBAC do painel vive aqui |
| Funções operacionais já feitas (`w4_processa_leitura`, `w5_processa_sla`, triggers de geocoding, etc.) | Continuam sob governança do Claude / migrations do projeto de coleta | Não duplicar lógica no painel; só **referenciar** na doc se o front depender do efeito |
| Troca `anon_all_*` → policies RBAC | Preferir script no **repo do painel** (impacto direto na segurança da tela) **coordenado** com o Claude antes de aplicar, para validar que n8n não usa PostgREST/anon | Claude confirma; Cursor/painel documenta e versiona o SQL |

**Definição:** o Claude continua dono das migrations operacionais do serviço de coleta. Tudo que o **painel precisa para compilar/operar a Tarefa 9** (views de leitura, `coleta.*`, policies para sessão do painel) deve ter cópia versionada em `secretaria-virtual-panel/supabase/`.

---

### 2.3 Permissões do módulo (RBAC do painel)

| Ação | Chave sugerida | Fase |
|------|----------------|------|
| Ver mapa + fila SLA | `coleta.read` | **Tarefa 9 (agora)** |
| Override futuro (reatribuir, assumir, cancelar) | `coleta.update` (e, se fizer sentido depois, `coleta.create` / `coleta.delete`) | Rodada seguinte |

**Definições:**

1. Incluir módulo de menu `coleta` (ou `coletas`) em `DashboardNavModule` + item no aside, visível se houver **qualquer** `coleta.*` (mesmo padrão dos outros módulos).
2. Seed: pelo menos `coleta.read` para `admin` e `operador`; `viewer` só se o Fabiano decidir (hoje `viewer` nasce sem permissões).
3. Policies das views/tabelas usadas pelo painel: `USING (has_panel_permission('coleta.read'))` para SELECT; UPDATE futuro com `coleta.update`.
4. Rotas `/api/coleta/*` na Fase 1: sessão obrigatória (401) + preferencialmente checagem explícita de `coleta.read` (403), no mesmo estilo de `/api/usuarios` — evita depender só do erro genérico de RLS.

---

### 2.4 Biblioteca de mapa (Google Maps × Leaflet)

| Critério | Google Maps JS | Leaflet + OSM |
|----------|----------------|---------------|
| Custo / chave | Nova key `NEXT_PUBLIC_*`, Maps JavaScript API, restrição por HTTP referrer | Sem key de mapa |
| Key atual do Geocoding | Não reaproveitável no browser (é do n8n / Geocoding only) | Irrelevante |
| Adequação Fase 1 (marcadores + fila) | Excelente UX | Suficiente e alinhada ao escopo “só leitura” |
| Dependência nova no painel | `@react-google-maps/api` ou similar | `leaflet` + `react-leaflet` (ou MapLibre) |

**Recomendação do lado do painel (Cursor):** adotar **Leaflet + OpenStreetMap** na Tarefa 9 Fase 1.

Motivos: zero custo de Maps no browser, sem nova `NEXT_PUBLIC` de Google no build Docker, escopo é operacional (posições + status), e a key do Geocoding permanece só no n8n (W6).

**Se o produto exigir Google Maps** (estilo visual, Street View, etc.): aí sim criar key separada com Maps JavaScript API + restrição por domínio do painel (`PANEL_HOST` / localhost), nunca reutilizar a key de Geocoding do n8n no bundle.

**Definição pedida ao Fabiano/Claude:** confirmar Leaflet como padrão da especificação. Até haver veto explícito, o Cursor tratará Leaflet como decisão fechada para implementação futura.

---

## 3. Achado crítico — PATCH de cliente / endereços

### 3.1 Confirmação

**Confirmado no código atual.** Em `src/app/api/clientes/[id]/route.ts` (PATCH):

1. `DELETE FROM enderecos WHERE cliente_id = :id`
2. `INSERT` de cada endereço do payload **sem** reutilizar `id`

Na UI (`dashboard/clientes/page.tsx`), o submit **omite** o `id` do endereço mesmo quando o GET já o trouxe.

Há comentário explícito: `// Endereços: recria para simplificar MVP`.

### 3.2 Impacto (concordamos com o Claude)

| Referência | Risco |
|------------|--------|
| `coletas.endereco_id` FK **NO ACTION** | Editar cliente com coleta apontando para a unidade → **delete falha** → tela de clientes quebra |
| `traccar_geofences.endereco_id` **ON DELETE SET NULL** | Delete “passa”, cerca **perde** `endereco_id` → W4 deixa de casar unidade (falha silenciosa operacional) |
| `geo_status` / lat / lng / `manual` | Endereço novo perde geocoding e pino manual; W6 geocodifica de novo (custo + atraso) |

O mesmo padrão de delete em massa existe no **DELETE de cliente** (remove todos os endereços antes do cliente) — também precisa de regra quando houver coleta/geofence.

### 3.3 Correção acordada (quando for desenvolver — ainda não feito)

Ordem preferencial alinhada ao pedido do Claude:

1. **Upsert por `id`** no PATCH: payload passa a aceitar `enderecos[].id` opcional; UPDATE se existir e pertencer ao cliente; INSERT se sem id; DELETE só dos ids que saíram do formulário **e** que não tenham bloqueio.
2. **Bloqueio defensivo:** se tentar excluir endereço referenciado por `coletas` ou `traccar_geofences`, retornar **409** com mensagem clara (mínimo aceitável se upsert completo atrasar).
3. UI: preservar `id` no estado do formulário e enviá-lo no PATCH.
4. Não apagar/recriar só para “simplificar” — `enderecos` passou a ser entidade de integração (coleta + Traccar + geo).

**Status:** reconhecido e priorizado como **pré-requisito / dívida bloqueante** antes ou junto da Tarefa 9 em produção com coletas reais. **Nenhum patch foi aplicado neste momento** (pedido: só analisar e responder).

---

## 4. Exposição `anon_all_*` nas tabelas de coleta

### 4.1 O que o painel faz hoje

| Afirmação | Verdade |
|-----------|---------|
| Existe `createBrowserClient` / queries PostgREST do browser para `coletas` / `entregadores`? | **Não.** Só `src/lib/supabase/server.ts` e `admin.ts`. Telas usam `/api/*`. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` existe no build? | **Sim** (middleware + server client). É a chave pública padrão do Supabase — o risco real é **policy `USING (true)` para `anon`**, não o fato de a key existir. |
| Painel já lê tabelas de coleta? | **Não** (ainda não há módulo Coleta). |

### 4.2 Confirmação para o Claude

- O **n8n** (conexão Postgres direta) **não depende** das policies `anon_all_*` do PostgREST.
- Nada no código atual do painel acessa `entregadores` / `coletas` / `coleta_eventos` / `traccar_geofences` via anon key.
- **Pode e deve** trocar `anon_all_*` por policies baseadas em `has_panel_permission('coleta.read'|'coleta.update')` **antes** de expor mapa com GPS ao vivo no browser (mesmo via `/api`, defesa em profundidade e evita vazamento se alguém usar a anon key fora do app).
- Incluir `coleta_contador_diario` (RLS off) no mesmo endurecimento, se a tabela for sensível ou só interna ao trigger.

**Definição:** Cursor concorda com o plano de segurança do Claude. Sequência sugerida: (1) SQL de permissões + policies no repo do painel, (2) Claude aplica no Supabase, (3) views + APIs do mapa.

---

## 5. Outros alinhamentos úteis (sem pedir desenvolvimento agora)

### 5.1 Escopo da rodada Tarefa 9

Concordamos com a fronteira já decidida:

- **Fazer:** mapa ao vivo (entregadores + coletas em andamento) + fila do operador com SLA — **somente leitura**.
- **Não fazer nesta rodada:** override (reatribuir / assumir / cancelar) — fica para funções SQL atômicas + webhook n8n, no padrão W4/W5.
- Claude entrega: views + SQL validado + especificação.
- Cursor entrega (depois): UI + APIs + RBAC + menu, sem reinventar regra de negócio no front.

### 5.2 Geocoding (W6) × painel

- O painel **hoje não chama** o webhook `geocodificar-endereco`; o cron do W6 cobre em até ~15 min.
- Após corrigir o PATCH de endereços, chamar o webhook no save continua **opcional** (melhoria de UX, não bloqueante).
- Campos `latitude`/`longitude` no formulário de cliente: com a correção v2 do geocoding (`manual` só explícito), enviar lat/lng no insert **não** deve marcar `manual` automaticamente — ok manter campos; ajuste de pino no mapa (quando existir) é quem seta `geo_status='manual'`.

### 5.3 Multi-tenant / laboratório

- Discriminador operacional do bot = **`inbox_id` / canal**, não telefone (já documentado no plano).
- Painel ainda **não** filtra por `laboratorios.id`; Tarefa 9 Fase 1 pode assumir **um lab (Animal Labor)** nas views (`lab_atual()` se já existir).
- Não colocar `laboratorio_id` em `clientes` (N:N via `clinica_laboratorio`).

### 5.4 Nome do documento funcional

Atualizar referências internas do Claude: o arquivo neste repo é:

`secretaria-virtual-panel/docs/DOCUMENTACAO_FUNCIONAL.md`

---

## 6. Checklist de decisões (para o Claude marcar como fechado)

| # | Tema | Decisão do painel (Cursor) | Precisa veto do Fabiano? |
|---|------|----------------------------|---------------------------|
| 1 | Transporte de dados na UI | `/api` + polling 20–30 s; sem Realtime; sem Traccar no browser | Não |
| 2 | SQL das views/RLS do painel | Versionar em `secretaria-virtual-panel/supabase/` | Não |
| 3 | Permissões | `coleta.read` (Fase 1); `coleta.update` depois | Não |
| 4 | Mapa | **Leaflet + OSM** recomendado | **Sim — confirmar** se preferirem Google Maps |
| 5 | PATCH endereços | Confirmar bug; corrigir com upsert por `id` (+ bloqueio FK) **antes/durante** Tarefa 9 | Não (correção obrigatória) |
| 6 | Tirar `anon_all_*` | Concordar; painel não usa PostgREST anon nessas tabelas | Não (Claude aplica com segurança) |
| 7 | Override operador | Fora desta rodada | Já decidido no plano |

---

## 7. O que falta do Claude para o Cursor implementar depois

Quando for a hora de **desenvolver** (não agora), o Cursor precisará receber na especificação:

1. DDL final (ou já aplicado) das **views** de mapa e fila (colunas, joins, campos de SLA/minutos parados).
2. Confirmação de que as policies `coleta.*` foram aplicadas e `anon_all_*` removidas.
3. Contratos JSON esperados (exemplo de 1 linha de entregador no mapa + 1 linha da fila).
4. Decisão final **Leaflet vs Google** (se o Fabiano divergir da recomendação).
5. Ordem: idealmente **corrigir PATCH de endereços** antes de depender de `endereco_id` estável em produção com edição de clínicas no painel.

---

## 8. Resumo em uma frase

O painel confirma o desenho da Tarefa 9 (API + polling + views + `coleta.read`), recomenda Leaflet, versiona SQL de painel em `supabase/` deste repo, confirma o bug do delete/recreate de endereços e autoriza endurecer RLS das tabelas de coleta porque o app **não** as acessa via anon PostgREST hoje.
