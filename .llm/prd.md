# PRD — Quanto Tô Valendo · WhatsApp Edition
**Agente de análise salarial para profissionais de dados, rodando nativo no WhatsApp**
**Versão 7 — spec completa e autossuficiente (Node.js + Baileys)**

> **Este documento é a fonte única de verdade.** Ele contém **tudo** o que é preciso para reconstruir o projeto do zero em qualquer VPS — inclusive o dataset e o schema embutidos nos apêndices. Não depende de nenhum outro repositório. A stack é fixa (seção 2): não proponha alternativas.

---

## 0. Como reconstruir este projeto em uma VPS nova

Este PRD foi escrito para o fluxo **`/init` → `/plan` → implementar** do Claude Code.

1. **Provisione a VPS** (seção 8.1): Node 20+, `git`, `pm2`, portas `3001` e `5173` liberadas no firewall.
2. **Coloque este `prd.md`** em `.llm/prd.md` de um repositório novo (greenfield) e rode **`/init`** — ele gera o `CLAUDE.md` a partir desta spec.
3. Rode **`/plan`** apontando para `.llm/prd.md` para obter o plano de implementação passo a passo.
4. Implemente seguindo o plano. Os **invariantes da seção 3 são intocáveis** — qualquer violação quebra o produto.
5. Crie `dados/salarios.json` a partir do **Apêndice A**. Não precisa de nenhuma fonte externa.
6. Preencha os `.env` (seção 7), builde o frontend e suba com `pm2` (seção 8).
7. Valide contra os **critérios de aceite da seção 6**.

**Convenção de idioma:** PT-BR em tudo — prompts, outputs, mensagens ao usuário, comentários, docstrings e identificadores de código (`analisarCurriculo`, `conversas`, `mensagens`).

---

## 1. O Produto

O usuário manda o currículo (PDF ou texto) **direto no WhatsApp**. O agente analisa o perfil, cruza com os dados salariais da pesquisa **State of Data Brazil 2025-2026 (Data Hackers / Bain & Company)** e responde a pergunta: **"quanto tô valendo?"**

A resposta é uma **narrativa em três atos** — nesta ordem, sem exceção:

1. **O Veredito** — a faixa salarial do perfil, com senioridade estimada e justificativa citando evidências do CV. Fonte citada. É o número que a pessoa veio buscar.
2. **O Delta** — quanto o próximo nível paga e **quanto dinheiro por mês separa a pessoa dele** (diferença entre as medianas, em R$). É o clímax emocional: não "você vale X", mas "você está deixando R$ Y por mês na mesa".
3. **O Caminho** — o que fecha esse gap: no máximo 3 lacunas concretas (relativas ao próximo nível) e um roadmap de 90 dias que as ataca.

**One more thing:** depois da análise, o resumo profissional reescrito — pronto para colar no LinkedIn. Sempre por último.

**A materialização no WhatsApp usa o meio a favor da narrativa:** cada ato é uma **mensagem separada**, enviada em sequência com um pequeno intervalo (1,5–2,5s) e indicador "digitando..." entre elas. O formato de mensageria vira o próprio ritmo do keynote — tensão, pausa, revelação. O "one more thing" chega como quinta e última mensagem.

### Princípios de produto (inegociáveis)

- **Uma pergunta, uma resposta.** O produto responde "quanto tô valendo — e como passo a valer mais". Sem "pontos fortes/fracos" genéricos: se não muda o que a pessoa faz segunda-feira de manhã, corta.
- **Números em linguagem humana.** Percentil não aparece na conversa. p25/p75 viram "a maioria dos profissionais como você ganha entre X e Y"; a mediana é "o valor típico".
- **O delta é sempre mensal e em reais.**
- **Zero configuração para o usuário final.** Ele manda o CV, recebe a análise. Não escolhe cargo nem senioridade — o agente infere.
- **PT-BR em tudo:** prompts, outputs, mensagens, comentários, docstrings.

## 2. Arquitetura Geral

| Camada | Stack | Porta |
|---|---|---|
| Backend | Node.js 20+ + Express + Socket.IO | 3001 |
| WhatsApp | `@whiskeysockets/baileys` (multi-conexão, sessão persistida) | — |
| Agente | `@anthropic-ai/sdk` (tool use + structured output validado com Zod) | — |
| Persistência | SQLite via `better-sqlite3` (`backend/data/app.db`) | — |
| Frontend (painel admin) | React + Vite + socket.io-client + axios + react-hot-toast + lucide-react + react-router-dom | 5173 |
| Infra | VPS Linux; serviços acessíveis via `http://${IP_OU_DOMINIO}:[porta]` | — |

