import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { getSocket } from '../lib/socket.js';

function Toggle({ ativo, onChange }) {
  return (
    <label className="switch">
      <input type="checkbox" checked={ativo} onChange={(e) => onChange(e.target.checked)} />
      <span className="slider" />
    </label>
  );
}

export default function Conversations() {
  const [conversas, setConversas] = useState([]);
  const [selecionada, setSelecionada] = useState(null);
  const [mensagens, setMensagens] = useState([]);
  const msgsRef = useRef(null);

  async function carregarConversas() {
    const { data } = await api.get('/api/conversations');
    setConversas(data.conversas);
  }

  async function abrir(conversa) {
    setSelecionada(conversa);
    const { data } = await api.get(`/api/conversations/${conversa.id}/messages`);
    setMensagens(data.mensagens);
    setSelecionada(data.conversa);
  }

  useEffect(() => {
    carregarConversas();
    const socket = getSocket();
    const onUpdate = ({ conversaId }) => {
      carregarConversas();
      if (selecionada && conversaId === selecionada.id) abrir(selecionada);
    };
    socket.on('conversation_update', onUpdate);
    return () => socket.off('conversation_update', onUpdate);
  }, [selecionada?.id]);

  useEffect(() => {
    if (msgsRef.current) msgsRef.current.scrollTop = msgsRef.current.scrollHeight;
  }, [mensagens]);

  async function toggleAgente(ativo) {
    const { data } = await api.patch(`/api/conversations/${selecionada.id}`, { agente_ativo: ativo });
    setSelecionada(data);
    carregarConversas();
  }

  return (
    <>
      <div className="topo">
        <div>
          <h1>Conversas</h1>
          <div className="sub">Histórico em tempo real de quem falou com o agente.</div>
        </div>
      </div>
      <div className="split">
        <div className="lista-conversas">
          {conversas.length === 0 && <div className="vazio">Nenhuma conversa ainda.</div>}
          {conversas.map((c) => (
            <div
              key={c.id}
              className={'item-conversa' + (selecionada?.id === c.id ? ' ativo' : '')}
              onClick={() => abrir(c)}
            >
              <div className="nome">{c.nome_contato || c.remote_jid?.split('@')[0]}</div>
              <div className="previa">{c.ultima_mensagem || '—'}</div>
            </div>
          ))}
        </div>

        <div className="chat">
          {!selecionada ? (
            <div className="vazio" style={{ margin: 'auto' }}>Selecione uma conversa</div>
          ) : (
            <>
              <div className="chat-topo">
                <strong>{selecionada.nome_contato || selecionada.remote_jid?.split('@')[0]}</strong>
                <div className="linha-toggle">
                  <span className="mudo" style={{ fontSize: 12 }}>Agente ativo</span>
                  <Toggle ativo={!!selecionada.agente_ativo} onChange={toggleAgente} />
                </div>
              </div>
              <div className="chat-msgs" ref={msgsRef}>
                {mensagens.map((m) => (
                  <div key={m.id} className={`msg msg-${m.papel}`}>
                    {m.conteudo}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
