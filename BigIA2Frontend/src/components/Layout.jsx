// src/components/Layout.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import Topbar from "./Topbar";
import Sidebar from "./Sidebar";

export default function Layout({
  title = "BigIA 2.0",
  menu = [],              // árbol: [{ id, type:'folder'|'page', label, route?, icon?, children? }, ...]
  rightSlot,
  leftSlot,
  onNavigate: onNavigateProp,
  activePath: activePathProp,
  children,
}) {
  const navigate = useNavigate();
  const location = useLocation();

  // Sidebar oculto por defecto
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Path activo (si no pasa activePath por props, usa router)
  const activePath = useMemo(() => {
    if (activePathProp) return activePathProp;
    return location.pathname || "/";
  }, [activePathProp, location.pathname]);

  const onNavigate = (path) => {
    if (!path) return;
    if (onNavigateProp) onNavigateProp(path);
    else navigate(path);
  };

  // Cerrar el sidebar al cambiar de ruta
  useEffect(() => {
    if (sidebarOpen) setSidebarOpen(false);
  }, [activePath]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      className="appshell"
      // variables compartidas (asegúrate de usarlas también en CSS)
      style={{ "--sidebar-w": "clamp(180px, 20vw, 280px)", "--topbar-h": "68px" }}
    >
      <Topbar
        title={title}
        leftSlot={leftSlot}
        rightSlot={rightSlot}
        isSidebarOpen={sidebarOpen}
        onBurger={() => setSidebarOpen((s) => !s)}
      />

      {/* Backdrop móvil cuando el sidebar está abierto */}
      {sidebarOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Área bajo la topbar. Cuando el menú está abierto, en desktop se desplaza */}
      <div
        className={`appshell-main ${sidebarOpen ? "appshell-main--shift" : ""}`}
        style={{ display: "flex", minHeight: "calc(100svh - var(--topbar-h))" }}
      >
        <Sidebar
          tree={menu}
          activePath={activePath}
          onNavigate={onNavigate}
          collapsed={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        <main className="appshell-content" role="main" style={{ flex: 1 }}>
          {children || <Outlet />}
        </main>
      </div>
    </div>
  );
}