O frontend **não é para o usuário final** — o usuário final vive no WhatsApp. O React é o **painel admin**: conexões via QR Code, histórico de conversas, toggle do agente, edição de system prompt e seleção de modelo.

Este produto é **inbound**: ele responde quem manda mensagem, **nunca dispara em massa**. Não há módulo de disparos, campanhas ou agendamento.

### 2.1 Versões exatas das dependências

Fixe estas versões para um build reproduzível.

**`backend/package.json`** (`"type": "module"`):
```json
{
  "dependencies": {
    "@anthropic-ai/sdk": "^0.32.1",
    "@whiskeysockets/baileys": "^6.7.9",
    "better-sqlite3": "^11.3.0",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.21.0",
    "pdf-parse": "^1.1.1",
    "pino": "^9.4.0",
    "qrcode": "^1.5.4",
    "socket.io": "^4.8.0",
    "uuid": "^11.0.2",
    "zod": "^3.23.8"
  },
  "devDependencies": { "vitest": "^2.1.4" },
  "scripts": {
    "dev": "node src/server.js",
    "start": "node src/server.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "exemplo": "node scripts/analisar-exemplo.js"
  }
}
```

**`frontend/package.json`** (`"type": "module"`):
```json
{
  "dependencies": {
    "axios": "^1.7.7",
    "lucide-react": "^0.454.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-hot-toast": "^2.4.1",
    "react-router-dom": "^6.27.0",
    "socket.io-client": "^4.8.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.3",
    "vite": "^5.4.10"
  },
  "scripts": {
    "dev": "vite --host",
    "build": "vite build",
    "preview": "vite preview --host"
  }
}
```

**`package.json` raiz** (orquestra os dois):
```json
{
  "scripts": {
    "backend": "npm --prefix backend run dev",
    "frontend": "npm --prefix frontend run dev",
    "test": "npm --prefix backend test"
  }
}
```

> **Nota Baileys:** `@whiskeysockets/baileys` é CJS. `makeWASocket` é o import **default**; `useMultiFileAuthState`, `DisconnectReason`, `Browsers` e `downloadMediaMessage` são imports **nomeados** (não são propriedades do default).

## 3. Invariantes (qualquer mudança quebra o produto)

1. **Números de salário vêm exclusivamente da tool.** O agente chama `consultarFaixaSalarial(cargo, senioridade)`, que lê `dados/salarios.json`. O system prompt proíbe o modelo de estimar valores. A tool é chamada ao menos duas vezes por análise: senioridade estimada **e** próximo nível (para o delta). Sem match exato → recorte mais próximo com `match_exato=false`, sinalizado na resposta.
2. **Dataset pronto, não gerado em runtime.** `dados/salarios.json` é um **asset estático** (Apêndice A). Nova edição da pesquisa = substituir o arquivo. Nenhum RAG.
3. **Structured output validado.** A resposta do agente é parseada contra o schema `AnaliseCompleta` (Zod). Validação falhou → até 2 retries reenviando o erro ao modelo.
4. **Três atos na ordem, sempre.** Perfil no topo (staff): `faixa_proximo_nivel=null`, `delta_mensal=null`; o Ato 2 vira reconhecimento ("você está no topo da tabela"), nunca some.
5. **Máximo 3 itens em `gap_para_proximo_nivel`** (validado no schema).
6. **Isolamento total por conversa:** todo estado é chaveado por `(connection_id, remote_jid)`. Contexto de um contato nunca vaza para outro. **Nenhuma variável de módulo com dados de CV/usuário** — só dados imutáveis (client Anthropic, dataset) podem viver em module scope.
7. **Modelo default `claude-haiku-4-5`**, sobrescrevível via configuração no painel (persistida no banco) ou env `MODELO_AGENTE`.
8. **`ANTHROPIC_API_KEY` só existe no backend.** Nunca chega ao frontend nem a logs.

## 4. Backend

### 4.1 Estrutura de pastas

