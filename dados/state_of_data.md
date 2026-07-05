# State of Data Brazil 2025–2026 — Base de Conhecimento

> Documento derivado do relatório oficial da pesquisa **State of Data Brazil 2025-2026** (Data Hackers + Bain & Company).
> Uso: fonte de referência do agente "Quanto Tô Valendo" e insumo para geração do `dados/salarios.json`.
> **NÃO é lido em runtime** (invariante #2 — sem RAG). Alimenta, em build-time, a rubrica de senioridade do system prompt (`core/prompts.js`) e o enquadramento de gap/roadmap.
> Fonte a citar nos outputs do agente: **"State of Data Brazil 2025-2026 (Data Hackers / Bain & Company)"**.

---

## 1. Metadados da pesquisa

| Campo | Valor |
|---|---|
| Edição | 2025–2026 (5ª edição da parceria Data Hackers + Bain) |
| Período de coleta | 14/out/2025 a 18/dez/2025 |
| Respondentes | 3.200 profissionais brasileiros de dados |
| Papéis cobertos | Analista de Dados, Cientista de Dados, Engenheiro de Dados/ML, Analista de Negócios, Gestores |
| Níveis cobertos | Júnior, Pleno, Sênior, Especialista/Staff, Gestor |
| Exclusões da amostra | Desempregados, apenas estudantes, quem não informou situação de trabalho |
| Moeda dos salários | R$ (reais/mês, valores brutos reportados pelos respondentes) |

**Limitação importante:** a pesquisa reporta remuneração em **faixas** (< R$2k, R$2–4k, R$4–6k, R$6–8k, R$8–12k, R$12–16k, > R$16k), não em percentis. Ver seção 10 para orientação de como derivar p25/mediana/p75.

---

## 4. Senioridade: sinais objetivos (rubrica de apoio)

Dados úteis para o agente estimar senioridade a partir de anos de experiência.

### 4.1 Anos de experiência em DADOS por nível — Figura 7

| Nível | Padrão dominante |
|---|---|
| Júnior | 84,1% têm até 2 anos de experiência em dados (sem exp: 12,4%; <1 ano: 28,3%; 1–2 anos: 43,3%; 3–4 anos: 12,6%) |
| Pleno | 72,4% têm entre 1 e 4 anos (1–2 anos: 23,7%; 3–4 anos: 48,6%; 5–6 anos: 15,2%) |
| Sênior | 80,2% têm de 3 a 10 anos (3–4: 28,0%; 5–6: 33,2%; 7–10: 19,1%; >10: 9,1%) |
| Especialista/Staff | 28,1% têm mais de 10 anos (7–10: 27,8%; 5–6: 27,5%; 3–4: 12,5%) |
| Gestor | 34,3% têm mais de 10 anos (7–10: 18,9%; 5–6: 19,1%) |

Há muita dispersão em todos os níveis — empresas têm políticas próprias de nivelamento.

### 4.3 Formação por nível

- 58% do total têm pós-graduação. Júnior: 19,5% já têm pós. Especialista: 74,2%. Gestor: 77,1%.
- Áreas de formação: TI/Computação 37,8%; Engenharias 20,5%; Ciência de Dados/IA 8,1%.

---

## 9. Contexto qualitativo relevante para a análise do agente

- **Remuneração é o critério nº 1 de mercado** (83,4%) — saber "quanto valho" é a pergunta central do profissional de dados brasileiro.
- **Falta de crescimento (67,1%) supera salário (29,8%) como motivo de insatisfação** — o roadmap de 90 dias e o gap para o próximo nível são tão importantes quanto a faixa em si.
- **Engenheiro de Dados/ML é a função mais bem paga e mais remota**; Analista de Dados é o piso salarial — migração analista → engenheiro/cientista é caminho comum de aumento de faixa.
- **Formação em Ciência de Dados/IA ainda é 8,1%** — a maioria migra de TI, engenharias e negócios; ausência de diploma específico não é penalidade.
- **Pós-graduação é norma nos níveis altos** (74–77% em especialista/gestão) — sinal relevante para gap de próximo nível.
- **IA generativa é habilidade de contexto obrigatória**: 98% já usam; empresas estão centralizando governança — experiência com IA aplicada e governança é diferencial crescente.

---

## 10. Notas para geração do `dados/salarios.json`

A pesquisa **não publica p25/mediana/p75 diretamente**. O `salarios.json` deste repo foi derivado por interpolação das faixas + sanity check com as médias por nível.

- Recortes com dados diretos: cargo × nível para Analista, Cientista e Engenheiro/ML nos níveis Júnior, Pleno e Sênior.
- Para Staff/Especialista, só há distribuição agregada por nível — o dataset usa uma linha única `"Geral (todas as funções)"` como proxy; recorte de staff de função específica ⇒ `match_exato=false`.
- Campo `fonte`: `"State of Data Brazil 2025-2026"`.
- **Aviso obrigatório no output do agente**: valores são estimativas derivadas de faixas autodeclaradas; alta dispersão em todos os níveis.
