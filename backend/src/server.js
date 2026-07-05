/**
 * Boot do backend: Express + Socket.IO, migrations, auth por X-Admin-Token e
 * religamento das conexões Baileys salvas.
 */
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'node:http';
import { Server as SocketServer } from 'socket.io';

import { migrar } from './db/database.js';
import * as conexoes from './managers/connectionManager.js';
import * as messageHandler from './managers/messageHandler.js';
import connectionsRoutes from './routes/connections.js';
import conversationsRoutes from './routes/conversations.js';
import settingsRoutes from './routes/settings.js';

const PORT = process.env.PORT || 3001;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';

if (!ADMIN_TOKEN) {
  console.warn('[server] ADMIN_TOKEN não definido no .env — o painel ficará desprotegido!');
}

// Migrations antes de qualquer acesso ao banco.
migrar();

const app = express();
app.use(cors()); // any origin — o token protege as rotas (CORS não é a barreira)
app.use(express.json({ limit: '2mb' }));

// Autenticação mínima: X-Admin-Token em todas as rotas /api.
app.use('/api', (req, res, next) => {
  if (!ADMIN_TOKEN) return next(); // sem token configurado, não bloqueia (aviso acima)
  if (req.get('X-Admin-Token') === ADMIN_TOKEN) return next();
  return res.status(401).json({ erro: 'token inválido' });
});

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/api/connections', connectionsRoutes);
app.use('/api/conversations', conversationsRoutes);
app.use('/api/settings', settingsRoutes);

// Handler de erro global — nunca vaza stack trace pro cliente.
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[server] erro não tratado', err.message);
  res.status(500).json({ erro: 'erro interno' });
});

const httpServer = createServer(app);
const io = new SocketServer(httpServer, { cors: { origin: '*' } });

// Mesmo token no handshake do Socket.IO.
io.use((socket, next) => {
  if (!ADMIN_TOKEN) return next();
  const token = socket.handshake.auth?.token || socket.handshake.headers['x-admin-token'];
  if (token === ADMIN_TOKEN) return next();
  return next(new Error('token inválido'));
});

// Fiação: os managers recebem o io e o handler (sem import circular).
conexoes.setIO(io);
messageHandler.setIO(io);
conexoes.setHandler(messageHandler.processarMensagem);

httpServer.listen(PORT, async () => {
  console.log(`[server] backend ouvindo em http://0.0.0.0:${PORT}`);
  await conexoes.reconectarSalvas();
});
