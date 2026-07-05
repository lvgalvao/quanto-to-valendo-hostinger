import { describe, it, expect } from 'vitest';
import { AnaliseCompleta, FaixaSalarial, FONTE } from '../src/core/schema.js';

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

const analiseValida = (over = {}) => ({
  veredito: {
    cargo: 'Analista de Dados',
    senioridade: 'pleno',
    faixa_atual: faixa(),
    justificativa: '3 anos de experiência, SQL e Power BI.',
    aviso_estimativa: 'Valores são estimativas de faixas autodeclaradas.',
  },
  delta: {
    faixa_proximo_nivel: faixa({ senioridade: 'senior', mediana: 10131 }),
    delta_mensal: 3571,
    mensagem: 'O próximo nível paga mais.',
  },
  caminho: {
    gap_para_proximo_nivel: [{ lacuna: 'dbt', porque_importa: 'padrão de mercado' }],
    roadmap_90_dias: [{ periodo: 'Dias 1–30', foco: 'dbt', acoes: ['curso'] }],
  },
  resumo_linkedin: 'Analista de dados orientado a impacto.',
  fonte: FONTE,
  ...over,
});

describe('AnaliseCompleta', () => {
  it('aceita uma análise válida', () => {
    expect(AnaliseCompleta.safeParse(analiseValida()).success).toBe(true);
  });

  it('preenche a fonte por default quando ausente', () => {
    const semFonte = analiseValida();
    delete semFonte.fonte;
    const r = AnaliseCompleta.parse(semFonte);
    expect(r.fonte).toBe(FONTE);
  });

  it('rejeita mais de 3 lacunas (invariante #5)', () => {
    const quatro = analiseValida({
      caminho: {
        gap_para_proximo_nivel: [1, 2, 3, 4].map((n) => ({ lacuna: `g${n}`, porque_importa: 'x' })),
        roadmap_90_dias: [{ periodo: 'd', foco: 'f', acoes: ['a'] }],
      },
    });
    expect(AnaliseCompleta.safeParse(quatro).success).toBe(false);
  });

  it('aceita o caso staff com faixa_proximo_nivel e delta nulos', () => {
    const staff = analiseValida({
      veredito: {
        cargo: 'Geral (todas as funções)',
        senioridade: 'staff',
        faixa_atual: faixa({ cargo: 'Geral (todas as funções)', senioridade: 'staff' }),
        justificativa: '12 anos de experiência.',
        aviso_estimativa: 'Estimativas.',
      },
      delta: { faixa_proximo_nivel: null, delta_mensal: null, mensagem: 'Você está no topo.' },
      caminho: {
        gap_para_proximo_nivel: [],
        roadmap_90_dias: [{ periodo: 'd', foco: 'f', acoes: ['a'] }],
      },
    });
    expect(AnaliseCompleta.safeParse(staff).success).toBe(true);
  });

  it('rejeita senioridade inválida', () => {
    expect(FaixaSalarial.safeParse(faixa({ senioridade: 'lenda' })).success).toBe(false);
  });
});
