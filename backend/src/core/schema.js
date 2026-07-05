/**
 * Schemas Zod — contrato de saída do agente. Reusado pelo renderer e pelos testes.
 * Nenhum import de fora do core (regra de dependência).
 */
import { z } from 'zod';

export const FONTE = 'State of Data Brazil 2025-2026 (Data Hackers / Bain & Company)';

// Escada de senioridade: junior -> pleno -> senior -> staff.
export const SENIORIDADES = ['junior', 'pleno', 'senior', 'staff'];
export const Senioridade = z.enum(['junior', 'pleno', 'senior', 'staff']);

// Cargos presentes no dataset. "Geral (todas as funções)" é a linha de staff.
export const Cargo = z.enum([
  'Analista de Dados',
  'Cientista de Dados',
  'Engenheiro de Dados',
  'Geral (todas as funções)',
]);

/**
 * Recorte salarial devolvido pela tool. `match_exato=false` sinaliza que o
 * recorte pedido não existia e usamos o mais próximo (invariante #1).
 */
export const FaixaSalarial = z.object({
  cargo: z.string(),
  senioridade: Senioridade,
  p25: z.number(),
  mediana: z.number(),
  p75: z.number(),
  n_respondentes: z.number(),
  fonte: z.string(),
  match_exato: z.boolean(),
});

const GapItem = z.object({
  lacuna: z.string().min(1),
  porque_importa: z.string().min(1),
});

const RoadmapFase = z.object({
  periodo: z.string().min(1), // ex.: "Dias 1–30"
  foco: z.string().min(1),
  acoes: z.array(z.string().min(1)).min(1),
});

// Ato 1 — O Veredito
const Veredito = z.object({
  cargo: z.string().min(1),
  senioridade: Senioridade,
  faixa_atual: FaixaSalarial,
  justificativa: z.string().min(1), // cita evidências do CV
  aviso_estimativa: z.string().min(1), // valores são estimativas de faixas autodeclaradas
});

// Ato 2 — O Delta. Staff => faixa_proximo_nivel e delta_mensal nulos; mensagem
// vira reconhecimento ("você está no topo da tabela"). Nunca some (invariante #4).
const Delta = z.object({
  faixa_proximo_nivel: FaixaSalarial.nullable(),
  delta_mensal: z.number().nullable(),
  mensagem: z.string().min(1),
});

// Ato 3 — O Caminho. No máximo 3 lacunas (invariante #5).
const Caminho = z.object({
  gap_para_proximo_nivel: z.array(GapItem).max(3),
  roadmap_90_dias: z.array(RoadmapFase).min(1),
});

export const AnaliseCompleta = z.object({
  veredito: Veredito,
  delta: Delta,
  caminho: Caminho,
  resumo_linkedin: z.string().min(1), // o "one more thing"
  fonte: z.string().default(FONTE),
});

/**
 * JSON Schema (subset) para instruir o modelo no formato exato do JSON final.
 * Mantido à mão para não acoplar a versão do Zod à geração de JSON Schema.
 */
export const ANALISE_JSON_SHAPE = `{
  "veredito": {
    "cargo": "string",
    "senioridade": "junior | pleno | senior | staff",
    "faixa_atual": { "cargo": "string", "senioridade": "...", "p25": number, "mediana": number, "p75": number, "n_respondentes": number, "fonte": "string", "match_exato": boolean },
    "justificativa": "string (cita evidências concretas do CV)",
    "aviso_estimativa": "string (valores são estimativas de faixas autodeclaradas, alta dispersão)"
  },
  "delta": {
    "faixa_proximo_nivel": { ...FaixaSalarial } | null,
    "delta_mensal": number | null,
    "mensagem": "string"
  },
  "caminho": {
    "gap_para_proximo_nivel": [ { "lacuna": "string", "porque_importa": "string" } ],  // máx 3 itens
    "roadmap_90_dias": [ { "periodo": "string", "foco": "string", "acoes": ["string"] } ]
  },
  "resumo_linkedin": "string"
}`;