```
quanto-to-valendo-whatsapp/
├── package.json                     # raiz: scripts "backend" e "frontend"
├── ecosystem.config.cjs             # pm2: backend + serve do painel buildado
├── README.md                        # instalação, acesso, arquitetura, design system
├── DEPLOY.md                        # passo a passo de deploy na VPS
├── .gitignore                       # node_modules, dist, sessions, data, .env
├── .llm/
│   └── prd.md                       # este documento — fonte ÚNICA (spec + mapa de implementação, Apêndice C)
├── dados/
│   └── salarios.json                # asset estático (Apêndice A) — consultado pela tool
├── backend/
│   ├── package.json
│   ├── .env.example                 # ANTHROPIC_API_KEY, MODELO_AGENTE, ADMIN_TOKEN, PORT
│   ├── sessions/                    # sessões Baileys por conexão (gitignore)
│   ├── data/                        # app.db (gitignore)
│   ├── scripts/
│   │   └── analisar-exemplo.js      # smoke da análise real (npm run exemplo)
│   ├── test/                        # Vitest (seção 6, R5)
│   └── src/
│       ├── server.js                # Express + Socket.IO + boot + /health
│       ├── core/                    # ← não importa managers/, routes/, renderers/, db/
│       │   ├── agente.js            # analisarCurriculo(texto) → AnaliseCompleta
│       │   ├── tools.js             # consultarFaixaSalarial()
│       │   ├── schema.js            # Zod: AnaliseCompleta, FaixaSalarial, enums (Apêndice B)
│       │   ├── prompts.js           # getSystemPrompt(override) — override por injeção
│       │   ├── extracao.js          # pdf-parse: Buffer → texto; erros de domínio
│       │   └── erros.js             # PDFSemTextoError, PerfilSemMatchError
│       ├── renderers/
│       │   └── whatsappRenderer.js  # AnaliseCompleta → [msg1..msg5] em formato WhatsApp
│       ├── managers/
│       │   ├── connectionManager.js # Baileys: QR, reconexão, Map de instâncias
│       │   └── messageHandler.js    # messages.upsert → orquestra análise → resposta
│       ├── db/
│       │   ├── database.js          # better-sqlite3, migrations em boot
│       │   └── repositorio.js       # conversas, mensagens, configuracoes
│       └── routes/
│           ├── connections.js       # /api/connections
│           ├── conversations.js     # /api/conversations
│           └── settings.js          # /api/settings
└── frontend/                        # React + Vite (seção 5)
```

**Regra de dependência (validada por teste):** `core/` não importa nada de `managers/`, `routes/`, `renderers/` ou `db/` — exceto `prompts.js`, que recebe o override por **injeção** (a função recebe o texto, não importa o repositório). `renderers/` importam só `core/schema.js`. `managers/` e `routes/` importam o resto.

### 4.2 Conexões Baileys

- `useMultiFileAuthState` com pasta `sessions/{connectionId}/`; reconexão automática sem novo QR quando há sessão salva; tratamento de `DisconnectReason`; instâncias ativas em `Map`.
- Rotas `/api/connections`: `POST /` (criar, uuid + nome), `GET /` (listar com status), `DELETE /:id` (remover + limpar sessão), `POST /:id/connect` (inicia e emite QR), `POST /:id/disconnect`.
- Socket.IO: `qr_update` `{ connectionId, qr }` (base64 png via `qrcode`), `connection_status` `{ connectionId, status: connecting | open | close | qr }`.
- **Desconectar é parada manual:** não deve reconectar sozinho.

### 4.3 Fluxo de mensagem inbound

`messageHandler.js`, ouvindo `messages.upsert` de cada conexão:

1. **Filtros de entrada (nesta ordem):** ignorar `fromMe`; ignorar grupos (`@g.us`), broadcast e status; ignorar mensagens sem texto e sem documento.
2. **Persistir a mensagem recebida** em `mensagens`, criando a conversa em `conversas` se não existir.
3. **Verificar se o agente está ativo** para a conversa (toggle global E por conversa — os dois precisam estar ligados). Desligado → só persiste, não responde.
4. **Roteamento do conteúdo:**
   - Documento PDF → download do buffer (`downloadMediaMessage`) → `extracao.js` → texto. PDF sem texto extraível → mensagem amigável, nunca stack trace.
   - Documento não-PDF → orientação amigável ("me manda em PDF ou cola o texto").
   - Texto < 200 caracteres → orientação em vez de gastar API ("cola seu currículo completo ou manda o PDF").
   - Texto ≥ 200 caracteres → tratado como currículo.
