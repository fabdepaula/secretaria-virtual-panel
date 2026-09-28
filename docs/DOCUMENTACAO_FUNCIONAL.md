# Documentação Funcional — Secretaria Virtual (Painel)

| Item | Valor |
|------|--------|
| Sistema | Painel administrativo da Secretaria Virtual IA |
| Repositório | `secretaria-virtual-panel` |
| Versão do app | `0.2.0` (`package.json`) |
| Tenant atual em uso | **Animal Labor** (outros laboratórios previstos; base já parcialmente preparada) |
| Formato desta doc | Markdown no Git (`docs/`) |
| Público-alvo | Desenvolvedores, analistas de sistemas e novos integrantes |
| Escopo deste documento | O que o painel faz, arquitetura, dados, acesso, módulos, integrações e fronteiras com o ecossistema |
| Data-base | Código do repositório + introspecção do schema no Supabase em uso (`oocyvlhvuqpoyxdzimjv`) |

> **Nota sobre scripts SQL neste repo:** em `supabase/` está versionado sobretudo o **RBAC do painel** (`panel_*` + RLS). As tabelas de CRM e do restante do ecossistema **já existem no Supabase**; o `CREATE TABLE` completo delas **não** está neste repositório. O modelo CRM abaixo combina uso no código + schema lido do banco.

---

## 1. Visão geral do produto

O **Secretaria Virtual Panel** é o painel web de cadastros operacionais do laboratório. Hoje opera o tenant **Animal Labor**. Escopo funcional do painel:

- **Contatos** (pessoas + telefones)
- **Clientes** (PF/PJ, endereços, vínculos com contatos e plano)
- **Serviços** (exames/procedimentos, com texto para embeddings de IA)
- **Planos** (pacotes comerciais + serviços do plano + clientes associados)
- **Usuários do painel** (RBAC: papéis e permissões) e **logo** do laboratório

O painel **não** implementa o atendimento WhatsApp, o roteamento de coletas nem os fluxos n8n de conversa. Ele **alimenta e mantém dados mestres** (clientes, serviços, planos, etc.) que outros componentes do ecossistema consomem no **mesmo banco Supabase**.

### 1.1 Stack tecnológica (este repositório)

| Camada | Tecnologia |
|--------|------------|
| Frontend / BFF | Next.js **14.2** (App Router), React 18, TypeScript |
| Estilo | Tailwind CSS |
| Validação | Zod |
| Auth + DB + Storage | **Supabase** (Auth, PostgreSQL, Storage, RLS) |
| Automação tocada pelo painel | **n8n** (webhook de embeddings ao criar/atualizar serviço) |
| Deploy | Docker (`standalone`) + Traefik (HTTPS) |

### 1.2 Ecossistema maior (o que quem mexe no painel precisa saber)

O produto **Secretaria Virtual** é um conjunto de peças que compartilham o Postgres do Supabase. Para quem desenvolve ou especifica o **painel**, o relevante é:

| Peça | Papel no conjunto | Relação com o painel |
|------|-------------------|----------------------|
| **Este painel** (`secretaria-virtual-panel`) | CRUD de cadastros + usuários do backoffice | Escreve/lê CRM (`clientes`, `contatos`, `"Services"`, `planos`, …) e `panel_*` |
| **Supabase** | Banco único, Auth, Storage, RLS | Fonte da verdade; local `npm run dev` usa o mesmo projeto cloud |
| **n8n** | Automações / IA / orquestração | Painel dispara webhook de **embedding** ao salvar serviço; outras automações (chat, etc.) vivem fora deste repo |
| **WhatsApp (Evolution API)** | Canal de mensagens | Instancias configuradas em `laboratorios` (`evolution_instancia_secretaria` / `_coleta`); o painel **não** envia WhatsApp |
| **Chatwoot** | Inbox / atendimento humano | Conta/inboxes também em `laboratorios`; painel não opera Chatwoot |
| **Traccar / coletas / entregadores** | Logística de coleta a domicílio | Tabelas `coletas`, `entregadores`, geofences, etc. — **fora** das telas atuais do painel |
| **Conversas / leads / agendamentos** | Funil e estado do bot | Tabelas `conversas`, `leads`, `conversation_state`, `agendamentos`, `n8n_chat_histories` — consumidas por n8n/bot; **cadastros mestres** do painel (ex.: serviços, clientes) impactam esses fluxos |

