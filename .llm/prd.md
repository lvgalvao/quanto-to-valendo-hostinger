# PRD — Quanto Tô Valendo · WhatsApp Edition
**Agente de análise salarial para profissionais de dados, rodando nativo no WhatsApp**
**Versão 7 — reescrita completa sobre a arquitetura ZapBlast (Node.js + Baileys)**

> **Instrução para o Claude Code:** este documento substitui a spec Python (v6). O escopo de negócio é **idêntico** ao do Quanto Tô Valendo original — a narrativa em três atos, os princípios de produto e os invariantes da seção 3 permanecem intocáveis. O que muda é **toda a stack**: o projeto é reescrito em Node.js sobre a arquitetura do ZapBlast (Baileys + Express + Socket.IO + React/Vite), rodando em VPS. Não proponha stack alternativa. O repositório Python original não é alterado — este é um repositório novo.

---

## 1. O Produto

O usuário manda o currículo (PDF ou texto) **direto no WhatsApp**. O agente analisa o perfil, cruza com os dados salariais da pesquisa **State of Data Brazil (Data Hackers)** e responde a pergunta: **"quanto tô valendo?"**

A resposta é uma **narrativa em três atos** — nesta ordem, sem exceção:

1. **O Veredito** — a faixa salarial do perfil, com senioridade estimada e justificativa citando evidências do CV. Fonte citada. É o número que a pessoa veio buscar.
2. **O Delta** — quanto o próximo nível paga e **quanto dinheiro por mês separa a pessoa dele** (diferença entre as medianas, em R$). É o clímax emocional: não "você vale X", mas "você está deixando R$ Y por mês na mesa".
3. **O Caminho** — o que fecha esse gap: no máximo 3 lacunas concretas (relativas ao próximo nível) e um roadmap de 90 dias que as ataca.

**One more thing:** depois da análise, o resumo profissional reescrito — pronto para colar no LinkedIn. Sempre por último.

**A materialização no WhatsApp usa o meio a favor da narrativa:** cada ato é uma **mensagem separada**, enviada em sequência com um pequeno intervalo (1,5–2,5s) e indicador "digitando..." entre elas. O formato de mensageria vira o próprio ritmo do keynote — tensão, pausa, revelação. O "one more thing" chega como quinta e última mensagem.

### Princípios de produto (inegociáveis — herdados da v6)

- **Uma pergunta, uma resposta.** O produto responde "quanto tô valendo — e como passo a valer mais". Sem "pontos fortes/fracos" genéricos: se não muda o que a pessoa faz segunda-feira de manhã, corta.
- **Números em linguagem humana.** Percentil não aparece na conversa. p25/p75 viram "a maioria dos profissionais como você ganha entre X e Y"; a mediana é "o valor típico".
- **O delta é sempre mensal e em reais.**
- **Zero configuração para o usuário final.** Ele manda o CV, recebe a análise. Não escolhe cargo nem senioridade — o agente infere.
- **PT-BR em tudo:** prompts, outputs, mensagens, comentários, docstrings.

## 2. Arquitetura Geral (herdada do ZapBlast)

| Camada | Stack | Porta |
|---|---|---|
| Backend | Node.js + Express + Socket.IO | 3001 |
| WhatsApp | @whiskeysockets/baileys (multi-conexão, sessão persistida) | — |
| Agente | @anthropic-ai/sdk (tool use + structured output validado com Zod) | — |
| Persistência | SQLite via better-sqlite3 (`backend/data/app.db`) | — |
| Frontend (painel admin) | React + Vite + socket.io-client + axios + react-hot-toast + lucide-react | 5173 |
| Infra | VPS `187.77.232.213`, serviços acessíveis via `http://187.77.232.213:[porta]` | — |

O frontend **não é para o usuário final** — o usuário final vive no WhatsApp. O React é o **painel admin** (a antiga "Fase 3" do projeto Python nasce aqui como parte do core do produto): conexões via QR Code, histórico de conversas, toggle do agente, edição de system prompt e seleção de modelo.

