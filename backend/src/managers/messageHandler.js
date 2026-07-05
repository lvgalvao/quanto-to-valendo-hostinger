/**
 * Orquestra o fluxo inbound: filtra, persiste, roteia conteúdo, chama o agente
 * e envia a análise em 5 mensagens com "digitando..." entre elas.
 *
 * As funções de FILTRO/CLASSIFICAÇÃO são puras (sem rede, sem db) e exportadas
 * para teste. O restante orquestra IO + persistência.
 */
import { downloadMediaMessage } from '@whiskeysockets/baileys';
import * as repo from '../db/repositorio.js';
import { analisarCurriculo } from '../core/agente.js';
import { extrairTexto } from '../core/extracao.js';
import { PDFSemTextoError, PerfilSemMatchError } from '../core/erros.js';
import { renderizar } from '../renderers/whatsappRenderer.js';
import * as conexoes from './connectionManager.js';

export const MIN_CV_CHARS = 200;

// Palavra-chave que inicia o atendimento com o agente. O bot só analisa depois
// de receber "ANALISE" (ou se a própria mensagem já trouxer a palavra + o CV).
export const GATILHO = 'analise';

let io = null;
export function setIO(ioInstance) {
  io = ioInstance;
}

// Trava anti-concorrência por (connectionId, remoteJid). Conversas distintas
// não se bloqueiam; a mesma conversa não inicia duas análises (invariante #6 + §4.3.9).
const emAndamento = new Set();

/* ------------------------------------------------------------------ */
/* Funções puras (testáveis)                                           */
/* ------------------------------------------------------------------ */