**Implicações práticas para o time do painel:**

1. **Alterar schema ou apagar dados de CRM** pode quebrar bot, embeddings e coletas — trate o banco como compartilhado.
2. Campo **`embedding_text`** em `"Services"` não é “só observação”: o painel dispara n8n, que grava o vetor `embedding` (`vector(1536)`) usado em busca semântica no atendimento.
3. **`agenda`** nos serviços é ID consumido por agendamento no ecossistema; não é detalhe só de UI.
4. Hoje o painel **não filtra por laboratório** nas queries: multi-tenant existe no modelo (`contratantes` → `laboratorios`), mas o app ainda opera como se houvesse um único laboratório (Animal Labor).
5. Integrações Evolution/Chatwoot/Traccar estão na linha de `laboratorios`; futuras telas de “configuração do lab” provavelmente lerão/escreverão ali — **não** inventar outra tabela de config no painel sem alinhamento.

### 1.3 Diagrama de contexto (ecossistema)

```
                    ┌─────────────────────────────────────────┐
                    │         WhatsApp (Evolution API)          │
                    └───────────────────┬─────────────────────┘
                                        │
     ┌──────────────┐                   ▼
     │ Operador     │     ┌──────────────────────────┐     ┌─────────────┐
     │ (navegador)  │────▶│ Painel Next.js (este repo)│────▶│ n8n         │
     └──────────────┘     │ cadastros + RBAC          │     │ embeddings  │
                          └────────────┬─────────────┘     │ + fluxos bot │
                                       │                   └──────┬──────┘
                                       ▼                          │
                          ┌──────────────────────────┐            │
                          │   Supabase (Postgres)    │◀───────────┘
                          │   Auth + Storage + RLS   │
                          └────────────┬─────────────┘
               ┌───────────────────────┼───────────────────────┐
               ▼                       ▼                       ▼
        Chatwoot / inbox      Coletas / Traccar /        Leads, conversas,
        (config no lab)       entregadores               agendamentos, animais
```

### 1.4 Multi-tenant (estado atual vs. previsto)

| Camada | Situação |
|--------|----------|
| **Negócio** | Produção atual = **Animal Labor**. Outros tenants (laboratórios) estão previstos. |
| **Banco** | Já existem `contratantes` (contrato/cliente comercial da Escala) e `laboratorios` (unidade operacional), com `laboratorios.contratante_id`. Há também `clinica_laboratorio` (vínculo clínica ↔ lab). |
| **Tenant Animal Labor (exemplo no banco)** | `laboratorios.nome` ≈ “Animal Labor Especialidades”; timezone `America/Sao_Paulo`; campos de Evolution/Chatwoot/Traccar preenchidos. |
| **Painel (código)** | **Ainda não** há seleção de laboratório, nem `laboratorio_id` em `panel_users` / `clientes` / `"Services"` nas colunas atuais. Cadastros CRM estão globalmente no schema `public` sem escopo por lab no app. |
| **Logo** | Upload do painel usa Storage `panel-assets` / `branding/logo`. A tabela `laboratorios` também tem `logo_path` (preparação multi-tenant) — alinhar evolução futura para não haver duas fontes de verdade. |

Modelo conceitual de tenant:

```
contratantes 1 ──< laboratorios
                       │
                       ├── configs: Evolution, Chatwoot, Traccar, timezone, geofence…
                       └── clinica_laboratorio >── clientes/clínicas (quando aplicável)
```

Ao especificar **novas features** do painel: decidir cedo se o dado é por laboratório e se precisa de `laboratorio_id` + RLS por tenant.

---

## 2. Arquitetura que o time deve seguir

### 2.1 Padrão geral

