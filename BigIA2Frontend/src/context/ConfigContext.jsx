// src/context/ConfigContext.jsx
import { createContext, useContext, useEffect, useState } from "react";
import api from "../api/axiosInstance";
import { getItem, setItem } from "../utils/storage";

const ConfigContext = createContext();

export function ConfigProvider({ children }) {
  // Leer de localStorage primero
  const storedConfig = getItem("config") || null;

  const [config, setConfig] = useState(storedConfig);
  const [loading, setLoading] = useState(true);

  // Función para actualizar config y persistir
  const updateConfig = (nextConfig) => {
    const merged = { ...config, ...nextConfig };
    setConfig(merged);
    setItem("config", merged);
  };

  // Helpers de color/contraste
  const hexToRgb = (hex) => {
    if (!hex) return [196, 0, 0];
    const h = hex.replace("#", "");
    const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.padStart(6, "0");
    const n = (i) => parseInt(full.slice(i, i + 2), 16);
    return [n(0), n(2), n(4)];
  };

  const relLuminance = ([r, g, b]) => {
    const f = (u) => (u <= 0.03928 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4));
    const [R, G, B] = [f(r), f(g), f(b)];
    return 0.2126 * R + 0.7152 * G + 0.0722 * B;
  };

  // Aplicar configuración visual
  useEffect(() => {
    if (!config) return;

    // Título del documento
    if (config.document_title) document.title = config.document_title;

    // Colores
    const color = config.topbar_color || "#c40000";
    const root = document.documentElement;
    root.style.setProperty("--topbar-bg", color);
    root.style.setProperty("--primary", color);

    const fg = relLuminance(hexToRgb(color)) > 0.5 ? "#111111" : "#ffffff";
    root.style.setProperty("--topbar-fg", fg);

    // Modo tema
    const mode = config.theme_mode === "dark" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", mode);
  }, [config]);

  // Cargar config desde endpoint si no existe en localStorage
  useEffect(() => {
    if (storedConfig) {
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const { data } = await api.get("/settings/public");
        setConfig(data);
        setItem("config", data);
      } catch (err) {
        console.error("Error cargando configuración pública:", err);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ConfigContext.Provider value={{ config, updateConfig, loading }}>
      {children}
    </ConfigContext.Provider>
  );
}

export const useConfig = () => useContext(ConfigContext);
