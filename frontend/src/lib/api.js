import axios from 'axios';
import { getToken, limparToken } from './auth.js';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const api = axios.create({ baseURL });

// Injeta o X-Admin-Token em toda chamada.
api.interceptors.request.use((config) => {
  const t = getToken();
  if (t) config.headers['X-Admin-Token'] = t;
  return config;
});

// Token expirado/inválido (ex.: ADMIN_TOKEN mudou no backend) => limpa e volta ao login.
api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      limparToken();
      if (typeof window !== 'undefined') window.location.reload();
    }
    return Promise.reject(err);
  }
);

// Valida um token batendo em /api/settings.
export async function validarToken(token) {
  try {
    await axios.get(`${baseURL}/api/settings`, { headers: { 'X-Admin-Token': token } });
    return true;
  } catch {
    return false;
  }
}
