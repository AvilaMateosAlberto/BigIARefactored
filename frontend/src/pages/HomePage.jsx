// src/pages/HomePage.jsx
import React from "react";

export default function HomePage() {
  return (
    <section style={{ padding: 24 }}>
      <h1>🏠 Home</h1>
      <p>Layout con Topbar y Sidebar OK. (Placeholder sin contextos)</p>
      <ul style={{ marginTop: 12 }}>
        <li>Prueba el menú: Inicio / Endpoints / Ajustes</li>
        <li>El botón de logout te devuelve al login</li>
        <li>El toggle cambia el tema (light/dark)</li>
      </ul>
    </section>
  );
}
