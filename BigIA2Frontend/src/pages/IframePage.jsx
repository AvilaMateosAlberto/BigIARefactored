import React from "react";
import "./pagesStyles/IframePage.css";

/**
 * Componente que renderiza una página con un iframe a pantalla completa.
 * Puede usarse para mostrar reportes, dashboards, o cualquier vista embebida.
 */
export default function IframePage({ url, title }) {
  // Si no hay URL, mostramos un mensaje de placeholder (mejor UX que null)
  if (!url) {
    return (
      <div className="iframe-empty">
        <p>No hay contenido para mostrar.</p>
      </div>
    );
  }

  return (
    <div className="iframe-container">
      <iframe
        src={url}
        title={title || "Embedded"}
        className="iframe-embedded"
        frameBorder="0"
        // sandbox controlado por seguridad: lo necesario para dashboards o apps embebidas
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
        allow="fullscreen; clipboard-read; clipboard-write"
      />
    </div>
  );
}