5. **Feedback imediato:** `sendPresenceUpdate('composing')` + mensagem "🔍 Analisando seu currículo..." antes de chamar o agente.
6. **Análise:** `analisarCurriculo(texto)` → `AnaliseCompleta`.
7. **Resposta em atos:** `whatsappRenderer` devolve um array de mensagens; o handler envia uma a uma com intervalo de 1,5–2,5s e `composing` entre elas.
8. **Persistir cada mensagem enviada** e emitir `conversation_update` via Socket.IO (o painel atualiza em tempo real).
9. **Trava anti-concorrência por conversa:** se já existe análise em andamento para aquele `(connectionId, remoteJid)`, responder "já estou analisando, um instante" em vez de iniciar outra. Conversas diferentes rodam em paralelo sem se bloquear.

**Fluxo de 2 etapas sem saudação:** o bot não faz saudação genérica; vai direto ao ponto (ou orientação, ou análise). **Delay humano** de 1,5–2,5s em todas as respostas.

**Formato WhatsApp:** o renderer usa a formatação nativa (`*negrito*`, `_itálico_`, `> citação`, listas com `•`) — nunca HTML, nunca markdown de `#`. Valores monetários via `formatarReais()` (`R$ 12.500`).

### 4.4 Agente (core)

- `@anthropic-ai/sdk` com tool use. Loop de tool calling manual: modelo pede `consultar_faixa_salarial` → executa → devolve `tool_result` → repete até resposta final.
- Resposta final exigida como JSON puro no formato de `AnaliseCompleta`; parse + validação Zod; falhou → reenvia o erro de validação ao modelo (máx. 2 retries).
- System prompt em `prompts.js` com a rubrica de senioridade (junior → pleno → senior → staff), recebendo override vindo do banco por parâmetro.
- Cliente Anthropic e dataset carregados uma vez (module scope) — dados imutáveis podem ser compartilhados; dados de usuário, jamais (invariante 6).

### 4.5 Persistência (SQLite)

```sql
conexoes       (id TEXT PRIMARY KEY, nome, criada_em)   -- conexões Baileys; sobrevive a restart
conversas      (id, connection_id, remote_jid, nome_contato, agente_ativo INTEGER DEFAULT 1,
                criada_em, atualizada_em, UNIQUE(connection_id, remote_jid))
mensagens      (id, conversa_id, papel TEXT CHECK(papel IN ('usuario','agente','sistema')),
                tipo TEXT, conteudo TEXT, timestamp)
configuracoes  (chave TEXT PRIMARY KEY, valor TEXT)   -- system_prompt_override, modelo, agente_ativo_global
```

Migrations rodam no boot (`database.js`); no boot também religa as conexões salvas. O banco fica em `backend/data/app.db` (gitignore).

### 4.6 Rotas do painel

- `/api/conversations`: `GET /` (lista com último trecho, contadores, status do agente), `GET /:id/messages` (histórico paginado), `PATCH /:id` (toggle `agente_ativo`).
- `/api/settings`: `GET /` e `PUT /` — `system_prompt_override`, `modelo` (lista fixa de modelos Anthropic válidos), `agente_ativo_global`.
- `/health`: `GET /` → `200` simples para checagem de vida.
- **Métricas por conexão** (exibidas no painel): uptime, nº de mensagens, nº de contatos.
- **Autenticação mínima:** header `X-Admin-Token` comparado com `ADMIN_TOKEN` do `.env` em **todas** as rotas `/api/*` e no **handshake do Socket.IO**. A VPS é pública e cada mensagem custa API — painel aberto é queima de chave.
- CORS: aceitar qualquer origin (o token protege as rotas).

## 5. Frontend (painel admin)

Design: dashboard **dark industrial** no design system da **Jornada de Dados** — verde WhatsApp `#25D366` sobre `#0d1117`/`#161b22`, monospace para dados técnicos, sans moderna para títulos, bordas sutis, sem shadows excessivas. Sidebar fixa; header com nome **Quanto Tô Valendo** e contador de conexões ativas.

