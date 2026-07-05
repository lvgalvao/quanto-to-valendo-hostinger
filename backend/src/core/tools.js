/**
 * Tool `consultar_faixa_salarial` — ÚNICA fonte de números salariais (invariante #1).
 * Lê o dataset estático `dados/salarios.json` uma vez (module scope, imutável).
 * O agente é proibido no system prompt de estimar valores por conta própria.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { SENIORIDADES } from './schema.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CAMINHO_DATASET = join(__dirname, '../../../dados/salarios.json');

// Carregado uma vez. Dado imutável — pode ser compartilhado entre conversas.
const DATASET = Object.freeze(JSON.parse(readFileSync(CAMINHO_DATASET, 'utf-8')));

const CARGO_STAFF = 'Geral (todas as funções)';

/** Normaliza texto para comparação tolerante (sem acento, minúsculo, sem espaços extras). */
function normalizar(txt) {
  return String(txt || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/** Próximo nível na escada. staff => null (topo da tabela). */
export function proximoNivel(senioridade) {
  const i = SENIORIDADES.indexOf(senioridade);
  if (i === -1 || i === SENIORIDADES.length - 1) return null;
  return SENIORIDADES[i + 1];
}

function acharRegistro(cargo, senioridade) {
  const c = normalizar(cargo);
  const s = normalizar(senioridade);
  return DATASET.find((r) => normalizar(r.cargo) === c && normalizar(r.senioridade) === s);
}

/** Qualquer registro daquela senioridade (âncora quando o cargo não bate). */
function acharPorSenioridade(senioridade) {
  const s = normalizar(senioridade);
  return DATASET.filter((r) => normalizar(r.senioridade) === s);
}

function montarFaixa(registro, matchExato) {
  return {
    cargo: registro.cargo,
    senioridade: registro.senioridade,
    p25: registro.p25,
    mediana: registro.mediana,
    p75: registro.p75,
    n_respondentes: registro.n_respondentes,
    fonte: registro.fonte,
    match_exato: matchExato,
  };
}

/**
 * Consulta a faixa salarial de (cargo, senioridade).
 *
 * Regras:
 *  - staff colapsa na linha única "Geral (todas as funções)". Se o cargo pedido
 *    for uma função específica, match_exato=false (o dataset não abre staff por função).
 *  - match exato (cargo, senioridade) => match_exato=true.
 *  - sem match => recorte mais próximo (mesma senioridade, primeiro cargo âncora)
 *    com match_exato=false.
 *
 * @returns {import('./schema.js').FaixaSalarial|null} FaixaSalarial ou null se a senioridade não existe.
 */
export function consultarFaixaSalarial(cargo, senioridade) {
  const s = normalizar(senioridade);

  // staff: sempre a linha Geral. match_exato só se o cargo pedido também for a Geral.
  if (s === 'staff') {
    const geral = acharRegistro(CARGO_STAFF, 'staff');
    if (!geral) return null;
    const exato = normalizar(cargo) === normalizar(CARGO_STAFF);
    return montarFaixa(geral, exato);
  }

  const exato = acharRegistro(cargo, senioridade);
  if (exato) return montarFaixa(exato, true);

  // Sem match exato: pega o recorte mais próximo pela senioridade.
  const candidatos = acharPorSenioridade(senioridade);
  if (candidatos.length > 0) return montarFaixa(candidatos[0], false);

  return null;
}

/** Definição da tool no formato esperado pela API Anthropic. */
export const TOOL_CONSULTAR_FAIXA = {
  name: 'consultar_faixa_salarial',
  description:
    'Retorna a faixa salarial (p25, mediana, p75) de um recorte cargo × senioridade a partir da pesquisa State of Data Brazil. É a ÚNICA fonte de números salariais. Chame para o nível atual estimado E para o próximo nível (para calcular o delta). Se não houver match exato, o retorno traz match_exato=false com o recorte mais próximo.',
  input_schema: {
    type: 'object',
    properties: {
      cargo: {
        type: 'string',
        description:
          'Cargo/função. Um de: "Analista de Dados", "Cientista de Dados", "Engenheiro de Dados", ou "Geral (todas as funções)" para staff.',
      },
      senioridade: {
        type: 'string',
        enum: SENIORIDADES,
        description: 'Nível: junior, pleno, senior ou staff.',
      },
    },
    required: ['cargo', 'senioridade'],
  },
};

// Exposto para testes.
export const _DATASET = DATASET;
export const _CARGO_STAFF = CARGO_STAFF;
