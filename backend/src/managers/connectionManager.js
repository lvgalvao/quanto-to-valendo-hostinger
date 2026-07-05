/**
 * Gerência de conexões Baileys: QR, reconexão automática e Map de instâncias.
 * Dono único dos sockets. O messageHandler é injetado via setHandler() para
 * evitar import circular (messageHandler importa daqui as funções de envio).
 */
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  Browsers,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import pino from 'pino';
import { rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as repo from '../db/repositorio.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SESSIONS_DIR = join(__dirname, '../../sessions');
const logger = pino({ level: 'silent' }); // Baileys é verboso; silenciamos o log interno

const sockets = new Map(); // connectionId -> WASocket
let io = null;
let onMensagem = null; // (connectionId, msg, sock) => Promise<void>

export function setIO(ioInstance) {
  io = ioInstance;
}

export function setHandler(fn) {
  onMensagem = fn;
}

function emitirStatus(connectionId, status) {
  repo.atualizarStatusConexao(connectionId, status);
  if (io) io.emit('connection_status', { connectionId, status });
}

function pastaSessao(connectionId) {
  return join(SESSIONS_DIR, connectionId);
}

/** Inicia (ou reinicia) uma conexão. Reusa a sessão salva se existir — sem novo QR. */
export async function conectar(connectionId) {
  if (sockets.has(connectionId)) return sockets.get(connectionId);

  const { state, saveCreds } = await useMultiFileAuthState(pastaSessao(connectionId));
  // Busca a versão mais recente do WhatsApp Web; usar versão defasada faz o WA
  // recusar a conexão e o QR nunca aparecer.
  const { version } = await fetchLatestBaileysVersion();
  console.log(`[connectionManager] ${connectionId}: iniciando com WA version ${version.join('.')}`);
  const sock = makeWASocket({
    version,
    auth: state,
    logger,
    browser: Browsers.appropriate('Chrome'),
    syncFullHistory: false,
  });
  sockets.set(connectionId, sock);

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      try {
        const dataUrl = await QRCode.toDataURL(qr);
        emitirStatus(connectionId, 'qr');
        if (io) io.emit('qr_update', { connectionId, qr: dataUrl });
        console.log(`[connectionManager] ${connectionId}: QR gerado e emitido (${dataUrl.length} bytes)`);
      } catch (e) {
        console.error('[connectionManager] falha ao gerar QR', e.message);
      }
    }

    if (connection === 'connecting') {
      if (io) io.emit('connection_status', { connectionId, status: 'connecting' });
    }

    if (connection === 'open') {
      const numero = sock.user?.id?.split(':')[0] || null;
      repo.atualizarStatusConexao(connectionId, 'open', numero);
      if (io) io.emit('connection_status', { connectionId, status: 'open', numero });
      console.log(`[connectionManager] ${connectionId}: CONECTADO (numero=${numero})`);
    }

    if (connection === 'close') {
      sockets.delete(connectionId);
      const code = lastDisconnect?.error?.output?.statusCode;
      console.log(
        `[connectionManager] ${connectionId}: close (statusCode=${code} msg=${lastDisconnect?.error?.message || '-'})`
      );

      if (code === DisconnectReason.loggedOut) {
        // Sessão inválida (deslogado): limpa para permitir novo pareamento.
        try {
          rmSync(pastaSessao(connectionId), { recursive: true, force: true });
        } catch {}
        emitirStatus(connectionId, 'close');
        return;
      }

      if (code === DisconnectReason.restartRequired) {
        // Esperado logo APÓS o scan do QR. Reconecta JÁ (reusa creds salvos),
        // mantendo "Conectando" — não volta para "Desconectado".
        if (io) io.emit('connection_status', { connectionId, status: 'connecting' });
        console.log(`[connectionManager] ${connectionId}: restart required (pós-scan), reconectando...`);
        conectar(connectionId).catch((e) =>
          console.error('[connectionManager] reconexão (restart) falhou', e.message)
        );
        return;
      }

      // Demais quedas: reconecta com pequeno atraso reusando a sessão salva.
      emitirStatus(connectionId, 'close');
      setTimeout(() => {
        conectar(connectionId).catch((e) =>
          console.error('[connectionManager] reconexão falhou', e.message)
        );
      }, 2500);
    }
  });

  sock.ev.on('messages.upsert', async (payload) => {
    if (payload.type !== 'notify' || !onMensagem) return;
    for (const msg of payload.messages) {
      try {
        await onMensagem(connectionId, msg, sock);
      } catch (e) {
        console.error('[connectionManager] erro no handler de mensagem', e.message);
      }
    }
  });

  return sock;
}

export async function desconectar(connectionId) {
  const sock = sockets.get(connectionId);
  if (sock) {
    try {
      await sock.logout();
    } catch {
      try {
        sock.end();
      } catch {}
    }
    sockets.delete(connectionId);
  }
  emitirStatus(connectionId, 'close');
}

export async function removerSessao(connectionId) {
  const sock = sockets.get(connectionId);
  if (sock) {
    try {
      sock.end();
    } catch {}
    sockets.delete(connectionId);
  }
  try {
    rmSync(pastaSessao(connectionId), { recursive: true, force: true });
  } catch {}
}

export function isConectado(connectionId) {
  return sockets.has(connectionId);
}

/** Envia texto e persiste nada (persistência é responsabilidade do handler). */
export async function enviarTexto(connectionId, jid, texto) {
  const sock = sockets.get(connectionId);
  if (!sock) throw new Error(`Conexão ${connectionId} não está ativa`);
  await sock.sendMessage(jid, { text: texto });
}

export async function enviarPresenca(connectionId, jid, estado = 'composing') {
  const sock = sockets.get(connectionId);
  if (!sock) return;
  try {
    await sock.sendPresenceUpdate(estado, jid);
  } catch {}
}

/** No boot, religa todas as conexões que tinham sessão salva. */
export async function reconectarSalvas() {
  const conexoes = repo.listarConexoes();
  for (const c of conexoes) {
    try {
      await conectar(c.id);
    } catch (e) {
      console.error(`[connectionManager] falha ao religar ${c.id}`, e.message);
    }
  }
}
