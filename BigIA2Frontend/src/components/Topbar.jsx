// src/components/Topbar.jsx
import React from "react";
import "./componentsStyles/Topbar.css";
import { useConfig } from "../context/ConfigContext";
import { useLocation } from "react-router-dom";
import { getPageTitle } from "../utils/pageTitles";

export default function Topbar({
  leftSlot,
  rightSlot,
  onBurger,
  isSidebarOpen = false,
}) {
  const { config } = useConfig();
  const brandTitle = config?.topbar_text || "BigIA 2.0";

  // Título central según la ruta actual
  const location = useLocation();
  const centerTitle = getPageTitle(location.pathname);

  return (
    <header
      className="topbar"
      role="banner"
      style={{ height: "var(--topbar-h, 68px)" }}
    >
      {/* Lado izquierdo: burger + título de marca (o slot custom) */}
      <div className="topbar-left">
        <button
          className="topbar-burger"
          aria-label={isSidebarOpen ? "Ocultar menú" : "Mostrar menú"}
          aria-controls="app-sidebar"
          aria-expanded={isSidebarOpen}
          onClick={onBurger}
          type="button"
        >
          <span className="burger-line" />
          <span className="burger-line" />
          <span className="burger-line" />
        </button>

        {leftSlot ?? <span className="topbar-title">{brandTitle}</span>}
      </div>

      {/* Centro: título de la página actual (si hay mapeo) */}
      {centerTitle ? (
        <div className="topbar-center" aria-live="polite">
          <h1 className="page-title">{centerTitle}</h1>
        </div>
      ) : null}

      {/* Lado derecho: acciones (usuario, tema, logout, etc.) */}
      <div className="topbar-right">{rightSlot}</div>
    </header>
  );
}
