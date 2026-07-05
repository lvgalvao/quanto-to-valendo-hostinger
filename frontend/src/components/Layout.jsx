import { NavLink } from 'react-router-dom';
import { Smartphone, MessagesSquare, Settings as SettingsIcon } from 'lucide-react';

export default function Layout({ children, conexoesAtivas }) {
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          Quanto <span>Tô Valendo</span>
        </div>
        <div className="brand-sub">por Jornada de Dados</div>

        <NavLink to="/connections" className={({ isActive }) => 'nav-item' + (isActive ? ' ativo' : '')}>
          <Smartphone size={19} /> Conexões
        </NavLink>
        <NavLink to="/conversations" className={({ isActive }) => 'nav-item' + (isActive ? ' ativo' : '')}>
          <MessagesSquare size={19} /> Conversas
        </NavLink>
        <NavLink to="/settings" className={({ isActive }) => 'nav-item' + (isActive ? ' ativo' : '')}>
          <SettingsIcon size={19} /> Configurações
        </NavLink>

        <div className="sidebar-rodape">
          <span className="dot" />
          {conexoesAtivas} conexão(ões) ativa(s)
        </div>
      </aside>
      <main className="conteudo">{children}</main>
    </div>
  );
}
