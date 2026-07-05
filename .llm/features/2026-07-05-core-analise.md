# Feature: Core de análise (o cérebro)

**Entregue em:** 2026-07-05

## O que é
Porte, em Node.js, do motor de análise salarial. `analisarCurriculo(texto) → AnaliseCompleta` validada por Zod.

## Arquivos
- `backend/src/core/schema.js` — Zod: `AnaliseCompleta`, `FaixaSalarial`, enums, `.max(3)` em gaps.
- `backend/src/core/tools.js` — `consultarFaixaSalarial(cargo, senioridade)` + `proximoNivel`. Lê `dados/salarios.json` (imutável, module scope). Staff → linha "Geral"; sem match → recorte mais próximo com `match_exato=false`.
- `backend/src/core/prompts.js` — `getSystemPrompt(override)` por injeção; rubrica de senioridade do State of Data.
- `backend/src/core/agente.js` — loop manual de tool calling; JSON puro + validação Zod; até 2 retries reenviando o erro; client injetável.
- `backend/src/core/extracao.js` — `extrairTexto(buffer)` via pdf-parse.
- `backend/src/core/erros.js` — erros de domínio.

## Invariantes atendidos
#1 (números só da tool, ≥2 chamadas), #2 (dataset estático), #3 (validação + retries), #4 (staff), #5 (≤3 gaps), #6 (sem estado de CV em module scope), #7 (modelo default `claude-haiku-4-5`).

## Testes
`test/schema.test.js`, `test/tools.test.js`, `test/agente.test.js` (client mockado, loop + retry + strip de code fence). Regra de dependência do `core/` em `test/dependencia.test.js`.
