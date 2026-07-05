/**
 * Rotas /api/connections — CRUD de conexões e controle de QR/conexão Baileys.
 */
import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import * as repo from '../db/repositorio.js';
import * as conexoes from '../managers/connectionManager.js';

const router = Router();

// POST / — cria uma conexão (uuid + nome).
router.post('/', (req, res) => {
  const nome = (req.body?.nome || '').trim();
  if (!nome) return res.status(400).json({ erro: 'nome é obrigatório' });
  const id = uuidv4();
  const conexao = repo.criarConexao(id, nome);
  res.status(201).json(conexao);
});

// GET / — lista conexões com status (db + live).
router.get('/', (_req, res) => {
  const lista = repo.listarConexoes().map((c) => ({
    ...c,
    ativo: conexoes.isConectado(c.id),
  }));
  res.json(lista);
});

// DELETE /:id — remove conexão e limpa sessão.
router.delete('/:id', async (req, res) => {
  await conexoes.removerSessao(req.params.id);
  repo.removerConexao(req.params.id);
  res.json({ ok: true });
});

// POST /:id/connect — inicia a conexão (QR sai via Socket.IO).
router.post('/:id/connect', async (req, res) => {
  const conexao = repo.getConexao(req.params.id);
  if (!conexao) return res.status(404).json({ erro: 'conexão não encontrada' });
  try {
    await conexoes.conectar(req.params.id);
    res.status(202).json({ ok: true, status: 'connecting' });
  } catch (e) {
    console.error('[connections] falha ao conectar', e.message);
    res.status(500).json({ erro: 'falha ao iniciar a conexão' });
  }
});

// POST /:id/disconnect — desconecta.
router.post('/:id/disconnect', async (req, res) => {
  await conexoes.desconectar(req.params.id);
  res.json({ ok: true });
});

export default router;