O que **sai** do ZapBlast: todo o módulo de disparos em massa (`dispatchManager`, rotas `/api/dispatches`, página Disparos). Este produto é **inbound**: ele responde quem manda mensagem, nunca dispara em massa.

## 3. Invariantes (portados da v6 — qualquer mudança quebra o produto)

1. **Números de salário vêm exclusivamente da tool.** O agente chama `consultar_faixa_salarial(cargo, senioridade)`, que lê `dados/salarios.json`. O system prompt proíbe o modelo de estimar valores. A tool é chamada ao menos duas vezes por análise: senioridade estimada **e** próximo nível (para o delta). Sem match exato → recorte mais próximo com `match_exato=False`, sinalizado na resposta.
2. **Dataset pronto, não gerado em runtime.** `dados/salarios.json` é copiado do repositório Python (asset, não código). Nova edição da pesquisa = substituir o arquivo. Nenhum RAG.
3. **Structured output validado.** A resposta do agente é parseada contra o schema `AnaliseCompleta` (Zod). Validação falhou → até 2 retries reenviando o erro ao modelo.
4. **Três atos na ordem, sempre.** Perfil no topo (staff): `faixa_proximo_nivel=null`, `delta_mensal=null`; o Ato 2 vira reconhecimento ("você está no topo da tabela"), nunca some.
5. **Máximo 3 itens em `gap_para_proximo_nivel`** (validado no schema).
6. **Isolamento total por conversa:** todo estado é chaveado por `(connection_id, remote_jid)`. Contexto de um contato nunca vaza para outro. Nenhuma variável de módulo com dados de CV.
7. **Modelo default `claude-haiku-4-5`**, sobrescrevível via configuração no painel (persistida no banco) ou env `MODELO_AGENTE`.
8. **`ANTHROPIC_API_KEY` só existe no backend.** Nunca chega ao frontend nem a logs.

## 4. Backend

### 4.1 Estrutura de pastas

```
quanto-to-valendo-whatsapp/
├── package.json                     # raiz: scripts "backend" e "frontend"
├── README.md                        # instalação, acesso, arquitetura, design system
├── .llm/
│   ├── prd.md                       # este documento
│   └── features/                    # registro das features entregues
├── dados/
│   └── salarios.json                # copiado do repo Python — consultado pela tool
├── backend/
│   ├── package.json
│   ├── .env.example                 # ANTHROPIC_API_KEY, MODELO_AGENTE, ADMIN_TOKEN, PORT
│   ├── sessions/                    # sessões Baileys por conexão (gitignore)
│   ├── data/                        # app.db (gitignore)
│   └── src/
│       ├── server.js                # Express + Socket.IO + boot
│       ├── core/                    # ← não importa managers/, routes/, renderers/
│       │   ├── agente.js            # analisarCurriculo(texto) → AnaliseCompleta
│       │   ├── tools.js             # consultarFaixaSalarial()
│       │   ├── schema.js            # Zod: AnaliseCompleta, FaixaSalarial, enums
│       │   ├── prompts.js           # getSystemPrompt() — lê override do banco
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

**Regra de dependência (validada por teste):** `core/` não importa nada de `managers/`, `routes/`, `renderers/` ou `db/` — exceto `prompts.js`, que recebe o override por **injeção** (função recebe o texto, não importa o repositório). `renderers/` importam só `core/schema.js`. `managers/` e `routes/` importam o resto.

### 4.2 Conexões Baileys (idêntico ao ZapBlast)

- `useMultiFileAuthState` com pasta `sessions/{connectionId}/`; reconexão automática sem novo QR quando há sessão salva; tratamento de `DisconnectReason`; instâncias ativas em `Map`.
- Rotas `/api/connections`: `POST /` (criar, uuid + nome), `GET /` (listar com status), `DELETE /:id` (remover + limpar sessão), `POST /:id/connect` (inicia e emite QR), `POST /:id/disconnect`.
- Socket.IO: `qr_update` `{ connectionId, qr }` (base64 png), `connection_status` `{ connectionId, status: connecting | open | close | qr }`.

### 4.3 Fluxo de mensagem inbound (substitui o dispatch)

`messageHandler.js`, ouvindo `messages.upsert` de cada conexão:

1. **Filtros de entrada (nesta ordem):** ignorar `fromMe`; ignorar grupos (`@g.us`), broadcast e status; ignorar mensagens sem texto e sem documento.
2. **Persistir a mensagem recebida** em `mensagens`, criando a conversa em `conversas` se não existir.
3. **Verificar se o agente está ativo** para a conversa (toggle global E por conversa — os dois precisam estar ligados). Desligado → só persiste, não responde.
4. **Roteamento do conteúdo:**
   - Documento PDF → download do buffer → `extracao.js` → texto. PDF sem texto extraível → mensagem amigável, nunca stack trace.
   - Documento não-PDF → orientação amigável ("me manda em PDF ou cola o texto").
   - Texto < 200 caracteres → orientação em vez de gastar API ("cola seu currículo completo ou manda o PDF").
   - Texto ≥ 200 caracteres → tratado como currículo.
5. **Feedback imediato:** `sendPresenceUpdate('composing')` + mensagem "🔍 Analisando seu currículo..." antes de chamar o agente.
6. **Análise:** `analisarCurriculo(texto)` → `AnaliseCompleta`.
7. **Resposta em atos:** `whatsappRenderer` devolve um array de mensagens; o handler envia uma a uma com intervalo de 1,5–2,5s e `composing` entre elas.
8. **Persistir cada mensagem enviada** e emitir `conversation_update` via Socket.IO (o painel atualiza em tempo real).
9. **Trava anti-concorrência por conversa:** se já existe análise em andamento para aquele `(connectionId, remoteJid)`, responder "já estou analisando, um instante" em vez de iniciar outra. Conversas diferentes rodam em paralelo sem se bloquear.

**Formato WhatsApp:** o renderer usa a formatação nativa (`*negrito*`, `_itálico_`, `> citação`, listas com `•`) — nunca HTML, nunca markdown de `#`. Valores monetários via `formatarReais()` (`R$ 12.500`).

