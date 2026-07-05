import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '../lib/api.js';

export default function Settings() {
  const [cfg, setCfg] = useState(null);
  const [salvando, setSalvando] = useState(false);

  async function carregar() {
    const { data } = await api.get('/api/settings');
    setCfg(data);
  }
  useEffect(() => {
    carregar();
  }, []);

  async function salvar() {
    setSalvando(true);
    try {
      await api.put('/api/settings', {
        system_prompt_override: cfg.system_prompt_override,
        modelo: cfg.modelo,
        agente_ativo_global: cfg.agente_ativo_global,
      });
      toast.success('Configurações salvas');
    } catch (e) {
      toast.error(e.response?.data?.erro || 'Falha ao salvar');
    } finally {
      setSalvando(false);
    }
  }

  if (!cfg) return <div className="vazio">Carregando...</div>;

  return (
    <>
      <div className="topo">
        <h1>Configurações</h1>
        <button className="btn-verde" onClick={salvar} disabled={salvando}>
          {salvando ? 'Salvando...' : 'Salvar'}
        </button>
      </div>

      <div style={{ maxWidth: 720 }}>
        <div className="campo-form">
          <label>
            <span className="linha-toggle">
              <label className="switch">
                <input
                  type="checkbox"
                  checked={cfg.agente_ativo_global}
                  onChange={(e) => setCfg({ ...cfg, agente_ativo_global: e.target.checked })}
                />
                <span className="slider" />
              </label>
              Agente ativo (global)
            </span>
          </label>
          <div className="ajuda">Desligado, o bot persiste as mensagens mas não responde a ninguém.</div>
        </div>

        <div className="campo-form">
          <label>Modelo</label>
          <select value={cfg.modelo} onChange={(e) => setCfg({ ...cfg, modelo: e.target.value })}>
            {cfg.modelos_disponiveis.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <div className="campo-form">
          <label>System prompt (override)</label>
          <textarea
            rows={14}
            value={cfg.system_prompt_override}
            onChange={(e) => setCfg({ ...cfg, system_prompt_override: e.target.value })}
            placeholder="Deixe vazio para usar o prompt padrão. O texto aqui é ANEXADO ao prompt base (não substitui as regras invioláveis)."
          />
          <div className="ajuda">
            <button
              className="btn-ghost"
              style={{ marginTop: 8 }}
              onClick={() => setCfg({ ...cfg, system_prompt_override: '' })}
            >
              Restaurar padrão (limpar override)
            </button>
          </div>
        </div>

        <details style={{ marginTop: 10 }}>
          <summary className="mudo" style={{ cursor: 'pointer' }}>Ver prompt padrão (somente leitura)</summary>
          <pre
            className="mono"
            style={{ whiteSpace: 'pre-wrap', fontSize: 12, color: 'var(--texto-mudo)', marginTop: 10 }}
          >
            {cfg.system_prompt_padrao}
          </pre>
        </details>
      </div>
    </>
  );
}