| Princípio | Como aplicar neste projeto |
|-----------|----------------------------|
| App Router | Páginas em `src/app/`; APIs em `src/app/api/**/route.ts` |
| UI no client, regras no server | Telas (`"use client"`) chamam APIs; persistência e Auth ficam nas rotas |
| Dois clientes Supabase | **Anon + cookies** (`createSupabaseServerClient`) para sessão/RLS; **service role** (`supabaseAdmin`) só no servidor, para Auth Admin e lookups privilegiados (ex.: login) |
| Autorização de dados | Preferir **RLS** + `has_panel_permission`; em módulos sensíveis (usuários/logo) também checar RPC na API e retornar **403** |
| Validação de entrada | Zod nos bodies das APIs; máscaras/validações espelhadas na UI |
| Sem ORM local | Acesso direto via Supabase JS (PostgREST) |
| Deploy | Imagem Docker `standalone`; variáveis `NEXT_PUBLIC_*` no **build**; `SERVICE_ROLE` só no **runtime** |

### 2.2 Estrutura de pastas (relevante)

```
secretaria-virtual-panel/
├── src/
│   ├── app/
│   │   ├── page.tsx                 # Login
│   │   ├── versao/                  # Diagnóstico de build
│   │   ├── dashboard/               # Shell autenticado + módulos
│   │   │   ├── _components/         # Aside, nav, logout, etc.
│   │   │   ├── contatos|clientes|servicos|planos|usuarios/
│   │   │   └── plano-servicos/      # Redirect legado → /planos
│   │   └── api/                     # Route Handlers (BFF)
│   ├── lib/
│   │   ├── supabase/                # server.ts, admin.ts
│   │   ├── panel-login.ts           # Regras de login / email_interno
│   │   ├── dashboard-nav-visibility.ts
│   │   ├── n8n.ts                   # Webhook embeddings
│   │   ├── documento.ts | phone.ts | cpf.ts | cliente-tipo.ts
│   │   └── branding.ts
│   └── middleware.ts                # Renova sessão Supabase (cookies)
├── supabase/                        # SQL do painel (RBAC + migrações)
├── public/branding/                 # Assets estáticos (ex.: Escala)
├── Dockerfile / docker-compose.yml
└── docs/                            # Esta documentação
```

### 2.3 Camadas de acesso (obrigatório entender)

1. **Browser** → chama `/api/...` (não usa service role).
2. **API Route** → valida sessão com `createSupabaseServerClient().auth.getUser()`.
3. **Postgres (RLS)** → políticas usam `has_panel_permission('modulo.acao')` com base no `panel_users.role_id` ligado a `auth.uid()`.
4. **Service role** → bypass de RLS; usar **somente** quando necessário (login lookup, criar usuário no Auth, layout que lê nome/role, upload admin, etc.).

### 2.4 Middleware

Arquivo: `src/middleware.ts`.

- **Faz:** renova tokens/cookies da sessão Supabase em quase todas as rotas.
- **Não faz:** redirecionar não autenticados (isso é do `dashboard/layout.tsx`).

---

## 3. Bancos, schemas e scripts SQL

### 3.1 Banco de dados

| Item | Detalhe |
|------|---------|
| SGBD | PostgreSQL (hospedado no **Supabase**) |
| Extensão usada no painel | `pgcrypto` (`gen_random_uuid`) |
| Auth | Schema `auth` do Supabase (`auth.users`) |
| Dados de negócio | Schema `public` |

### 3.2 Ordem recomendada de aplicação dos scripts (`supabase/`)

| Ordem | Arquivo | Função |
|-------|---------|--------|
| 1 | `panel_schema.sql` | Tabelas RBAC: `panel_roles`, `panel_permissions`, `panel_role_permissions`, `panel_users` |
| 2 | `panel_permissions_seed.sql` | Roles `admin` / `operador` / `viewer` + permissões + vínculos |
| 3 | `panel_rls.sql` | Funções `current_panel_role_id`, `has_panel_permission` + policies RLS |
| 4 | `panel_users_login_fields.sql` | Migração: `login`, `nome_completo`, `email` (substitui CPF no acesso) |
| 5 | `panel_permissions_merge_planos.sql` | Unifica permissões `plano_servicos.*` em `planos.*` |
| 6 | `panel_users_repair_email_interno.sql` | Correção de `email_interno` quando necessário |

> As tabelas CRM (`contatos`, `telefones`, `clientes`, `enderecos`, `"Services"`, `planos`, `plano_servicos`, …) devem já existir no projeto Supabase antes do RLS. O `panel_rls.sql` assume que elas existem.

### 3.3 Modelo de dados (conceitual)

