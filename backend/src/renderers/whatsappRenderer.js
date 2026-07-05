/**
 * Renderiza uma AnaliseCompleta em 5 mensagens de WhatsApp, na ordem do keynote:
 *   1) O Veredito  2) O Delta  3) O Caminho — lacunas  4) Roadmap 90 dias  5) One more thing
 *
 * Só depende de core/schema.js (regra de dependência). Formatação NATIVA do
 * WhatsApp (*negrito*, _itálico_, > citação, •) — nunca HTML nem markdown de #.
 */
import { FONTE } from '../core/schema.js';

/** Formata um valor em reais: 12500 -> "R$ 12.500" (sem centavos, ponto de milhar). */
export function formatarReais(valor) {
  const n = Math.round(Number(valor) || 0);
  const corpo = Math.abs(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${n < 0 ? '-' : ''}R$ ${corpo}`;
}

const SENIORIDADE_HUMANA = {
  junior: 'Júnior',
  pleno: 'Pleno',
  senior: 'Sênior',
  staff: 'Staff / Especialista',
};

function humanizarSenioridade(s) {
  return SENIORIDADE_HUMANA[s] || s;
}

/** Ato 1 — O Veredito. */
function renderVeredito({ veredito }) {
  const f = veredito.faixa_atual;
  const linhas = [
    '*💰 O Veredito*',
    '',
    `Pelo seu currículo, você está num perfil de *${veredito.cargo} — ${humanizarSenioridade(veredito.senioridade)}*.`,
    '',
    veredito.justificativa,
    '',
    `A maioria dos profissionais como você ganha entre *${formatarReais(f.p25)}* e *${formatarReais(f.p75)}* por mês. O valor típico é *${formatarReais(f.mediana)}*.`,
  ];
  if (!f.match_exato) {
    linhas.push('_(faixa aproximada — usei o recorte mais próximo disponível na pesquisa)_');
  }
  linhas.push('', `_${veredito.aviso_estimativa}_`);
  linhas.push(`Fonte: ${veredito.faixa_atual.fonte || FONTE}`);
  return linhas.join('\n');
}

/** Ato 2 — O Delta. Staff (sem próximo nível) vira reconhecimento. */
function renderDelta({ delta }) {
  const linhas = ['*📈 O Delta*', ''];
  if (delta.faixa_proximo_nivel == null || delta.delta_mensal == null) {
    // Topo da tabela: reconhecimento, nunca some (invariante #4).
    linhas.push(delta.mensagem);
    return linhas.join('\n');
  }
  const prox = delta.faixa_proximo_nivel;
  linhas.push(
    `O próximo nível — *${prox.cargo} — ${humanizarSenioridade(prox.senioridade)}* — tem valor típico de *${formatarReais(prox.mediana)}* por mês.`,
    '',
    delta.mensagem,
    '',
    `👉 São *${formatarReais(delta.delta_mensal)} por mês* que separam você do próximo nível.`
  );
  return linhas.join('\n');
}

/** Ato 3a — O Caminho (lacunas, no máximo 3). */
function renderLacunas({ caminho }) {
  const gaps = caminho.gap_para_proximo_nivel || [];
  const linhas = ['*🧭 O Caminho — o que falta*', ''];
  if (gaps.length === 0) {
    linhas.push(
      'Você já está no topo da tabela. Aqui o jogo muda: o foco deixa de ser "subir de nível" e passa a ser ampliar impacto e influência técnica.'
    );
    return linhas.join('\n');
  }
  gaps.forEach((g, i) => {
    linhas.push(`*${i + 1}. ${g.lacuna}*`);
    linhas.push(`> ${g.porque_importa}`);
    if (i < gaps.length - 1) linhas.push('');
  });
  return linhas.join('\n');
}

/** Ato 3b — Roadmap de 90 dias. */
function renderRoadmap({ caminho }) {
  const linhas = ['*🗓️ Seu plano de 90 dias*', ''];
  caminho.roadmap_90_dias.forEach((fase, i) => {
    linhas.push(`*${fase.periodo} — ${fase.foco}*`);
    fase.acoes.forEach((a) => linhas.push(`• ${a}`));
    if (i < caminho.roadmap_90_dias.length - 1) linhas.push('');
  });
  return linhas.join('\n');
}

/** One more thing — resumo pronto pro LinkedIn. */
function renderOneMoreThing({ resumo_linkedin }) {
  return ['*✨ One more thing — seu resumo pro LinkedIn*', '', resumo_linkedin].join('\n');
}

/**
 * @param {object} analise AnaliseCompleta validada
 * @returns {string[]} exatamente 5 mensagens, na ordem de envio
 */
export function renderizar(analise) {
  return [
    renderVeredito(analise),
    renderDelta(analise),
    renderLacunas(analise),
    renderRoadmap(analise),
    renderOneMoreThing(analise),
  ];
}
