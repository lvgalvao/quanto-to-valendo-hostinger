/**
 * SQLite (better-sqlite3). Abre o banco e roda as migrations no boot.
 */
import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '../../data');
const DB_PATH = join(DATA_DIR, 'app.db');

mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/** Cria as tabelas se não existirem. Idempotente. */
export function migrar() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS conexoes (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'close',
      numero TEXT,
      criada_em TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS conversas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      connection_id TEXT NOT NULL,
      remote_jid TEXT NOT NULL,
      nome_contato TEXT,
      agente_ativo INTEGER NOT NULL DEFAULT 1,
      criada_em TEXT NOT NULL DEFAULT (datetime('now')),
      atualizada_em TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(connection_id, remote_jid)
    );

    CREATE TABLE IF NOT EXISTS mensagens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversa_id INTEGER NOT NULL,
      papel TEXT NOT NULL CHECK(papel IN ('usuario','agente','sistema')),
      tipo TEXT NOT NULL DEFAULT 'texto',
      conteudo TEXT,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (conversa_id) REFERENCES conversas(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_mensagens_conversa ON mensagens(conversa_id);

    CREATE TABLE IF NOT EXISTS configuracoes (
      chave TEXT PRIMARY KEY,
      valor TEXT
    );
  `);

  // Defaults de configuração (só insere se ausente).
  const upsertPadrao = db.prepare(
    'INSERT OR IGNORE INTO configuracoes (chave, valor) VALUES (?, ?)'
  );
  upsertPadrao.run('agente_ativo_global', '1');
  upsertPadrao.run('system_prompt_override', '');
  upsertPadrao.run('modelo', process.env.MODELO_AGENTE || 'claude-haiku-4-5');
}

export default db;
