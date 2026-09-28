# Plano de Construção — Serviço de Coleta (Animal Labor)
Painel de controle das tarefas de implementação. Documento-âncora: cada nova conversa começa referenciando uma tarefa daqui.

**Especificação de referência:** `Especificacao_Servico_Coleta_AnimalLabor.md` (mesma pasta).
**Última atualização:** 26/09/2026 — **Tarefa 7 (W5 — Monitor de SLA) CONSTRUÍDA e validada no banco**: função `w5_processa_sla` + colunas de SLA aplicadas; JSON `W5-Monitor-SLA.json` entregue; falta importar, aplicar o patch no W2 (`recusada`→`recusada,timeout`) e ativar. Tarefa 6 (W4) construída e validada. Registro anterior: 25/09/2026 — **Tarefa 10 (Traccar) CONCLUÍDA e testada com celular real**: servidor no ar, 3 geofences, device online. Criado também o cadastro de `contratantes` + `laboratorios` (ver `Modelo_Contratantes_Laboratorios.md`). **Próxima da ordem sugerida: Tarefa 6 (W4 — GPS + geofence).** Registro anterior: 24/09/2026 — **Multi-unidade resolvido**: migração `multi_unidade_coleta_v1` aplicada (`coletas.endereco_id`, `enderecos.aceita_coleta`, status `aguardando_unidade`, view `coletas_aguardando_unidade`) e W1/W2/W3 ajustados. A coleta agora aponta para a UNIDADE, não para o cliente. Tarefa 8 (Geocoding) concluída e em produção.

---

## Como usar este plano
1. Abra uma **conversa nova dentro deste projeto** (Secretária Laboratório Veterinário).
2. Diga a tarefa que quer fazer — por número ("vamos fazer a tarefa 1") ou com suas palavras ("cria o SQL das tabelas"). **Para a Tarefa 6, o ponto de entrada é `BRIEFING-Tarefa6-W4.md`.**
3. Eu leio o plano + a memória, confirmo o escopo, executo e **atualizo o status aqui** no fim.

**Legenda de status:** ⬜ a fazer · 🟡 em andamento · ✅ concluído · ⛔ bloqueado (aguardando decisão/insumo)

---

## Decisões/insumos pendentes (destravar antes ou durante)
- ~~**Acesso ao banco:** é **Supabase** (executo as tabelas por aqui) ou **Postgres self-hosted na VPS**?~~ → ✅ **Supabase** (MCP conectado, migrations aplicadas aqui).
- ~~**Nome exato da tabela de clínicas/clientes**~~ → ✅ **`public.clientes`**. A tabela `public.enderecos` (FK `cliente_id`) já tem `latitude` e `longitude` — **não é necessário alterar nenhuma tabela existente**. A Tarefa 8 (Geocoding) vai popular esses campos.
- **Conteúdo de `materiais`** (orientações de manuseio por material): depende da conversa com o laboratório. Não bloqueia o serviço — sem ele, dúvidas de material caem em handoff.
- ✅ **Multi-unidade (resolvido em 24/09/2026):** `coletas.endereco_id` criado; o telefone deixou de identificar a clínica e passou a devolver **candidatos** (clínica + unidade), porque um número pode atender mais de uma clínica e uma clínica tem várias unidades. Com 1 candidato a coleta segue direto; com 2+ ela nasce em `aguardando_unidade`, a IA pergunta e a resposta seguinte resolve. A unidade é o campo `tipo_endereco` do cadastro (ex.: "Unidade - Vila Independência"). W2 e W3 passaram a fazer join por `coletas.endereco_id`.
- **Teto de coletas simultâneas / tempo máx. em trânsito** por entregador (regra de negócio, material sensível). Pode ficar pra depois.

---

## Backlog de tarefas

### 1. Tabelas no banco  ✅
Criar `entregadores`, `coletas`, `coleta_eventos`, `materiais`.
`lat`/`lng` já existem em `enderecos` (ligada por `cliente_id`) — nenhuma tabela alterada.
Migration aplicada via Supabase MCP em 09/07/2026: `servico_coleta_tabelas_v1`.
RLS habilitada com policy `anon_all_*` em todas as 4 tabelas (padrão do projeto, compatível com n8n).

### 2. Infra do canal WhatsApp  ✅
Nova instância Evolution (`animallabor-coleta`, canal **Baileys**) + integração nativa Chatwoot (Account ID 1, inbox novo criado automaticamente) + webhook do Chatwoot apontando para `https://n8n.fpsoftware.cloud/webhook/receber-coleta` (node Webhook, método POST, path `receber-coleta`, auth None).
**Achado importante durante a implementação:** o webhook do Chatwoot (Settings → Integrations → Webhooks) é **por conta, não por inbox** — dispara para QUALQUER mensagem de QUALQUER inbox da conta 1. Isso causou cross-talk: a Ana Clara respondeu uma msg de teste do número novo. Corrigido adicionando um filtro **`{{ $json.body.conversation.inbox_id }}` equals `3`** logo após o node Webhook1 do workflow `1 - Secretaria` (inbox_id 3 = "Animal Labor"/Ana Clara). Testado e funcionando.
**⚠️ Pendência decorrente:** o mesmo cross-talk acontece no sentido inverso — o webhook `receber-coleta` também recebe mensagens da Ana Clara. Isso ainda não importa porque o Flow Recepção (clínica) só tem o node Webhook (sem lógica), mas **antes de adicionar lógica de verdade na Tarefa 3, é preciso descobrir o `inbox_id` do canal de Coleta** (visível no payload já capturado na execução de teste do webhook) **e adicionar o mesmo filtro** no novo fluxo, senão ele vai processar mensagens da Ana Clara também.
Entregável: número pareado, inbox ativo, webhook chegando no n8n. ✅ Feito e testado em 10/07/2026.

