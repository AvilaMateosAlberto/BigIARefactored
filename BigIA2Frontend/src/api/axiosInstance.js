// src/api/axiosInstance.js
import axios from "axios";

const API_BASE = "/api";

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true, // necesario para enviar/recibir la cookie httpOnly del refresh
});

let accessToken = null;

export const setAccessToken = (token) => {
  accessToken = token;
  if (token) {
    localStorage.setItem("accessToken", token);
  } else {
    localStorage.removeItem("accessToken");
  }
};

api.interceptors.request.use((config) => {
  accessToken = localStorage.getItem("accessToken");
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

// (Opcional) Refresh automático en 401.
// Descomenta este bloque cuando quieras activarlo:
/*
let isRefreshing = false;
let queue = [];

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const { response, config } = error;
    if (!response) return Promise.reject(error);
    if (response.status !== 401 || config._retry) return Promise.reject(error);

    config._retry = true;

    if (!isRefreshing) {
      isRefreshing = true;
      try {
        const { data } = await api.post("/auth/refresh"); // usa cookie httpOnly
        setAccessToken(data.accessToken);
        queue.forEach((cb) => cb());
        queue = [];
        return api(config);
      } catch (e) {
        queue = [];
        window.dispatchEvent(new Event("sessionExpired"));
        return Promise.reject(e);
      } finally {
        isRefreshing = false;
      }
    }

    return new Promise((resolve) => {
      queue.push(() => resolve(api(config)));
    });
  }
);
*/

export default api;
