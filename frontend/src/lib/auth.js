// Token de admin: persistido no localStorage para sobreviver a refresh/reabertura
// da aba (antes ficava só em memória e a sessão do painel se perdia).
const KEY = 'qtv_admin_token';

let token = null;
try {
  token = localStorage.getItem(KEY) || null;
} catch {
  token = null;
}

export function setToken(t) {
  token = t;
  try {
    localStorage.setItem(KEY, t);
  } catch {
    /* localStorage indisponível — segue só em memória */
  }
}
export function getToken() {
  return token;
}
export function temToken() {
  return !!token;
}
export function limparToken() {
  token = null;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
}