```
                    panel_roles ──< panel_role_permissions >── panel_permissions
                         │
                         │ role_id
                         ▼
                    panel_users ──────── auth.users (auth_user_id)
                         │
                         │ (sessão do operador do painel)

planos 1 ───< plano_servicos >─── 1 "Services"
  │
  │ plano_id (N:1)
  ▼
clientes ───< enderecos
  │
  └───< cliente_contato >─── contatos ───< contato_telefone >─── telefones
```

### 3.4 Entidades RBAC (versionadas)

#### `panel_roles`
| Campo | Tipo / notas |
|-------|----------------|
| `id` | uuid PK |
| `nome` | text unique (`admin`, `operador`, `viewer`, …) |
| `ativo` | boolean |
| `created_at` | timestamptz |

#### `panel_permissions`
| Campo | Tipo / notas |
|-------|----------------|
| `id` | uuid PK |
| `chave` | text unique — padrão `modulo.acao` |
| `descricao` | text |
| `created_at` | timestamptz |

#### `panel_role_permissions`
PK composta `(role_id, permission_id)`.

#### `panel_users`
| Campo | Tipo / notas |
|-------|----------------|
| `id` | uuid PK |
| `auth_user_id` | uuid → `auth.users` (nullable) |
| `cpf` | text unique, **opcional** (legado) |
| `email_interno` | text unique — e-mail no Supabase Auth (ex.: `joao@painel.local`) |
| `nome_completo` | text |
| `email` | text — contato informativo (opcional) |
| `login` | text — identificador de acesso (único, case-insensitive) |
| `role_id` | uuid → `panel_roles` |
| `ativo` | boolean |
| `created_at` / `updated_at` | timestamptz |

### 3.5 Entidades CRM (inferidas pelo código)

#### `contatos` / `telefones` / `contato_telefone`
- Contato: `id`, `nome`, `created_at`
- Telefone: `id`, `numero` (só dígitos; reutilizado entre contatos se o número já existir)
- Junção: `contato_id`, `telefone_id`

#### `clientes` / `enderecos` / `cliente_contato`
- Cliente: `id`, `tipo_cliente` (`pf`/`pj` no banco; API/UI usam `PF`/`PJ`), `nome`, `nome_fantasia`, `documento` (só dígitos), `plano_id`, timestamps
- Endereço: `cliente_id`, `tipo_endereco`, `logradouro`, `numero`, `complemento`, `bairro`, `cidade`, `estado`, `cep`, `latitude`, `longitude`
- Vínculo: `cliente_id`, `contato_id`, `cargo`

#### `"Services"` (nome da tabela com S maiúsculo)

Campos usados pelo painel / relevantes no banco:

| Campo | Notas |
|-------|--------|
| `id`, `tipo`, `nome`, `preparo` | Cadastro básico |
| `embedding_text` | Sinônimos / texto para IA; dispara webhook n8n |
| `embedding` | `vector(1536)` — preenchido pelo pipeline n8n (não editado na UI) |
| `embedding_updated_at` | Timestamp do vetor |
| `valor`, `cod_interno` | Numéricos |
| `ativo`, `agendamento`, `urgencia` | Boolean |
| `agenda` | ID da agenda (API/UI: `agenda_id`) |
| `prazo_entrega`, `prazo_entrega_urgencia` | Text |
| `duracao_minutos`, `dado_necessario` | Exigidos se agendamento |
| `restricao` | Text |
| `valor_urgencia` | Exigido se urgência |
| `created_at`, `updated_at` | Timestamps |

#### Tabelas do ecossistema (fora das telas do painel, mas no mesmo banco)

Úteis para não “recriar” conceitos ou quebrar integrações:

| Área | Tabelas (exemplos) |
|------|--------------------|
| Tenant | `contratantes`, `laboratorios`, `clinica_laboratorio` |
| Conversa / bot | `conversas`, `leads`, `lead_interacoes`, `conversation_state`, `conversation_entities`, `n8n_chat_histories`, `CRM-Geral` |
| Agenda clínica | `agendamentos`, `animais` |
| Coleta | `coletas`, `coleta_eventos`, `entregadores`, `traccar_geofences`, … |

