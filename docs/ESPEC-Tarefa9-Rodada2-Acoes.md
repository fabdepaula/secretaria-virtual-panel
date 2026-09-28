# Especificação — Ações do operador (Tarefa 9, rodada 2)

| Item | Valor |
|---|---|
| Destinatário | Cursor / Composer (`secretaria-virtual-panel`) |
| Depende de | Rodada 1 (tela de operação) já em produção |
| Banco | Migração `op_acoes_operador_v1` **já aplicada** em `oocyvlhvuqpoyxdzimjv` |
| n8n | `W7-Acoes-Operador.json` (na pasta do projeto, pronto para importar) |
| Permissão | `coleta.update` (já existe em `panel_permissions`, vinculada a admin e operador) |

---

## 1. O problema que esta rodada resolve

A rodada 1 mostra as coletas travadas. Não resolve nenhuma. São quatro travamentos que o sistema produz sozinho e que hoje não têm saída:

| Situação | O que acontece hoje | Ação |
|---|---|---|
| `sem_entregador` | W2 não achou ninguém, W5 desiste ao atingir o teto de tentativas | devolver à fila ou atribuir direto |
| `aguardando_unidade` | clínica não respondeu, a IA repergunta uma vez e desiste | definir a unidade pelo painel |
| `aceita`/`coletando` parada | W5 alerta a cada 45 min e não age | trocar o entregador |
| pedido por engano | não existe cancelamento | cancelar com motivo |

**Fora de escopo:** "assumir a coleta". O handoff humano continua pela label "Humano" no Chatwoot, que já pausa a IA.

---

## 2. Arquitetura

O painel **não** escreve no banco e **não** chama a função direto. O caminho é:

```
tela → POST /api/coleta/acao (rota de servidor)
     → POST https://n8n.fpsoftware.cloud/webhook/operador-acao  (Header Auth)
     → W7: Code monta o SQL → Postgres executa public.op_executa(...)
           ├─ responde ao painel
           ├─ chamar_w2 → W2 (roteirização)
           ├─ chamar_w3 → W3 (acionamento do novo entregador)
           └─ notificacoes[] → Evolution (WhatsApp)
```

Três razões para não ser RPC direta do painel: a ação precisa encadear W2/W3 e disparar WhatsApp, que é papel do n8n; a função fica com execução revogada de `anon` e `authenticated`, então não existe superfície pelo PostgREST; e toda a regra de negócio permanece num lugar só.

`public.op_executa` é atômica, com `FOR UPDATE` na coleta e nos entregadores envolvidos. Ela **nunca envia mensagem**: devolve o que deve ser enviado e o n8n envia.

---

## 3. Contrato da rota do painel

### `POST /api/coleta/acao`

```ts
// src/app/api/coleta/acao/route.ts
export const dynamic = "force-dynamic";
```

1. `auth.getUser()` → sem sessão, **401**.
2. `has_panel_permission('coleta.update')` → falso, **403**.
3. Validar o corpo com Zod:

```ts
const Body = z.object({
  acao: z.enum(["reatribuir","devolver_fila","definir_unidade","cancelar"]),
  coleta_id: z.string().uuid(),
  entregador_id: z.string().uuid().optional(),
  endereco_id: z.string().uuid().optional(),
  motivo: z.string().trim().min(3).max(300).optional(),
});
```

4. Repassar ao webhook do n8n, acrescentando `operador` **do servidor**, nunca do cliente:

```ts
operador: panelUser.login   // de panel_users, resolvido pela sessão
```

Header do webhook: o token vai em `N8N_OPERADOR_ACAO_TOKEN` (env de runtime, **não** `NEXT_PUBLIC_`), e a URL em `N8N_OPERADOR_ACAO_URL`.

5. Devolver ao cliente exatamente o que o n8n respondeu, no padrão do painel:

```json
{ "ok": true, "data": { "ok": true, "resultado": "reatribuida",
  "mensagem": "Coleta 2709260704120002 atribuida a Entregador Dois." } }
```