### 3. W1 — Recepção (clínica)  ✅
Identifica a clínica pelo telefone; classifica **pedido de coleta × dúvida técnica**; cria `coletas` (status `solicitada`); em dúvida, aciona a tool **SobreClinica** e aguarda o retorno; responde à clínica.
Depende de: 1, 2.
Entregável: workflow W1 funcionando com coleta de teste.
**Progresso (10/07/2026):** workflow completo entregue como JSON importável em `n8n-vetlabor-workflows/workflows/w1-recepcao-coleta.json` (51 nodes). Decisões: entregar JSON pra importar; **paridade com a Ana Clara** (filtro humano + áudio Whisper + imagem Gemini + buffer Redis 25s); **handoff pro operador** (label "Humano" no Chatwoot) quando a clínica não for identificada. Agente IA = **gpt-4.1 temp 0.6** (mesmo da Ana Clara), com tool `sobreClinica`, saída JSON `{tipo, resposta_texto, urgencia, janela_horario}` interpretada por Code node → insert em `coletas` + `coleta_eventos`. Nomes dos nodes novos em PT.
**Inbox de Coleta = `4`** (fixado no node "Filtro Inbox Coleta").
**Pendências pra ativar:** (a) importar no n8n; (b) conferir credenciais nos nodes reaproveitados (Redis, Postgres|LabVet Homol, OpenAi, Gemini, Groq); (c) teste com coleta real (telefone de clínica cadastrada). Identificação por telefone só funciona após `telefones/enderecos` populados (hoje 0 linhas → cai em handoff).

### 4. W2 — Roteirização  🟡
Escolhe o **entregador disponível mais próximo** (distância em linha reta), com **lock/idempotência**; fallback ao operador; override manual.
Depende de: 1, 3.
**Progresso (10/07/2026):** entregue como JSON importável `n8n-vetlabor-workflows/workflows/w2-roteirizacao.json` (11 nodes) + patch `w1-patch-chama-w2.json`. Sub-workflow **Execute Workflow** (recebe `coleta_id`). Toda a atribuição num **único SQL atômico** (node "Roteiriza"): `FOR UPDATE ... SKIP LOCKED` + haversine (fallback carga/rodízio quando sem coords/GPS >10min), marca `atribuida`, `coletas_ativas++` (vira `ocupado` ao lotar), loga evento; idempotente (coleta fora de `solicitada` → `ignorada`). **SQL testado no banco real** (atribuição, efeitos, idempotência) e dados de teste limpos. Fallback `sem_entregador` → alerta no **Chatwoot** + **grupo WhatsApp** (Evolution). Gancho pro W3 é um NoOp placeholder.
**Pendências pra ativar:** (a) importar W2; (b) preencher placeholders dos alertas — Chatwoot `__ID_CONVERSA_OPERADOR__`, e Evolution `__EVOLUTION_HOST__`/`__EVOLUTION_APIKEY__`/`__JID_GRUPO_LABORATORIO__`; (c) aplicar o patch no W1: adicionar o node "Chama W2 (Roteirização)" após **Registra Evento** (2ª saída, paralelo ao Monta Resposta), selecionando o W2 e mapeando `coleta_id = {{ $('Cria Coleta').item.json.id }}`, sem esperar o sub-workflow (não trava a resposta à clínica); (d) cadastrar entregadores (tabela `entregadores` vazia → hoje cai em `sem_entregador`).
**Override manual do operador:** fica pra tela do operador (Tarefas 7/9) — o W2 cobre só a atribuição automática.

### 5. W3 — Acionamento do entregador  ✅
**Funcionando ponta a ponta (23/09/2026):** teste real com clínica "amor pet" e "Entregador Teste" — W1→W2→W3-Acionamento→resposta do entregador→W1 desvia→W3-Resposta tratando ACEITO/RECUSO. Aprendizados na ativação: (1) o desvio de entregador no W1 (`setarInfo → É Entregador? → Remetente é Entregador? → [true] Chama W3-Resposta / [false] Identifica Clínica`) precisou ser adicionado manualmente no n8n — não vinha no import. (2) O node `Início (numero + texto)` do W3-Resposta ficou em **inputSource=passthrough**, então o Execute Workflow **ignora mapeamento** e repassa o item que chega; como o node anterior era o Postgres `É Entregador?`, só ia `entregador_id`/`entregador_nome`. Resolvido com um **Set `Prepara Resposta W3`** antes do `Chama W3` montando `numero={{ $('setarInfo4').first().json.msg.numberLead }}` e `texto={{ $('ConcatenaMsg').first().json.message }}` → passthrough repassa certo. Detecção casa pelo telefone: entregador precisa responder do número exato cadastrado em `entregadores.telefone_whatsapp`.

Envia a demanda no WhatsApp; trata **ACEITO / recusa / timeout** (re-roteiriza); notifica a clínica; recebe status manual como fallback.
Depende de: 4.

**Progresso (18/07/2026):** entregue como **2 sub-workflows Execute Workflow** + 2 patches, todos na pasta `n8n-vetlabor-workflows/workflows/`:
- **`w3-acionamento.json`** (outbound) — chamado pelo W2 quando a coleta fica `atribuida` (recebe `coleta_id`). Busca coleta+clínica+entregador, monta a demanda (nome da clínica, endereço, **link Google Maps** se houver coords, urgência, janela) e **envia ao entregador via Evolution** (instância `animallabor-coleta`) pedindo *ACEITO*/*RECUSO*; loga evento `acionado`.
- **`w3-resposta-entregador.json`** (inbound) — chamado pelo **W1** quando o remetente do inbox 4 é entregador (recebe `numero`+`texto`). Classifica *ACEITO*/*RECUSO*. **ACEITO** → SQL atômico marca `aceita` + **notifica a clínica** via Evolution ("entregador a caminho"). **RECUSO** → SQL atômico libera o entregador (`coletas_ativas--`, volta a `disponivel`), volta a coleta p/ `solicitada`, `tentativas_atribuicao++`, loga `recusada` (com `entregador_id`) e **re-chama o W2**.
- **W2 patchado in-place** (`w2-roteirizacao.json`): o NoOp gancho virou **`Chama W3 (Acionamento)`** (Execute Workflow, `coleta_id`, sem esperar); e o SQL `Roteiriza` ganhou **exclusão dos entregadores que já recusaram** aquela coleta (`NOT EXISTS ... coleta_eventos evento='recusada'`), pra a re-roteirização nunca reofertar pro mesmo.
- **`w1-patch-roteia-entregador.json`** — nós pra o W1 detectar remetente entregador (SQL por telefone) e rotear pro W3-Resposta (true) em vez do fluxo da clínica (false). Ligar entre `ConcatenaMsg` e `Identifica Clínica` (ver sticky no patch).

**Decisões de arquitetura (Fase 1):**
- **Aceite/recusa é stateless, dirigido pelo banco** (status da coleta), não por Wait+resume. A resposta do entregador chega no mesmo inbox 4 e é roteada pelo W1 → W3-Resposta. Mais robusto (sobrevive a restart do n8n) e consistente com o resto do sistema.
- **Timeout de aceite NÃO fica no W3** — é responsabilidade do **W5 (SLA)**, que re-dispara o W2 ou alerta o operador (spec §W5.1). Tarefa 7.
- **Texto livre, regra FIFO:** ACEITO/RECUSO se aplicam à coleta `atribuida` **mais antiga** do entregador. Botões interativos (Evolution) ficam p/ Fase 2 pra remover a ambiguidade quando o entregador tem várias coletas pendentes.
- **Notificação da clínica via Evolution** (sendText pro telefone da clínica), não via conversa Chatwoot, porque o W3-Resposta roda como sub-workflow sem o `conversation_id` da clínica em contexto.

