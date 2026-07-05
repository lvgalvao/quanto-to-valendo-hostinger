/**
 * Testa o loop de tool calling e o retry de validação com o client Anthropic
 * MOCKADO — sem gastar API.
 */
import { describe, it, expect } from 'vitest';
import { analisarCurriculo } from '../src/core/agente.js';
import { FONTE } from '../src/core/schema.js';
import { ValidacaoAgenteError } from '../src/core/erros.js';

const faixa = (over = {}) => ({
  cargo: 'Analista de Dados',
  senioridade: 'pleno',
  p25: 4848,
  mediana: 6560,
  p75: 8772,
  n_respondentes: 280,
  fonte: 'State of Data Brazil 2025-2026',
  match_exato: true,
  ...over,
});

const analiseValida = {
  veredito: {
    cargo: 'Analista de Dados',
    senioridade: 'pleno',
    faixa_atual: faixa(),
    justificativa: '3 anos, SQL e Power BI.',
    aviso_estimativa: 'Estimativas de faixas autodeclaradas.',
  },
  delta: {
    faixa_proximo_nivel: faixa({ senioridade: 'senior', mediana: 10131 }),
    delta_mensal: 3571,
    mensagem: 'O próximo nível paga mais.',
  },
  caminho: {
    gap_para_proximo_nivel: [{ lacuna: 'dbt', porque_importa: 'padrão' }],
    roadmap_90_dias: [{ periodo: 'Dias 1–30', foco: 'dbt', acoes: ['curso'] }],
  },
  resumo_linkedin: 'Analista de dados orientado a impacto.',
  fonte: FONTE,
};

const respToolUse = (id, cargo, senioridade) => ({
  stop_reason: 'tool_use',
  content: [{ type: 'tool_use', id, name: 'consultar_faixa_salarial', input: { cargo, senioridade } }],
});

const respFinal = (texto) => ({
  stop_reason: 'end_turn',
  content: [{ type: 'text', text: texto }],
});

function clientMock(respostas) {
  let i = 0;
  const chamadas = [];
  return {
    chamadas,
    messages: {
      create: async (args) => {
        // snapshot: `messages` é mutado após a chamada (mesma referência)
        chamadas.push({ ...args, messages: JSON.parse(JSON.stringify(args.messages)) });
        return respostas[Math.min(i++, respostas.length - 1)];
      },
    },
  };
}

describe('analisarCurriculo (client mockado)', () => {
  it('executa o loop de tool calling e devolve a análise validada', async () => {
    const client = clientMock([
      respToolUse('t1', 'Analista de Dados', 'pleno'),
      respToolUse('t2', 'Analista de Dados', 'senior'),
      respFinal(JSON.stringify(analiseValida)),
    ]);
    const analise = await analisarCurriculo('curriculo...', { client });
    expect(analise.veredito.mediana ?? analise.veredito.faixa_atual.mediana).toBeTruthy();
    expect(analise.delta.delta_mensal).toBe(3571);
    // 2 tool calls + 1 final = 3 chamadas ao modelo
    expect(client.chamadas).toHaveLength(3);
    // O tool_result deve ter voltado como mensagem do usuário
    const segundaChamada = client.chamadas[1];
    const ultimaMsg = segundaChamada.messages[segundaChamada.messages.length - 1];
    expect(ultimaMsg.role).toBe('user');
    expect(ultimaMsg.content[0].type).toBe('tool_result');
  });

  it('reenvia o erro de validação e aceita o JSON corrigido', async () => {
    const client = clientMock([
      respFinal('{"veredito": "faltando tudo"}'), // inválido
      respFinal(JSON.stringify(analiseValida)), // corrigido
    ]);
    const analise = await analisarCurriculo('curriculo...', { client });
    expect(analise.resumo_linkedin).toContain('Analista');
    expect(client.chamadas).toHaveLength(2);
  });

  it('desiste após exceder o máximo de retries de validação', async () => {
    const client = clientMock([respFinal('{"lixo": true}')]);
    await expect(analisarCurriculo('curriculo...', { client })).rejects.toBeInstanceOf(
      ValidacaoAgenteError
    );
  });

  it('remove cercas de código markdown do JSON final', async () => {
    const client = clientMock([respFinal('```json\n' + JSON.stringify(analiseValida) + '\n```')]);
    const analise = await analisarCurriculo('curriculo...', { client });
    expect(analise.delta.delta_mensal).toBe(3571);
  });
});
