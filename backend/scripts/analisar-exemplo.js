/**
 * Harness de verificação manual: alimenta um CV de exemplo, roda o agente real
 * e imprime as 5 mensagens renderizadas. Requer ANTHROPIC_API_KEY no ambiente.
 *
 *   ANTHROPIC_API_KEY=sk-... node scripts/analisar-exemplo.js
 */
import 'dotenv/config';
import { analisarCurriculo } from '../src/core/agente.js';
import { renderizar } from '../src/renderers/whatsappRenderer.js';

const CV_EXEMPLO = `
João da Silva — Analista de Dados
São Paulo, SP | joao@email.com

Resumo: Profissional de dados com 3 anos de experiência. Atuo com SQL, Python (pandas),
dashboards em Power BI e Looker. Já construí pipelines de ETL simples no Airflow e
modelagem dimensional. Formação: Bacharel em Estatística. Curso de Machine Learning.

Experiência:
- Analista de Dados Pleno na VarejoTech (2 anos): dashboards de vendas, análises ad-hoc,
  automação de relatórios em Python, colaboração com times de produto.
- Analista de Dados Júnior na FinCorp (1 ano): extração de dados em SQL, planilhas,
  suporte a áreas de negócio.

Skills: SQL avançado, Python, Power BI, Looker, Git, começando com dbt e AWS.
`;

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Defina ANTHROPIC_API_KEY para rodar o exemplo com a API real.');
    process.exit(1);
  }
  console.log('Analisando CV de exemplo...\n');
  const analise = await analisarCurriculo(CV_EXEMPLO);
  const mensagens = renderizar(analise);
  mensagens.forEach((m, i) => {
    console.log(`\n──────── MENSAGEM ${i + 1} ────────\n`);
    console.log(m);
  });
  console.log('\n──────── FIM ────────\n');
}

main().catch((e) => {
  console.error('Falhou:', e);
  process.exit(1);
});
