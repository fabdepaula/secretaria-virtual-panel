# Secretaria Virtual — Painel

Painel administrativo em [Next.js](https://nextjs.org) (App Router) com Supabase.

## Requisitos

- Node.js 20+ (desenvolvimento local)
- Conta e projeto [Supabase](https://supabase.com) com SQL em `supabase/` aplicado conforme a documentação do projeto

## Variáveis de ambiente

Copie `.env.example` para `.env` e preencha (não commite `.env`).

| Variável | Onde |
|----------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Browser + servidor + **build Docker** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser + servidor + **build Docker** |
| `SUPABASE_SERVICE_ROLE_KEY` | Só servidor (API routes) |
| `N8N_EMBEDDING_WEBHOOK_URL` | Opcional (há URL padrão no código) |

No Supabase, configure **Site URL** e **Redirect URLs** de autenticação para o domínio real do painel em produção (incluindo `https://`).

## Desenvolvimento

Na pasta **`secretaria-virtual-panel`**:

```bash
npm install
npm run dev
```

Para limpar cache se a UI não atualizar ou houver erro de HMR:

```bash
npm run dev:clean
```

A URL costuma ser `http://localhost:3000` (ou outra porta se 3000 estiver ocupada).

### Produção local (`next start`)

`next start` só serve o último `npm run build`. Se o layout parecer antigo:

```bash
npm run start:fresh
```

### Diagnóstico

- Página: **`/versao`**
- API: **`/api/panel-version`** ou **`/api/debug/build`**

## Docker (produção na VPS ou local)

A imagem usa o [modo `standalone`](https://nextjs.org/docs/app/building-your-application/deploying#docker-image) do Next.js.

### Pré-requisito

Crie um `.env` na mesma pasta que o `docker-compose.yml` (pode copiar de `.env.example`). O Docker Compose lê esse arquivo para interpolar variáveis.

**Importante:** `NEXT_PUBLIC_*` são incorporadas ao JavaScript no **momento do build**. Se mudar URL ou anon key do Supabase para o painel, é preciso **reconstruir** a imagem (`docker compose build --no-cache` ou `docker build ...` de novo).

### Com Docker Compose

```bash
docker compose up -d --build
```

Porta no host: `3000` por padrão, ou defina `PANEL_PORT` no `.env`.

### Só Docker (sem Compose)

```bash
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL" \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="$NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -t secretaria-virtual-panel .

docker run --rm -p 3000:3000 \
  -e NEXT_PUBLIC_SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL" \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY="$NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -e SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" \
  -e N8N_EMBEDDING_WEBHOOK_URL="$N8N_EMBEDDING_WEBHOOK_URL" \
  secretaria-virtual-panel
```

Na VPS, coloque na frente um proxy reverso (Nginx, Caddy, Traefik) com TLS (Let’s Encrypt) e encaminhe para a porta do container.

### Atualizar o deploy

```bash
git pull
docker compose up -d --build
```

## Git (só este repositório)

Inicialize o Git **dentro** de `secretaria-virtual-panel` se este for o único app no repositório remoto.

## Referências Next.js

- [Documentação Next.js](https://nextjs.org/docs)
- [Deploy com Docker](https://nextjs.org/docs/app/building-your-application/deploying#docker-image)
