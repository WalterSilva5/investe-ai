/**
 * Em desenvolvimento local, a API roda na porta 3000 da mesma máquina.
 * Usar o hostname atual permite acessar de outro dispositivo na LAN
 * (ex.: http://192.168.0.10:4200 → API em http://192.168.0.10:3000).
 */
const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';

export const API_BASE_URL = `http://${host}:3000/api`;
