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
// let isRefreshing = false;
// let queue = [];

// api.interceptors.response.use(
//   (res) => res,
//   async (error) => {
//     const { response, config } = error;
//     if (!response) return Promise.reject(error);
//     if (response.status !== 401 || config._retry) return Promise.reject(error);

//     config._retry = true;

//     if (!isRefreshing) {
//       isRefreshing = true;

//       try {
//         const { data } = await api.post("/auth/refresh"); // cookie httpOnly
//         setAccessToken(data.accessToken);

//         // resolvemos todas las promesas pendientes
//         queue.forEach(({ resolve }) => resolve());
//         queue = [];

//         return api(config);
//       } catch (e) {
//         // rechazamos todas las promesas pendientes
//         queue.forEach(({ reject }) => reject(e));
//         queue = [];

//         window.dispatchEvent(new Event("sessionExpired"));
//         return Promise.reject(e);
//       } finally {
//         isRefreshing = false;
//       }
//     }

//     // Si ya hay un refresh en curso, devolvemos promesa que se resolverá o rechazará después
//     return new Promise((resolve, reject) => {
//       queue.push({
//         resolve: () => resolve(api(config)),
//         reject: (err) => reject(err),
//       });
//     });
//   }
// );




export default api;
