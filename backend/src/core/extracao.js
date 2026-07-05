/**
 * Extração de texto de PDF. Buffer -> texto. Erros viram erro de domínio.
 */
import { createRequire } from 'node:module';
import { PDFSemTextoError } from './erros.js';

// pdf-parse é CommonJS e, no import default de ESM, dispara um bloco de debug.
// createRequire acessa o módulo interno (lib/pdf-parse.js) sem esse efeito.
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse/lib/pdf-parse.js');

/**
 * @param {Buffer} buffer conteúdo binário do PDF
 * @returns {Promise<string>} texto extraído
 * @throws {PDFSemTextoError} quando o PDF não tem texto extraível (ex.: PDF escaneado)
 */
export async function extrairTexto(buffer) {
  let resultado;
  try {
    resultado = await pdfParse(buffer);
  } catch (e) {
    throw new PDFSemTextoError(`Falha ao ler o PDF: ${e.message}`);
  }
  const texto = (resultado?.text || '').trim();
  if (texto.length < 20) {
    throw new PDFSemTextoError('PDF sem texto extraível (provavelmente escaneado/imagem)');
  }
  return texto;
}
