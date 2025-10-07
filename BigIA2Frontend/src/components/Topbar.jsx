import React from "react";
import "./componentsStyles/Topbar.css";
import IconResolver from "./IconResolver";

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

      <div className="topbar-right">
        {/* Pill de usuario con icono + nombre (lista para ampliar con rol/menú) */}
        <div className="user-pill" title="Usuario">
          <span className="user-icon" aria-hidden="true">
            <IconResolver name="user" size={16} />
          </span>
          <span className="user-name">admin</span>
        </div>

        {rightSlot /* aquí van sol/luna y logout como ya tienes */}
      </div>
    </header>
  );
}