O painel **não** gerencia essas tabelas hoje; mudanças em clientes/serviços/planos ainda assim podem afetá-las via FKs e fluxos n8n.

#### `planos` / `plano_servicos`
- Plano: `id`, `nome`, `descricao`, `prioridade_atendimento`, `prazo_pagamento_dias`, `permite_faturamento`, `ativo`
- Vínculo: `plano_id`, `servico_id`, `valor_especifico`, `prazo_especifico`, `ativo`

#### Storage
| Bucket | Path | Uso |
|--------|------|-----|
| `panel-assets` (privado) | `branding/logo` | Logo do laboratório (URL assinada ~1h) |

### 3.6 Relação cliente ↔ plano

- Cardinalidade: **muitos clientes → no máximo um plano** (`clientes.plano_id`).
- Associar outro plano **substitui** o anterior.
- Remover: `plano_id = null` (`PATCH /api/clientes/[id]/plano`).
- Serviços do plano vêm de `plano_servicos`; o cliente herda o pacote indiretamente.

---

## 4. Autenticação e autorização

### 4.1 Login (funcional)

| Passo | Comportamento |
|-------|----------------|
| Entrada | Campo **login** (usuário ou e-mail) + senha |
| API | `POST /api/auth/login` |
| Resolução do usuário | 1) `panel_users.login` normalizado; 2) se houver `@`, tenta `email` e `email_interno` |
| Inativo | `ativo = false` → credenciais inválidas |
| Auth real | `signInWithPassword` com `email_interno` + senha |
| Sucesso | Cookies de sessão; redirect para `/dashboard` |

**Convenção de Auth:** o e-mail no Supabase Auth é sintético: `{login}@painel.local` (`PAINEL_EMAIL_DOMAIN`). O campo `email` em `panel_users` é só contato.

**Regras de login:** 3–50 caracteres; `[a-z0-9._-]`; normalizado em minúsculas. Logins numéricos legados (CPF antigo) ainda são válidos.

### 4.2 Logout

`POST /api/auth/logout` → limpa sessão → `/`.

### 4.3 Proteção de telas

`src/app/dashboard/layout.tsx`:

- Sem usuário autenticado → `redirect("/")`
- Carrega nome/role (via admin) e visibilidade do menu (via RPC no cliente de sessão)
- `dynamic = "force-dynamic"` (evita HTML antigo em cache)

### 4.4 RBAC — permissões

Padrão da chave: **`{modulo}.{acao}`** com ações `read | create | update | delete`.

| Módulo | Chaves | Cobre também (via RLS) |
|--------|--------|-------------------------|
| `usuarios` | `usuarios.*` | `panel_users`, roles, permissions |
| `contatos` | `contatos.*` | `contatos`, `telefones`, `contato_telefone` |
| `clientes` | `clientes.*` | `clientes`, `enderecos`, `cliente_contato` |
| `servicos` | `servicos.*` | `"Services"` |
| `planos` | `planos.*` | `planos` **e** `plano_servicos` |

**Roles seed:**

| Role | Permissões padrão |
|------|-------------------|
| `admin` | Todas |
| `operador` | CRM completo (contatos, clientes, serviços, planos); **sem** `usuarios.*` |
| `viewer` | Papel criado no seed **sem nenhuma permissão vinculada**. Na prática, usuário `viewer` entra no painel mas **não vê módulos** do menu até alguém atribuir permissões (ex.: só `*.read`) em **Usuários → permissões da role**. Intenção de negócio (somente leitura) ainda não está fixada no seed — configurar conforme o caso. |

**Menu:** item aparece se o role tiver **qualquer** permissão do módulo (`getDashboardNavVisibility`).

**Importante para desenvolvedores:**

- APIs de CRM em geral só checam **sessão** (401); a negação por falta de permissão vem do **RLS** (hoje costuma aparecer como erro 500 genérico, não 403).
- APIs de usuários / roles / upload de logo checam RPC e respondem **403 Sem permissão**.

---

## 5. Módulos funcionais (UI)

### 5.1 Mapa de rotas