**Pendências pra ativar:** (a) importar `w3-acionamento` e `w3-resposta-entregador`; (b) preencher `__EVOLUTION_HOST__`/`__EVOLUTION_APIKEY__` (mesmos do W2) nos nós Evolution dos dois; (c) no W2, selecionar o W3-Acionamento no node `Chama W3 (Acionamento)` (troca `__ID_DO_W3_ACIONAMENTO__`); (d) no W3-Resposta, selecionar o W2 no node `Re-roteiriza (W2)`; (e) aplicar o patch do W1 e selecionar o W3-Resposta no `Chama W3 (Resposta Entregador)`; (f) cadastrar entregadores (tabela vazia) pra testar 4→5 ponta a ponta.
**Limitação conhecida:** sem cap rígido de `tentativas_atribuicao` no W2 — a re-roteirização se auto-limita pela exclusão de recusantes (cada um recusa no máx. 1x → esgota → `sem_entregador` → operador). Um teto explícito (ex. 3) pode entrar junto com o W5.

### 6. W4 — GPS (Traccar) + presença + geofences  ✅ FUNCIONANDO (teste integrado Traccar+cron OK; falta só teste de campo real)

**➡️ COMECE POR `BRIEFING-Tarefa6-W4.md`** (raiz da pasta do projeto): briefing autocontido com ambiente, credenciais, ids, evidência do teste de cercas, decisões fechadas, proposta de desenho, armadilhas do n8n já pagas e pendências.

**TESTE DE CERCAS FEITO (25/09/2026, simulação).** Resultado completo em `traccar/RESULTADO-Teste-Geofence.md`. As 3 cercas dispararam enter/exit com raio 100 m. Três achados que mudam o W4:
1. **Falso positivo reproduzido:** um único ponto de raspão no Castelinho gerou entrada e saída com 4 s de diferença. Reagir ao `geofenceEnter` colocaria coleta em `coletando` por causa de carro passando. Permanência mínima é requisito, não refinamento.
2. **O evento não carrega os atributos da cerca**, só `geofenceId` numérico (`{id, attributes:{}, deviceId, type, eventTime, positionId, geofenceId, maintenanceId}`). Precisa de **tabela de mapeamento no Supabase** traduzindo `geofenceId` → `endereco_id`/`laboratorio_id`, senão vira uma chamada HTTP ao Traccar por evento.
3. **A posição já traz `geofenceIds`**, array das cercas que a contêm. Permanência vira "mesma cerca em leituras consecutivas separadas por ≥120 s", sem timer e imune a evento perdido.
**Proposta decorrente:** o W4 pode resolver tudo no **polling de posição** que já estava previsto, dispensando `event.forward.url`. Menos peça móvel, nenhum webhook novo exposto, coerente com o W3 stateless. Custo: atraso de 1 a 2 min do ciclo, irrelevante para a operação.

**Definições que já entram no W4 (decididas em 25/09/2026):**
- **Presença vem do GPS, não de "ON"/"OFF" no WhatsApp.** `laboratorios.presenca_origem = 'app_gps'`. Ligar o app do Traccar = em serviço; desligar = fora do turno, e o celular para de transmitir. O W4 deriva o status do device estar online/offline. A cadeia fecha sozinha: `status.timeout=600` → device offline → entregador `offline` → o SQL do W2 já filtra `status <> offline`. Motivo: fora da jornada não há justificativa para coletar localização, e filtrar no servidor não resolve, porque o dado já transitou.
- **Retenção de posições: 30 dias** (`laboratorios.retencao_posicoes_dias`). Job no Postgres do Traccar sobre `tc_positions` respeitando `tc_devices.positionid`; não existe chave de configuração para isso.
- **Permanência mínima de 2 min dentro da cerca é lógica do W4**, não do Traccar, que dispara no ponto que cruza a linha.
- **Casamento do evento** sai do atributo da cerca (`endereco_id` ou `laboratorio_id`), nunca do id que o Traccar manda.
- **Novo item para o W5 (Tarefa 7):** alertar o operador quando um entregador em serviço fica sem GPS (bateria, sinal), porque ele sai da roteirização em silêncio.
Consome posição e **eventos de geofence** do Traccar → transições automáticas (`coletando`/`coletado`/`entregue`); atualiza presença; alimenta o mapa.
Depende de: 1, 10.

**Progresso (26/09/2026) — construído e validado ponta a ponta no banco real:**
Desenho fechado com o Fabiano: **um único cron de 1 min, sem webhook** (a posição já traz `geofenceIds`). Toda a máquina de estados foi encapsulada numa **função SQL atômica** `public.w4_processa_leitura(device, online, lat, lng, gids)` — o n8n só a chama por device e recebe de volta a linha de notificação quando há `coletado`.

Migrações aplicadas no Supabase LabVet Homol:
- `w4_traccar_geofences_e_dwell_v1`: tabela **`traccar_geofences`** (geofence_id PK, papel, endereco_id, laboratorio_id) + colunas **`geofence_atual_id`/`geofence_desde`** em `entregadores`. Populada: cerca 1→Vila Independência, 2→Castelinho, 3→laboratório.
- `w4_add_ator_gps_v1`: valor **`gps`** adicionado ao enum `ator_coleta_enum`.
- `w4_processa_leitura_v1`/`_v2_cast`: a função + coluna **`leituras_fora_cerca`** em `entregadores`.

Regras implementadas (decisões do Fabiano):
- **Dwell por relógio real:** transição de entrada só quando `now() - geofence_desde >= permanencia_minima_s` (120 s). Raspão nunca chega lá.
- **Saída confirmada em 2 leituras** fora da cerca da clínica (`leituras_fora_cerca >= 2`) antes de `coletado` + notificar a clínica.
- **Presença nas bordas:** device offline → `offline`; ao voltar online recomputa pelo banco (`>= capacidade_max` → `ocupado`, senão `disponivel`) — nunca sobrescreve carga.
- **Entrega:** dentro da cerca do lab (dwell) → todas as `coletado` do entregador viram `entregue`, `coletas_ativas--`, status recomputado.
- **Casamento obrigatório:** só muda status de coleta cuja `endereco_id` bate com a cerca e que é daquele entregador. Tudo logado em `coleta_eventos` com ator `gps`.
- **Notificação ao `coletado`:** número resolvido no padrão do W3, instância `evolution_instancia_coleta` (`animallabor-coleta`), texto com protocolo.

