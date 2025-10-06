// src/pages/HomePage.jsx
import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';

function firstLink(nodes) {
  for (const n of nodes || []) {
    if (n.type === 'link' && n.route) return n.route;
    if (n.type === 'folder' && n.children?.length) {
      const found = firstLink(n.children);
      if (found) return found;
    }
  }
  return null;
}

export default function HomePage() {
  const { menu } = useApp();
  const navigate = useNavigate();

  const first = useMemo(() => firstLink(menu), [menu]);

  return (
    <div style={{ padding: 24 }}>
      <h2>Bienvenido a BigIA 2.0</h2>
      <p>Usa el menú lateral para navegar por las páginas y dashboards.</p>
    </div>
  );
}