| Rota | Função | Auth |
|------|--------|------|
| `/` | Login | Pública |
| `/dashboard` | Visão geral (cards por permissão) | Sim |
| `/dashboard/contatos` | CRUD contatos + telefones | Sim |
| `/dashboard/clientes` | CRUD clientes PF/PJ | Sim |
| `/dashboard/servicos` | CRUD serviços/exames | Sim |
| `/dashboard/planos` | CRUD planos + serviços do plano + clientes | Sim |
| `/dashboard/usuarios` | Usuários, roles/perms, logo | Sim |
| `/dashboard/plano-servicos` | Redirect legado → `/dashboard/planos` | Sim |
| `/versao` | Diagnóstico de build | Pública |

### 5.2 Padrão UX das telas de cadastro

1. Lista à esquerda / formulário à direita (ou equivalente)
2. Clique na linha → consulta (somente leitura)
3. “Habilitar edição” → libera formulário
4. Cancelar / Limpar / Excluir (com confirmação)

Identidade visual base: azul `#023366` / `#0B64C0`, fundo `#F3F7FF`.

### 5.3 Contatos

| Capacidade | Detalhe |
|------------|---------|
| Campos | Nome (obrigatório), telefones (textarea) |
| Telefones | Separados por vírgula, espaço, `;` ou quebra de linha; só dígitos; sem duplicata |
| APIs | `GET/POST /api/contatos`, `PATCH/DELETE /api/contatos/[id]` |

### 5.4 Clientes

| Capacidade | Detalhe |
|------------|---------|
| Tipo | PF (pessoa/tutor) ou PJ (clínica/empresa) |
| Campos | Nome, nome fantasia (PJ), documento opcional (CPF/CNPJ validado), plano, N endereços, N contatos com cargo |
| Documento | Persistido só com dígitos; máscara na UI |
| APIs | `/api/clientes`, `/api/clientes/[id]`, auxiliares `/api/planos`, `/api/contatos` |

**Regra de update:** PATCH recria endereços e vínculos (delete + insert).

### 5.5 Serviços (exames)

| Capacidade | Detalhe |
|------------|---------|
| Lista | Filtros: busca, ativo, agendamento, urgência |
| Obrigatórios | Tipo, nome, preparo, sinônimos (`embedding_text`) |
| Condicionais | Se agendamento → agenda, duração ≥ 1, dados necessários; se urgência → valor de urgência |
| Integração | Create/update com `embedding_text` dispara webhook n8n |
| APIs | `/api/servicos`, `/api/servicos/[id]` |

### 5.6 Planos (hub)

Substitui a tela antiga de plano-serviços.

| Capacidade | Detalhe |
|------------|---------|
| Plano | Nome, descrição, prioridade, prazo pagamento (dias), faturamento, ativo |
| Serviços do plano | Um serviço por plano; valor e prazo específicos |
| Clientes | Associar (substitui plano anterior) / remover |
| APIs | `/api/planos`, `/api/planos/[id]`, `/api/planos/[id]/completo`, `/api/plano-servicos`, `PATCH /api/clientes/[id]/plano` |

### 5.7 Usuários e branding

| Capacidade | Detalhe |
|------------|---------|
| Criar usuário | Nome, e-mail opcional, login, senha (≥6), role, ativo → cria Auth + `panel_users` |
| Manutenção | Trocar role, ativar/desativar, redefinir senha |
| Roles | Tela para marcar permissões por módulo/ação (`PUT /api/roles/[id]/permissions`) |
| Logo | Upload imagem ≤ 4MB; exige `usuarios.update`; `GET/POST /api/branding/logo` |

---

## 6. Catálogo de APIs

Convenção de resposta: `{ ok: true, ... }` ou `{ ok: false, message, details? }`.

### 6.1 Auth e utilitários

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| POST | `/api/auth/login` | Público | Login |
| POST | `/api/auth/logout` | Sessão | Logout |
| GET | `/api/branding/logo` | Público | URL do logo |
| POST | `/api/branding/logo` | `usuarios.update` | Upload do logo |
| GET | `/api/panel-version` | Público | Info de build |
| GET | `/api/debug/build` | Público | Info de build |
| GET | `/api/debug/me` | Sessão | Diagnóstico auth/RLS |

### 6.2 CRM e planos