**Testado no banco real** com o `Entregador Teste`: aceita→coletando→coletado(+notify)→entregue, presença offline/online com recompute (`ocupado`/`disponivel`), eventos ator `gps`. Fixtures removidos e entregador de teste zerado (`disponivel`, 0 ativas).

**Entregável:** `W4-GPS-Presenca-Geofences.json` (raiz da pasta do projeto — não na pasta sincronizada), JSON puro pronto para import.
**Pendências para ativar:** (a) criar credencial HTTP Header Auth "Traccar Bearer" (`Authorization: Bearer <token>`) e selecioná-la nos 2 nodes Traccar; (b) selecionar a credencial Postgres LabVet Homol no node Aplica Transição; (c) conferir host/apikey do Evolution no node de notificação (já no padrão do W3); (d) importar, ativar e fazer o **teste de campo real** (as cercas estão em Piracicaba; combinar cercas temporárias em Campinas).
**Fora do escopo (confirmado):** retenção de 30 dias (job no Postgres do Traccar, tarefa separada).

**Teste integrado OK (26/09/2026):** W4 ativo no n8n, GPS injetado no device de teste via OsmAnd (`traccar/w4-sim.sh`), cron real de 1 min. Ciclo completo passou: dentro da cerca da clínica → **coletando** (dwell 120s); saiu → 2 leituras fora → **coletado** + **WhatsApp real** recebido; dentro da cerca do lab → **entregue**, vaga liberada (`coletas_ativas`→0, `disponivel`). Eventos `coletando/coletado/entregue` com ator `gps`. Falta o teste de campo andando de verdade (precisão/cadência/bateria do Android).

### 7. W5 — Monitor de SLA  ✅ FUNCIONANDO (teste integrado OK; W2 patchado)
Cron que detecta coletas paradas (sem aceite, sem avanço) e alerta o operador; métricas do dia.
Depende de: 3, 4, 5.

**Progresso (26/09/2026):** desenho fechado com o Fabiano (uma pergunta por vez). Escopo Fase 1 = 4 casos; métricas ficam pra Fase 2.
Migração `w5_sla_colunas_v1`: colunas `sla_aceite_min`(5), `sla_parada_min`(30), `max_tentativas_atribuicao`(3) em `laboratorios` e `alerta_offline_em` em `entregadores`. Função atômica **`public.w5_processa_sla()`** (`w5_processa_sla_v1`/`_v2_texto`) devolve uma linha por ação (`rerotear`|`alerta`).
Casos: (1) timeout de aceite (`atribuida` > 5 min) → libera entregador, `tentativas++`, evento `timeout`, e re-roteiriza; ao atingir 3 tentativas (recusa+timeout) → `sem_entregador` + alerta. (2) coleta parada com dono (`aceita`/`coletando`/`coletado` > 30 min) → alerta operador. (3) fila `sem_entregador` abaixo do teto com candidato não-excluído → re-roteiriza. (4) entregador `offline` com coleta ativa → alerta. Dedup de 45 min (evento `alerta_sla` / `entregadores.alerta_offline_em`).
**Testado no banco** com fixtures nos 5 cenários (rerotear, sem_entregador por teto, parada+dedup, reprocesso da fila, offline+dedup). Fixtures removidos.
**Entregável:** `W5-Monitor-SLA.json` (raiz da pasta do projeto), JSON puro. Cron 2 min → `w5_processa_sla()` → Switch: `rerotear` chama o W2 (Execute Workflow, id `mREg3cBtMs2mAMlSh48Nm`), `alerta` vai pro Chatwoot (conversa 59) + grupo WhatsApp do lab.
**PATCH obrigatório no W2:** no node Roteiriza, trocar `ce.evento = 'recusada'` por `ce.evento IN ('recusada','timeout')` na cláusula de exclusão, senão a re-roteirização por timeout reoferta pro mesmo. **Pendências:** selecionar credencial Postgres no node Processa SLA; importar, aplicar o patch e ativar.

**Teste integrado OK (26/09/2026):** W5 ativo, cron 2 min. Coleta forçada em `atribuida` há 6 min → W5 marcou `timeout`, liberou o entregador, re-chamou o W2; W2 (patchado) não achou candidato → `sem_entregador` + alerta real no grupo WhatsApp. Efeito colateral correto: o W4 marcou o Entregador Teste `offline` por falta de GPS recente. **Ajuste no W2 (fallback):** node Roteiriza passou a devolver `a.protocolo` (incluído no CTE `alvo` e no SELECT final) e o node Monta Alerta exibe `{{ $json.protocolo }}` em vez do UUID. Patch de exclusão `recusada`→`recusada,timeout` aplicado. Falta só o teste de campo real (comum ao W4).

### 8. Geocoding no cadastro da clínica  ✅ CONCLUÍDA (24/09/2026, testada em produção)
**Google Geocoding** ao salvar/editar o endereço → grava `latitude`/`longitude` em `public.enderecos`; endereços aproximados ficam marcados para conferência do pino no mapa (Tarefa 9).
Depende de: 1.

