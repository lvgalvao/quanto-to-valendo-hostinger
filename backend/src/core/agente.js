/**
 * Agente de análise. `analisarCurriculo(texto)` -> AnaliseCompleta validada.
 * Loop manual de tool calling + retry de validação. Sem estado de CV em module
 * scope (invariante #6): só o client e o dataset (imutáveis) são compartilhados.
 */
import Anthropic from '@anthropic-ai/sdk';
import { AnaliseCompleta, FONTE } from './schema.js';
import { TOOL_CONSULTAR_FAIXA, consultarFaixaSalarial } from './tools.js';
import { getSystemPrompt } from './prompts.js';
import { ValidacaoAgenteError } from './erros.js';

export const MODELO_PADRAO = 'claude-haiku-4-5';
const MAX_ITERACOES = 16; // teto de segurança do loop de tool calling
const MAX_RETRIES_VALIDACAO = 2; // invariante #3

// Client default criado sob demanda (não no import — testes injetam o próprio).
let clienteDefault = null;
function getClienteDefault() {
  if (!clienteDefault) {
    clienteDefault = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return clienteDefault;
}

/** Concatena os blocos de texto da resposta do modelo. */
function extrairTexto(content) {
  return content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();
}

/** Remove cercas de código (```json ... ```) se o modelo desobedecer. */
function limparJSON(txt) {
  let t = txt.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const inicio = t.indexOf('{');
  const fim = t.lastIndexOf('}');
  if (inicio !== -1 && fim !== -1 && fim > inicio) t = t.slice(inicio, fim + 1);
  return t;
}

/** Tenta parsear + validar. @returns {{ok:true,data}|{ok:false,erro:string}} */
function parsearAnalise(texto) {
  let obj;
  try {
    obj = JSON.parse(limparJSON(texto));
  } catch (e) {
    return { ok: false, erro: `JSON inválido: ${e.message}` };
  }
  if (obj && obj.fonte == null) obj.fonte = FONTE;
  const res = AnaliseCompleta.safeParse(obj);
  if (!res.success) {
    const problemas = res.error.issues
      .map((i) => `- ${i.path.join('.') || '(raiz)'}: ${i.message}`)
      .join('\n');
    return { ok: false, erro: problemas };
  }
  return { ok: true, data: res.data };
}

/**
 * Analisa um currículo (texto já extraído) e devolve a AnaliseCompleta validada.
 * @param {string} texto currículo em texto puro
 * @param {object} [opts]
 * @param {string} [opts.modelo] id do modelo Anthropic
 * @param {string|null} [opts.overridePrompt] override de system prompt do painel
 * @param {object} [opts.client] client Anthropic (injetável para testes)
 * @returns {Promise<object>} AnaliseCompleta
 */
export async function analisarCurriculo(texto, opts = {}) {
  const client = opts.client || getClienteDefault();
  const modelo = opts.modelo || process.env.MODELO_AGENTE || MODELO_PADRAO;
  const system = getSystemPrompt(opts.overridePrompt ?? null);

  // `messages` é local à chamada — nada de estado compartilhado entre conversas.
  const messages = [
    {
      role: 'user',
      content: `Analise o currículo abaixo e produza a análise completa.\n\nCURRÍCULO:\n"""\n${texto}\n"""`,
    },
  ];

  let retriesValidacao = 0;

  for (let iter = 0; iter < MAX_ITERACOES; iter++) {
    const resposta = await client.messages.create({
      model: modelo,
      max_tokens: 3000,
      system,
      tools: [TOOL_CONSULTAR_FAIXA],
      messages,
    });

    messages.push({ role: 'assistant', content: resposta.content });

    if (resposta.stop_reason === 'tool_use') {
      const resultados = [];
      for (const bloco of resposta.content) {
        if (bloco.type !== 'tool_use') continue;
        const { cargo, senioridade } = bloco.input || {};
        const faixa = consultarFaixaSalarial(cargo, senioridade);
        resultados.push({
          type: 'tool_result',
          tool_use_id: bloco.id,
          content: JSON.stringify(
            faixa ?? { erro: 'Recorte inexistente para essa senioridade' }
          ),
        });
      }
      messages.push({ role: 'user', content: resultados });
      continue;
    }

    // Resposta final: parseia e valida.
    const parsed = parsearAnalise(extrairTexto(resposta.content));
    if (parsed.ok) return parsed.data;

    retriesValidacao += 1;
    if (retriesValidacao > MAX_RETRIES_VALIDACAO) {
      throw new ValidacaoAgenteError(
        `Falha de validação após ${MAX_RETRIES_VALIDACAO} tentativas:\n${parsed.erro}`
      );
    }
    messages.push({
      role: 'user',
      content: `Sua resposta não passou na validação do schema. Corrija os problemas abaixo e reenvie APENAS o objeto JSON válido, sem texto ao redor:\n${parsed.erro}`,
    });
  }

  throw new ValidacaoAgenteError('O loop de análise excedeu o número máximo de iterações');
}
