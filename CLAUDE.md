# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Status

Implemented (v7). Backend (`backend/`) + admin panel (`frontend/`) are built and the 32-test Vitest suite is green. Full spec lives in `.llm/prd.md` (source of truth); delivered features are logged in `.llm/features/`.

Verified headlessly: tests, backend boot + `X-Admin-Token` auth (routes and Socket.IO handshake), the Baileys→Socket.IO event pipeline, and the frontend build. **Not** verifiable in a sandbox (needs real WhatsApp egress + an API key): the live QR scan and a real agent analysis — do these on the VPS.

## What this is

An **inbound** WhatsApp agent: a user sends their résumé (PDF or text) directly on WhatsApp; the agent analyzes it against the *State of Data Brazil* salary dataset and answers "quanto tô valendo?" as a **three-act narrative**, each act a separate WhatsApp message sent in sequence with a 1.5–2.5s gap and a "typing…" indicator between them:

1. **O Veredito** — the salary range + estimated seniority, justified with CV evidence.
2. **O Delta** — what the next level pays and the monthly R$ gap (difference of medians). The emotional climax.
3. **O Caminho** — ≤3 concrete gaps + a 90-day roadmap.
4. **One more thing** (always last) — a rewritten LinkedIn-ready professional summary.

The React frontend is an **admin panel only** — the end user lives entirely in WhatsApp.

## Stack (do not propose alternatives)

Node.js + Express + Socket.IO backend (port 3001) · `@whiskeysockets/baileys` for WhatsApp · `@anthropic-ai/sdk` (tool use + Zod structured output) · SQLite via `better-sqlite3` (`backend/data/app.db`) · React + Vite admin panel (port 5173). Reused from the ZapBlast architecture, minus all mass-dispatch code.

## Commands

- Backend: `cd backend && npm run dev` (port 3001). Frontend: `cd frontend && npm run dev` (port 5173). pm2 on the VPS; no automated deploy.
- Tests: `cd backend && npm test`. Single file: `npx vitest run test/renderer.test.js`. Watch: `npx vitest`.
- Live agent smoke (needs key): `cd backend && ANTHROPIC_API_KEY=sk-... npm run exemplo`.
- Baileys note: `@whiskeysockets/baileys` is CJS — `makeWASocket` is the **default** import; `useMultiFileAuthState`/`DisconnectReason`/`Browsers`/`downloadMediaMessage` are **named** imports (not properties of the default).

Backend `.env`: `ANTHROPIC_API_KEY`, `MODELO_AGENTE`, `ADMIN_TOKEN`, `PORT`. Frontend `.env`: `VITE_API_URL`, `VITE_SOCKET_URL` → `http://187.77.232.213:3001`.

## Invariants (from PRD §3 — violating any of these breaks the product)

1. **Salary numbers come exclusively from the tool.** The agent calls `consultarFaixaSalarial(cargo, senioridade)`, reading `dados/salarios.json`. The system prompt forbids the model from estimating values. Called ≥2× per analysis: estimated seniority **and** next level (for the delta). No exact match → nearest slice with `match_exato=false`, flagged in the response.
2. **Dataset is a static asset**, copied from the Python repo. No RAG, nothing generated at runtime.
3. **Structured output validated** against Zod `AnaliseCompleta`; on failure, resend the validation error to the model (max 2 retries).
4. **Three acts, always in order.** Staff-level profile → `faixa_proximo_nivel=null`, `delta_mensal=null`; Act 2 becomes recognition ("you're at the top of the table"), never disappears.
5. **`gap_para_proximo_nivel` ≤ 3 items** (enforced in the schema).
6. **Total isolation per conversation.** All state keyed by `(connection_id, remote_jid)`. Never let one contact's CV context leak to another. **No module-scope variables holding user/CV data** — only immutable data (Anthropic client, dataset) may be module-scoped.
7. **Default model `claude-haiku-4-5`**, overridable via panel config (persisted in DB) or `MODELO_AGENTE` env.
8. **`ANTHROPIC_API_KEY` lives only in the backend** — never reaches the frontend or logs.

## Architecture rules

**Layered dependency rule (must be covered by a test):**
- `core/` imports nothing from `managers/`, `routes/`, `renderers/`, or `db/`. Exception: `prompts.js` receives the system-prompt override by **injection** (a param), it does not import the repository.
- `renderers/` import only `core/schema.js`.
- `managers/` and `routes/` may import everything else.

**Key modules:** `core/agente.js` (`analisarCurriculo(texto) → AnaliseCompleta`, manual tool-calling loop) · `core/tools.js` · `core/schema.js` (Zod) · `core/extracao.js` (pdf-parse) · `renderers/whatsappRenderer.js` (`AnaliseCompleta → [msg1..msg5]`) · `managers/connectionManager.js` (Baileys, `useMultiFileAuthState`, `Map` of instances) · `managers/messageHandler.js` (`messages.upsert` → orchestrates analysis).

**Inbound message flow** (`messageHandler.js`): filter (`fromMe`, groups `@g.us`, broadcast/status, no-text-no-doc) → persist → check agent active (global **AND** per-conversation toggles) → route content (PDF / non-PDF doc / text <200 chars → friendly guidance / text ≥200 chars → treat as CV) → `composing` + "🔍 Analisando…" → analyze → send acts one-by-one with 1.5–2.5s gaps → persist each + emit `conversation_update`. **Per-conversation concurrency lock:** if an analysis is already running for `(connectionId, remoteJid)`, reply "já estou analisando, um instante"; different conversations run in parallel.

## Conventions

- **PT-BR everywhere**: prompts, outputs, user messages, code comments, docstrings, and code identifiers (`analisarCurriculo`, `conversas`, `mensagens`).
- **WhatsApp formatting only** in the renderer: `*bold*`, `_italic_`, `> quote`, `•` lists. Never HTML, never `#` markdown. Money via `formatarReais()` → `R$ 12.500`.
- **Numbers in human language** in the conversation: never expose percentiles; p25/p75 → "a maioria ganha entre X e Y", median → "o valor típico". The delta is always monthly, in reais.
- **Admin auth:** every route and the Socket.IO handshake check `X-Admin-Token` against `ADMIN_TOKEN`. CORS accepts any origin (the token is the guard).
- Never surface stack traces to the WhatsApp user — friendly domain-error messages only (`PDFSemTextoError`, `PerfilSemMatchError`). Structured `console` logging.

## Out of scope (do not build)

Mass dispatch/campaigns/scheduling, Telegram/Streamlit (those live in the untouched Python repo v6), job-posting analysis, charts, RAG, multi-tenant, automated deploy.