| Método | Rota | Descrição |
|--------|------|-----------|
| GET, POST | `/api/clientes` | Listar / criar |
| GET, PATCH, DELETE | `/api/clientes/[id]` | Detalhe / atualizar / excluir |
| PATCH | `/api/clientes/[id]/plano` | Associar/remover plano |
| GET, POST | `/api/contatos` | Listar / criar |
| PATCH, DELETE | `/api/contatos/[id]` | Atualizar / excluir |
| GET, POST | `/api/servicos` | Listar / criar (+ n8n) |
| GET, PATCH, DELETE | `/api/servicos/[id]` | Detalhe / atualizar (+ n8n) / excluir |
| GET, POST | `/api/planos` | Listar / criar |
| PATCH, DELETE | `/api/planos/[id]` | Atualizar / excluir |
| GET | `/api/planos/[id]/completo` | Plano + serviços + clientes |
| GET, POST | `/api/plano-servicos` | Listar / criar vínculo |
| PATCH, DELETE | `/api/plano-servicos/[id]` | Atualizar / excluir vínculo |

### 6.3 Usuários / roles

| Método | Rota | Permissão explícita |
|--------|------|---------------------|
| GET, POST | `/api/usuarios` | `usuarios.read` / `usuarios.create` |
| PATCH | `/api/usuarios/[id]` | `usuarios.update` |
| GET | `/api/usuarios/meta` | `usuarios.read` |
| PUT | `/api/roles/[id]/permissions` | `usuarios.update` |

---

## 7. Integrações externas

### 7.1 Supabase

| Uso | Variável / cliente |
|-----|---------------------|
| URL + anon (browser/server/build) | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| Service role (só servidor) | `SUPABASE_SERVICE_ROLE_KEY` |
| Auth redirect produção | Site URL + Redirect URLs no painel Supabase apontando para o domínio real |

### 7.2 n8n (embeddings de serviços)

| Item | Detalhe |
|------|---------|
| Quando | Após **criar** serviço com `embedding_text`; após **atualizar** se o texto mudou |
| Onde | `src/lib/n8n.ts` → `triggerEmbeddingWorkflow` |
| URL | `N8N_EMBEDDING_WEBHOOK_URL` ou fallback no código (`n8n.fpsoftware.cloud/.../embedding_por_servico`) |
| Payload enviado pelo painel | `{ id: service_id, embedding_text }` |
| Efeito esperado no banco | Preencher `"Services".embedding` (`vector(1536)`) e `embedding_updated_at` |
| Timeout | 8s |
| Falha | Não derruba o CRUD; API devolve `workflow: { ok, reason? }` |

Outros workflows n8n (WhatsApp, chat history em `n8n_chat_histories`, etc.) **não** são disparados por este painel.

---

## 8. Variáveis de ambiente

| Variável | Escopo | Obrigatória |
|----------|--------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Browser + server + **build Docker** | Sim |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser + server + **build Docker** | Sim |
| `SUPABASE_SERVICE_ROLE_KEY` | Runtime servidor / API | Sim (para login e admin) |
| `N8N_EMBEDDING_WEBHOOK_URL` | Runtime | Não (há fallback) |
| `PANEL_HOST` | Compose / Traefik | Sim em produção com Traefik |
| `TRAEFIK_CERT_RESOLVER` | Compose | Não (padrão `le`) |

Modelo: `.env.example`. Não versionar `.env` / `.env.local`.

---

## 9. Deploy e ambientes

### 9.1 Desenvolvimento local

```bash
cd secretaria-virtual-panel
npm install
npm run dev          # Next + Turbo, porta 3000
npm run dev:clean    # limpa .next / cache se UI quebrar
npm run build        # validação de produção
```

### 9.2 Produção (Docker + Traefik)

- Compose service: `secretaria-animallabor`
- Rede externa: `proxy-net`
- Entrypoint Traefik: `websecure` (443), Host = `PANEL_HOST`
- Porta interna do app: **3000** (não publicada no host pelo compose padrão)
- Atualização típica: `git pull && docker compose up -d --build`

**Atenção:** mudar `NEXT_PUBLIC_*` exige **rebuild** da imagem.

### 9.3 Diagnóstico pós-deploy

- Página `/versao`
- APIs `/api/panel-version` ou `/api/debug/build`
- Sessão/RLS: `/api/debug/me` (autenticado)

---