**Banco — migração `geocoding_enderecos_v1` (APLICADA no Supabase LabVet Homol):**
- Colunas aditivas em `public.enderecos`: `geo_status`, `geo_precisao`, `geo_place_id`, `geo_endereco_formatado`, `geo_erro`, `geo_tentativas`, `geo_atualizado_em` (+ CHECK de `geo_status`, + índice parcial para a varredura).
- `geo_status`: `pendente` (geocodificar) · `ok` (ROOFTOP/RANGE_INTERPOLATED, confiável) · `revisar` (APPROXIMATE/GEOMETRIC_CENTER/partial_match, conferir pino) · `erro` (ZERO_RESULTS, REQUEST_DENIED…) · `manual` (pino fixado, **nunca sobrescrito**).
- **Correção v2 (25/09/2026, migração `geocoding_enderecos_v2_manual_explicito`):** `manual` deixou de ser inferido a partir de lat/lng vindas no INSERT. O formulário do site tem campos de latitude e longitude, então a regra antiga marcava todo endereço novo como `manual` e o tirava do geocoding automático. Agora só vale marcação explícita de `geo_status='manual'` — que é o que o ajuste de pino no mapa (Tarefa 9) vai fazer.
- **Correção v2 no W6:** a varredura voltou a pegar endereço com 3 erros quando a última tentativa tem mais de 6 h. Sem isso, um problema passageiro de configuração (como a troca da key para credencial) queimava as 3 tentativas e travava o endereço para sempre.
- **Pegadinha da credencial Query Auth do n8n (25/09/2026):** o campo **Name** da credencial é o nome do *parâmetro de query* que vai na URL, não o nome da credencial. Preenchido com "Google Geocoding API Key", a requisição saía como `?Google Geocoding API Key=...` e o Google respondia `REQUEST_DENIED: You must use an API key to authenticate each request`. O valor correto é `key`. Esse texto de erro específico sempre significa parâmetro ausente, nunca chave inválida ou restrição de IP.
- **Resultado final (25/09/2026):** Vila Independência `-22.7192577 / -47.6284599` e Castelinho `-22.7326734 / -47.6639986`, ambos `ok` / `ROOFTOP`, com os CEPs preenchidos pelo Google. Tarefa 8 encerrada; resta só recolocar a restrição de IP na key ao sair do ambiente de teste.
- Trigger `trg_enderecos_geo` (BEFORE INSERT OR UPDATE): INSERT sem coords → `pendente`; INSERT com lat/lng informados → `manual`; UPDATE que altere logradouro/número/complemento/bairro/cidade/UF/CEP → volta a `pendente`, **limpa lat/lng** e zera `geo_tentativas`. **O site da secretaria não precisa saber nada de geocoding** — basta salvar o endereço.
- View `public.enderecos_geo_revisar` — fila de conferência humana (`revisar` + `erro`) já com nome da clínica e endereço montado.

**Workflow `W6 - Geocoding Endereços`** (arquivo `W6-Geocoding-Enderecos.json`, formato puro para "Import from File"), 3 entradas convergindo no mesmo caminho:
1. **Webhook** `POST https://n8n.fpsoftware.cloud/webhook/geocodificar-endereco` — o site chama ao salvar/alterar: body `{"endereco_id":"<uuid>"}`, ou `{"cliente_id":"<uuid>"}` para todas as unidades da clínica, ou body vazio = varredura. Resposta 200 imediata (não bloqueia o cadastro).
2. **Cron a cada 15 min** — varre `geo_status='pendente'` (rede de segurança: funciona mesmo sem nenhuma alteração no site).
3. **Execute Workflow** (`endereco_id`, `cliente_id`) — para o W1/W2 geocodificarem sob demanda no futuro.

Caminho comum: `Busca Endereços` (SQL parametrizado, ignora `manual`, varre `pendente` **e `erro`** — retry automático — e para em 3 tentativas com erro; chamada direta por `endereco_id` força qualquer status) → `Lote (1 por vez)` → `Google Geocoding` (address + `components=country:BR` + `language=pt-BR`, com `neverError` e `onError: continue` para falha de API não derrubar o lote) → `Interpreta Retorno` (classifica precisão e monta os literais SQL já escapados) → `Grava Coordenadas` (UPDATE com `geo_tentativas` e `geo_atualizado_em`) → volta ao lote → `Resumo` (processados/ok/revisar/erro).

**Correções aplicadas no teste (24/09/2026):** (1) o campo *Query Parameters* do node Postgres **descarta valores vazios**, o que quebrava a query com `there is no parameter $2` — passou a usar o sentinela `-` com `NULLIF($n::text,'-')`; (2) a varredura só pegava `pendente`, então um endereço que falhou (ex.: key ainda não preenchida) nunca mais era retentado — agora pega `pendente` e `erro`.

**Ativado e testado em 24/09/2026:** key criada no projeto GCP `clinica animalabor` (`n8n-geocoding-vps`, só Geocoding API), workflow importado e rodando. Teste real com a clínica Amor Pet: `Rua Dona Eugênia 2379, Vila Independência, Piracicaba - SP` → `-22.7192577 / -47.6284599`, `geo_status = ok`, `geo_precisao = ROOFTOP`, e o Google ainda devolveu o CEP que faltava (13417-100) em `geo_endereco_formatado`.

**Dívidas técnicas desta tarefa (fazer antes de produção):**
- A key está **sem restrição de IP** (foi preciso remover para funcionar no teste). Recolocar o IP de saída da VPS e conferir o teto de cota/alerta de orçamento.
- ~~Key em texto puro no node~~ → ✅ resolvido em 24/09/2026: a key virou credencial **Query Auth** do n8n (`Google Geocoding API Key`, Name = `key`) e o parâmetro `key` saiu do node. Testado e aprovado. A key nunca chegou a ser commitada no git-sync, e agora também fica mascarada nos dados de execução.
- ~~W6 fora do git-sync~~ → ✅ incluído no `/srv/n8n-git-sync/n8n-git-sync.sh` (24/09/2026), já aparece na pasta sincronizada.
- O site pode passar a chamar o webhook no save do endereço (opcional; sem isso o cron resolve em até 15 min).
**Validado no banco:** trigger (insert sem coords, insert com coords, alteração de endereço zerando lat/lng), query de busca com os 3 modos de parâmetro, UPDATE de sucesso e de erro (inclusive endereço com vírgula e apóstrofo no texto do Google). Custo: dentro da cota gratuita (10.000 req/mês) porque só roda no cadastro/alteração.

### 8.1 Multi-unidade (fora do backlog original)  ✅ (24/09/2026, SQLs validados — aguardando import)
**Migração `multi_unidade_coleta_v1` (aplicada):** `coletas.endereco_id` (FK `enderecos`), `enderecos.aceita_coleta` (default true), novo status `aguardando_unidade` no enum, índices, backfill das coletas de clientes com endereço único, e a view `public.coletas_aguardando_unidade` (fila do operador com minutos parados e a lista de candidatos).

**Como a unidade é resolvida:** o telefone não identifica a clínica (um número pode atender mais de uma, e cada clínica tem várias unidades). `Identifica Candidatos` devolve todos os pares clínica + unidade daquele telefone e `Agrupa Candidatos` junta num item numerado. Um candidato segue direto. Dois ou mais: a coleta nasce em `aguardando_unidade`, o evento `aguardando_unidade` guarda a lista e o número de quem pediu, a IA pergunta e **o W2 não é chamado**. A mensagem seguinte daquele número cai em `Coleta Aguardando Unidade?` (janela de 30 min) e `Resolve Unidade` casa por número da lista, nome da unidade, bairro ou logradouro — só aceitando palavras que discriminam entre os candidatos. Acertou: grava `endereco_id`, volta para `solicitada` e chama o W2. Não acertou: repergunta uma vez (evento `unidade_nao_entendida`), depois cancela e manda para o operador.