Quando `data.ok` for `false`, a ação foi recusada por regra de negócio (não é erro de sistema): mostrar `mensagem` ao operador e **não** tratar como falha técnica. Os códigos de `resultado` possíveis: `coleta_nao_encontrada`, `status_final`, `status_invalido`, `operador_ausente`, `entregador_ausente`, `entregador_nao_encontrado`, `entregador_inativo`, `sem_mudanca`, `material_em_transito`, `unidade_indefinida`, `endereco_ausente`, `endereco_nao_encontrado`, `endereco_de_outra_clinica`, `motivo_ausente`, `acao_desconhecida`.

6. Timeout de 15 s na chamada ao n8n. Se estourar, responder 504 com mensagem clara: **a ação pode ter sido aplicada** (a função é atômica e commita antes do encadeamento), então a tela deve recarregar a fila em vez de afirmar que falhou.

### Rota auxiliar

`GET /api/coleta/entregadores` — lista para o seletor de reatribuição. Serve `operacao_mapa_entregadores` filtrando `ativo`, com `nome`, `status`, `coletas_ativas`, `capacidade_max`, `sem_vaga`, `posicao_incerta`. Ordenar por `status` (disponível primeiro) e nome. Exige `coleta.read`.

Para o seletor de unidade, use `operacao_mapa_pontos` filtrando `tipo='clinica'` e `cliente_id` igual ao `clinica_id` da coleta. Se a clínica tiver unidade sem coordenada, ela **não** aparece ali; nesse caso buscar por `enderecos` do cliente numa rota própria, ou geocodificar antes.

---

## 4. Ações na tela

Botões na linha da fila e no detalhe da coleta, todos visíveis apenas com `coleta.update`, todos com confirmação antes de disparar.

| Ação | Quando oferecer | Campos | Confirmação |
|---|---|---|---|
| **Devolver à fila** | `atribuida`, `aceita`, `coletando`, `sem_entregador` | motivo opcional | "A coleta volta para a fila e a roteirização escolhe de novo." |
| **Atribuir / trocar entregador** | `solicitada`, `atribuida`, `aceita`, `coletando`, `sem_entregador` | seletor de entregador, motivo opcional | mostrar carga e status do escolhido antes de confirmar |
| **Definir unidade** | só `aguardando_unidade` | seletor de unidade da clínica | mostrar o endereço completo da unidade |
| **Cancelar** | qualquer status aberto | **motivo obrigatório** | confirmação destacada, é irreversível |

Depois de qualquer ação bem-sucedida: recarregar fila e mapa imediatamente, sem esperar o ciclo de 25 s, e mostrar a `mensagem` devolvida.

Estados que o botão precisa respeitar sem chamar a API: em `coletado` a troca e a devolução são bloqueadas pela função (o material já está com a pessoa), então esconda os dois nesse status em vez de deixar o operador tomar erro.

---

## 5. O que o sistema avisa por WhatsApp

Decidido com o Fabiano. A função monta os textos, o n8n envia; o painel não escreve mensagem nenhuma.

| Evento | Quem recebe |
|---|---|
| Nova atribuição (manual ou pela fila) | novo entregador, pelo W3 |
| Troca ou devolução à fila | entregador anterior: "a coleta saiu com você, não precisa ir" |
| Cancelamento | clínica que pediu, e o entregador se já havia um |
| Unidade definida pelo operador | clínica que pediu, confirmando qual unidade |

O motivo interno nunca vai nas mensagens.

---

## 6. Auditoria

Toda ação grava em `coleta_eventos` com `ator = 'operador'` e o `login` de quem fez no payload, além de de/para e motivo. Eventos novos: `reatribuida`, `devolvida_fila`, `unidade_definida` (também gravado pelo W1) e `cancelada`.

Vale expor no detalhe da coleta a linha do tempo lendo `coleta_eventos` — uma rota `GET /api/coleta/[id]/eventos` com `coleta.read`. Sem isso, o operador vê o estado mas não a história, e a história é o que explica por que a coleta está onde está.

---

## 7. Pré-requisito no n8n (o Fabiano aplica)

`W7-Acoes-Operador.json` precisa ser importado, ter as credenciais selecionadas, os placeholders do Evolution trocados, e **o W2 precisa do patch** descrito no sticky do próprio workflow. Sem esse patch, "devolver à fila" não destrava nada: a coleta volta a `solicitada` e o W2 continua excluindo todo mundo que já recusou ou estourou o tempo, devolvendo `sem_entregador` na hora.
