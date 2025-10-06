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
    document.documentElement.style.setProperty("--brand", hex);
    document.documentElement.style.setProperty("--on-primary", getOnPrimary(hex));
    localStorage.setItem("brand_color", hex);
  } catch (e) {
    console.warn("Error aplicando color de marca:", e);
  }
}

// === Cambia tema claro/oscuro manualmente (opcional más adelante) ===
export function setTheme(mode) {
  const root = document.documentElement;
  root.setAttribute("data-theme", mode);
  root.style.colorScheme = mode; // sincroniza scrollbars/inputs
  localStorage.setItem("pref_theme", mode);
}
