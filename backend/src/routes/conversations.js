/**
 * Rotas /api/conversations — histórico e toggle do agente por conversa.
 */
import { Router } from 'express';
import * as repo from '../db/repositorio.js';

const router = Router();

// GET / — lista de conversas com último trecho, contadores e status do agente.
router.get('/', (_req, res) => {
  res.json({
    conversas: repo.listarConversas(),
    agente_ativo_global: repo.agenteAtivoGlobal(),
  });
});

// GET /:id/messages — histórico paginado (limite, antesDe).
router.get('/:id/messages', (req, res) => {
  const id = Number(req.params.id);
  const conversa = repo.getConversa(id);
  if (!conversa) return res.status(404).json({ erro: 'conversa não encontrada' });
  const limite = Math.min(Number(req.query.limite) || 100, 500);
  const antesDe = req.query.antesDe ? Number(req.query.antesDe) : null;
  res.json({
    conversa,
    mensagens: repo.listarMensagens(id, { limite, antesDe }),
  });
});

// PATCH /:id — toggle agente_ativo da conversa.
router.patch('/:id', (req, res) => {
  const id = Number(req.params.id);
  const conversa = repo.getConversa(id);
  if (!conversa) return res.status(404).json({ erro: 'conversa não encontrada' });
  const ativo = !!req.body?.agente_ativo;
  res.json(repo.setAgenteAtivoConversa(id, ativo));
});

export default router;
