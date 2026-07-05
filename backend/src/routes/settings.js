/**
 * Rotas /api/settings — system prompt override, modelo e toggle global do agente.
 */
import { Router } from 'express';
import * as repo from '../db/repositorio.js';
import { SYSTEM_PROMPT_PADRAO } from '../core/prompts.js';

const router = Router();

// Lista fixa de modelos Anthropic válidos exibida no painel.
export const MODELOS_VALIDOS = ['claude-haiku-4-5', 'claude-sonnet-5', 'claude-opus-4-8'];

// GET / — configuração atual + metadados para o painel.
router.get('/', (_req, res) => {
  const cfg = repo.getTodasConfigs();
  res.json({
    system_prompt_override: cfg.system_prompt_override || '',
    modelo: cfg.modelo || MODELOS_VALIDOS[0],
    agente_ativo_global: cfg.agente_ativo_global === '1',
    modelos_disponiveis: MODELOS_VALIDOS,
    system_prompt_padrao: SYSTEM_PROMPT_PADRAO,
  });
});

// PUT / — salva configuração. Vale para a PRÓXIMA análise, sem restart.
router.put('/', (req, res) => {
  const { system_prompt_override, modelo, agente_ativo_global } = req.body || {};

  if (modelo !== undefined) {
    if (!MODELOS_VALIDOS.includes(modelo)) {
      return res.status(400).json({ erro: `modelo inválido. Use um de: ${MODELOS_VALIDOS.join(', ')}` });
    }
    repo.setConfig('modelo', modelo);
  }
  if (system_prompt_override !== undefined) {
    repo.setConfig('system_prompt_override', String(system_prompt_override));
  }
  if (agente_ativo_global !== undefined) {
    repo.setConfig('agente_ativo_global', agente_ativo_global ? '1' : '0');
  }

  res.json({ ok: true });
});

export default router;
