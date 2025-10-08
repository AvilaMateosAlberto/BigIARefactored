// src/components/Topbar.jsx
import React from "react";
import "./componentsStyles/Topbar.css";

export default function Topbar({
  title = "BigIA 2.0",
  leftSlot,
  rightSlot,
  onBurger,
  isSidebarOpen = false,
}) {
  return (
    <header className="topbar" role="banner" style={{ height: "var(--topbar-h, 68px)" }}>
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
        {leftSlot ?? <span className="topbar-title">{title}</span>}
      </div>

      {/* Aquí entra todo lo del usuario, tema, logout */}
      <div className="topbar-right">{rightSlot}</div>
    </header>
  );
}

