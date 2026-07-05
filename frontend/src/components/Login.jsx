import { useState } from 'react';
import toast from 'react-hot-toast';
import { validarToken } from '../lib/api.js';
import { setToken } from '../lib/auth.js';

export default function Login({ onEntrar }) {
  const [valor, setValor] = useState('');
  const [carregando, setCarregando] = useState(false);

  async function entrar(e) {
    e.preventDefault();
    if (!valor.trim()) return;
    setCarregando(true);
    const ok = await validarToken(valor.trim());
    setCarregando(false);
    if (ok) {
      setToken(valor.trim());
      onEntrar();
    } else {
      toast.error('Token inválido');
    }
  }

  return (
    <div className="login-tela">
      <form className="login-box" onSubmit={entrar}>
        <div className="brand">
          Quanto <span>Tô Valendo</span>
        </div>
        <div className="brand-sub">por Jornada de Dados</div>
        <div className="campo-form">
          <label>Admin token</label>
          <input
            type="password"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder="cole seu ADMIN_TOKEN"
            autoFocus
          />
        </div>
        <button className="btn-primary btn-lg btn-block" disabled={carregando}>
          {carregando ? 'Verificando...' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
