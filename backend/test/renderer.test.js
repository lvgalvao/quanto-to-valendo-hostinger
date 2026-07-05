import { describe, it, expect } from 'vitest';
import { formatarReais, renderizar } from '../src/renderers/whatsappRenderer.js';

describe('formatarReais', () => {
  it('formata com ponto de milhar e sem centavos', () => {
    expect(formatarReais(12500)).toBe('R$ 12.500');
    expect(formatarReais(3516)).toBe('R$ 3.516');
    expect(formatarReais(999)).toBe('R$ 999');
    expect(formatarReais(1000000)).toBe('R$ 1.000.000');
  });

  it('arredonda decimais', () => {
    expect(formatarReais(6559.6)).toBe('R$ 6.560');
  });
});

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

const analise = (over = {}) => ({
  veredito: {
    cargo: 'Analista de Dados',
    senioridade: 'pleno',
    faixa_atual: faixa(),
    justificativa: 'Justificativa citando o CV.',
    aviso_estimativa: 'Valores são estimativas.',
  },
  delta: {
    faixa_proximo_nivel: faixa({ senioridade: 'senior', mediana: 10131 }),
    delta_mensal: 3571,
    mensagem: 'O próximo nível paga mais.',
  },
  caminho: {
    gap_para_proximo_nivel: [
      { lacuna: 'dbt', porque_importa: 'padrão' },
      { lacuna: 'cloud', porque_importa: 'escala' },
    ],
    roadmap_90_dias: [
      { periodo: 'Dias 1–30', foco: 'Fundamentos', acoes: ['a1', 'a2'] },
      { periodo: 'Dias 31–60', foco: 'Prática', acoes: ['b1'] },
    ],
  },
  resumo_linkedin: 'Resumo pronto pro LinkedIn.',
  fonte: 'State of Data Brazil 2025-2026 (Data Hackers / Bain & Company)',
  ...over,
});

describe('renderizar', () => {
  it('produz exatamente 5 mensagens na ordem dos atos', () => {
    const msgs = renderizar(analise());
    expect(msgs).toHaveLength(5);
    expect(msgs[0]).toContain('O Veredito');
    expect(msgs[1]).toContain('O Delta');
    expect(msgs[2]).toContain('O Caminho');
    expect(msgs[3]).toContain('90 dias');
    expect(msgs[4]).toContain('One more thing');
  });

  it('usa formatação nativa do WhatsApp e nunca HTML/markdown de #', () => {
    const texto = renderizar(analise()).join('\n');
    expect(texto).toContain('*'); // negrito nativo
    expect(texto).not.toContain('<'); // sem HTML
    expect(texto).not.toMatch(/^#/m); // sem headings markdown
  });

  it('mostra o delta mensal em reais no Ato 2', () => {
    const msgs = renderizar(analise());
    expect(msgs[1]).toContain('R$ 3.571');
    expect(msgs[1]).toContain('por mês');
  });

  it('no caso staff, o Ato 2 vira reconhecimento (sem delta)', () => {
    const staff = analise({
      delta: { faixa_proximo_nivel: null, delta_mensal: null, mensagem: 'Você está no topo da tabela.' },
      caminho: {
        gap_para_proximo_nivel: [],
        roadmap_90_dias: [{ periodo: 'Dias 1–30', foco: 'Impacto', acoes: ['x'] }],
      },
    });
    const msgs = renderizar(staff);
    expect(msgs).toHaveLength(5);
    expect(msgs[1]).toContain('topo da tabela');
    expect(msgs[1]).not.toContain('deixando');
  });

  it('sinaliza faixa aproximada quando match_exato=false', () => {
    const aprox = analise({
      veredito: {
        cargo: 'Analista de Negócios',
        senioridade: 'pleno',
        faixa_atual: faixa({ match_exato: false }),
        justificativa: 'x',
        aviso_estimativa: 'y',
      },
    });
    expect(renderizar(aprox)[0]).toContain('aproximada');
  });
});