### 4.4 Agente (core)

- `@anthropic-ai/sdk` com tool use. Loop de tool calling manual: modelo pede `consultar_faixa_salarial` → executa → devolve `tool_result` → repete até resposta final.
- Resposta final exigida como JSON puro no formato de `AnaliseCompleta`; parse + validação Zod; falhou → reenvia o erro de validação ao modelo (máx. 2 retries).
- System prompt em `prompts.js` com a rubrica de senioridade portada do projeto Python, recebendo override vindo do banco por parâmetro.
- Cliente Anthropic e dataset carregados uma vez (module scope) — dados imutáveis podem ser compartilhados; dados de usuário, jamais (invariante 6).

### 4.5 Persistência (SQLite)

```sql
conversas      (id, connection_id, remote_jid, nome_contato, agente_ativo INTEGER DEFAULT 1,
                criada_em, atualizada_em, UNIQUE(connection_id, remote_jid))
mensagens      (id, conversa_id, papel TEXT CHECK(papel IN ('usuario','agente','sistema')),
                tipo TEXT, conteudo TEXT, timestamp)
configuracoes  (chave TEXT PRIMARY KEY, valor TEXT)   -- system_prompt_override, modelo, agente_ativo_global
```

Conexões podem continuar em `connections.json` (como no ZapBlast) ou migrar para tabela — decisão livre do Claude Code, desde que sobreviva a restart.

### 4.6 Rotas do painel

- `/api/conversations`: `GET /` (lista com último trecho, contadores, status do agente), `GET /:id/messages` (histórico paginado), `PATCH /:id` (toggle `agente_ativo`).
- `/api/settings`: `GET /` e `PUT /` — `system_prompt_override`, `modelo` (lista fixa de modelos Anthropic válidos), `agente_ativo_global`.
- **Autenticação mínima:** header `X-Admin-Token` comparado com `ADMIN_TOKEN` do `.env` em todas as rotas e no handshake do Socket.IO. A VPS é pública e cada mensagem custa API — painel aberto é queima de chave. (Diferença deliberada em relação ao ZapBlast.)
- CORS: aceitar qualquer origin (como no ZapBlast), já que o token protege as rotas.

