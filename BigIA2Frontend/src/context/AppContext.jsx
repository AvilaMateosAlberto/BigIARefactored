import { createContext, useContext, useState, useEffect } from "react";
import { applyBrand } from "../utils/themeClient";
import { updateFavicon } from "../utils/favicon";
import { getItem, setItem } from "../utils/storage";

const AppContext = createContext();
export const useApp = () => useContext(AppContext);

export function AppProvider({ children }) {
  const [config, setConfig] = useState({
    brand: "#c40000",
    title: "BigIA 2.0",
  });

  // ✅ Cuando cambie el color, se aplica a la app entera
  useEffect(() => {
    if (config?.brand) {
      applyBrand(config.brand);
      updateFavicon(config.brand);
      setItem("brand_color", config.brand);
    }
  }, [config.brand]);

  // ✅ Si ya había un color guardado en localStorage, lo aplica al inicio
  useEffect(() => {
    const savedColor = getItem("brand_color", false);
    if (savedColor) {
      setConfig((prev) => ({ ...prev, brand: savedColor }));
      applyBrand(savedColor);
    }
  }, []);

  // 📡 Simulación de carga desde el backend
  async function loadAppConfig() {
    try {
      const res = await fetch("/api/settings/public");
      const data = await res.json();
      setConfig((prev) => ({
        ...prev,
        brand: data.topbar_color,
        title: data.topbar_text,
      }));
    } catch (err) {
      console.warn("Error cargando configuración:", err);
    }
  }

  return (
    <AppContext.Provider value={{ config, setConfig, loadAppConfig }}>
      {children}
    </AppContext.Provider>
  );
}
