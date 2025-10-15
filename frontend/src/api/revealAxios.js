// src/api/revealAxios.js
import axios from "axios";

const revealAxios = axios.create({
  baseURL: "/revealjsapi", // cambia al host/puerto de Flask
  withCredentials: true, // si tu backend maneja cookies httpOnly
});

export default revealAxios;