## 5. Frontend (painel admin)

Design herdado do ZapBlast: dashboard dark industrial, verde WhatsApp `#25D366` sobre `#0d1117`/`#161b22`, monospace para dados técnicos, sans moderna para títulos, bordas sutis, sem shadows excessivas. Sidebar fixa; header com nome **Quanto Tô Valendo** e contador de conexões ativas. `frontend/.env`: `VITE_API_URL` e `VITE_SOCKET_URL` apontando para `http://187.77.232.213:3001`.

**Login simples:** tela pedindo o admin token, guardado em memória e enviado em todas as chamadas.

**Rotas (React Router):**

- **/connections** — idêntica ao ZapBlast: cards com nome, badge de status (amarelo Aguardando QR, verde Conectado, vermelho Desconectado) e número conectado; modal de QR atualizado em tempo real via `qr_update`; botões Conectar/Desconectar/Excluir; Nova Conexão via modal.
- **/conversations** — substitui a página de disparos: lista de conversas (contato, última mensagem, horário, badge do agente), atualização em tempo real via `conversation_update`; clicar abre o histórico estilo chat (mensagens do usuário à esquerda, do agente à direita); toggle "Agente ativo" por conversa no topo do histórico.
- **/settings** — textarea para o system prompt (com botão "restaurar padrão"), select de modelo, toggle global do agente, toast de confirmação ao salvar.

## 6. Requisitos e Critérios de Aceite

**R1. Core de análise (porte do Python)**
- [ ] `analisarCurriculo(texto)` retorna `AnaliseCompleta` validada por Zod
- [ ] Números salariais (atual e próximo nível) vêm exclusivamente da tool; `delta_mensal` = diferença das medianas
- [ ] Sem match exato → `match_exato=false` + recorte mais próximo, sinalizado na resposta
- [ ] Staff → `faixa_proximo_nivel=null`, Ato 2 vira reconhecimento
- [ ] `gap_para_proximo_nivel` com no máximo 3 itens

**R2. Conexões WhatsApp**
- [ ] Criar conexão no painel, escanear QR, status vira Conectado em tempo real
- [ ] Restart do backend → conexões com sessão salva reconectam sem novo QR
- [ ] Múltiplas conexões simultâneas, cada uma com sua pasta de sessão

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
- [ ] Sem token válido → toda rota e o Socket.IO recusam

**R5. Qualidade**
- [ ] Vitest: schema (Zod), `formatarReais`, `whatsappRenderer` (ordem dos atos, formatação, caso staff), filtros do `messageHandler` (funções puras, sem rede), teste de regra de dependência do `core/`
- [ ] Teste do agente com cliente Anthropic mockado (loop de tool calling sem gastar API)
- [ ] Try/catch em todos os handlers; respostas JSON de erro adequadas; `console` estruturado, nunca stack trace pro usuário final
- [ ] README: o que é, arquitetura (com Mermaid), design system da narrativa, setup, como rodar, como conectar o primeiro número
- [ ] `.llm/features/` registra cada feature entregue

**Fora do escopo (não implementar):** disparos em massa, campanhas, agendamento, Telegram/Streamlit (vivem no repo Python), análise de vaga, gráficos, RAG, multi-tenant, deploy automatizado (rodar com `npm run dev` ou pm2 manual na VPS).

## 7. Riscos e Observações

- **Baileys é biblioteca não-oficial** — mesmo sem disparo em massa, número pode ser banido. Mitigação: produto é inbound (responde quem procura), intervalos entre mensagens, e recomendação de usar um número dedicado, não o comercial principal.
- **Custo de API:** cada análise = 1 chamada com tool use (Haiku). O corte de textos < 200 chars e o toggle do agente são as válvulas de controle.
- **Fila:** volume esperado é baixo; a trava por conversa basta. Se virar gargalo, fila (BullMQ) é evolução futura — não implementar agora.

---

**Status:** v7 · **Owner:** Luciano · **Baseline:** repositório novo, greenfield · **Repo Python (v6):** intocado, permanece como material da Trilha Claude Code