**Arquivos para import:** pasta `multiunidade/` — `W1-Recepcao-Coleta.json`, `W2-Roteirizacao-Coleta.json`, `W3-Acionamento-Entregador.json`, `W3-Resposta-Entregador.json`.
- **W1**: 13 nodes novos, `Identifica Clínica` renomeado para `Identifica Candidatos`, `Interpreta Coleta`/`Cria Coleta`/`Registra Evento` ajustados, e `Precisa Rotear?` entre o `Registra Evento` e o `Chamar W2`.
- **W2**: `LEFT JOIN enderecos ON cliente_id` virou `ON en.id = co.endereco_id`. Fim da multiplicação de linhas no CTE `alvo`.
- **W3-Acionamento**: mesmo join, e a mensagem ao entregador passou a mostrar a unidade ao lado do nome da clínica.
- **W3-Resposta**: a confirmação vai para o número que **pediu** a coleta (gravado no evento `criada`), com o telefone genérico do cadastro como fallback.

**Validado no banco real** com o cenário que já existe: o número 5519988542802 atende "Amor Pet" (duas unidades) e "exoticos pet", gerando 3 candidatos. Testados: query de candidatos, criação ambígua, busca da coleta pendente, resolução por "2", "castelinho", "na vila independencia" e "Rua Mem de Sá", repergunta e handoff, gravação da unidade, join novo do W2 e do W3, e o fallback do telefone. Fixtures removidos.

### 9. Mapa no site de secretaria  🟡 EM ANDAMENTO (26/09/2026 — levantamento)
Exibir posição ao vivo dos entregadores + coletas em andamento, lendo do banco/Traccar. Tela do operador (fila, override).
Depende de: 6.

**Decisões desta rodada (26/09/2026):** (a) fronteira de entrega = **camada de banco validada no Supabase + especificação de implementação para o Cursor** (o site é desenvolvido no Cursor; eu não escrevo o front); (b) escopo da rodada = **só leitura: mapa ao vivo + fila do operador com SLA**. Override (reatribuir, assumir, cancelar) fica para a rodada seguinte, com função SQL atômica por ação + webhook do operador no n8n, no mesmo padrão do W4/W5.

**Achados do levantamento:**
- **Não é preciso expor o Traccar ao navegador.** A `w4_processa_leitura` já grava `entregadores.lat_atual`, `lng_atual`, `pos_atualizada_em` e `geofence_atual_id`. O mapa lê só o Supabase. Trilha histórica do trajeto é o único caso que exigiria proxy para o Traccar — fase 2.
- **Cadência real é 1 min** (cron do W4). Não há motivo para WebSocket: Supabase Realtime ou polling de 20 a 30s dão o mesmo resultado.
- **Falta camada de leitura:** só existe a view `coletas_aguardando_unidade`. Criar duas views (mapa e fila) para o front não replicar regra de negócio.
- **Chave do Google:** a existente é só Geocoding e é do n8n. Mapa no browser exige outra key com Maps JavaScript API e restrição por referenciador (e entra no build como `NEXT_PUBLIC_*`). Alternativa sem chave e sem custo: Leaflet + OSM. Decisão em aberto.

**O painel está documentado.** O Cursor gerou `DOCUMENTACAO_FUNCIONAL_CURSOR.md` (repo `secretaria-virtual-panel`). Resumo do que importa: **Next.js 14.2 App Router + React 18 + TS + Tailwind + Zod**, deploy Docker + Traefik (compose `secretaria-animallabor`, rede `proxy-net`). **O browser nunca fala com o Supabase direto:** tela `"use client"` → `/api/**/route.ts` → `createSupabaseServerClient` (anon + cookies, sujeito a RLS); `supabaseAdmin` (service role) só no servidor. Auth = Supabase Auth com e-mail sintético `{login}@painel.local`, `panel_users.auth_user_id` → `auth.users`, RBAC por `has_panel_permission('modulo.acao')`, menu por `getDashboardNavVisibility`. Consequência para a Tarefa 9: **a tela faz polling por uma rota `/api`, não Realtime no browser**, e o módulo novo segue o checklist da seção 11 da doc (permissões `coleta.*` no seed + policies + item de menu).

**CORREÇÃO do levantamento anterior:** `clientes`, `enderecos` e `panel_users` NÃO estão abertas. O papel das policies é `public`, mas o `USING` é `has_panel_permission(...)`. O RBAC está vivo e populado (3 usuários, 3 roles, 24 permissões, 40 vínculos) — a leitura de "zero linhas" veio de estimativa do catálogo, não de contagem real.

**⚠️ ACHADO CRÍTICO (integração painel × coleta), a tratar do lado do Cursor:** a doc seção 5.4 diz que o **PATCH de cliente recria os endereços (delete + insert)**. Desde a coleta, `enderecos` é entidade referenciada: `coletas.endereco_id` é FK **NO ACTION** (o delete passa a **falhar** assim que existir qualquer coleta apontando pro endereço, quebrando a tela de cliente) e `traccar_geofences.endereco_id` é **ON DELETE SET NULL** (falha **silenciosa**: a cerca perde o vínculo com a unidade e o W4 para de avançar as coletas). Além disso o endereço recriado perde `geo_status`/`latitude`/`longitude`, descartando pino manual e queimando chamada nova do Google a cada edição. Correção pedida: **upsert por `id`** no PATCH (idem `cliente_contato`); mínimo aceitável = bloquear exclusão de endereço com coleta ou geofence vinculada.

**⚠️ EXPOSIÇÃO CONFIRMADA:** só as tabelas da coleta estão abertas — `anon_all_entregadores`, `anon_all_coletas`, `anon_all_coleta_eventos`, `anon_all_traccar_geofences`, todas `USING (true)` para `anon`, e a anon key é pública (vai no bundle). Com a tela nova isso passa a expor localização de pessoas em tempo real. `coleta_contador_diario` segue com **RLS desabilitada**. Plano: trocar por policies `has_panel_permission('coleta.read'/'coleta.update')` junto com as views, depois que o Cursor confirmar que nada acessa essas tabelas pela anon key (o n8n usa conexão direta ao Postgres, que não passa por RLS).

**Pendências antes de construir as views:** respostas do Cursor em **`PERGUNTAS-Cursor-Tarefa9.md`** (padrão de fetch/polling, onde versionar o SQL novo, permissões do módulo, biblioteca de mapa) e a decisão Google Maps × Leaflet.

