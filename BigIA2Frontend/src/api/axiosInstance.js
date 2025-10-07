// src/api/axiosInstance.js
import axios from 'axios';

let ACCESS_TOKEN = null;
let refreshPromise = null;

export function setAccessToken(token) {
  ACCESS_TOKEN = token || null;
}

export function getAccessToken() {
  return ACCESS_TOKEN;
}

const axiosInstance = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,                // <- envía cookie httpOnly 'rt'
});

// Interceptor de request: mete el access si lo hay (memoria)
axiosInstance.interceptors.request.use(
  (config) => {
    const token = getAccessToken();
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    } else {
      // Asegura que no queda un header viejo
      if (config.headers?.Authorization) delete config.headers.Authorization;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Cliente sin interceptores para /auth/refresh
const refreshClient = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// Interceptor de respuesta: auto-refresh una vez y reintenta
axiosInstance.interceptors.response.use(
  (resp) => resp,
  async (error) => {
    const { response, config } = error || {};
    const status = response?.status || 0;
    const url = String(config?.url || '');

    // No intentes refrescar si el 401 viene de refresh/logout
    const isAuthOp = /\/auth\/refresh$|\/auth\/logout$/.test(url);

    if (status === 401 && !isAuthOp && !config._retry) {
      config._retry = true;

      try {
        // Evita tormenta de refresh en la misma pestaña
        refreshPromise = refreshPromise || refreshClient.post('/auth/refresh');
        const { data } = await refreshPromise.finally(() => { refreshPromise = null; });

        setAccessToken(data.accessToken);
        // Reintenta el original con el nuevo token
        return axiosInstance(config);
      } catch (e) {
        // Avisar a la app para que limpie sesión
        window.dispatchEvent(new Event('sessionExpired'));
      }
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;
