// src/utils/favicon.js

/**
 * Cambia el favicon dinámicamente (p. ej. según color de marca o tema).
 * @param {string} color - Color principal (#RRGGBB) para aplicar al favicon.
 * @param {string} logoPath - Ruta del SVG original (por defecto /logoBigIA.svg)
 */
export function updateFavicon(color, logoPath = "/logoBigIA.svg") {
  try {
    const link = document.querySelector("link[rel~='icon']") || document.createElement("link");
    link.rel = "icon";
    link.type = "image/svg+xml";

    // Insertar el color en el SVG si se usa uno plano
    fetch(logoPath)
      .then((res) => res.text())
      .then((svgText) => {
        const colored = svgText.replace(/fill="[^"]*"/g, `fill="${color}"`);
        const blob = new Blob([colored], { type: "image/svg+xml" });
        const url = URL.createObjectURL(blob);
        link.href = url;
        document.head.appendChild(link);
      })
      .catch((err) => console.warn("Error actualizando favicon:", err));
  } catch (err) {
    console.warn("Error en updateFavicon:", err);
  }
}

/**
 * Restablece el favicon original
 */
export function resetFavicon(defaultPath = "/logoBigIA.svg") {
  try {
    const link = document.querySelector("link[rel~='icon']") || document.createElement("link");
    link.rel = "icon";
    link.href = defaultPath;
    document.head.appendChild(link);
  } catch (err) {
    console.warn("Error restaurando favicon:", err);
  }
}
