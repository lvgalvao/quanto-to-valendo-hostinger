import { describe, it, expect } from 'vitest';
import {
  ehGrupoOuBroadcast,
  extrairTextoMsg,
  extrairDocumento,
  deveIgnorarMensagem,
  classificarConteudo,
  contemGatilho,
  MIN_CV_CHARS,
} from '../src/managers/messageHandler.js';

const textoLongo = 'x'.repeat(MIN_CV_CHARS + 10);

describe('filtros puros do messageHandler', () => {
  it('identifica grupos, broadcast e status', () => {
    expect(ehGrupoOuBroadcast('123-456@g.us')).toBe(true);
    expect(ehGrupoOuBroadcast('status@broadcast')).toBe(true);
    expect(ehGrupoOuBroadcast('5511999@s.whatsapp.net')).toBe(false);
  });

  it('extrai texto de conversation e extendedTextMessage', () => {
    expect(extrairTextoMsg({ conversation: 'oi' })).toBe('oi');
    expect(extrairTextoMsg({ extendedTextMessage: { text: 'olá' } })).toBe('olá');
    expect(extrairTextoMsg(null)).toBe('');
  });

  it('extrai documento inclusive com caption', () => {
    expect(extrairDocumento({ documentMessage: { fileName: 'cv.pdf' } })).toBeTruthy();
    expect(
      extrairDocumento({ documentWithCaptionMessage: { message: { documentMessage: { fileName: 'cv.pdf' } } } })
    ).toBeTruthy();
    expect(extrairDocumento({ conversation: 'x' })).toBe(null);
  });

  it('ignora fromMe, grupo e mensagens vazias', () => {
    expect(deveIgnorarMensagem({ fromMe: true, remoteJid: 'a@s.whatsapp.net', message: { conversation: 'oi' } })).toBe(true);
    expect(deveIgnorarMensagem({ fromMe: false, remoteJid: 'g@g.us', message: { conversation: 'oi' } })).toBe(true);
    expect(deveIgnorarMensagem({ fromMe: false, remoteJid: 'a@s.whatsapp.net', message: {} })).toBe(true);
  });

  it('não ignora texto legítimo de contato individual', () => {
    expect(
      deveIgnorarMensagem({ fromMe: false, remoteJid: 'a@s.whatsapp.net', message: { conversation: 'meu cv' } })
    ).toBe(false);
  });

  it('classifica PDF, documento não-PDF, texto curto e currículo', () => {
    expect(classificarConteudo({ documentMessage: { mimetype: 'application/pdf', fileName: 'cv.pdf' } }).acao).toBe('pdf');
    expect(classificarConteudo({ documentMessage: { mimetype: 'image/png', fileName: 'foto.png' } }).acao).toBe('doc_nao_pdf');
    expect(classificarConteudo({ conversation: 'oi' }).acao).toBe('texto_curto');
    const cv = classificarConteudo({ conversation: textoLongo });
    expect(cv.acao).toBe('curriculo');
    expect(cv.texto).toBe(textoLongo);
  });

  it('reconhece PDF pela extensão mesmo sem mimetype', () => {
    expect(classificarConteudo({ documentMessage: { fileName: 'curriculo.PDF' } }).acao).toBe('pdf');
  });

  it('detecta a palavra-chave ANALISE (com/sem acento, caixa)', () => {
    expect(contemGatilho('ANALISE')).toBe(true);
    expect(contemGatilho('análise')).toBe(true);
    expect(contemGatilho('quero uma Análise por favor')).toBe(true);
    expect(contemGatilho('oi tudo bem?')).toBe(false);
    expect(contemGatilho('')).toBe(false);
    expect(contemGatilho(null)).toBe(false);
  });
});
