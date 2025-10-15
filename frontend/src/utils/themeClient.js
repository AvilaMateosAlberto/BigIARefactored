// src/utils/themeClient.js

// === Helpers ===
function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return { r: 196, g: 0, b: 0 }; // fallback rojo
  return {
    r: parseInt(m[1], 16),
    g: parseInt(m[2], 16),
    b: parseInt(m[3], 16)
  };
}

function getOnPrimary(hex) {
  const { r, g, b } = hexToRgb(hex);
  const luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luma < 0.5 ? "#fff" : "#000";
}

// === Aplica el color corporativo globalmente ===
export function applyBrand(hex) {
  try {
    const on = getOnPrimary(hex);
    const root = document.documentElement;
    root.style.setProperty("--brand", hex);
    root.style.setProperty("--topbar-bg", hex);     // asegura topbar = brand
    root.style.setProperty("--on-primary", on);     // texto legible sobre brand
    localStorage.setItem("brand_color", hex);
  } catch (e) {
    console.warn("Error aplicando color de marca:", e);
  }
}

// === Cambia tema claro/oscuro manualmente ===
export function setTheme(mode) {
  const root = document.documentElement;
  root.setAttribute("data-theme", mode);
  root.style.colorScheme = mode; // sincroniza scrollbars/inputs
  localStorage.setItem("pref_theme", mode);
}

// === Inicializa tema y marca desde localStorage (llámalo una vez al boot) ===
export function initThemeFromStorage() {
  try {
    const brand = localStorage.getItem("brand_color");
    if (brand) applyBrand(brand);

    const pref = localStorage.getItem("pref_theme");
    if (pref === "light" || pref === "dark") setTheme(pref);
  } catch {}
}
