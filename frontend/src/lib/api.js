import axios from 'axios';
import { getToken } from './auth.js';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const api = axios.create({ baseURL });

// Injeta o X-Admin-Token em toda chamada.
api.interceptors.request.use((config) => {
  const t = getToken();
  if (t) config.headers['X-Admin-Token'] = t;
  return config;
});

// Valida um token batendo em /api/settings.
export async function validarToken(token) {
  try {
    await axios.get(`${baseURL}/api/settings`, { headers: { 'X-Admin-Token': token } });
    return true;
  } catch {
    return false;
  }
}
