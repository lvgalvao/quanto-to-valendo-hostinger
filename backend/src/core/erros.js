/**
 * Erros de domínio do core. Capturados pelos handlers para virar mensagens
 * amigáveis ao usuário do WhatsApp — nunca stack trace cru.
 */

export class PDFSemTextoError extends Error {
  constructor(mensagem = 'PDF sem texto extraível') {
    super(mensagem);
    this.name = 'PDFSemTextoError';
  }
}

export class PerfilSemMatchError extends Error {
  constructor(mensagem = 'Não foi possível estimar um perfil a partir do currículo') {
    super(mensagem);
    this.name = 'PerfilSemMatchError';
  }
}

export class ValidacaoAgenteError extends Error {
  constructor(mensagem = 'A resposta do agente não passou na validação do schema') {
    super(mensagem);
    this.name = 'ValidacaoAgenteError';
  }
}
