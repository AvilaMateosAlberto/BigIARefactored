// src/pages/DynamicRouteRenderer.jsx
import React from 'react';
import { useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import IframePage from '../pages/IframePage'; // usa tu componente existente

// Aplana el árbol del menú
function flatten(nodes) {
  const out = [];
  const walk = (arr) => {
    for (const n of arr || []) {
      if (n.type === 'folder' && n.children) walk(n.children);
      else out.push(n);
    }
  };
  walk(nodes || []);
  return out;
}

export default function DynamicRouteRenderer() {
  const { pathname } = useLocation();
  const { menu } = useApp();

  const flat = flatten(menu);
  const item = flat.find((it) => it.route === pathname);

  if (!item) {
    return <div style={{ padding: 16 }}>No encontrado.</div>;
  }

  // Si tiene URL -> iframe (Kibana, etc.)
  if (item.url) {
    return <IframePage url={item.url} />;
  }

  // Si no tiene URL y no es una ruta interna declarada en App.jsx:
  return (
    <div style={{ padding: 16 }}>
      Esta ruta existe en el menú pero no tiene URL asignada ni corresponde a una
      página interna. Asigna una <strong>URL</strong> en el Gestor de Endpoints o
      crea una ruta interna en <code>src/App.jsx</code>.
    </div>
  );
}
