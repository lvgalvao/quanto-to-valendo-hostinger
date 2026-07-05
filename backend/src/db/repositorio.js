/**
 * Repositório — todo acesso ao SQLite. Chaveia conversas por (connection_id, remote_jid)
 * garantindo isolamento por conversa (invariante #6).
 */
import db from './database.js';

/* ---------- Conexões ---------- */

export function criarConexao(id, nome) {
  db.prepare('INSERT INTO conexoes (id, nome, status) VALUES (?, ?, ?)').run(id, nome, 'close');
  return getConexao(id);
}

export function getConexao(id) {
  return db.prepare('SELECT * FROM conexoes WHERE id = ?').get(id);
}

export function listarConexoes() {
  return db.prepare('SELECT * FROM conexoes ORDER BY criada_em DESC').all();
}

export function atualizarStatusConexao(id, status, numero) {
  if (numero !== undefined) {
    db.prepare('UPDATE conexoes SET status = ?, numero = ? WHERE id = ?').run(status, numero, id);
  } else {
    db.prepare('UPDATE conexoes SET status = ? WHERE id = ?').run(status, id);
  }
}

export function removerConexao(id) {
  db.prepare('DELETE FROM conexoes WHERE id = ?').run(id);
}

/* ---------- Conversas ---------- */

/** Retorna a conversa existente ou cria uma nova para (connection_id, remote_jid). */
export function getOuCriarConversa(connectionId, remoteJid, nomeContato) {
  const existente = db
    .prepare('SELECT * FROM conversas WHERE connection_id = ? AND remote_jid = ?')
    .get(connectionId, remoteJid);
  if (existente) {
    if (nomeContato && !existente.nome_contato) {
      db.prepare('UPDATE conversas SET nome_contato = ? WHERE id = ?').run(nomeContato, existente.id);
      existente.nome_contato = nomeContato;
    }
    return existente;
  }
  const info = db
    .prepare(
      'INSERT INTO conversas (connection_id, remote_jid, nome_contato) VALUES (?, ?, ?)'
    )
    .run(connectionId, remoteJid, nomeContato || null);
  return db.prepare('SELECT * FROM conversas WHERE id = ?').get(info.lastInsertRowid);
}

export function getConversa(id) {
  return db.prepare('SELECT * FROM conversas WHERE id = ?').get(id);
}

export function listarConversas() {
  return db
    .prepare(
      `SELECT c.*,
              (SELECT conteudo FROM mensagens m WHERE m.conversa_id = c.id ORDER BY m.id DESC LIMIT 1) AS ultima_mensagem,
              (SELECT timestamp FROM mensagens m WHERE m.conversa_id = c.id ORDER BY m.id DESC LIMIT 1) AS ultima_em,
              (SELECT COUNT(*) FROM mensagens m WHERE m.conversa_id = c.id) AS total_mensagens
       FROM conversas c
       ORDER BY atualizada_em DESC`
    )
    .all();
}

export function setAgenteAtivoConversa(id, ativo) {
  db.prepare('UPDATE conversas SET agente_ativo = ?, atualizada_em = datetime(\'now\') WHERE id = ?').run(
    ativo ? 1 : 0,
    id
  );
  return getConversa(id);
}

function tocarConversa(id) {
  db.prepare("UPDATE conversas SET atualizada_em = datetime('now') WHERE id = ?").run(id);
}

/* ---------- Mensagens ---------- */

export function inserirMensagem(conversaId, papel, tipo, conteudo) {
  const info = db
    .prepare('INSERT INTO mensagens (conversa_id, papel, tipo, conteudo) VALUES (?, ?, ?, ?)')
    .run(conversaId, papel, tipo || 'texto', conteudo ?? '');
  tocarConversa(conversaId);
  return db.prepare('SELECT * FROM mensagens WHERE id = ?').get(info.lastInsertRowid);
}

export function listarMensagens(conversaId, { limite = 100, antesDe = null } = {}) {
  if (antesDe) {
    return db
      .prepare(
        'SELECT * FROM mensagens WHERE conversa_id = ? AND id < ? ORDER BY id DESC LIMIT ?'
      )
      .all(conversaId, antesDe, limite)
      .reverse();
  }
  return db
    .prepare('SELECT * FROM mensagens WHERE conversa_id = ? ORDER BY id DESC LIMIT ?')
    .all(conversaId, limite)
    .reverse();
}

/* ---------- Configurações ---------- */

export function getConfig(chave) {
  const row = db.prepare('SELECT valor FROM configuracoes WHERE chave = ?').get(chave);
  return row ? row.valor : null;
}

export function setConfig(chave, valor) {
  db.prepare(
    'INSERT INTO configuracoes (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor'
  ).run(chave, valor ?? '');
}

export function getTodasConfigs() {
  const rows = db.prepare('SELECT chave, valor FROM configuracoes').all();
  return Object.fromEntries(rows.map((r) => [r.chave, r.valor]));
}

export function agenteAtivoGlobal() {
  return getConfig('agente_ativo_global') === '1';
}
