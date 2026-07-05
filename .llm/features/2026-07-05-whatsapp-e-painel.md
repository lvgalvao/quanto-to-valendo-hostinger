# Feature: WhatsApp (Baileys) + painel admin

**Entregue em:** 2026-07-05

## Renderer (5 mensagens)
- `backend/src/renderers/whatsappRenderer.js` — `renderizar(analise) → [msg1..msg5]` + `formatarReais`. Formatação nativa do WhatsApp. Caso staff vira reconhecimento. Testes em `test/renderer.test.js`.

## Conexões e fluxo inbound
- `backend/src/managers/connectionManager.js` — Baileys `useMultiFileAuthState`, Map de sockets, QR via `qr_update`, `connection_status`, reconexão automática (loggedOut limpa sessão; demais religam sem novo QR).
- `backend/src/managers/messageHandler.js` — filtros puros (`deveIgnorarMensagem`, `classificarConteudo`), roteamento (PDF / doc não-PDF / texto <200 / currículo), feedback "🔍 Analisando…", envio dos 5 atos com 1,5–2,5s e "digitando", **trava anti-concorrência** por `(connectionId, remoteJid)`. Testes em `test/messageHandler.test.js`.

## Persistência e rotas
- `backend/src/db/{database,repositorio}.js` — SQLite: `conexoes`, `conversas`, `mensagens`, `configuracoes`.
- `backend/src/routes/{connections,conversations,settings}.js` — todas atrás de `X-Admin-Token`.
- `backend/src/server.js` — Express + Socket.IO, auth no handshake, migrations e religamento no boot.

## Painel (React + Vite)
- `frontend/` — login por token (em memória), `/connections` (QR em tempo real), `/conversations` (chat + toggle por conversa), `/settings` (prompt override + modelo + toggle global). Tema dark WhatsApp.

## Verificação
Backend: auth 401/200 (rotas e Socket.IO), criação de conexão, pipeline de eventos ao cliente socket, sem crash no connect. Frontend: `vite build` OK. QR ao vivo e análise real ficam para a VPS (rede WhatsApp + chave).

## Nota técnica
Baileys é CJS: `makeWASocket` é o import **default**; `useMultiFileAuthState`/`DisconnectReason`/`Browsers`/`downloadMediaMessage` são **named imports**.