/** Normaliza texto: sem acento, minúsculo. */
function normalizar(txt) {
  return String(txt || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/** Verdadeiro se o texto contém a palavra-chave de gatilho (ANALISE/ANÁLISE). */
export function contemGatilho(texto) {
  return normalizar(texto).includes(GATILHO);
}

export function ehGrupoOuBroadcast(jid) {
  if (!jid) return true;
  return jid.endsWith('@g.us') || jid === 'status@broadcast' || jid.endsWith('@broadcast');
}

export function extrairDocumento(message) {
  if (!message) return null;
  if (message.documentMessage) return message.documentMessage;
  if (message.documentWithCaptionMessage?.message?.documentMessage) {
    return message.documentWithCaptionMessage.message.documentMessage;
  }
  return null;
}

export function extrairTextoMsg(message) {
  if (!message) return '';
  return (
    message.conversation ||
    message.extendedTextMessage?.text ||
    message.documentMessage?.caption ||
    message.documentWithCaptionMessage?.message?.documentMessage?.caption ||
    ''
  ).trim();
}

/**
 * Decide se a mensagem deve ser ignorada de saída (fromMe, grupo/broadcast/status,
 * ou sem texto E sem documento).
 * @param {{fromMe:boolean, remoteJid:string, message:object}} m
 */
export function deveIgnorarMensagem({ fromMe, remoteJid, message }) {
  if (fromMe) return true;
  if (ehGrupoOuBroadcast(remoteJid)) return true;
  if (!message) return true;
  const temTexto = extrairTextoMsg(message).length > 0;
  const temDoc = extrairDocumento(message) != null;
  if (!temTexto && !temDoc) return true;
  return false;
}

/**
 * Classifica o conteúdo em uma ação de roteamento.
 * @returns {{acao:'pdf'|'doc_nao_pdf'|'texto_curto'|'curriculo', texto?:string}}
 */
export function classificarConteudo(message) {
  const doc = extrairDocumento(message);
  const texto = extrairTextoMsg(message);
  if (doc) {
    const mime = (doc.mimetype || '').toLowerCase();
    const nome = (doc.fileName || '').toLowerCase();
    const ehPdf = mime.includes('pdf') || nome.endsWith('.pdf');
    return { acao: ehPdf ? 'pdf' : 'doc_nao_pdf' };
  }
  if (texto.length < MIN_CV_CHARS) return { acao: 'texto_curto' };
  return { acao: 'curriculo', texto };
}

/* ------------------------------------------------------------------ */
/* Orquestração                                                        */
/* ------------------------------------------------------------------ */

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

// Delay "humano" aplicado antes de CADA resposta do bot (com "digitando..."),
// para não parecer robô que responde instantâneo. Ajuste aqui se quiser.
export const DELAY_MIN_MS = 1500;
export const DELAY_MAX_MS = 2500;
const delayHumano = () => DELAY_MIN_MS + Math.random() * (DELAY_MAX_MS - DELAY_MIN_MS);

function emitirConversaAtualizada(connectionId, conversaId) {
  if (io) io.emit('conversation_update', { connectionId, conversaId });
}

/**
 * Envia texto pelo socket com ritmo humano: mostra "digitando...", espera 1,5–2,5s,
 * envia, persiste e notifica o painel.
 * @param {object} [opts]
 * @param {boolean} [opts.semDelay] pula o delay (uso raro; padrão é humano)
 */
async function responder(sock, connectionId, conversa, texto, tipo = 'texto', opts = {}) {
  if (!opts.semDelay) {
    await conexoes.enviarPresenca(connectionId, conversa.remote_jid, 'composing');
    await dormir(delayHumano());
  }
  await sock.sendMessage(conversa.remote_jid, { text: texto });
  await conexoes.enviarPresenca(connectionId, conversa.remote_jid, 'paused');
  repo.inserirMensagem(conversa.id, 'agente', tipo, texto);
  emitirConversaAtualizada(connectionId, conversa.id);
}

async function baixarPdf(msg, sock) {
  const buffer = await downloadMediaMessage(
    msg,
    'buffer',
    {},
    { reuploadRequest: sock.updateMediaMessage }
  );
  return extrairTexto(buffer);
}

/** Envia as 5 mensagens da análise, cada uma com o ritmo humano do responder(). */
async function enviarAnalise(sock, connectionId, conversa, mensagens) {
  for (const texto of mensagens) {
    await responder(sock, connectionId, conversa, texto);
  }
}

/**
 * Ponto de entrada chamado pelo connectionManager para cada mensagem inbound.
 * @param {string} connectionId
 * @param {object} msg mensagem crua do Baileys
 * @param {object} sock socket Baileys
 */
export async function processarMensagem(connectionId, msg, sock) {
  const fromMe = !!msg.key?.fromMe;
  const remoteJid = msg.key?.remoteJid;
  const message = msg.message;

  // 1. Filtros de entrada.
  if (deveIgnorarMensagem({ fromMe, remoteJid, message })) return;

  // 2. Persiste a recebida (cria conversa se preciso).
  const conversa = repo.getOuCriarConversa(connectionId, remoteJid, msg.pushName);
  const doc = extrairDocumento(message);
  const textoRecebido = extrairTextoMsg(message) || (doc ? `[documento: ${doc.fileName || 'arquivo'}]` : '');
  repo.inserirMensagem(conversa.id, 'usuario', doc ? 'documento' : 'texto', textoRecebido);
  emitirConversaAtualizada(connectionId, conversa.id);

  // 3. Agente ativo? (global E por conversa). Desligado => só persiste.
  const conversaAtual = repo.getConversa(conversa.id);
  if (!repo.agenteAtivoGlobal() || !conversaAtual.agente_ativo) return;

  // 9. Trava anti-concorrência por conversa.
  const chave = `${connectionId}:${remoteJid}`;
  if (emAndamento.has(chave)) {
    await responder(sock, connectionId, conversa, 'Já estou analisando seu currículo, me dá só um instante 🙂', 'sistema');
    return;
  }
  emAndamento.add(chave);

  try {
    // 4. Roteamento do conteúdo.
    const rota = classificarConteudo(message);
    const temCV = rota.acao === 'pdf' || rota.acao === 'curriculo';
    const temGatilho = contemGatilho(extrairTextoMsg(message));
    const armado = !!repo.getConversa(conversa.id).aguardando_cv;

    // GATE: só inicia o atendimento se veio a palavra ANALISE (ou a conversa já
    // foi armada por ela). Sem gatilho e sem estar armado => só orienta.
    if (!temGatilho && !armado) {
      await responder(
        sock,
        connectionId,
        conversa,
        'Oi! Sou o *Quanto Tô Valendo* 👋\n\nQuer descobrir quanto você tá valendo no mercado de dados? Envie a palavra *ANALISE* que eu começo. 🚀'
      );
      return;
    }

    // Veio o gatilho, mas ainda sem um CV nesta mensagem => arma e pede o CV.
    if (temGatilho && !temCV) {
      repo.setAguardandoCv(conversa.id, true);
      await responder(
        sock,
        connectionId,
        conversa,
        'Perfeito! 📄 Agora me manda seu *currículo em PDF* ou *cola o texto completo* aqui que eu faço sua análise.'
      );
      return;
    }

    // Já armado, mas a mensagem não traz um CV válido => orienta e continua armado.
    if (armado && !temCV) {
      if (rota.acao === 'doc_nao_pdf') {
        await responder(sock, connectionId, conversa, 'Recebi seu arquivo, mas só consigo ler *PDF*. Me manda o currículo em PDF ou cola o texto aqui no chat. 🙂');
        return;
      }
      // texto_curto
      await responder(sock, connectionId, conversa, 'Pra eu analisar direito, cola seu *currículo completo* aqui (experiência, cargos, tecnologias) ou manda o *PDF*. Com pouco texto eu não consigo estimar sua faixa. 🙂');
      return;
    }

    // A partir daqui há um CV (pdf ou texto ≥ 200) e o gate foi liberado.
    // Extrai o texto do CV.
    let textoCV;
    if (rota.acao === 'pdf') {
      try {
        textoCV = await baixarPdf(msg, sock);
      } catch (e) {
        if (e instanceof PDFSemTextoError) {
          await responder(sock, connectionId, conversa, 'Não consegui extrair texto desse PDF (parece escaneado/imagem). Tenta exportar de novo como PDF de texto, ou cola o conteúdo aqui. 🙂');
          return;
        }
        throw e;
      }
    } else {
      textoCV = rota.texto;
    }

    // 5. Feedback ("digitando..." + delay humano já embutidos no responder).
    await responder(sock, connectionId, conversa, '🔍 Analisando seu currículo...', 'sistema');

    // 6. Análise (config atual do painel: modelo + override).
    const overridePrompt = repo.getConfig('system_prompt_override') || null;
    const modelo = repo.getConfig('modelo') || undefined;
    let analise;
    try {
      analise = await analisarCurriculo(textoCV, { modelo, overridePrompt });
    } catch (e) {
      if (e instanceof PerfilSemMatchError) {
        await responder(sock, connectionId, conversa, 'Consegui ler seu currículo, mas não consegui cruzar com um perfil de dados da pesquisa. Ele é de uma área de dados (analista/cientista/engenheiro)? Se puder, detalha um pouco mais sua experiência. 🙂');
        return;
      }
      console.error('[messageHandler] erro na análise', e.message);
      await responder(sock, connectionId, conversa, 'Tive um problema pra concluir a análise agora. Pode tentar reenviar em alguns instantes? 🙏', 'sistema');
      return;
    }

    // 7 + 8. Envia as 5 mensagens (com persistência e updates).
    const mensagens = renderizar(analise);
    await enviarAnalise(sock, connectionId, conversa, mensagens);

    // Análise concluída: desarma. Nova análise exige a palavra ANALISE de novo.
    repo.setAguardandoCv(conversa.id, false);
  } catch (e) {
    console.error('[messageHandler] erro inesperado', e.message);
    try {
      await responder(sock, connectionId, conversa, 'Ops, algo deu errado por aqui. Pode tentar de novo? 🙏', 'sistema');
    } catch {}
  } finally {
    emAndamento.delete(chave);
  }
}
