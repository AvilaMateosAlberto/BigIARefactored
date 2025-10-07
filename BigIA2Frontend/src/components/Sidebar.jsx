import React from "react";
import "./componentsStyles/Sidebar.css";
import IconResolver from "./IconResolver";

/**
 * Sidebar navegable y accesible.
 * - menu: [{ id,label,route,icon, url? }]
 * - activePath: ruta activa (string)
 * - onNavigate(path): callback al seleccionar item
 * - collapsed: bool (móvil)
 * - onClose: cerrar en móvil
 */
export default function Sidebar({
  menu = [],
  activePath = "/",
  onNavigate,
  collapsed = false,
  onClose,
}) {
  const handleClick = (item) => {
    // Soportar items con URL externa en el futuro si quieres
    if (item.url) onNavigate?.(item.route ?? "/");
    else onNavigate?.(item.route);
    onClose?.();
  };

  return (
    <aside className={`sidebar ${collapsed ? "is-open" : ""}`} aria-label="Navegación lateral">
      <div className="sidebar-scroll">
        <nav className="sidebar-menu">
          {menu.map((item) => {
            const active = activePath === item.route;
            return (
              <button
                key={item.id ?? item.route}
                className={`sidebar-item ${active ? "active" : ""}`}
                onClick={() => handleClick(item)}
                aria-current={active ? "page" : undefined}
              >
                <IconResolver name={item.icon || "link"} size={18} />
                <span className="sidebar-label">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