### 10. Traccar — instalação e configuração  ✅ CONCLUÍDA (25/09/2026, testada com celular real)
Subir o **Traccar self-hosted na VPS**; app **Traccar Client** nos celulares dos entregadores; cadastrar **geofences** (clínicas + laboratório) a partir das coordenadas.
Depende de: 8 (concluída).

**Diagnóstico read-only da VPS (25/09/2026).** Detalhes em `traccar/DIAGNOSTICO-VPS-Traccar.md`; coleta bruta em `traccar/diag-vps-20260925-094954.txt`; script reaproveitável em `traccar/diag-vps-traccar.sh`.
- **Memória é o gargalo:** 3.8 GB totais, 2.8 em uso, **1.0 GB disponível e zero swap**. Soma dos containers ≈ 2.23 GB (n8n 627 MB, chatwoot-worker 558, chatwoot 369, evo-api 169). 1 vCPU ocioso (load 0.16). Disco com 34 GB livres. Docker 29.6.1 / Compose v5.3.1.
- **Portas livres:** 8082, 5055 e toda a faixa 5000-5300. Nenhuma regra de ufw nova é necessária (entra pela 443, já aberta).
- **Traefik v3.6.7 NÃO precisa ser alterado.** Provider docker com `exposedbydefault=false`, rede externa **`proxy-net`**, entrypoints **`web`** e **`websecure`**, certresolver **`le`** com desafio **HTTP-01**. Só 80 e 443 publicadas. Duas consequências: (1) **sem wildcard**, cada hostname precisa de registro A próprio (confirmado: host inexistente não resolve); (2) a ingestão do app vai por **Host na 443 roteado para a porta 5055 do container**, e não por entrypoint novo, o que evita recriar o Traefik que atende Chatwoot, Evolution e n8n.
- **Achados fora do escopo, registrados:** **Redis publicado em `0.0.0.0:6379`** e **MongoDB em `0.0.0.0:27017`**, alcançáveis da internet (publicação do Docker fura o ufw, e as duas portas também estão liberadas nele); container zumbi **`evo_postgres`** em status `Created`, resíduo da pasta antiga `~/evolutionapi`; e **o IP de saída respondeu IPv6** (`2a02:4780:14:c6da::1`), o que afeta a dívida da Tarefa 8: restringir a key do Google só ao IPv4 147.79.106.20 pode não funcionar.

**Decisões do Fabiano (25/09/2026):** containers de outros projetos (`mongodb-prod`, `consultant-scheduler`, `redis-server`, `redis-prod`) **estão em uso, não mexer**; **aumentar a RAM da VPS de 4 para 8 GB** em vez de criar swap; **container Postgres dedicado** para o Traccar; hostnames **`traccar.fpsoftware.cloud`** (UI/API) e **`gps.fpsoftware.cloud`** (ingestão OsmAnd).

**Pré-requisitos antes de instalar:** (a) upgrade de RAM e reboot, conferindo antes as `restart policies` dos containers porque a VPS está com 76 dias de uptime; (b) criar os 2 registros A apontando para 147.79.106.20 (nenhum dos dois resolve hoje) antes de subir o container, senão o Let's Encrypt queima tentativa; (c) endereço do laboratório com lat/lng para a geofence de destino; (d) celular de teste com o Traccar Client; (e) fixar raio da cerca (80-150 m) e tempo mínimo de permanência.

**Contrato com o n8n a configurar junto (define o W4, Tarefa 6):** eventos de geofence via `event.forward.url` + `event.forward.header` para webhook do n8n (volume baixo, 1 execução por evento real); **posição por polling** do n8n na API REST do Traccar a cada 1-2 min, **não** por `forward.url` (encaminhar cada ponto daria ~14.000 execuções/dia com 5 entregadores a 30s, e o W2 tolera posição com até 10 min de atraso). Amarração obrigatória: o evento do Traccar devolve o id da cerca dele, não o `endereco_id`, então gravar o `endereco_id` nos atributos da geofence ou numa tabela de mapeamento. Geofences vinculadas a um **grupo** "Entregadores", não device por device.

**Andamento em 25/09/2026 (fim do dia):** RAM da VPS aumentada para **7.8 GB, 5.6 GB disponíveis** — gargalo de memória resolvido, todos os containers voltaram e n8n/Chatwoot/Evolution respondendo 200. Pacote de instalação pronto em `traccar/instalar-traccar.sh` (modos `check` read-only, `instalar`, `status`, `logs`, `remover`), com versão da imagem resolvida e fixada na hora, segredos gerados dentro da VPS em `/srv/prod/traccar/.env`, dois routers por label sem tocar no Traefik, e abort automático se o DNS não estiver pronto. **Único bloqueio para instalar: os 2 registros A ainda não criados.**
- Pendência de boot detectada: `redis-server` é o único container com política `on-failure`, não volta sozinho num reboot.
- Armadilhas de ferramenta anotadas: `getent` não existe no macOS (usar `dig` nos scripts que rodam no Mac) e SSH com senha em chamadas seguidas é cortado pelo servidor (uma conexão por execução; ideal é `ssh-copy-id`).

**Duas correções à especificação, verificadas na documentação do Traccar:** (1) **não existe tempo de permanência nativo na geofence** — o dwell time assumido na spec §5.2 tem de ser implementado no **W4 (Tarefa 6)**, confirmando que o device continuou dentro da cerca depois do evento de entrada; (2) **não há chave documentada de expurgo de histórico** — a retenção de posições será um job no Postgres do Traccar (`tc_positions`, respeitando `tc_devices.positionid`), item separado depois de conhecer o volume real.

**✅ SERVIDOR NO AR (25/09/2026).** Traccar instalado e acessível em **https://traccar.fpsoftware.cloud** (UI/API) e **https://gps.fpsoftware.cloud** (ingestão OsmAnd na porta 5055 do container), ambos por label no Traefik, que não foi alterado. Postgres dedicado `traccar-postgres` em `/srv/prod/traccar`, segredos em `.env` gerado na própria VPS.
**Achado do primeiro acesso:** a instalação **não veio com `admin`/`admin`** como a documentação sugere; subiu com banco vazio e a UI caiu direto na **tela de REGISTRAR**, com auto-registro aberto e o primeiro cadastro virando administrador. Risco real, porque o hostname vira público nos logs de Certificate Transparency assim que o Let's Encrypt emite o certificado. Tratado no ato: usuário admin criado pelo Fabiano e **auto-registro desligado** em Configurações → Servidor. **Regra para qualquer serviço novo exposto por HTTPS nesta VPS: fechar cadastro público no mesmo minuto em que o certificado é emitido.**
Verificador reaproveitável: `traccar/traccar-pos-instalacao.sh` (read-only: usuários e flag de registro lidos do banco, versão fixada, consumo, rota de ingestão e erros do log).

