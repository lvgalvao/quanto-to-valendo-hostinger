import { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login.jsx';
import Layout from './components/Layout.jsx';
import Connections from './pages/Connections.jsx';
import Conversations from './pages/Conversations.jsx';
import Settings from './pages/Settings.jsx';
import { temToken } from './lib/auth.js';
import { conectarSocket } from './lib/socket.js';
import { api } from './lib/api.js';

export default function App() {
  const [logado, setLogado] = useState(temToken());
  const [conexoesAtivas, setConexoesAtivas] = useState(0);

  async function atualizarContador() {
    try {
      const { data } = await api.get('/api/connections');
      setConexoesAtivas(data.filter((c) => c.status === 'open').length);
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    if (!logado) return;
    conectarSocket();
    atualizarContador();
    const socket = conectarSocket();
    socket.on('connection_status', atualizarContador);
    return () => socket.off('connection_status', atualizarContador);
  }, [logado]);

  if (!logado) return <Login onEntrar={() => setLogado(true)} />;

  return (
    <Layout conexoesAtivas={conexoesAtivas}>
      <Routes>
        <Route path="/connections" element={<Connections onMudou={atualizarContador} />} />
        <Route path="/conversations" element={<Conversations />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/connections" replace />} />
      </Routes>
    </Layout>
  );
}
