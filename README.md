# UFU Decide — Backend

Plataforma de votação estudantil com autenticação por e-mail institucional `@ufu.br`.

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Framework | Next.js 14 (App Router) |
| Banco de dados | Supabase (PostgreSQL + RLS) |
| E-mail | Resend |
| Deploy | Vercel |

---

## 1. Configurar variáveis de ambiente

Copie `.env.local.example` para `.env.local` e preencha os valores:

```bash
cp .env.local.example .env.local
```

| Variável | Onde obter |
|----------|-----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → service_role key |
| `RESEND_API_KEY` | resend.com → API Keys |

> **Atenção:** a `SUPABASE_SERVICE_ROLE_KEY` nunca deve ser exposta no cliente — ela só é usada em rotas de servidor.

---

## 2. Configurar o banco de dados (Supabase)

1. No painel do Supabase, acesse **SQL Editor**.
2. Cole e execute o conteúdo de `supabase-setup.sql`.

O script cria:
- Enum `vote_choice` (`favor | contra | abstencao`)
- Tabela `votes` — um voto por `email_hash`
- Tabela `verification_codes` — códigos OTP de 6 dígitos
- Tabela `rate_limits` — controle de requisições por IP
- View `public_results` — contagem agregada de votos
- Row Level Security habilitado em todas as tabelas (acesso apenas via `service_role`)

---

## 3. Rodar localmente

```bash
npm install
npm run dev
```

---

## 4. API Endpoints

### `POST /api/send-code`

Gera e envia um código OTP de 6 dígitos para o e-mail informado.

**Body:**
```json
{ "email": "aluno@ufu.br" }
```

**Respostas:**

| Status | Significado |
|--------|-------------|
| 200 | `{ "success": true }` — e-mail enviado |
| 400 | E-mail inválido (não é `@ufu.br`) |
| 409 | Este e-mail já votou |
| 429 | Rate limit excedido (3 req / 15 min por IP) |

---

### `POST /api/verify-code`

Valida o código OTP. Retorna um token de sessão temporário se correto.

**Body:**
```json
{ "email": "aluno@ufu.br", "code": "123456" }
```

**Respostas:**

| Status | Significado |
|--------|-------------|
| 200 | `{ "success": true, "token": "<uuid>" }` |
| 400 | Formato de código inválido |
| 401 | Código incorreto |
| 404 | Nenhum código válido encontrado |
| 429 | 5 tentativas incorretas — solicitar novo código |

> O `token` retornado tem validade igual à do código original (até 10 minutos após a geração). Guarde-o no frontend para usar em `/api/vote`.

---

### `POST /api/vote`

Registra o voto. Exige o token gerado por `/api/verify-code`.

**Body:**
```json
{
  "email": "aluno@ufu.br",
  "token": "<uuid-retornado-pelo-verify-code>",
  "choice": "favor"
}
```

`choice` aceita: `"favor"` | `"contra"` | `"abstencao"`

**Respostas:**

| Status | Significado |
|--------|-------------|
| 200 | `{ "success": true }` — voto registrado |
| 400 | Parâmetros inválidos |
| 401 | Token inválido ou expirado |
| 409 | Este e-mail já votou |

---

### `GET /api/results`

Endpoint público sem autenticação. Retorna a contagem atual de votos.

**Resposta:**
```json
{
  "favor": 120,
  "contra": 45,
  "abstencao": 10,
  "total": 175
}
```

Respostas são cacheadas por 30 segundos no edge.

---

## 5. Fluxo completo de votação

```
1. Usuário informa e-mail @ufu.br
       ↓
2. POST /api/send-code
   → valida domínio, rate limit, verifica se já votou
   → envia código OTP por e-mail
       ↓
3. Usuário digita o código recebido
       ↓
4. POST /api/verify-code
   → valida código (máx. 5 tentativas)
   → retorna { token }
       ↓
5. Usuário escolhe: A Favor / Contra / Abstenção
       ↓
6. POST /api/vote  { email, token, choice }
   → valida token de sessão
   → registra voto (email salvo apenas como SHA-256)
   → invalida token
       ↓
7. GET /api/results → exibe placar atualizado
```

---

## 6. Segurança

- E-mails **nunca** são armazenados — apenas o hash SHA-256.
- Todos os endpoints validam o domínio `@ufu.br` antes de qualquer operação.
- Rate limiting por IP em `/api/send-code`.
- Limite de 5 tentativas incorretas em `/api/verify-code`.
- Token de sessão é UUID aleatório, consumido após o voto.
- RLS no Supabase bloqueia acesso direto pelo client anon.
- Toda comunicação com o banco passa pelo `service_role` no servidor.

---

## 7. Deploy na Vercel

1. Faça push do projeto para um repositório Git.
2. Importe o projeto na Vercel.
3. Adicione as variáveis de ambiente no painel da Vercel (Settings → Environment Variables).
4. Deploy automático a cada push.