**Config (`frontend/.env`, lida em tempo de _build_):** `VITE_API_URL` e `VITE_SOCKET_URL` apontando para `http://${IP_OU_DOMINIO}:3001`. ⚠️ Como o Vite injeta essas variáveis no bundle em build-time, **rebuildar o frontend** é obrigatório sempre que o IP/domínio mudar.

**Login simples:** tela pedindo o admin token, guardado (sessão) e enviado em todas as chamadas (`X-Admin-Token`) e no handshake do socket.

**Rotas (React Router):**

- **/connections** — cards com nome, badge de status (amarelo Aguardando QR, verde Conectado, vermelho Desconectado) e número conectado; modal de QR atualizado em tempo real via `qr_update`; botões Conectar/Desconectar/Excluir; Nova Conexão via modal.
- **/conversations** — lista de conversas (contato, última mensagem, horário, badge do agente), atualização em tempo real via `conversation_update`; clicar abre o histórico estilo chat (mensagens do usuário à esquerda, do agente à direita); toggle "Agente ativo" por conversa no topo do histórico.
- **/settings** — textarea para o system prompt (com botão "restaurar padrão"), select de modelo, toggle global do agente, toast de confirmação ao salvar.

## 6. Requisitos e Critérios de Aceite

**R1. Core de análise**
- [ ] `analisarCurriculo(texto)` retorna `AnaliseCompleta` validada por Zod
- [ ] Números salariais (atual e próximo nível) vêm exclusivamente da tool; `delta_mensal` = diferença das medianas
- [ ] Sem match exato → `match_exato=false` + recorte mais próximo, sinalizado na resposta
- [ ] Staff → `faixa_proximo_nivel=null`, Ato 2 vira reconhecimento
- [ ] `gap_para_proximo_nivel` com no máximo 3 itens

**R2. Conexões WhatsApp**
- [ ] Criar conexão no painel, escanear QR, status vira Conectado em tempo real
- [ ] Restart do backend → conexões com sessão salva reconectam sem novo QR
- [ ] Múltiplas conexões simultâneas, cada uma com sua pasta de sessão
- [ ] Desconectar (manual) não reconecta sozinho

**R3. Fluxo do bot**
- [ ] PDF enviado no chat → análise em 5 mensagens sequenciais (3 atos + one more thing), com "digitando..." entre elas
- [ ] Texto colado ≥ 200 chars → mesma análise
- [ ] Texto curto, documento não-PDF e PDF sem texto → orientações amigáveis, nunca erro cru
- [ ] Mensagens de grupo, status e `fromMe` são ignoradas
- [ ] Duas pessoas mandando CV ao mesmo tempo → duas análises corretas, sem vazamento de contexto
- [ ] Agente desligado (global ou na conversa) → mensagem é persistida mas não respondida

**R4. Painel admin**
- [ ] Histórico de qualquer conversa legível no painel, atualizando em tempo real
- [ ] Toggle do agente por conversa e global funcionam imediatamente
- [ ] Editar system prompt no painel altera o comportamento da próxima análise sem restart
- [ ] Trocar modelo no painel vale para a próxima análise
- [ ] Sem token válido → toda rota `/api/*` e o Socket.IO recusam

**R5. Qualidade**
- [ ] Vitest: schema (Zod), `formatarReais`, `whatsappRenderer` (ordem dos atos, formatação, caso staff), tool (match exato, staff→Geral, sem match), filtros do `messageHandler` (funções puras, sem rede), teste de regra de dependência do `core/`
- [ ] Teste do agente com cliente Anthropic mockado (loop de tool calling sem gastar API)
- [ ] Try/catch em todos os handlers; respostas JSON de erro adequadas; `console`/`pino` estruturado, nunca stack trace pro usuário final
- [ ] README: o que é, arquitetura (com Mermaid), design system da narrativa, setup, como rodar, como conectar o primeiro número

**Fora do escopo (não implementar):** disparos em massa, campanhas, agendamento, Telegram/Streamlit, análise de vaga, gráficos, RAG, multi-tenant, deploy automatizado (rodar com `npm run dev` ou pm2 manual na VPS).

## 7. Variáveis de ambiente

### `backend/.env` (nunca versionado)