## 10. Regras de negócio (resumo para analistas)

1. Login do painel é por **usuário (`login`)** ou e-mail; senha no Supabase Auth com e-mail sintético `@painel.local`.
2. Usuário inativo não autentica.
3. Acesso a dados é por **papel → permissões**; menu esconde módulos sem nenhuma permissão.
4. Cliente é PF ou PJ; documento é opcional, mas se informado deve ser CPF/CNPJ válido.
5. Um cliente tem **no máximo um plano**; associar outro plano substitui o atual.
6. Serviços do plano têm preço/prazo específicos; um serviço não se repete no mesmo plano (UI filtra).
7. Contato pode ter vários telefones; número é normalizado só com dígitos.
8. Serviço com agendamento exige agenda, duração e dados necessários; com urgência exige valor de urgência.
9. Texto de sinônimos (`embedding_text`) alimenta pipeline de IA via n8n (vetor em `"Services".embedding`).
10. Logo atual do painel é Storage `panel-assets`; multi-tenant futuro deve alinhar com `laboratorios.logo_path`.
11. Tenant em produção hoje: **Animal Labor**. Multi-lab está previsto no banco (`contratantes` / `laboratorios`), mas o app do painel ainda não isola dados por laboratório.

---

## 11. Convenções para evoluir o sistema

Ao criar um **novo módulo** no painel, seguir este checklist:

1. Definir se o dado é **global** ou **por laboratório** (multi-tenant); se por lab, prever `laboratorio_id` + RLS.
2. Verificar impacto em tabelas do ecossistema (leads, conversas, coletas, embeddings).
3. Definir permissões `novo_modulo.read|create|update|delete` no seed SQL.
4. Criar/ajustar policies RLS em `panel_rls.sql` (e aplicar no Supabase).
5. Incluir o módulo em `DashboardNavModule` + item no `DashboardAside`.
6. Expor APIs em `src/app/api/...` com sessão + Zod.
7. Preferir cliente de sessão (RLS) para CRUD; service role só se houver justificativa clara.
8. Tela em `src/app/dashboard/...` seguindo o padrão listar → consultar → editar.
9. Atualizar esta documentação e, se necessário, o README.

---

## 12. Limitações e débitos conhecidos (úteis para o time)

| Item | Observação |
|------|------------|
| DDL completo do CRM/ecossistema | Não versionado neste repo — schema vive no Supabase; risco de drift se outro ambiente for criado só com `supabase/*.sql` do painel |
| Multi-tenant no app | Modelo `contratantes`/`laboratorios` existe; painel ainda não seleciona nem filtra por lab |
| Duas ideias de logo | Storage do painel vs `laboratorios.logo_path` |
| Role `viewer` | Existe sem permissões no seed — configurar manualmente se precisar de “só leitura” |
| Erros de permissão no CRM | RLS falha costuma virar 500, não 403 amigável |
| PATCH cliente/contato | Recria filhos (endereços/telefones/vínculos) — não é patch parcial fino |
| DELETE contato | Não limpa telefones órfãos nem valida vínculos com clientes |
| Escopo do produto | Este repo é o **painel**; WhatsApp/Chatwoot/coletas/bot estão em outras peças + mesmo banco |

---

## 13. Referências rápidas no código

| Tema | Onde olhar |
|------|------------|
| Login | `src/app/api/auth/login/route.ts`, `src/lib/panel-login.ts` |
| Sessão server | `src/lib/supabase/server.ts`, `src/middleware.ts` |
| Admin | `src/lib/supabase/admin.ts` |
| Nav/RBAC UI | `src/lib/dashboard-nav-visibility.ts`, `DashboardAside.tsx` |
| RLS | `supabase/panel_rls.sql` |
| n8n embeddings | `src/lib/n8n.ts` |
| Deploy | `Dockerfile`, `docker-compose.yml`, `README.md` |

---

## Histórico deste documento

| Versão | Descrição |
|--------|-----------|
| 1.0 | Levantamento funcional inicial a partir do código do painel |
| 1.1 | Ecossistema (WhatsApp/n8n/Chatwoot/coletas), multi-tenant (`contratantes`/`laboratorios`), schema lido do Supabase em uso; Markdown como formato oficial; glossário adiado |