**Cadastro de contratante e laboratório criado (25/09/2026), migração `cadastro_contratantes_laboratorios_v1`.** Surgiu da pergunta "onde guardar o endereço do laboratório" e virou a base de cadastro do produto. Detalhes em `Modelo_Contratantes_Laboratorios.md`. Em resumo: `contratantes` + `laboratorios` + `clinica_laboratorio` (N:N, porque uma clínica pode ser atendida por mais de um laboratório, logo `clientes` nunca ganha `laboratorio_id`), mais `lab_atual()` e `lab_por_inbox()`. **Nenhuma tabela operacional foi tocada.** Achado central: **o discriminador de tenant é o canal, não o telefone** — cada laboratório tem inbox próprio no Chatwoot e todo workflow já filtra por `inbox_id`. Laboratório real gravado com a coordenada `-22.713105 / -47.640765` (pino manual do Google Maps), raio 100 m e permanência 120 s; contratante com **dados fictícios marcados em `observacoes`, a trocar antes de produção**.

**Devices e geofences criados (25/09/2026).** Grupo `Entregadores` id 1; cercas id 1 (Amor Pet Vila Independência), 2 (Amor Pet Castelinho) e 3 (Animal Labor laboratório), todas com raio 100 m e **vinculadas ao grupo**, para entregador novo herdar tudo. Device `Entregador Teste` com uniqueId `entregador-teste-9f3a1c7b` (longo e aleatório de propósito: o protocolo OsmAnd não autentica, e `database.registerUnknown=false` descarta desconhecido). Gravados `laboratorios.traccar_grupo_id=1`, `laboratorios.traccar_geofence_id=3` e `entregadores.id_dispositivo_gps`. Script idempotente reaproveitável: `traccar/cadastrar-traccar.sh`.
**Contrato de atributos das cercas, que o W4 (Tarefa 6) vai consumir:** clínica → `{"papel":"clinica","endereco_id":"<uuid de enderecos>"}`; laboratório → `{"papel":"laboratorio","laboratorio_id":"<uuid de laboratorios>"}`. O evento do Traccar devolve só o id da cerca dele; é esse atributo que diz qual unidade é.

**✅ ENCERRADA (25/09/2026).** Traccar Client instalado no celular, device **online no mapa** reportando posição. Fase 1 do rastreamento de pé ponta a ponta: servidor, banco, TLS, ingestão, device, grupo e as 3 cercas.
**Configuração do app que funcionou:** identificador `entregador-teste-9f3a1c7b`, servidor `https://gps.fpsoftware.cloud`, frequência 30 s, **distância e ângulo em 0** (os filtros de movimento economizam bateria mas furam a permanência de 2 min dentro da cerca, que precisa de ponto regular mesmo parado), precisão alta, buffer offline ligado. No Android: localização em **"Permitir o tempo todo"** e app **fora da otimização de bateria** — é o que mais mata rastreamento por celular, porque o sistema hiberna o app sem gerar erro nenhum do lado do servidor.

**Dívidas técnicas desta tarefa (fazer antes de produção):**
- Contratante com **dados fictícios** (CNPJ `00.000.000/0001-00`, e-mail `.test`). Aviso gravado em `contratantes.observacoes`.
- Endereço textual do laboratório (logradouro, número, bairro, CEP) nulo. A cerca usa a coordenada, então não bloqueia, mas faz falta no mapa e nas mensagens.
- `laboratorios.evolution_instancia_secretaria` nula: confirmar o nome da instância da Ana Clara no Evolution Manager.
- `max_coletas_simultaneas` e `tempo_max_transito_min` nulos: regra de negócio em aberto.
- **Retenção de posições**: o Traccar não tem chave documentada de expurgo. Vai precisar de job no Postgres dele (`tc_positions`, respeitando `tc_devices.positionid`) quando o volume real for conhecido.
- **Exposição herdada da VPS**, anterior a esta tarefa: Redis em `0.0.0.0:6379` e MongoDB em `0.0.0.0:27017` alcançáveis da internet. Agora a mesma máquina guarda histórico de localização de pessoas.
- `redis-server` com política `on-failure`: único container que não volta sozinho num reboot.

**⚠️ RESTRIÇÃO DE ACESSO (vale para as próximas conversas):** nem o container da sessão nem o shell local alcançam a VPS. O egress bloqueia `fpsoftware.cloud` e qualquer porta não-HTTP (testado: `/dev/tcp` na 22 e curl na 443 falham nos dois lados). Padrão de trabalho adotado: eu gero um script na pasta `traccar/`, o Fabiano roda uma linha no terminal do Mac, a saída volta para a pasta e eu leio. Foi assim que o diagnóstico foi feito.

### 11. SobreClinica — base de materiais (fase posterior)  ⛔
Adicionar o conhecimento de **materiais** à cadeia da SobreClinica (compartilhada com a Ana Clara), resolvendo o gap material × exame.
Depende de: conteúdo do laboratório (Tarefa de insumo).

---

## Ordem sugerida
1 → 2 → 3 → (4 → 5) → 8 → 10 → 6 → 7 → 9. A Tarefa 11 entra quando o laboratório fornecer o conteúdo de materiais.

---

## Melhorias implementadas (fora do backlog original)

### Protocolo da coleta  ✅ (23/09/2026, testado e aprovado)
Campo **`coletas.protocolo`** (text, UNIQUE) gerado no banco por trigger `trg_gera_protocolo` (BEFORE INSERT), formato **`ddmmyyhhmmss` (horário de Brasília) + contador diário de 4 dígitos** (ex.: `2309261858110001`). Contador atômico via tabela `coleta_contador_diario (dia, contador)` com UPSERT `ON CONFLICT ... RETURNING` — zera a cada dia, sem colisão sob concorrência. Migração aplicada no Supabase LabVet Homol. **Exibido:** na mensagem ao entregador (W3-Acionamento) e na notificação à clínica no ACEITO (W3-Resposta). Coletas anteriores à trigger ficam com protocolo nulo (só as novas nascem com protocolo). Aprendizado de entrega: o "Import from File" da UI do n8n recusa o formato de export de banco (lista com metadados `shared`/`versionId`); tem de ser o workflow puro com `nodes`/`connections` no topo.