| Variável | Obrigatória | Default | Descrição |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | ✅ | — | Chave da API Anthropic. **Só no backend** (invariante 8). |
| `MODELO_AGENTE` | — | `claude-haiku-4-5` | Modelo default; sobrescrito pela config do painel se houver. |
| `ADMIN_TOKEN` | ✅ | — | Token exigido em todas as rotas e no handshake do Socket.IO (`X-Admin-Token`). Use um valor forte. |
| `PORT` | — | `3001` | Porta do backend. |

### `frontend/.env` (build-time)

| Variável | Obrigatória | Descrição |
|---|---|---|
| `VITE_API_URL` | ✅ | Base HTTP do backend, ex. `http://${IP_OU_DOMINIO}:3001`. |
| `VITE_SOCKET_URL` | ✅ | Base do Socket.IO, normalmente igual à de cima. |

> Substitua `${IP_OU_DOMINIO}` pelo IP público ou domínio da sua VPS. Como o Vite embute essas variáveis no bundle, **refaça o build** ao mudá-las.

## 8. Deploy na VPS (manual)

### 8.1 Pré-requisitos
- Node 20+, `git`, e `pm2` (`npm i -g pm2`).
- Portas `3001` (backend/WhatsApp/painel→API) e `5173` (painel) liberadas no firewall.
- Recomendado: **número de WhatsApp dedicado**, não o comercial principal (Baileys é não-oficial; risco de bloqueio mesmo sendo inbound).

### 8.2 Passos

```bash
# 1. Obter o código (ou reconstruir do PRD)
git clone <repo> quanto-to-valendo-whatsapp
cd quanto-to-valendo-whatsapp

# 2. Dataset (se reconstruindo do zero): crie dados/salarios.json a partir do Apêndice A

# 3. Backend
cd backend
cp .env.example .env      # preencha ANTHROPIC_API_KEY, ADMIN_TOKEN (forte), MODELO_AGENTE, PORT=3001
npm install
cd ..

# 4. Frontend (as VITE_* entram em build-time!)
cd frontend
cp .env.example .env      # VITE_API_URL / VITE_SOCKET_URL = http://${IP_OU_DOMINIO}:3001
npm install
npm run build
cd ..

# 5. Subir com pm2
pm2 start ecosystem.config.cjs
pm2 save                  # + `pm2 startup` uma vez, para sobreviver a reboot
pm2 logs
```

### 8.3 `ecosystem.config.cjs`
Sobe **`qtv-backend`** (`backend/src/server.js`, cwd `./backend` para o `dotenv` achar o `.env`, `autorestart`, `max_restarts: 20`) e **`qtv-frontend`** (serve estático do `frontend/dist` na porta `5173`, `PM2_SERVE_SPA: true`, `PM2_SERVE_HOMEPAGE: /index.html`).

### 8.4 Acessos e primeiro número
- Painel: `http://${IP_OU_DOMINIO}:5173` (login com o `ADMIN_TOKEN`).
- Health: `http://${IP_OU_DOMINIO}:3001/health`.
- Conectar: Painel → **Conexões → Nova Conexão → Conectar** → no celular, WhatsApp › **Aparelhos conectados** › escanear o QR. Status vira **Conectado**; mande um PDF de currículo pra esse número.

### 8.5 Atualizações
```bash
git pull
cd frontend && npm run build && cd ..
pm2 restart ecosystem.config.cjs
```

## 9. Riscos e Observações

- **Baileys é biblioteca não-oficial** — mesmo sem disparo em massa, o número pode ser banido. Mitigação: produto é inbound, intervalos entre mensagens, número dedicado.
- **Custo de API:** cada análise = 1 chamada com tool use (Haiku). O corte de textos < 200 chars e o toggle do agente são as válvulas de controle.
- **Fila:** volume esperado é baixo; a trava por conversa basta. Se virar gargalo, fila (BullMQ) é evolução futura — não implementar agora.
- **Segredos:** `ANTHROPIC_API_KEY` e `ADMIN_TOKEN` vivem só no `backend/.env` da VPS — nunca no git.

---

## Apêndice A — `dados/salarios.json` (asset estático)

10 recortes (3 cargos × junior/pleno/senior + 1 linha staff "Geral"). Valores mensais em R$, fonte *State of Data Brazil 2025-2026*. Copie **exatamente**:

```json
[
  { "cargo": "Analista de Dados",        "senioridade": "junior", "p25": 2264,  "mediana": 3516,  "p75": 5085,  "n_respondentes": 120, "fonte": "State of Data Brazil 2025-2026" },
  { "cargo": "Cientista de Dados",       "senioridade": "junior", "p25": 3277,  "mediana": 5667,  "p75": 8687,  "n_respondentes": 72,  "fonte": "State of Data Brazil 2025-2026" },
  { "cargo": "Engenheiro de Dados",      "senioridade": "junior", "p25": 2915,  "mediana": 4347,  "p75": 5824,  "n_respondentes": 96,  "fonte": "State of Data Brazil 2025-2026" },
  { "cargo": "Analista de Dados",        "senioridade": "pleno",  "p25": 4848,  "mediana": 6560,  "p75": 8772,  "n_respondentes": 280, "fonte": "State of Data Brazil 2025-2026" },
  { "cargo": "Cientista de Dados",       "senioridade": "pleno",  "p25": 7279,  "mediana": 9350,  "p75": 11379, "n_respondentes": 168, "fonte": "State of Data Brazil 2025-2026" },
  { "cargo": "Engenheiro de Dados",      "senioridade": "pleno",  "p25": 6797,  "mediana": 8790,  "p75": 11181, "n_respondentes": 224, "fonte": "State of Data Brazil 2025-2026" },
  { "cargo": "Analista de Dados",        "senioridade": "senior", "p25": 7917,  "mediana": 10131, "p75": 12949, "n_respondentes": 280, "fonte": "State of Data Brazil 2025-2026" },
  { "cargo": "Cientista de Dados",       "senioridade": "senior", "p25": 11833, "mediana": 14919, "p75": 21490, "n_respondentes": 168, "fonte": "State of Data Brazil 2025-2026" },
  { "cargo": "Engenheiro de Dados",      "senioridade": "senior", "p25": 11703, "mediana": 15285, "p75": 22219, "n_respondentes": 224, "fonte": "State of Data Brazil 2025-2026" },
  { "cargo": "Geral (todas as funções)", "senioridade": "staff",  "p25": 9303,  "mediana": 17805, "p75": 23902, "n_respondentes": 260, "fonte": "State of Data Brazil 2025-2026" }
]
```

**Regras da tool (`consultarFaixaSalarial`):** match exato por `(cargo, senioridade)`; senioridade `staff` sempre cai na linha `Geral (todas as funções)`; sem match → recorte mais próximo com `match_exato=false`.

## Apêndice B — Schema de saída (`core/schema.js`)

Contrato Zod exato que o agente deve produzir e o renderer consumir:

```js
import { z } from 'zod';

export const FONTE = 'State of Data Brazil 2025-2026 (Data Hackers / Bain & Company)';
export const SENIORIDADES = ['junior', 'pleno', 'senior', 'staff'];
export const Senioridade = z.enum(['junior', 'pleno', 'senior', 'staff']);
export const Cargo = z.enum([
  'Analista de Dados', 'Cientista de Dados', 'Engenheiro de Dados', 'Geral (todas as funções)',
]);

export const FaixaSalarial = z.object({
  cargo: z.string(),
  senioridade: Senioridade,
  p25: z.number(),
  mediana: z.number(),
  p75: z.number(),
  n_respondentes: z.number(),
  fonte: z.string(),
  match_exato: z.boolean(),
});

const GapItem = z.object({ lacuna: z.string().min(1), porque_importa: z.string().min(1) });
const RoadmapFase = z.object({
  periodo: z.string().min(1),           // ex.: "Dias 1–30"
  foco: z.string().min(1),
  acoes: z.array(z.string().min(1)).min(1),
});

const Veredito = z.object({
  cargo: z.string().min(1),
  senioridade: Senioridade,
  faixa_atual: FaixaSalarial,
  justificativa: z.string().min(1),     // cita evidências do CV
  aviso_estimativa: z.string().min(1),  // valores são estimativas autodeclaradas
});
const Delta = z.object({
  faixa_proximo_nivel: FaixaSalarial.nullable(),  // staff => null
  delta_mensal: z.number().nullable(),            // staff => null
  mensagem: z.string().min(1),
});
const Caminho = z.object({
  gap_para_proximo_nivel: z.array(GapItem).max(3),  // invariante #5
  roadmap_90_dias: z.array(RoadmapFase).min(1),
});

export const AnaliseCompleta = z.object({
  veredito: Veredito,
  delta: Delta,
  caminho: Caminho,
  resumo_linkedin: z.string().min(1),   // o "one more thing"
  fonte: z.string().default(FONTE),
});
```

