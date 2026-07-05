import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Power, PowerOff, Trash2, Clock, MessageSquare, Bot, Users } from 'lucide-react';
import { api } from '../lib/api.js';
import { getSocket } from '../lib/socket.js';

const STATUS_BADGE = {
  open: { classe: 'badge-open', texto: 'Conectado' },
  qr: { classe: 'badge-qr', texto: 'Aguardando QR' },
  connecting: { classe: 'badge-qr', texto: 'Conectando' },
  close: { classe: 'badge-close', texto: 'Desconectado' },
};

/** Formata o uptime a partir de conectado_em (UTC do SQLite) até agora. */
function formatarUptime(conectadoEm, agora) {
  if (!conectadoEm) return '—';
  const inicio = new Date(conectadoEm.replace(' ', 'T') + 'Z').getTime();
  let s = Math.max(0, Math.floor((agora - inicio) / 1000));
  const d = Math.floor(s / 86400);
  s -= d * 86400;
  const h = Math.floor(s / 3600);
  s -= h * 3600;
  const m = Math.floor(s / 60);
  s -= m * 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default function Connections({ onMudou }) {
  const [conexoes, setConexoes] = useState([]);
  const [modalNova, setModalNova] = useState(false);
  const [nome, setNome] = useState('');
  const [qr, setQr] = useState(null); // { connectionId, dataUrl }
  const [agora, setAgora] = useState(Date.now()); // tick para o uptime ao vivo

  async function carregar() {
    const { data } = await api.get('/api/connections');
    setConexoes(data);
    onMudou?.();
  }

  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    carregar();
    const socket = getSocket();
    const onStatus = ({ connectionId, status }) => {
      setConexoes((prev) => prev.map((c) => (c.id === connectionId ? { ...c, status } : c)));
      if (status === 'open') {
        setQr((q) => (q?.connectionId === connectionId ? null : q));
        toast.success('Conexão estabelecida!');
      }
      if (status === 'close') {
        setQr((q) => (q?.connectionId === connectionId ? null : q));
      }
      onMudou?.();
    };
    const onQr = ({ connectionId, qr: dataUrl }) => setQr({ connectionId, dataUrl });
    const onConversa = () => carregar(); // atualiza contadores de mensagens
    socket.on('connection_status', onStatus);
    socket.on('qr_update', onQr);
    socket.on('conversation_update', onConversa);
    return () => {
      socket.off('connection_status', onStatus);
      socket.off('qr_update', onQr);
      socket.off('conversation_update', onConversa);
    };
  }, []);

  async function criar(e) {
    e.preventDefault();
    if (!nome.trim()) return;
    await api.post('/api/connections', { nome: nome.trim() });
    setNome('');
    setModalNova(false);
    carregar();
  }

  async function conectar(id) {
    await api.post(`/api/connections/${id}/connect`);
    toast('Gerando QR Code...');
  }
  async function desconectar(id) {
    await api.post(`/api/connections/${id}/disconnect`);
  }
  async function excluir(id) {
    if (!confirm('Excluir esta conexão e limpar a sessão?')) return;
    await api.delete(`/api/connections/${id}`);
    carregar();
  }

  return (
    <>
      <div className="topo">
        <div>
          <h1>Conexões</h1>
          <div className="sub">Números de WhatsApp conectados ao agente.</div>
        </div>
        <button className="btn-primary" onClick={() => setModalNova(true)}>
          <Plus size={17} /> Nova Conexão
        </button>
      </div>

      {conexoes.length === 0 && <div className="vazio">Nenhuma conexão ainda. Crie a primeira.</div>}

      <div className="grid">
        {conexoes.map((c) => {
          const b = STATUS_BADGE[c.status] || STATUS_BADGE.close;
          return (
            <div className="card" key={c.id}>
              <h3>{c.nome}</h3>
              <div className="numero">{c.numero || 'sem número'}</div>
              <span className={`badge ${b.classe}`}>
                <span className="dot" /> {b.texto}
              </span>

              <div className="card-stats">
                <div className="stat">
                  <Clock size={17} />
                  <div>
                    <div className="v">{c.status === 'open' ? formatarUptime(c.conectado_em, agora) : '—'}</div>
                    <div className="l">ativo</div>
                  </div>
                </div>
                <div className="stat">
                  <Users size={17} />
                  <div>
                    <div className="v">{c.total_conversas ?? 0}</div>
                    <div className="l">contatos</div>
                  </div>
                </div>
                <div className="stat">
                  <MessageSquare size={17} />
                  <div>
                    <div className="v">{c.msgs_recebidas ?? 0}</div>
                    <div className="l">recebidas</div>
                  </div>
                </div>
                <div className="stat">
                  <Bot size={17} />
                  <div>
                    <div className="v">{c.msgs_agente ?? 0}</div>
                    <div className="l">respostas</div>
                  </div>
                </div>
              </div>

              <div className="card-acoes">
                {c.status === 'close' ? (
                  <button className="btn-verde" onClick={() => conectar(c.id)}>
                    <Power size={14} style={{ verticalAlign: '-2px', marginRight: 5 }} /> Conectar
                  </button>
                ) : (
                  <button className="btn-ghost" onClick={() => desconectar(c.id)}>
                    <PowerOff size={14} style={{ verticalAlign: '-2px', marginRight: 5 }} />
                    {c.status === 'open' ? ' Desconectar' : ' Cancelar'}
                  </button>
                )}
                <button className="btn-perigo" onClick={() => excluir(c.id)} title="Remove a conexão e apaga a sessão">
                  <Trash2 size={14} style={{ verticalAlign: '-2px', marginRight: 5 }} /> Excluir
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {modalNova && (
        <div className="overlay" onClick={() => setModalNova(false)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={criar}>
            <h2>Nova Conexão</h2>
            <div className="campo">
              <label>Nome da conexão</label>
              <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Número principal" autoFocus />
            </div>
            <div className="modal-acoes">
              <button type="button" className="btn-ghost" onClick={() => setModalNova(false)}>
                Cancelar
              </button>
              <button className="btn-primary">Criar</button>
            </div>
          </form>
        </div>
      )}

      {qr && (
        <div className="overlay" onClick={() => setQr(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Escaneie no WhatsApp</h2>
            <div className="qr-wrap">
              <img src={qr.dataUrl} alt="QR Code" />
            </div>
            <p className="mudo" style={{ marginTop: 16, fontSize: 12.5 }}>
              WhatsApp › Aparelhos conectados › Conectar aparelho
            </p>
          </div>
        </div>
      )}
    </>
  );
}
