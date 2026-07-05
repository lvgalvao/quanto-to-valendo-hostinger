// Token de admin guardado apenas em memória (perde no refresh — re-login).
let token = null;

export function setToken(t) {
  token = t;
}
export function getToken() {
  return token;
}
export function temToken() {
  return !!token;
}
export function limparToken() {
  token = null;
}