O renderer transforma um `AnaliseCompleta` em 5 mensagens WhatsApp (Veredito, Delta, Caminho/lacunas, Plano de 90 dias, resumo LinkedIn), nesta ordem.

## Apêndice C — Mapa de implementação (referência)

Módulo → responsabilidade e funções esperadas. É o alvo que uma implementação correta deve produzir (útil para o `/plan`).

### `core/` (o cérebro — não importa managers/routes/renderers/db)
- **`schema.js`** — Zod: `AnaliseCompleta`, `FaixaSalarial`, enums `Senioridade`/`Cargo`, `.max(3)` em `gap_para_proximo_nivel` (Apêndice B).
- **`tools.js`** — `consultarFaixaSalarial(cargo, senioridade)` + helper `proximoNivel(senioridade)`. Lê `dados/salarios.json` (imutável, module scope). Staff → linha `Geral (todas as funções)`; sem match → recorte mais próximo com `match_exato=false`.
- **`prompts.js`** — `getSystemPrompt(override)` por **injeção** (recebe o texto, não importa o repositório); rubrica de senioridade do State of Data.
- **`agente.js`** — `analisarCurriculo(texto)`; loop **manual** de tool calling; exige JSON puro, faz strip de code fence, valida com Zod, até **2 retries** reenviando o erro; **client Anthropic injetável** (para o teste mockado).
- **`extracao.js`** — `extrairTexto(buffer)` via `pdf-parse`.
- **`erros.js`** — erros de domínio: `PDFSemTextoError`, `PerfilSemMatchError`.

### `renderers/` (importa só `core/schema.js`)
- **`whatsappRenderer.js`** — `renderizar(analise) → [msg1..msg5]` + `formatarReais(n) → "R$ 12.500"`. Formatação nativa do WhatsApp; caso staff vira reconhecimento.

### `managers/`
- **`connectionManager.js`** — Baileys `useMultiFileAuthState`, `Map` de sockets, QR via `qr_update`, `connection_status`, reconexão automática (`loggedOut` limpa a sessão; demais religam sem novo QR; desconexão manual não religa).
- **`messageHandler.js`** — filtros **puros** `deveIgnorarMensagem(...)` e `classificarConteudo(...)`; roteamento (PDF / doc não-PDF / texto <200 / currículo); feedback "🔍 Analisando…"; envio dos 5 atos com 1,5–2,5s e "digitando"; **trava anti-concorrência** por `(connectionId, remoteJid)`.

### `db/` e `routes/`
- **`db/{database,repositorio}.js`** — SQLite: tabelas `conexoes`, `conversas`, `mensagens`, `configuracoes` (§4.5).
- **`routes/{connections,conversations,settings}.js`** — todas atrás de `X-Admin-Token`.
- **`server.js`** — Express + Socket.IO; auth no handshake; migrations e religamento das conexões no boot; `/health`.

### `frontend/`
- Login por token (em memória) → `X-Admin-Token` em toda chamada e no handshake do socket. Rotas `/connections` (QR em tempo real), `/conversations` (chat + toggle por conversa), `/settings` (prompt override + modelo + toggle global). Tema dark WhatsApp (design system Jornada de Dados).

### Testes (Vitest) que provam o acima
`test/schema.test.js`, `test/tools.test.js` (match exato, staff→Geral, sem match), `test/agente.test.js` (client mockado: loop + retry + strip de code fence), `test/renderer.test.js` (ordem dos atos, formatação, staff), `test/messageHandler.test.js` (filtros puros, sem rede), `test/dependencia.test.js` (regra de dependência do `core/`).

### Estado de verificação (na v7 original)
- ✅ Headless: suíte Vitest verde, boot do backend, auth `X-Admin-Token` (rotas + Socket.IO), pipeline de eventos Baileys→Socket.IO, `vite build`.
- ⏳ Só na VPS (precisa de egress WhatsApp real + chave): scan de QR ao vivo e uma análise real (`npm run exemplo`).

---

**Status:** v7 · **Owner:** Luciano · **Baseline:** spec autossuficiente, greenfield, arquivo único · **Fonte de dados:** State of Data Brazil 2025-2026 (Data Hackers / Bain & Company)
