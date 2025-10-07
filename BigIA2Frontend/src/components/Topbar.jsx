import React from "react";
import "./componentsStyles/Topbar.css";

/**
 * Topbar simple y flexible.
 * - title: string a mostrar
 * - leftSlot: nodo opcional (logo, etc.)
 * - rightSlot: acciones (iconos, avatar…)
 * - onBurger: callback para abrir/cerrar sidebar en móvil
 */
export default function Topbar({ title = "BigIA 2.0", leftSlot, rightSlot, onBurger }) {
  return (
    <header className="topbar" role="banner">
      <div className="topbar-left">
        <button className="topbar-burger" aria-label="Abrir menú" onClick={onBurger}>
          <span className="topbar-burger-line" />
          <span className="topbar-burger-line" />
          <span className="topbar-burger-line" />
        </button>

        {leftSlot ?? <img src="/logoBigIA.svg" alt="" className="topbar-logo" />}
        <span className="topbar-title">{title}</span>
      </div>

      <div className="topbar-right">{rightSlot}</div>
    </header>
  );
}
