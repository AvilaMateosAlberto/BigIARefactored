// src/context/ConfigContext.jsx
import { createContext, useContext, useEffect, useState } from "react";
import api from "../api/axiosInstance";
import { getItem, setItem } from "../utils/storage";
import { applyBranding } from "../utils/favicon";

const ConfigContext = createContext();

/**
 * Guardamos la config en localStorage bajo la clave "config" (compat con tu proyecto).
 * Cuando cambia, aplicamos branding visual (favicon/mask-icon/theme-color/splash vars)
 * y algunas CSS vars de uso interno (--topbar-bg, --primary, --on-primary).
 */
export function ConfigProvider({ children }) {
  // 1) Leer config cacheada primero (no bloquea el pintado)
  const storedConfig = getItem("config") || null;

  const [config, setConfig] = useState(storedConfig);
  const [loading, setLoading] = useState(true);

  // ------- Helpers color/contraste (para --on-primary) -------
  const hexToRgb = (hex) => {
    if (!hex) return [196, 0, 0];
    const h = hex.replace("#", "").trim();
    const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.padStart(6, "0");
    const n = (i) => parseInt(full.slice(i, i + 2), 16);
    return [n(0), n(2), n(4)];
  };

  const relLuminance = ([r, g, b]) => {
    const f = (u) => {
      u /= 255;
      return u <= 0.03928 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4);
    };
    const [R, G, B] = [f(r), f(g), f(b)];
    return 0.2126 * R + 0.7152 * G + 0.0722 * B;
  };

  // ------- Setter + persistencia -------
  const updateConfig = (nextConfig) => {
    const merged = { ...config, ...nextConfig };
    setConfig(merged);
    setItem("config", merged);
  };

  // ------- Efecto: aplicar configuración visual cuando cambia -------
  useEffect(() => {
    if (!config) return;

    // Título del documento (si lo traes de /settings/public)
    if (config.document_title) document.title = config.document_title;

    // Color de marca
    const color = config.topbar_color || "#c40000";

    // 1) Util centralizado: favicon (recoloreado), mask-icon, theme-color y vars del splash
    applyBranding(color, "/logoBigIA.svg");

    // 2) CSS vars internas que ya usas en componentes
    const root = document.documentElement;
    root.style.setProperty("--topbar-bg", color);
    root.style.setProperty("--primary", color);
    // --brand la setea applyBranding; la dejamos redundante por compat
    root.style.setProperty("--brand", color);

    // 3) Contraste para textos/botones sobre color primario
    const fg = relLuminance(hexToRgb(color)) > 0.5 ? "#000000ff" : "#ffffffff";
    root.style.setProperty("--on-primary", fg);
  }, [config]);

  // ------- Cargar config del backend si no hay cache -------
  useEffect(() => {
    if (storedConfig) {
      setLoading(false);
      return;
    }

    (async () => {
      try {
        // endpoint público ya existente en tu backend
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
