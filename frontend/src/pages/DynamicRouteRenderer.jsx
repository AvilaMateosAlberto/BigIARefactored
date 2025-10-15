// src/pages/DynamicRouteRenderer.jsx
import React from 'react';
import { useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import IframePage from './IframePage';

// === Páginas internas disponibles (ajusta según tu proyecto) ===
import HomePage from './HomePage';
import EndpointsManager from './EndpointsManager';
import SettingsPage from './SettingsPage';

// Normaliza: quita dobles barras, quita slash final (excepto "/"), minúsculas
function normalizePath(p) {
  if (!p) return '/';
  let x = ('/' + String(p).trim()).replace(/\/{2,}/g, '/');
  if (x.length > 1 && x.endsWith('/')) x = x.slice(0, -1);
  return x.toLowerCase();
}

// Mapa de rutas internas EXACTAS según la BBDD (tu columna "Ruta")
const INTERNAL_COMPONENTS = {
  '/inicio': HomePage,
  '/configuracion/personalizacion': SettingsPage,
  // Cuando tengas estas pantallas listas, descomenta/añade:
  // '/reportes': ReportPage,
  // '/configuracion/usuarios': UserManagement,
  // ...y cualquier otra interna que no sea iframe
};

// Aplana el árbol del menú (para buscar por route)
function flatten(nodes) {
  const out = [];
  const walk = (arr) => {
    for (const n of arr || []) {
      if (n.type === 'folder' && n.children?.length) {
        walk(n.children);
      } else {
        out.push(n);
      }
    }
  };
  walk(nodes || []);
  return out;
}

export default function DynamicRouteRenderer() {
  const { pathname } = useLocation();
  const { menu } = useApp();

  const path = normalizePath(pathname);
  const flat = flatten(menu);

  // Busca el item del menú cuya "route" coincida con el path actual
  const item = flat.find((it) => normalizePath(it.route) === path);

  if (!item) {
    return (
      <div style={{ padding: 16 }}>
        No encontrado: <code>{path}</code>
      </div>
    );
  }

  // Si el item tiene URL -> es un endpoint externo (Kibana, SOAR, dashboards...) => iframe
  if (item.url) {
    return <IframePage url={item.url} title={item.label} />;
  }

  // Si hay una página interna mapeada para este path -> renderízala
  const Comp = INTERNAL_COMPONENTS[path];
  if (Comp) {
    return <Comp />;
  }

  // No tiene URL ni página interna mapeada
  return (
    <div style={{ padding: 16 }}>
      La ruta <code>{path}</code> existe en el menú (<strong>{item.label}</strong>) pero no
      tiene <strong>URL</strong> ni <strong>página interna</strong> asignada.
      <br />
      • Si debe abrir un dashboard, añade la <strong>URL</strong> en el Gestor de Endpoints.
      <br />
      • Si debe ser una página interna, añádela al mapa <code>INTERNAL_COMPONENTS</code>.
    </div>
  );
}
