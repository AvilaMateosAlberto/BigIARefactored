// src/utils/pageTitles.js
export const PAGE_TITLES = {
  "/home": "Inicio",
  "/users": "Gestión de usuarios",
  "/settings": "Configuración",
  "/endpoints": "Gestión de endpoints",
  "/dashboards": "Dashboards",
  "/reportes": "Reportes",
  "/configuracion/endpoints": "Gestión de endpoints",
  "/configuracion": "Configuración general",
};

export function getPageTitle(pathname = "") {
  // si no hay coincidencia exacta, intenta parcial
  const exact = PAGE_TITLES[pathname];
  if (exact) return exact;

  const partial = Object.entries(PAGE_TITLES).find(([key]) =>
    pathname.startsWith(key)
  );
  return partial ? partial[1] : "";
}
